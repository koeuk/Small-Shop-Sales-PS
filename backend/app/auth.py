import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from .config import settings, signing_secret

bearer = HTTPBearer(auto_error=False)


class Login(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=256)


def sign_in(login: Login):
    if not (
        secrets.compare_digest(login.email.encode(), settings.admin_email.encode())
        and secrets.compare_digest(login.password.encode(), settings.admin_password.encode())
    ):
        raise HTTPException(401, "Email or password is incorrect")
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": settings.admin_id,
            "email": settings.admin_email,
            "iat": now,
            "exp": now + timedelta(hours=8),
            "aud": "small-shop",
            "iss": "small-shop",
        },
        signing_secret(),
        algorithm="HS256",
    )
    return {
        "access_token": token,
        "expires_in": 28800,
        "user": {"id": settings.admin_id, "email": settings.admin_email},
    }


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    if not credentials:
        raise HTTPException(401, "Please sign in", headers={"WWW-Authenticate": "Bearer"})
    try:
        claims = jwt.decode(
            credentials.credentials,
            signing_secret(),
            algorithms=["HS256"],
            audience="small-shop",
            issuer="small-shop",
            options={"require": ["exp", "sub", "iat"]},
        )
        owner_id = str(UUID(claims["sub"]))
        if owner_id != settings.admin_id:
            raise HTTPException(403, "Administrator access required")
        return owner_id
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(
            401,
            "Session expired or invalid; please sign in again",
            headers={"WWW-Authenticate": "Bearer"},
        )
