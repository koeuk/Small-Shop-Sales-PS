import os
import tempfile
from pathlib import Path

import pytest

TEST_ROOT = Path(tempfile.mkdtemp(prefix="small-shop-tests-"))
os.environ["APP_MODE"] = "demo"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_ROOT / 'test.db'}"
os.environ["ARTIFACT_DIR"] = str(TEST_ROOT / "artifacts")
os.environ["DEMO_EMAIL"] = "admin@smallshop.local"
os.environ["DEMO_PASSWORD"] = "shopdemo2026"

from fastapi.testclient import TestClient
from app.database import Base, engine
from app.main import app, login_attempts


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    login_attempts.clear()
    with TestClient(app) as client:
        yield client


@pytest.fixture
def auth(client):
    response = client.post("/api/auth/login", json={"email": "admin@smallshop.local", "password": "shopdemo2026"})
    assert response.status_code == 200, response.text
    client.headers["Authorization"] = f"Bearer {response.json()['access_token']}"
    return client
