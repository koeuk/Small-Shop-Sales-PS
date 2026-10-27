import secrets
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from uuid import UUID

import httpx
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from .config import DEMO_USER_ID, demo_secret, settings

bearer = HTTPBearer(auto_error=False)


class Login(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=256)


class Refresh(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=4096)


def supabase_request(path, payload):
    try:
        response = httpx.post(f"{settings.supabase_url}/auth/v1/{path}", headers={"apikey": settings.supabase_key}, json=payload, timeout=15)
    except httpx.RequestError:
        raise HTTPException(503, "Sign-in service is temporarily unavailable")
    if response.status_code >= 400:
        raise HTTPException(401, "Email, password or session is invalid")
    data = response.json()
    if data.get("user", {}).get("id") != settings.admin_id:
        raise HTTPException(403, "This account is not the shop administrator")
    return {key: data.get(key) for key in ("access_token", "refresh_token", "expires_in", "user")}


def sign_in(login: Login):
    if settings.mode == "supabase":
        return supabase_request("token?grant_type=password", login.model_dump())
    if not (secrets.compare_digest(login.email.encode(), settings.demo_email.encode()) and secrets.compare_digest(login.password.encode(), settings.demo_password.encode())):
        raise HTTPException(401, "Email or password is incorrect")
    now = datetime.now(timezone.utc)
    token = jwt.encode({"sub": DEMO_USER_ID, "email": settings.demo_email, "iat": now, "exp": now + timedelta(hours=8), "aud": "small-shop-demo", "iss": "small-shop-demo"}, demo_secret(), algorithm="HS256")
    return {"access_token": token, "expires_in": 28800, "user": {"id": DEMO_USER_ID, "email": settings.demo_email}}


@lru_cache(maxsize=1)
def jwks_client():
    return jwt.PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json", timeout=10)


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    if not credentials:
        raise HTTPException(401, "Please sign in", headers={"WWW-Authenticate": "Bearer"})
    try:
        if settings.mode == "demo":
            claims = jwt.decode(credentials.credentials, demo_secret(), algorithms=["HS256"], audience="small-shop-demo", issuer="small-shop-demo", options={"require": ["exp", "sub", "iat"]})
            allowed = DEMO_USER_ID
        else:
            key = jwks_client().get_signing_key_from_jwt(credentials.credentials)
            claims = jwt.decode(credentials.credentials, key.key, algorithms=["ES256", "RS256"], audience="authenticated", issuer=f"{settings.supabase_url}/auth/v1", options={"require": ["exp", "sub", "iat"]})
            allowed = settings.admin_id
        owner_id = str(UUID(claims["sub"]))
        if owner_id != allowed:
            raise HTTPException(403, "Administrator access required")
        return owner_id
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(401, "Session expired or invalid; please sign in again", headers={"WWW-Authenticate": "Bearer"})
