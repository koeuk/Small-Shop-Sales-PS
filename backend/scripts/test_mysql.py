"""Run integration tests only against the project's separate MySQL test schema."""

import os
import subprocess
import sys

from dotenv import dotenv_values
from sqlalchemy.engine import make_url

from app.config import ROOT, settings

test_name = dotenv_values(ROOT / ".env.test").get("TEST_DATABASE_NAME")
test_name = test_name or f"{make_url(settings.database_url).database}_test"
if not test_name.endswith("_test"):
    raise SystemExit("Test database name must end in _test")
url = make_url(settings.database_url).set(database=test_name)
if url.get_backend_name() != "mysql":
    raise SystemExit("This command requires a MySQL connection")
environment = dict(os.environ)
environment["TEST_DATABASE_URL"] = url.render_as_string(hide_password=False)
print(f"Running tests against {test_name}; application data is untouched.", flush=True)
raise SystemExit(subprocess.call([sys.executable, "-m", "pytest", "-q"], cwd=ROOT, env=environment))
