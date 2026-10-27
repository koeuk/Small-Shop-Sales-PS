import io
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import numpy as np
from openpyxl import Workbook
from sqlalchemy import select

from app.config import settings
from app.database import session_scope
from app.ml import evaluate, fit_algorithm, prepare_series
from app.models import Product


def today():
    return datetime.now(settings.timezone).date()


def product(client, name="Coffee", price="2.00"):
    response = client.post("/api/products", json={"name": name, "category": "Drinks", "price": price})
    assert response.status_code == 201, response.text
    return response.json()


def sale(client, product_id, **kwargs):
    payload = {"product_id": product_id, "sale_date": (today() - timedelta(days=1)).isoformat(), "quantity": 3, "unit_price": "2.00", **kwargs}
    return client.post("/api/sales", json=payload)


def test_protected_endpoints(client):
    for path in ["products", "sales", "imports", "ml/models", "ml/dataset", "predictions", "dashboard"]:
        assert client.get(f"/api/{path}").status_code == 401
    assert client.post("/api/ml/train", json={}).status_code == 401
    assert client.post("/api/demo/seed").status_code == 401
    assert client.post("/api/auth/login", json={"email": "bad@example.com", "password": "wrong"}).status_code == 401
    assert client.get("/api/products", headers={"Authorization": "Bearer forged"}).status_code == 401


def test_product_sales_and_historical_prices(auth):
    item = product(auth)
    assert auth.patch(f"/api/products/{item['id']}", json={"category": "Hot drinks"}).status_code == 200
    created = sale(auth, item["id"])
    assert created.status_code == 201, created.text
    assert Decimal(str(created.json()["total_amount"])) == Decimal("6.00")
    auth.patch(f"/api/products/{item['id']}", json={"price": "9.00"})
    assert Decimal(str(auth.get("/api/sales").json()["items"][0]["unit_price"])) == Decimal("2.00")
    payload = {"product_id": item["id"], "sale_date": (today() - timedelta(days=1)).isoformat(), "quantity": 4, "unit_price": "2.50"}
    updated = auth.patch(f"/api/sales/{created.json()['id']}", json=payload)
    assert updated.status_code == 200
    assert Decimal(str(updated.json()["total_amount"])) == Decimal("10.00")
    assert auth.delete(f"/api/products/{item['id']}").json()["action"] == "archived"
    assert auth.get("/api/products").json()["total"] == 0
    assert auth.get("/api/products?include_archived=true").json()["total"] == 1
    assert sale(auth, item["id"]).status_code == 400
    assert auth.delete(f"/api/sales/{created.json()['id']}").status_code == 204


def test_validation_and_owner_isolation(auth):
    item = product(auth)
    for qty in [-1, 0, 1.5, True, "3"]:
        assert sale(auth, item["id"], quantity=qty).status_code == 422
    assert sale(auth, item["id"], unit_price="-1").status_code == 422
    assert sale(auth, item["id"], unit_price="1.234").status_code == 422
    assert sale(auth, item["id"], sale_date=(today() + timedelta(days=1)).isoformat()).status_code == 422
    assert sale(auth, item["id"], total_amount=1).status_code == 422
    assert auth.post("/api/products", json={"name": " coffee ", "price": 2}).status_code == 409
    assert auth.patch(f"/api/products/{item['id']}", json={"price": None}).status_code == 422
    other_owner = str(uuid4())
    with session_scope(other_owner) as session:
        private = Product(owner_id=other_owner, name="Private", price=Decimal("1.00"))
        session.add(private)
        session.flush()
        private_id = private.id
    assert sale(auth, private_id).status_code == 404
    assert auth.patch(f"/api/products/{private_id}", json={"name": "Stolen"}).status_code == 404
    assert auth.get("/api/products").json()["total"] == 1


def test_csv_preview_partial_import_and_duplicates(auth):
    product(auth)
    day = (today() - timedelta(days=1)).isoformat()
    content = f"sale_date,product_name,quantity,unit_price\n{day},Coffee,3,2.00\n{day},Coffee,-1,2.00\n{day},Unknown,2,1.00\n".encode()
    files = {"file": ("sales.csv", content, "text/csv")}
    preview = auth.post("/api/imports", files=files, data={"dry_run": "true"})
    assert preview.status_code == 200, preview.text
    assert preview.json()["valid_rows"] == 1
    assert preview.json()["invalid_rows"] == 2
    assert auth.get("/api/sales").json()["total"] == 0
    result = auth.post("/api/imports", files=files, data={"dry_run": "false"})
    assert result.status_code == 200, result.text
    assert result.json()["import"]["row_count"] == 1
    assert result.json()["import"]["invalid_rows"] == 2
    assert auth.get("/api/sales").json()["total"] == 1
    assert auth.post("/api/imports", files={"file": ("renamed.csv", content)}, data={"dry_run": "false"}).status_code == 409


