"""Add application users and ownership foreign keys without rewriting shop records."""

from sqlalchemy import func, inspect, select, text
from sqlalchemy.orm import Session

from .database import engine
from .models import DataImport, MLModel, Prediction, Product, Sale, User


def migrate_user_ownership():
    if engine.dialect.name != "mysql":
        return
    inspector = inspect(engine)
    pending = []
    for model in (Product, Sale, DataImport, MLModel, Prediction):
        keys = inspector.get_foreign_keys(model.__tablename__)
        if not any(key["constrained_columns"] == ["owner_id"] and key["referred_table"] == "users" for key in keys):
            pending.append(model)
    if not pending:
        return
    with Session(engine) as session:
        for model in pending:
            unknown = session.scalar(select(func.count()).select_from(model).outerjoin(User, model.owner_id == User.id).where(User.id.is_(None)))
            if unknown:
                raise RuntimeError(f"Cannot link {model.__tablename__}: some owner IDs have no users row. Restore the matching administrator ID first.")
    with engine.begin() as connection:
        for model in pending:
            table = model.__tablename__
            connection.execute(text(f"ALTER TABLE `{table}` ADD CONSTRAINT `fk_{table}_owner_user` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT"))
