from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.mysql import DATETIME
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base

UTC_DATETIME = DateTime(timezone=True).with_variant(DATETIME(fsp=6), "mysql")


def utcnow():
    return datetime.now(UTC)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), default="Shop administrator")
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="administrator")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    token_version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=utcnow, onupdate=utcnow)
    __table_args__ = (
        CheckConstraint("role IN ('administrator', 'operator')", name="users_role_valid"),
    )


class Record:
    id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    owner_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=utcnow)


class Product(Record, Base):
    __tablename__ = "products"
    name: Mapped[str] = mapped_column(String(100))
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=utcnow, onupdate=utcnow)
    __table_args__ = (
        CheckConstraint("price >= 0", name="products_price_nonnegative"),
        UniqueConstraint("owner_id", "name", name="products_owner_name"),
    )


class DataImport(Record, Base):
    __tablename__ = "data_imports"
    file_name: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(20))
    fingerprint: Mapped[str] = mapped_column(String(64))
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    invalid_rows: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    error_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (
        UniqueConstraint("owner_id", "fingerprint", name="imports_owner_fingerprint"),
    )


class Sale(Record, Base):
    __tablename__ = "sales"
    product_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("products.id", ondelete="RESTRICT")
    )
    sale_date: Mapped[date] = mapped_column(Date, index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    import_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("data_imports.id", ondelete="RESTRICT"), nullable=True
    )
    source_row: Mapped[int | None] = mapped_column(Integer, nullable=True)
    __table_args__ = (
        CheckConstraint("quantity > 0", name="sales_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="sales_price_nonnegative"),
        CheckConstraint(
            "total_amount = round(quantity * unit_price, 2)", name="sales_total_correct"
        ),
        UniqueConstraint("import_id", "source_row", name="sales_import_row"),
        Index("sales_product_id", "product_id"),
    )


class MLModel(Record, Base):
    __tablename__ = "ml_models"
    model_name: Mapped[str] = mapped_column(String(100))
    algorithm: Mapped[str] = mapped_column(String(100))
    training_start_date: Mapped[date] = mapped_column(Date)
    training_end_date: Mapped[date] = mapped_column(Date)
    mae: Mapped[float] = mapped_column()
    rmse: Mapped[float] = mapped_column()
    model_path: Mapped[str] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column(JSON)
    trained_at: Mapped[datetime] = mapped_column(UTC_DATETIME, default=utcnow)


class Prediction(Record, Base):
    __tablename__ = "predictions"
    model_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("ml_models.id", ondelete="RESTRICT")
    )
    run_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), index=True)
    prediction_date: Mapped[date] = mapped_column(Date)
    predicted_sales: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    __table_args__ = (
        CheckConstraint("predicted_sales >= 0", name="predictions_nonnegative"),
        UniqueConstraint("run_id", "prediction_date", name="predictions_run_date"),
        Index("predictions_model_date", "model_id", "prediction_date"),
    )


for table in Base.metadata.tables.values():
    table.dialect_options["mysql"].update(engine="InnoDB", charset="utf8mb4", collate="utf8mb4_bin")
