import os
import secrets
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


@dataclass
class Settings:
    mode: str = os.getenv("APP_MODE", "demo")
    database_url: str = os.getenv("DATABASE_URL", f"sqlite:///{ROOT / 'data/shop.db'}")
    artifact_dir: Path = Path(os.getenv("ARTIFACT_DIR", str(ROOT / "data/artifacts")))
    demo_email: str = os.getenv("DEMO_EMAIL", "admin@smallshop.local")
    demo_password: str = os.getenv("DEMO_PASSWORD", "shopdemo2026")
    supabase_url: str = os.getenv("SUPABASE_URL", "").rstrip("/")
    supabase_key: str = os.getenv("SUPABASE_ANON_KEY", "")
    admin_id: str = os.getenv("ADMIN_USER_ID", "")
    timezone: ZoneInfo = ZoneInfo(os.getenv("SHOP_TIMEZONE", "Asia/Phnom_Penh"))
    origins: tuple = tuple(os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","))

    def validate(self):
        if self.mode not in {"demo", "supabase"}:
            raise RuntimeError("APP_MODE must be demo or supabase")
        if self.mode == "supabase" and not all((self.supabase_url, self.supabase_key, self.admin_id, self.database_url.startswith("postgresql"))):
            raise RuntimeError("Supabase mode requires DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY and ADMIN_USER_ID")


settings = Settings()
settings.validate()
DEMO_USER_ID = "00000000-0000-4000-8000-000000000001"


def demo_secret():
    path = ROOT / "data/.demo-secret"
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("x") as output:
            path.chmod(0o600)
            output.write(secrets.token_hex(48))
    except FileExistsError:
        pass
    return path.read_text().strip()
