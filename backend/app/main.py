import csv
import io
import logging
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from sqlalchemy import func, inspect, select
from sqlalchemy.exc import IntegrityError, OperationalError

from .auth import Login, Refresh, current_user, sign_in, supabase_request
from .config import settings
from .database import Base, engine, session_scope
from .imports import MAX_FILE_BYTES, commit_import, prepare_import
from .ml import TRAINING_LOCK, daily_history, dataset_quality, fingerprint, forecast_values, public_model, train_models
from .models import DataImport, MLModel, Prediction, Product, Sale, utcnow
from .product_names import normalize_name
from .schemas import ForecastInput, ProductInput, ProductUpdate, SaleInput, TrainInput
from .seed import seed_demo

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_):
    if settings.mode == "demo":
        Base.metadata.create_all(engine)
    yield


app = FastAPI(title="Small Shop Sales API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=list(settings.origins), allow_credentials=False, allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"])


@app.exception_handler(IntegrityError)
async def integrity_error(_, exc):
    logger.warning("Database constraint rejected a write: %s", type(exc).__name__)
    return JSONResponse(status_code=409, content={"detail": "This record conflicts with existing data or a database constraint. Refresh and check the values."})


@app.exception_handler(OperationalError)
async def database_error(_, exc):
    logger.error("Database operation failed: %s", type(exc).__name__)
    return JSONResponse(status_code=503, content={"detail": "Database is temporarily unavailable. Check the server configuration."})


def row_dict(record):
    return {column.key: getattr(record, column.key) for column in inspect(record).mapper.column_attrs if column.key not in {"owner_id", "model_path"}}


def owned(session, model, record_id, owner_id):
    record = session.scalar(select(model).where(model.id == str(record_id), model.owner_id == owner_id))
    if not record:
        raise HTTPException(404, "Record not found")
    return record


@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "ok", "mode": settings.mode}


@app.get("/api/config")
def app_config():
    return {"mode": settings.mode, "currency": "USD", "timezone": str(settings.timezone), "demo_email": settings.demo_email if settings.mode == "demo" else None, "default_demo_password": settings.mode == "demo" and settings.demo_password == "shopdemo2026"}


login_attempts = defaultdict(deque)
login_lock = threading.Lock()


@app.post("/api/auth/login")
def login(payload: Login, request: Request):
    address = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with login_lock:
        attempts = login_attempts[address]
        while attempts and attempts[0] < now - 300:
            attempts.popleft()
        if len(attempts) >= 20:
            raise HTTPException(429, "Too many sign-in attempts. Try again in five minutes.")
        attempts.append(now)
    return sign_in(payload)


@app.post("/api/auth/refresh")
def refresh(payload: Refresh):
    if settings.mode != "supabase":
        raise HTTPException(400, "Demo sessions last eight hours. Sign in again to renew.")
    return supabase_request("token?grant_type=refresh_token", payload.model_dump())


@app.get("/api/auth/me")
def me(owner_id: str = Depends(current_user)):
    return {"id": owner_id, "mode": settings.mode}


@app.get("/api/products")
def products(search: str = Query("", max_length=100), include_archived: bool = False, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=1000), owner_id: str = Depends(current_user)):
    with session_scope(owner_id) as session:
        query = select(Product).where(Product.owner_id == owner_id)
        if not include_archived:
            query = query.where(Product.archived.is_(False))
        if search:
            query = query.where(Product.name.ilike(f"%{search}%"))
        total = session.scalar(select(func.count()).select_from(query.subquery()))
        items = session.scalars(query.order_by(Product.archived, Product.name).offset((page - 1) * page_size).limit(page_size))
        return {"items": [row_dict(item) for item in items], "total": total, "page": page, "page_size": page_size}


def unique_product_name(session, owner_id, name, excluding=None):
    query = select(Product).where(Product.owner_id == owner_id)
    if excluding:
        query = query.where(Product.id != excluding)
    if any(normalize_name(product.name) == normalize_name(name) for product in session.scalars(query)):
        raise HTTPException(409, "A product with this name already exists, including archived products")


