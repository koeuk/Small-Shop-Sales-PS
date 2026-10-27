import hashlib
import json
import math
import os
import threading
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

import joblib
import numpy as np
import sklearn
from fastapi import HTTPException
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, root_mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sqlalchemy import func, select

from .config import settings
from .models import DataImport, MLModel, Sale

TRAINING_LOCK = threading.Lock()
ALGORITHMS = {"historical_average": "Historical average", "seasonal_naive": "Previous week", "linear_regression": "Linear regression", "random_forest": "Random forest"}
FEATURES = ["weekday_sin", "weekday_cos", "month_sin", "month_cos", "weekend", "lag_1", "lag_7", "lag_14", "trailing_7_mean", "day_index"]


def daily_history(session, owner_id):
    today = datetime.now(settings.timezone).date()
    rows = session.execute(select(Sale.sale_date, func.sum(Sale.total_amount)).where(Sale.owner_id == owner_id, Sale.sale_date < today).group_by(Sale.sale_date).order_by(Sale.sale_date)).all()
    return [(day, float(total)) for day, total in rows]


def fingerprint(rows):
    return hashlib.sha256(json.dumps([(day.isoformat(), round(value, 2)) for day, value in rows], separators=(",", ":")).encode()).hexdigest()


def dataset_quality(session, owner_id):
    rows = daily_history(session, owner_id)
    known = dict(rows)
    missing = []
    calendar_days = (rows[-1][0] - rows[0][0]).days + 1 if rows else 0
    if rows:
        day = rows[0][0]
        while day <= rows[-1][0] and len(missing) < 100:
            if day not in known:
                missing.append(day.isoformat())
            day += timedelta(days=1)
    synthetic = bool(session.scalar(select(func.count()).select_from(Sale).join(DataImport, Sale.import_id == DataImport.id).where(Sale.owner_id == owner_id, DataImport.synthetic.is_(True))))
    return {
        "observed_days": len(rows), "calendar_days": calendar_days,
        "start_date": rows[0][0] if rows else None, "end_date": rows[-1][0] if rows else None,
        "missing_days": calendar_days - len(rows), "missing_dates": missing, "minimum_days": 90,
        "synthetic": synthetic, "fingerprint": fingerprint(rows),
        "daily": [{"date": day, "revenue": value} for day, value in rows],
        "note": "Today's sales are excluded from training because the day may be incomplete.",
    }


def prepare_series(rows, policy):
    if not rows:
        raise HTTPException(422, "Add at least 90 calendar days of historical sales before training")
    if (rows[-1][0] - rows[0][0]).days > 3650:
        raise HTTPException(422, "Training is limited to ten years of daily history")
    known = dict(rows)
    dates, values = [], []
    day = rows[0][0]
    while day <= rows[-1][0]:
        if day not in known and policy == "reject":
            raise HTTPException(422, "History contains missing dates. Complete the records or explicitly confirm zero-sales days.")
        dates.append(day)
        values.append(known.get(day, 0.0))
        day += timedelta(days=1)
    if len(values) < 90 or len(rows) < 60:
        raise HTTPException(422, "Training needs at least 90 calendar days and 60 observed sales days. Add more history.")
    return dates, values


def features(day, history, index):
    return [math.sin(2 * math.pi * day.weekday() / 7), math.cos(2 * math.pi * day.weekday() / 7), math.sin(2 * math.pi * day.month / 12), math.cos(2 * math.pi * day.month / 12), float(day.weekday() >= 5), history[-1], history[-7], history[-14], float(np.mean(history[-7:])), index]


def fit_algorithm(algorithm, dates, values):
    if algorithm == "historical_average":
        return float(np.mean(values))
    if algorithm == "seasonal_naive":
        return None
    x = [features(dates[index], values[:index], index) for index in range(14, len(values))]
    estimator = make_pipeline(StandardScaler(), LinearRegression()) if algorithm == "linear_regression" else RandomForestRegressor(n_estimators=100, min_samples_leaf=3, max_depth=10, random_state=42, n_jobs=1)
    estimator.fit(x, values[14:])
    return estimator


def recursive_predict(algorithm, estimator, history, dates, index):
    context = list(history)
    predictions = []
    for offset, day in enumerate(dates):
        if algorithm == "historical_average":
            value = estimator
        elif algorithm == "seasonal_naive":
            value = context[-7]
        else:
            value = float(estimator.predict([features(day, context, index + offset)])[0])
        if not math.isfinite(value):
            raise HTTPException(422, "Model produced a non-finite forecast. Review the dataset and retrain.")
        value = max(0.0, float(value))
        if value > 9_999_999_999.99:
            raise HTTPException(422, "Forecast exceeds the supported revenue range. Review unusual sales values.")
        predictions.append(value)
        context.append(value)
    return predictions


