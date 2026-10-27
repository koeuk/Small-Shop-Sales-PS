import csv
import hashlib
import io
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from uuid import UUID
from zipfile import BadZipFile, ZipFile

from fastapi import HTTPException
from openpyxl import load_workbook
from pydantic import ValidationError
from sqlalchemy import select

from .models import DataImport, Product, Sale
from .schemas import SaleInput

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_ROWS = 10_000


def read_rows(content: bytes, filename: str):
    suffix = Path(filename).suffix.lower()
    if suffix not in {".csv", ".xlsx"}:
        raise ValueError("Only .csv and .xlsx files are supported")
    if not content:
        raise ValueError("The uploaded file is empty")
    if len(content) > MAX_FILE_BYTES:
        raise ValueError("File size must be 5 MB or less")
    if suffix == ".csv":
        try:
            rows = list(csv.reader(io.StringIO(content.decode("utf-8-sig")), strict=True))
        except (UnicodeDecodeError, csv.Error):
            raise ValueError("CSV must be valid UTF-8 text with comma-separated columns")
    else:
        try:
            with ZipFile(io.BytesIO(content)) as archive:
                if sum(item.file_size for item in archive.infolist()) > 25 * 1024 * 1024:
                    raise ValueError("Expanded spreadsheet exceeds the 25 MB limit")
            workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            try:
                rows = []
                for row in workbook.active.iter_rows(values_only=True):
                    rows.append(list(row))
                    if len(rows) > MAX_ROWS + 1:
                        raise ValueError(f"Import is limited to {MAX_ROWS:,} rows")
            finally:
                workbook.close()
        except (BadZipFile, KeyError, OSError):
            raise ValueError("Unable to read this XLSX workbook")
    rows = [row for row in rows if any(value is not None and str(value).strip() for value in row)]
    if len(rows) < 2:
        raise ValueError("Include a header and at least one sales row")
    if len(rows) - 1 > MAX_ROWS:
        raise ValueError(f"Import is limited to {MAX_ROWS:,} rows")
    headers = [str(value or "").strip().lower() for value in rows[0]]
    if len(headers) != len(set(headers)) or "" in headers:
        raise ValueError("Column headers must be unique and nonempty")
    required = {"sale_date", "quantity", "unit_price"}
    if not required.issubset(headers) or not {"product_id", "product_name"}.intersection(headers):
        raise ValueError("Required columns: sale_date, product_name (or product_id), quantity, unit_price")
    return headers, rows[1:]


def prepare_import(session, owner_id, content, filename):
    fingerprint = hashlib.sha256(content).hexdigest()
    existing = session.scalar(select(DataImport).where(DataImport.owner_id == owner_id, DataImport.fingerprint == fingerprint))
    if existing and existing.status == "completed":
        raise HTTPException(409, "This file has already been imported. Rename does not bypass duplicate detection.")
    products = list(session.scalars(select(Product).where(Product.owner_id == owner_id, Product.archived.is_(False))))
    by_id = {product.id: product for product in products}
    by_name = {product.name.casefold(): product for product in products}
    valid, errors, preview = [], [], []
    try:
        headers, rows = read_rows(content, filename)
    except (ValueError, TypeError, OverflowError) as exc:
        return {"fingerprint": fingerprint, "total_rows": 0, "valid_rows": 0, "invalid_rows": 0, "errors": [{"row": 0, "message": str(exc)}], "preview": [], "fatal": True}, [], existing
    for number, values in enumerate(rows, start=2):
        row = dict(zip(headers, values))
        error = None
        try:
            if len(values) > len(headers):
                raise ValueError("More values than column headers")
            product_id = str(row.get("product_id") or "").strip()
            product_name = str(row.get("product_name") or "").strip()
            product = by_id.get(str(UUID(product_id))) if product_id else by_name.get(product_name.casefold())
            if not product:
                raise ValueError("Product is unknown or archived; create or restore it before importing")
            if product_id and product_name and product.name.casefold() != product_name.casefold():
                raise ValueError("product_id and product_name refer to different products")
            quantity = str(row.get("quantity", "")).strip()
            if not re.fullmatch(r"[1-9]\d*", quantity):
                raise ValueError("Quantity must be a positive whole number")
            day = row.get("sale_date")
            if isinstance(day, datetime):
                day = day.date()
            elif not isinstance(day, date):
                day = str(day).strip()
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
                    raise ValueError("Dates must use YYYY-MM-DD")
                day = date.fromisoformat(day)
            sale = SaleInput(product_id=product.id, sale_date=day, quantity=int(quantity), unit_price=Decimal(str(row.get("unit_price", "")).strip()))
            valid.append({**sale.model_dump(), "product_id": product.id, "total_amount": sale.quantity * sale.unit_price, "source_row": number})
        except (ValidationError, ValueError, TypeError, InvalidOperation, OverflowError) as exc:
            error = "; ".join(item["msg"] for item in exc.errors()) if isinstance(exc, ValidationError) else str(exc)
            errors.append({"row": number, "message": error})
        if len(preview) < 15:
            preview.append({"row": number, "sale_date": str(row.get("sale_date", "")), "product": str(row.get("product_name") or row.get("product_id") or ""), "quantity": str(row.get("quantity", "")), "unit_price": str(row.get("unit_price", "")), "error": error})
    return {"fingerprint": fingerprint, "total_rows": len(rows), "valid_rows": len(valid), "invalid_rows": len(errors), "errors": errors[:100], "preview": preview, "fatal": False}, valid, existing


def commit_import(session, owner_id, filename, summary, valid, existing, synthetic):
    record = existing or DataImport(owner_id=owner_id, fingerprint=summary["fingerprint"], file_name=filename[:255], file_type=Path(filename).suffix.lstrip(".").lower()[:20])
    record.total_rows = summary["total_rows"]
    record.row_count = len(valid)
    record.invalid_rows = summary["invalid_rows"]
    record.status = "completed" if valid else "failed"
    record.error_summary = "\n".join(f"Row {item['row']}: {item['message']}" for item in summary["errors"]) or None
    record.synthetic = synthetic
    session.add(record)
    session.flush()
    for values in valid:
        session.add(Sale(owner_id=owner_id, import_id=record.id, **values))
    session.flush()
    return record