@app.post("/api/products", status_code=201)
def create_product(payload: ProductInput, owner_id: str = Depends(current_user)):
    with session_scope(owner_id) as session:
        unique_product_name(session, owner_id, payload.name)
        record = Product(owner_id=owner_id, **payload.model_dump())
        session.add(record)
        session.flush()
        return row_dict(record)


@app.patch("/api/products/{record_id}")
def update_product(record_id: UUID, payload: ProductUpdate, owner_id: str = Depends(current_user)):
    with session_scope(owner_id) as session:
        record = owned(session, Product, record_id, owner_id)
        values = payload.model_dump(exclude_unset=True)
        if "name" in values:
            unique_product_name(session, owner_id, values["name"], record.id)
        for key, value in values.items():
            setattr(record, key, value)
        session.flush()
        return row_dict(record)


@app.delete("/api/products/{record_id}")
def delete_product(record_id: UUID, owner_id: str = Depends(current_user)):
    with session_scope(owner_id) as session:
        record = owned(session, Product, record_id, owner_id)
        if session.scalar(select(func.count()).select_from(Sale).where(Sale.product_id == record.id)):
            record.archived = True
            return {"action": "archived", "message": "Product archived; historical sales are preserved"}
        session.delete(record)
        return {"action": "deleted", "message": "Product deleted"}


@app.get("/api/sales")
def sales(start_date: date | None = None, end_date: date | None = None, product_id: UUID | None = None, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200), owner_id: str = Depends(current_user)):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(400, "Start date must be before end date")
    with session_scope(owner_id) as session:
        query = select(Sale).where(Sale.owner_id == owner_id)
        if start_date:
            query = query.where(Sale.sale_date >= start_date)
        if end_date:
            query = query.where(Sale.sale_date <= end_date)
        if product_id:
            query = query.where(Sale.product_id == str(product_id))
        subquery = query.subquery()
        total, revenue = session.execute(select(func.count(), func.coalesce(func.sum(subquery.c.total_amount), 0)).select_from(subquery)).one()
        records = session.scalars(query.order_by(Sale.sale_date.desc(), Sale.created_at.desc(), Sale.id).offset((page - 1) * page_size).limit(page_size)).all()
        names = dict(session.execute(select(Product.id, Product.name).where(Product.owner_id == owner_id)).all())
        return {"items": [{**row_dict(record), "product_name": names.get(record.product_id, "Archived product")} for record in records], "total": total, "revenue": revenue, "page": page, "page_size": page_size}


def assign_sale(session, owner_id, payload, record=None):
    product = owned(session, Product, payload.product_id, owner_id)
    if product.archived and (record is None or record.product_id != product.id):
        raise HTTPException(400, "Restore this product before recording new sales")
    values = payload.model_dump()
    values["product_id"] = str(payload.product_id)
    values["total_amount"] = payload.quantity * payload.unit_price
    if record is None:
        record = Sale(owner_id=owner_id, **values)
        session.add(record)
    else:
        for key, value in values.items():
            setattr(record, key, value)
    session.flush()
    return {**row_dict(record), "product_name": product.name}


@app.post("/api/sales", status_code=201)
def create_sale(payload: SaleInput, owner_id: str = Depends(current_user)):
    with session_scope(owner_id) as session:
        return assign_sale(session, owner_id, payload)


@app.patch("/api/sales/{record_id}")
def update_sale(record_id: UUID, payload: SaleInput, owner_id: str = Depends(current_user)):
    with session_scope(owner_id) as session:
        record = owned(session, Sale, record_id, owner_id)
        return assign_sale(session, owner_id, payload, record)


@app.delete("/api/sales/{record_id}", status_code=204)
def delete_sale(record_id: UUID, owner_id: str = Depends(current_user)):
    with session_scope(owner_id) as session:
        session.delete(owned(session, Sale, record_id, owner_id))


