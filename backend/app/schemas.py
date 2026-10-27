from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator

from .config import settings

Money = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=2)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ProductInput(Input):
    name: str = Field(min_length=1, max_length=100)
    category: str | None = Field(default=None, max_length=50)
    price: Money


class ProductUpdate(Input):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    category: str | None = Field(default=None, max_length=50)
    price: Money | None = None
    archived: bool | None = None

    @model_validator(mode="after")
    def required_not_null(self):
        for name in ("name", "price", "archived"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class SaleInput(Input):
    product_id: UUID
    sale_date: date
    quantity: Annotated[StrictInt, Field(gt=0, le=1_000_000)]
    unit_price: Money

    @field_validator("sale_date")
    @classmethod
    def historical_only(cls, value):
        if value > datetime.now(settings.timezone).date():
            raise ValueError("Sale date cannot be in the future")
        return value

    @model_validator(mode="after")
    def total_fits(self):
        if self.quantity * self.unit_price > Decimal("9999999999.99"):
            raise ValueError("Sale total exceeds the supported amount")
        return self


class SaleUpdate(Input):
    product_id: UUID | None = None
    sale_date: date | None = None
    quantity: Annotated[StrictInt, Field(gt=0, le=1_000_000)] | None = None
    unit_price: Money | None = None

    @model_validator(mode="after")
    def provided_values_not_null(self):
        for name in self.model_fields_set:
            if getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class TrainInput(Input):
    missing_policy: Literal["reject", "zero"] = "reject"
    confirm_complete: bool = False

    @model_validator(mode="after")
    def confirm_zero(self):
        if self.missing_policy == "zero" and not self.confirm_complete:
            raise ValueError("Confirm that missing days are complete records with zero revenue")
        return self


class ForecastInput(Input):
    model_id: UUID
