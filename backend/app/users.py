from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select

from .auth import current_identity, hash_password, public_user, require_administrator
from .config import settings
from .database import session_scope
from .models import User
from .schemas import PasswordReset, UserInput, UserUpdate

router = APIRouter(
    prefix="/api/users", tags=["users"], dependencies=[Depends(require_administrator)]
)


def user_data(user):
    return {
        **public_user(user),
        "is_active": user.is_active,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "shop_owner": user.id == settings.admin_id,
    }


def locked_users(session, user_id):
    users = list(session.scalars(select(User).order_by(User.id).with_for_update()))
    user = next((item for item in users if item.id == str(user_id)), None)
    if not user:
        raise HTTPException(404, "User not found")
    return user, users


def keep_an_administrator(user, users, role, active):
    if (
        user.role == "administrator"
        and user.is_active
        and (role != "administrator" or not active)
        and sum(item.role == "administrator" and item.is_active for item in users) <= 1
    ):
        raise HTTPException(409, "Keep at least one active administrator")


@router.get("")
def list_users(
    search: str = Query("", max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    with session_scope(settings.admin_id) as session:
        query = select(User)
        if search:
            query = query.where(User.name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))
        total = session.scalar(select(func.count()).select_from(query.subquery()))
        records = session.scalars(
            query.order_by(User.created_at, User.id).offset((page - 1) * page_size).limit(page_size)
        )
        return {
            "items": [user_data(user) for user in records],
            "total": total,
            "page": page,
            "page_size": page_size,
        }


@router.post("", status_code=201)
def create_user(payload: UserInput):
    with session_scope(settings.admin_id) as session:
        if session.scalar(select(User.id).where(User.email == payload.email)):
            raise HTTPException(409, "An account with this email already exists")
        user = User(
            name=payload.name,
            email=payload.email,
            role=payload.role,
            password_hash=hash_password(payload.password),
        )
        session.add(user)
        session.flush()
        return user_data(user)


@router.patch("/{user_id}")
def update_user(user_id: UUID, payload: UserUpdate, identity: User = Depends(current_identity)):
    with session_scope(settings.admin_id) as session:
        user, users = locked_users(session, user_id)
        values = payload.model_dump(exclude_unset=True)
        role, active = values.get("role", user.role), values.get("is_active", user.is_active)
        keep_an_administrator(user, users, role, active)
        if "email" in values and any(
            item.id != user.id and item.email == values["email"] for item in users
        ):
            raise HTTPException(409, "An account with this email already exists")
        changed_security = any(
            key in values and values[key] != getattr(user, key)
            for key in ("email", "role", "is_active")
        )
        for key, value in values.items():
            setattr(user, key, value)
        if changed_security:
            user.token_version += 1
        session.flush()
        return {
            "user": user_data(user),
            "reauthenticate": user.id == identity.id and changed_security,
        }


@router.post("/{user_id}/password")
def reset_password(
    user_id: UUID, payload: PasswordReset, identity: User = Depends(current_identity)
):
    with session_scope(settings.admin_id) as session:
        user, _ = locked_users(session, user_id)
        user.password_hash = hash_password(payload.password)
        user.token_version += 1
        return {
            "message": "Password updated. Existing sessions for this user have been revoked.",
            "reauthenticate": user.id == identity.id,
        }


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: UUID, identity: User = Depends(current_identity)):
    if str(user_id) == settings.admin_id:
        raise HTTPException(
            409,
            "The original shop owner cannot be deleted because historical records reference it. Deactivate it after adding another administrator.",
        )
    if str(user_id) == identity.id:
        raise HTTPException(409, "Ask another administrator to remove your account")
    with session_scope(settings.admin_id) as session:
        user, users = locked_users(session, user_id)
        keep_an_administrator(user, users, user.role, False)
        session.delete(user)