@app.post("/api/imports")
def import_sales(file: UploadFile = File(...), dry_run: bool = Form(True), synthetic: bool = Form(False), owner_id: str = Depends(current_user)):
    content = file.file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, "File size must be 5 MB or less")
    filename = (file.filename or "upload.csv").replace("\\", "/").split("/")[-1]
    with session_scope(owner_id) as session:
        summary, valid, existing = prepare_import(session, owner_id, content, filename)
        if dry_run:
            return summary
        record = commit_import(session, owner_id, filename, summary, valid, existing, synthetic)
        result = {**summary, "import": row_dict(record)}
    if not valid:
        return JSONResponse(status_code=422, content={"detail": "No valid rows were imported. Review the preview and import history.", "errors": summary["errors"]})
    return result


@app.get("/api/imports")
def import_history(owner_id: str = Depends(current_user)):
    with session_scope(owner_id) as session:
        records = session.scalars(select(DataImport).where(DataImport.owner_id == owner_id).order_by(DataImport.created_at.desc()).limit(100))
        return [row_dict(record) for record in records]


@app.get("/api/ml/dataset")
def dataset(owner_id: str = Depends(current_user)):
    with session_scope(owner_id) as session:
        return dataset_quality(session, owner_id)


@app.post("/api/ml/train", status_code=201)
def train(payload: TrainInput, owner_id: str = Depends(current_user)):
    if not TRAINING_LOCK.acquire(blocking=False):
        raise HTTPException(409, "Training is already running; try again shortly")
    try:
        with session_scope(owner_id) as session:
            records = train_models(session, owner_id, payload.missing_policy)
            return {"models": [public_model(record) for record in records], "message": "Compared four models. Recommendation uses validation MAE; test dates remain unseen until final evaluation."}
    finally:
        TRAINING_LOCK.release()


@app.get("/api/ml/models")
def models(owner_id: str = Depends(current_user)):
    with session_scope(owner_id) as session:
        current = fingerprint(daily_history(session, owner_id))
        records = session.scalars(select(MLModel).where(MLModel.owner_id == owner_id).order_by(MLModel.trained_at.desc(), MLModel.id).limit(100)).all()
        return [public_model(record, current) for record in records]


def forecast_runs(session, owner_id, limit=100):
    runs = session.scalars(select(Prediction.run_id).where(Prediction.owner_id == owner_id).group_by(Prediction.run_id).order_by(func.max(Prediction.created_at).desc()).limit(limit)).all()
    if not runs:
        return []
    records = session.execute(select(Prediction, MLModel).join(MLModel, Prediction.model_id == MLModel.id).where(Prediction.owner_id == owner_id, Prediction.run_id.in_(runs)).order_by(Prediction.prediction_date)).all()
    actuals = dict(daily_history(session, owner_id))
    grouped = {}
    for prediction, model in records:
        run = grouped.setdefault(prediction.run_id, {"id": prediction.run_id, "model_id": model.id, "model_name": model.model_name, "created_at": prediction.created_at, "synthetic": model.metadata_json.get("synthetic", False), "training_end_date": model.training_end_date, "mae": model.mae, "predictions": [], "total": Decimal("0.00")})
        run["predictions"].append({"date": prediction.prediction_date, "revenue": prediction.predicted_sales, "actual": actuals.get(prediction.prediction_date)})
        run["total"] += prediction.predicted_sales
    return [grouped[run] for run in runs]


@app.post("/api/predictions", status_code=201)
def predict(payload: ForecastInput, owner_id: str = Depends(current_user)):
    with session_scope(owner_id) as session:
        model = owned(session, MLModel, payload.model_id, owner_id)
        values = forecast_values(session, owner_id, model)
        run_id = str(uuid4())
        created_at = utcnow()
        for day, value in values:
            session.add(Prediction(owner_id=owner_id, model_id=model.id, run_id=run_id, prediction_date=day, predicted_sales=Decimal(str(value)), created_at=created_at))
        session.flush()
        return forecast_runs(session, owner_id, limit=1)[0]