def test_excel_and_malformed_audit(auth):
    product(auth)
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["sale_date", "product_name", "quantity", "unit_price"])
    sheet.append([datetime.combine(today() - timedelta(days=1), datetime.min.time()), "Coffee", 2, 2.5])
    output = io.BytesIO()
    workbook.save(output)
    response = auth.post("/api/imports", files={"file": ("sales.xlsx", output.getvalue())}, data={"dry_run": "false"})
    assert response.status_code == 200, response.text
    assert response.json()["valid_rows"] == 1
    for name, content in [("bad.csv", b"wrong,headers\n1,2"), ("bad.xlsx", b"not a zip file"), ("bad.pdf", b"pdf")]:
        response = auth.post("/api/imports", files={"file": (name, content)}, data={"dry_run": "false"})
        assert response.status_code == 422, response.text
    assert sum(row["status"] == "failed" for row in auth.get("/api/imports").json()) == 3


def test_insufficient_data_and_missing_policy(auth):
    assert auth.post("/api/ml/train", json={}).status_code == 422
    assert auth.post("/api/ml/train", json={"missing_policy": "zero"}).status_code == 422
    start = today() - timedelta(days=100)
    rows = [(start + timedelta(days=i), 100.0) for i in range(100) if i != 30]
    from fastapi import HTTPException
    import pytest
    with pytest.raises(HTTPException):
        prepare_series(rows, "reject")
    dates, values = prepare_series(rows, "zero")
    assert len(dates) == 100
    assert values[30] == 0


def test_recursive_evaluation_does_not_read_future_actuals():
    dates = [today() - timedelta(days=100 - i) for i in range(100)]
    values = [100 + i * 0.5 + (i % 7) * 4 for i in range(100)]
    estimator = fit_algorithm("linear_regression", dates[:70], values[:70])
    first = evaluate("linear_regression", estimator, dates, values, 70, 84)
    changed = values[:70] + [value * 10 for value in values[70:]]
    second = evaluate("linear_regression", estimator, dates, changed, 70, 84)
    np.testing.assert_allclose([p["predicted"] for p in first["points"][:7]], [p["predicted"] for p in second["points"][:7]])


def test_complete_training_forecast_retraining_and_history(auth):
    assert auth.post("/api/demo/seed").status_code == 201
    assert auth.post("/api/demo/seed").status_code == 409
    quality = auth.get("/api/ml/dataset").json()
    assert quality["observed_days"] == 180 and quality["missing_days"] == 0 and quality["synthetic"]
    trained = auth.post("/api/ml/train", json={})
    assert trained.status_code == 201, trained.text
    models = trained.json()["models"]
    assert len(models) == 4
    chosen = next(model for model in models if model["metadata"]["recommended"])
    assert chosen["metadata"]["validation_mae"] == min(m["metadata"]["validation_mae"] for m in models)
    for model in models:
        splits = model["metadata"]["splits"]
        assert splits["train"][1] < splits["validation"][0] <= splits["validation"][1] < splits["test"][0]
        assert all(point["date"] >= splits["test"][0] for point in model["metadata"]["test_points"])
        assert model["mae"] >= 0 and model["rmse"] >= 0
        assert "model_path" not in model
    forecast = auth.post("/api/predictions", json={"model_id": chosen["id"]})
    assert forecast.status_code == 201, forecast.text
    run = forecast.json()
    assert len(run["predictions"]) == 7
    assert run["predictions"][0]["date"] == (today() + timedelta(days=1)).isoformat()
    assert all(float(row["revenue"]) >= 0 for row in run["predictions"])
    assert auth.get(f"/api/predictions/{run['id']}/export").text.count("\n") == 8
    items = auth.get("/api/sales").json()["items"]
    payload = {key: items[0][key] for key in ("product_id", "sale_date", "quantity", "unit_price")}
    payload["quantity"] += 1
    assert auth.patch(f"/api/sales/{items[0]['id']}", json=payload).status_code == 200
    assert auth.post("/api/predictions", json={"model_id": chosen["id"]}).status_code == 409
    retrained = auth.post("/api/ml/train", json={})
    assert retrained.status_code == 201, retrained.text
    assert len(auth.get("/api/ml/models").json()) == 8
    assert auth.get("/api/predictions").json()[0]["model_id"] == chosen["id"]
    dashboard = auth.get("/api/dashboard")
    assert dashboard.status_code == 200, dashboard.text
    assert dashboard.json()["revenue_30d"] > 0