def evaluate(algorithm, estimator, dates, values, start, end):
    predictions = []
    # Actual observations become available only between successive seven-day origins.
    # Within each block, all lag features use earlier predictions, never future actuals.
    for origin in range(start, end, 7):
        predictions.extend(recursive_predict(algorithm, estimator, values[:origin], dates[origin:min(origin + 7, end)], origin))
    actual = values[start:end]
    return {
        "mae": float(mean_absolute_error(actual, predictions)),
        "rmse": float(root_mean_squared_error(actual, predictions)),
        "wape": float(sum(abs(a - p) for a, p in zip(actual, predictions)) / sum(actual) * 100) if sum(actual) else None,
        "points": [{"date": day.isoformat(), "actual": a, "predicted": round(p, 2)} for day, a, p in zip(dates[start:end], actual, predictions)],
    }


def train_models(session, owner_id, policy):
    source = daily_history(session, owner_id)
    dates, values = prepare_series(source, policy)
    quality = dataset_quality(session, owner_id)
    n = len(values)
    train_end, validation_end = int(n * 0.70), int(n * 0.85)
    batch_id = str(uuid4())
    validation = {}
    for algorithm in ALGORITHMS:
        estimator = fit_algorithm(algorithm, dates[:train_end], values[:train_end])
        validation[algorithm] = evaluate(algorithm, estimator, dates, values, train_end, validation_end)
    winner = min(validation, key=lambda name: validation[name]["mae"])
    directory = settings.artifact_dir / owner_id
    directory.mkdir(parents=True, exist_ok=True)
    created = []
    records = []
    try:
        for algorithm, label in ALGORITHMS.items():
            test_estimator = fit_algorithm(algorithm, dates[:validation_end], values[:validation_end])
            test = evaluate(algorithm, test_estimator, dates, values, validation_end, n)
            deployed = fit_algorithm(algorithm, dates, values)
            model_id = str(uuid4())
            path = directory / f"{model_id}.joblib"
            temporary = path.with_suffix(".tmp")
            artifact = {"algorithm": algorithm, "estimator": deployed, "history": values, "start_date": dates[0].isoformat(), "end_date": dates[-1].isoformat(), "fingerprint": fingerprint(source), "missing_policy": policy}
            joblib.dump(artifact, temporary)
            os.replace(temporary, path)
            created.append(path)
            metadata = {
                "batch_id": batch_id, "recommended": algorithm == winner, "validation_mae": validation[algorithm]["mae"], "validation_rmse": validation[algorithm]["rmse"],
                "test_wape": test["wape"], "test_points": test["points"], "synthetic": quality["synthetic"], "missing_policy": policy, "filled_days": quality["missing_days"],
                "fingerprint": fingerprint(source), "artifact_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "observed_days": len(source), "calendar_days": n, "random_seed": 42, "sklearn_version": sklearn.__version__, "features": FEATURES,
                "evaluation": "Rolling origins in seven-day recursive blocks; no actual values inside a forecast block.",
                "strategy": "Recursive seven-day forecast; negative outputs are clamped to zero.",
                "splits": {"train": [dates[0].isoformat(), dates[train_end - 1].isoformat()], "validation": [dates[train_end].isoformat(), dates[validation_end - 1].isoformat()], "test": [dates[validation_end].isoformat(), dates[-1].isoformat()]},
            }
            record = MLModel(id=model_id, owner_id=owner_id, model_name=label, algorithm=algorithm, training_start_date=dates[0], training_end_date=dates[-1], mae=test["mae"], rmse=test["rmse"], model_path=str(path), metadata_json=metadata)
            session.add(record)
            records.append(record)
        session.flush()
        return records
    except Exception:
        for path in created:
            path.unlink(missing_ok=True)
        raise


def forecast_values(session, owner_id, model):
    path = Path(model.model_path).resolve()
    trusted = (settings.artifact_dir / owner_id / f"{model.id}.joblib").resolve()
    if path != trusted or not path.is_file():
        raise HTTPException(409, "Model artifact is unavailable; retrain this model")
    if hashlib.sha256(path.read_bytes()).hexdigest() != model.metadata_json["artifact_sha256"]:
        raise HTTPException(409, "Model artifact integrity check failed; retrain")
    source = daily_history(session, owner_id)
    if fingerprint(source) != model.metadata_json["fingerprint"]:
        raise HTTPException(409, "Sales history has changed since training. Retrain before generating a forecast.")
    artifact = joblib.load(path)
    today = datetime.now(settings.timezone).date()
    last = source[-1][0]
    if (today - last).days > 7:
        raise HTTPException(422, "Latest sales are more than seven days old. Add recent records and retrain.")
    start = today + timedelta(days=1)
    all_dates = [last + timedelta(days=offset) for offset in range(1, (start + timedelta(days=6) - last).days + 1)]
    result = recursive_predict(artifact["algorithm"], artifact["estimator"], artifact["history"], all_dates, len(artifact["history"]))
    return [(day, round(value, 2)) for day, value in zip(all_dates, result) if day >= start]


def public_model(model, current_fingerprint=None):
    return {"id": model.id, "model_name": model.model_name, "algorithm": model.algorithm, "training_start_date": model.training_start_date, "training_end_date": model.training_end_date, "mae": model.mae, "rmse": model.rmse, "trained_at": model.trained_at, "metadata": {key: value for key, value in model.metadata_json.items() if key != "artifact_sha256"}, "stale": current_fingerprint is not None and current_fingerprint != model.metadata_json["fingerprint"]}