@app.get("/api/predictions")
def predictions(owner_id: str = Depends(current_user)):
    with session_scope(owner_id) as session:
        return forecast_runs(session, owner_id)


@app.get("/api/predictions/{run_id}/export")
def export_predictions(run_id: UUID, owner_id: str = Depends(current_user)):
    with session_scope(owner_id) as session:
        records = session.scalars(select(Prediction).where(Prediction.owner_id == owner_id, Prediction.run_id == str(run_id)).order_by(Prediction.prediction_date)).all()
        if not records:
            raise HTTPException(404, "Forecast not found")
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["prediction_date", "predicted_revenue_usd", "model_id", "run_id", "created_at_utc"])
        for record in records:
            writer.writerow([record.prediction_date, record.predicted_sales, record.model_id, record.run_id, record.created_at.isoformat()])
        return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="forecast-{run_id}.csv"'})


@app.post("/api/demo/seed", status_code=201)
def sample_data(owner_id: str = Depends(current_user)):
    with session_scope(owner_id) as session:
        return seed_demo(session, owner_id)


@app.get("/api/dashboard")
def dashboard(owner_id: str = Depends(current_user)):
    today = datetime.now(settings.timezone).date()
    with session_scope(owner_id) as session:
        rows = session.execute(select(Sale.sale_date, func.sum(Sale.total_amount), func.sum(Sale.quantity)).where(Sale.owner_id == owner_id).group_by(Sale.sale_date).order_by(Sale.sale_date)).all()
        recent = [(day, float(revenue), quantity) for day, revenue, quantity in rows if day >= today - timedelta(days=29)]
        previous = sum(float(revenue) for day, revenue, _ in rows if today - timedelta(days=59) <= day < today - timedelta(days=29))
        revenue = sum(value for _, value, _ in recent)
        names = session.execute(select(Product.name, func.sum(Sale.total_amount).label("revenue"), func.sum(Sale.quantity).label("quantity")).join(Sale, Sale.product_id == Product.id).where(Sale.owner_id == owner_id, Sale.sale_date >= today - timedelta(days=29)).group_by(Product.id, Product.name).order_by(func.sum(Sale.total_amount).desc()).limit(5)).all()
        quality = dataset_quality(session, owner_id)
        latest_model = session.scalar(select(MLModel).where(MLModel.owner_id == owner_id).order_by(MLModel.trained_at.desc()).limit(1))
        if latest_model:
            group = session.scalars(select(MLModel).where(MLModel.owner_id == owner_id).order_by(MLModel.trained_at.desc()).limit(4)).all()
            latest_model = next((model for model in group if model.metadata_json["batch_id"] == latest_model.metadata_json["batch_id"] and model.metadata_json.get("recommended")), latest_model)
        return {
            "revenue_30d": revenue, "previous_revenue_30d": previous, "change_percent": (revenue - previous) / previous * 100 if previous else None,
            "units_30d": sum(quantity for _, _, quantity in recent), "average_daily": revenue / 30,
            "sales_count": session.scalar(select(func.count()).select_from(Sale).where(Sale.owner_id == owner_id)),
            "product_count": session.scalar(select(func.count()).select_from(Product).where(Product.owner_id == owner_id, Product.archived.is_(False))),
            "daily": [{"date": day, "revenue": float(value), "quantity": quantity} for day, value, quantity in rows[-90:]],
            "top_products": [{"name": name, "revenue": float(value), "quantity": quantity} for name, value, quantity in names],
            "quality": {key: value for key, value in quality.items() if key != "daily"},
            "model": public_model(latest_model, quality["fingerprint"]) if latest_model else None,
            "forecast": next(iter(forecast_runs(session, owner_id, limit=1)), None),
        }
