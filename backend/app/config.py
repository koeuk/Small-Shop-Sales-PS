import os
import secrets
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import quote_plus
from uuid import UUID
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
DEMO_USER_ID = "00000000-0000-4000-8000-000000000001"


def mysql_url():
    user = quote_plus(os.getenv("DB_USER", "smallshop"))
    password = quote_plus(os.getenv("DB_PASSWORD", "smallshop_local_2026"))
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = int(os.getenv("DB_PORT", "3307"))
    database = quote_plus(os.getenv("DB_NAME", "small_shop_sales"))
    return f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}?charset=utf8mb4"


@dataclass
class Settings:
    mode: str = os.getenv("APP_MODE", "demo")
    database_url: str = os.getenv("DATABASE_URL", mysql_url())
    artifact_dir: Path = Path(os.getenv("ARTIFACT_DIR", str(ROOT / "data/artifacts")))
    admin_email: str = os.getenv("ADMIN_EMAIL", os.getenv("DEMO_EMAIL", "admin@smallshop.local"))
    admin_password: str = os.getenv("ADMIN_PASSWORD", os.getenv("DEMO_PASSWORD", "shopdemo2026"))
    admin_id: str = os.getenv("ADMIN_USER_ID", DEMO_USER_ID)
    jwt_secret: str = os.getenv("JWT_SECRET", "")
    timezone: ZoneInfo = field(
        default_factory=lambda: ZoneInfo(os.getenv("SHOP_TIMEZONE", "Asia/Phnom_Penh"))
    )
    origins: tuple = tuple(
        os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    )

    def validate(self):
        if self.mode not in {"demo", "production"}:
            raise RuntimeError("APP_MODE must be demo or production")
        UUID(self.admin_id)
        if self.mode == "production":
            if (
                len(self.jwt_secret) < 32
                or len(self.admin_password) < 12
                or self.admin_password == "shopdemo2026"
            ):
                raise RuntimeError(
                    "Production requires JWT_SECRET (32+ characters) and a custom ADMIN_PASSWORD (12+ characters)"
                )
            if not self.database_url.startswith("mysql+pymysql://"):
                raise RuntimeError("Production requires a MySQL database")


settings = Settings()
settings.validate()


def signing_secret():
    if settings.jwt_secret:
        return settings.jwt_secret
    path = ROOT / "data/.auth-secret"
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("x") as output:
            path.chmod(0o600)
            output.write(secrets.token_hex(48))
    except FileExistsError:
        pass
    return path.read_text().strip()
