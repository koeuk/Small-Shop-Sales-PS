import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings, signing_secret
from .database import engine
from .models import User

bearer = HTTPBearer(auto_error=False)
password_hasher = PasswordHasher()
dummy_hash = password_hasher.hash(secrets.token_urlsafe(32))


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return password_hasher.verify(hashed, password)
    except (InvalidHashError, VerificationError):
        return False


def bootstrap_administrator():
    """Create the configured initial account once; never reset a stored account."""
    with Session(engine) as session:
        if session.get(User, settings.admin_id):
            return
        email = settings.admin_email.strip().casefold()
        if session.scalar(select(User.id).where(User.email == email)):
            raise RuntimeError("Administrator email already belongs to another ID; check ADMIN_USER_ID")
        if settings.mode == "production" and (
            len(settings.admin_password) < 12 or settings.admin_password == "shopdemo2026"
        ):
            raise RuntimeError("Creating the initial production user requires a custom ADMIN_PASSWORD of at least 12 characters")
        session.add(User(id=settings.admin_id, email=email, password_hash=hash_password(settings.admin_password)))
        session.commit()


def public_user(user: User):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}


def demo_account_config():
    if settings.mode != "demo":
        return {"demo_email": None, "default_demo_password": False}
    with Session(engine) as session:
        user = session.get(User, settings.admin_id)
        return {
            "demo_email": user.email if user else None,
            "default_demo_password": bool(user and user.is_active and verify_password("shopdemo2026", user.password_hash)),
        }


class Login(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=256)


def sign_in(login: Login):
    with Session(engine, expire_on_commit=False) as session:
        user = session.scalar(select(User).where(User.email == login.email.strip().casefold()))
        password_valid = verify_password(login.password, user.password_hash if user else dummy_hash)
        if not password_valid or not user or not user.is_active or user.role not in {"administrator", "operator"}:
            raise HTTPException(401, "Email or password is incorrect")
        if password_hasher.check_needs_rehash(user.password_hash):
            user.password_hash = hash_password(login.password)
            session.commit()
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": user.id,
            "email": user.email,
            "ver": user.token_version,
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
        "user": public_user(user),
    }


def current_identity(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> User:
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
        with Session(engine, expire_on_commit=False) as session:
            user = session.get(User, owner_id)
            if not user or not user.is_active or user.role not in {"administrator", "operator"} or claims.get("ver") != user.token_version:
                raise HTTPException(401, "Account or session is no longer active; please sign in again", headers={"WWW-Authenticate": "Bearer"})
        return user
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(
            401,
            "Session expired or invalid; please sign in again",
            headers={"WWW-Authenticate": "Bearer"},
        )


def current_user(identity: User = Depends(current_identity)) -> str:
    # All managed accounts belong to the same shop. Preserve the existing shop's owner ID.
    return settings.admin_id


def require_administrator(identity: User = Depends(current_identity)) -> str:
    if identity.role != "administrator":
        raise HTTPException(403, "Administrator access required")
    return settings.admin_id
