import hashlib
import math
import random
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select

from .config import settings
from .models import DataImport, Product, Sale


def seed_demo(session, owner_id):
    if settings.mode != "demo":
        raise HTTPException(403, "Sample data is available only in local demo mode")
    if session.scalar(select(func.count()).select_from(Sale).where(Sale.owner_id == owner_id)):
        raise HTTPException(409, "Load sample data into an empty sales history to avoid mixing synthetic and real sales")
    catalog = [("Coffee", "Drinks", "2.00", 24), ("Iced latte", "Drinks", "3.50", 18), ("Matcha tea", "Drinks", "3.00", 12), ("Butter croissant", "Bakery", "2.50", 16), ("Chocolate cookie", "Bakery", "1.50", 20)]
    products = []
    for name, category, price, base in catalog:
        product = session.scalar(select(Product).where(Product.owner_id == owner_id, func.lower(Product.name) == name.lower()))
        if not product:
            product = Product(owner_id=owner_id, name=name, category=category, price=Decimal(price))
            session.add(product)
            session.flush()
        if product.archived:
            raise HTTPException(409, f"Restore {name} before loading sample data")
        products.append((product, base))
    today = datetime.now(settings.timezone).date()
    start = today - timedelta(days=180)
    record = DataImport(owner_id=owner_id, file_name="synthetic-demo-180-days.csv", file_type="csv", fingerprint=hashlib.sha256(f"synthetic-v1-{today}".encode()).hexdigest(), status="completed", row_count=900, total_rows=900, invalid_rows=0, synthetic=True)
    session.add(record)
    session.flush()
    rng = random.Random(42)
    row = 2
    for index in range(180):
        day = start + timedelta(days=index)
        factor = 1 + 0.0015 * index + (0.22 if day.weekday() >= 5 else 0) + 0.06 * math.sin(index / 9)
        for product, base in products:
            quantity = max(1, round(base * factor + rng.gauss(0, 2.5)))
            session.add(Sale(owner_id=owner_id, product_id=product.id, sale_date=day, quantity=quantity, unit_price=product.price, total_amount=product.price * quantity, import_id=record.id, source_row=row))
            row += 1
    return {"message": "Loaded 180 days of synthetic sales (900 rows). This dataset is for classroom demonstration.", "row_count": 900}
