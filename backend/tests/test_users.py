from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import bootstrap_administrator, verify_password
from app.config import settings, signing_secret
from app.database import engine
from app.models import User


def credentials(email="admin@smallshop.local", password="shopdemo2026"):
    return {"email": email, "password": password}


def test_user_bootstrap_hash_and_no_password_disclosure(auth, monkeypatch):
    with Session(engine) as session:
        user = session.get(User, settings.admin_id)
        original_hash = user.password_hash
        assert original_hash.startswith("$argon2id$")
        assert verify_password("shopdemo2026", original_hash)
        assert not verify_password("wrong", original_hash)
    monkeypatch.setattr(settings, "admin_password", "Changed-environment-password")
    bootstrap_administrator()
    with Session(engine) as session:
        assert session.get(User, settings.admin_id).password_hash == original_hash
        assert session.scalar(select(func.count()).select_from(User)) == 1
    response = auth.get("/api/users")
    assert response.status_code == 200, response.text
    assert "password_hash" not in response.text and "token_version" not in response.text
    assert auth.post("/api/auth/login", json=credentials()).status_code == 200
    assert (
        auth.post(
            "/api/auth/login", json=credentials(password="Changed-environment-password")
        ).status_code
        == 401
    )
    assert auth.get("/api/config").json()["default_demo_password"]


def test_create_edit_operator_and_role_permissions(auth):
    assert (
        auth.post("/api/products", json={"name": "Shared coffee", "price": "2.00"}).status_code
        == 201
    )
    response = auth.post(
        "/api/users",
        json={
            "name": "Sales operator",
            "email": "WORKER@example.com",
            "password": "operator-password-123",
            "role": "operator",
        },
    )
    assert response.status_code == 201, response.text
    operator = response.json()
    assert operator["email"] == "worker@example.com"
    assert "password_hash" not in operator
    assert (
        auth.post(
            "/api/users",
            json={
                "name": "Duplicate",
                "email": "worker@example.com",
                "password": "long-enough-password",
            },
        ).status_code
        == 409
    )
    assert (
        auth.post(
            "/api/users", json={"name": "Bad", "email": "bad-email", "password": "short"}
        ).status_code
        == 422
    )
    assert (
        auth.patch(f"/api/users/{operator['id']}", json={"name": "Updated operator"}).status_code
        == 200
    )
    login = auth.post(
        "/api/auth/login", json=credentials(" WORKER@example.com ", "operator-password-123")
    )
    assert login.status_code == 200, login.text
    operator_token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {operator_token}"}
    assert auth.get("/api/users", headers=headers).status_code == 403
    assert auth.post("/api/ml/train", json={}, headers=headers).status_code == 403
    assert auth.post("/api/demo/seed", headers=headers).status_code == 403
    products = auth.get("/api/products", headers=headers)
    assert products.status_code == 200 and products.json()["total"] == 1
    assert (
        auth.post(
            "/api/sales",
            headers=headers,
            json={
                "product_id": products.json()["items"][0]["id"],
                "sale_date": "2026-07-01",
                "quantity": 3,
                "unit_price": "2.00",
            },
        ).status_code
        == 201
    )
    assert auth.get("/api/sales").json()["total"] == 1


def test_deactivation_password_reset_and_immediate_session_revocation(auth):
    user = auth.post(
        "/api/users",
        json={
            "name": "Operator",
            "email": "operator@example.com",
            "password": "initial-password-123",
            "role": "operator",
        },
    ).json()
    session = auth.post(
        "/api/auth/login", json=credentials(user["email"], "initial-password-123")
    ).json()
    headers = {"Authorization": f"Bearer {session['access_token']}"}
    assert auth.patch(f"/api/users/{user['id']}", json={"is_active": False}).status_code == 200
    assert auth.get("/api/dashboard", headers=headers).status_code == 401
    assert (
        auth.post(
            "/api/auth/login", json=credentials(user["email"], "initial-password-123")
        ).status_code
        == 401
    )
    assert auth.patch(f"/api/users/{user['id']}", json={"is_active": True}).status_code == 200
    assert auth.get("/api/dashboard", headers=headers).status_code == 401
    assert (
        auth.post(
            f"/api/users/{user['id']}/password", json={"password": "new-password-456"}
        ).status_code
        == 200
    )
    assert (
        auth.post(
            "/api/auth/login", json=credentials(user["email"], "initial-password-123")
        ).status_code
        == 401
    )
    assert (
        auth.post(
            "/api/auth/login", json=credentials(user["email"], "new-password-456")
        ).status_code
        == 200
    )
    assert auth.delete(f"/api/users/{user['id']}").status_code == 204


def test_last_administrator_and_original_owner_are_protected(auth):
    assert (
        auth.patch(f"/api/users/{settings.admin_id}", json={"is_active": False}).status_code == 409
    )
    assert (
        auth.patch(f"/api/users/{settings.admin_id}", json={"role": "operator"}).status_code == 409
    )
    assert auth.delete(f"/api/users/{settings.admin_id}").status_code == 409
    second = auth.post(
        "/api/users",
        json={
            "name": "Second admin",
            "email": "second@example.com",
            "password": "second-admin-password",
            "role": "administrator",
        },
    )
    assert second.status_code == 201
    assert (
        auth.patch(f"/api/users/{settings.admin_id}", json={"is_active": False}).status_code == 200
    )
    bootstrap_administrator()
    assert auth.post("/api/auth/login", json=credentials()).status_code == 401
    login = auth.post(
        "/api/auth/login", json=credentials("second@example.com", "second-admin-password")
    )
    assert login.status_code == 200
    assert (
        auth.get(
            "/api/users", headers={"Authorization": f"Bearer {login.json()['access_token']}"}
        ).status_code
        == 200
    )


def test_password_whitespace_and_legacy_token_rejection(auth):
    password = "  whitespace is significant  "
    response = auth.post(
        "/api/users", json={"name": "Space", "email": "space@example.com", "password": password}
    )
    assert response.status_code == 201, response.text
    assert (
        auth.post("/api/auth/login", json=credentials("space@example.com", password)).status_code
        == 200
    )
    assert (
        auth.post(
            "/api/auth/login", json=credentials("space@example.com", password.strip())
        ).status_code
        == 401
    )
    now = datetime.now(UTC)
    legacy = jwt.encode(
        {
            "sub": settings.admin_id,
            "iat": now,
            "exp": now + timedelta(hours=1),
            "aud": "small-shop",
            "iss": "small-shop",
        },
        signing_secret(),
        algorithm="HS256",
    )
    assert (
        auth.get("/api/auth/me", headers={"Authorization": f"Bearer {legacy}"}).status_code == 401
    )
