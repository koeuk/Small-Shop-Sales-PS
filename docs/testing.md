# Verification

The system was exercised against **MySQL 8.0.46**, FastAPI, React and Vite.
Docker Compose targets MySQL 8.4; the existing MySQL server is configured in this
workspace. Tests use a separate schema whose name ends in `_test`.

## Backend

```bash
cd backend
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m scripts.test_mysql
ruff check app tests
ruff format --check app tests
```

`scripts.test_mysql` reads the database connection from `.env`, replaces only the
database name with the test name from `.env.test` (or appends `_test`), and runs pytest.
It drops/recreates the six tables in that test schema before each test. Never point
it at an application database. The schema must exist and the account needs table
creation/deletion privileges there.

Portable tests can also run with `python -m pytest -q`. They use a fresh temporary
SQLite file solely as a test harness, with the same ORM. The application itself
defaults to MySQL.

Coverage includes unauthenticated/forged-token denial, administrator sign-in,
ownership isolation, product edit/archive/delete behavior, retained historical
prices, server-calculated totals, invalid input rejection, CSV/XLSX preview and
partial commit, duplicate-file rejection, malformed spreadsheet auditing, inflated
dimensions, Unicode product mapping, insufficient history, explicit missing-date
policy, chronological train/validation/test boundaries, recursive feature leakage,
seven future nonnegative dates, CSV export, stale models, and preserved forecast
history after retraining.

## Frontend

```bash
cd web
npm run lint
npm run build
```

Production builds split the chart library into a separate chunk, and fonts are
bundled locally. `npm run preview` previews frontend output; set an API URL or use
the configured local API proxy.

## Browser workflow

The native Python Playwright script `scripts/browser_check.py` uses real endpoints
and data. It covers sign-in, sample loading, product and sales create/edit/delete,
CSV validation and commit, training, forecast generation, CSV download, session
survival on reload, 390-pixel mobile overflow/navigation checks and sign-out. It
also asserts that the browser raised no uncaught JavaScript errors.

Run the two servers first, then (in an environment with Python Playwright installed):

```bash
python3 -m playwright install chromium
python3 scripts/browser_check.py
```

Use a fresh demo database. The script loads synthetic data and creates records;
it is not intended for a database containing real sales. Screenshots are written
to `docs/screenshots/`.

## Acceptance mapping

| Requirement | Verification |
| --- | --- |
| TC-01–03 products, totals, invalid quantity | Backend tests; browser CRUD |
| TC-04–05 imports and malformed files | Backend CSV/XLSX tests; browser import |
| TC-06–08 models, insufficient data, holdout | Backend ML tests; browser training |
| TC-09–10 seven-day output and linked history | Backend forecast tests; browser export/history |
| TC-11 protected endpoints | Backend authentication/ownership tests |
| TC-12 retrain and retain older forecasts | Backend end-to-end retraining test |

No live forecast accuracy guarantee is claimed. Metrics and screenshots describe
the generated demonstration dataset. Performance is observed on this development
machine, not load-tested for public multi-user deployment.

The temporary standalone MySQL instance used early in verification listens on
localhost:3307. The execution environment denied signaling that process during
cleanup; it is not used by the application, which connects to the configured
existing server on port 3306. Its runtime directory and PID are recorded in
`/tmp/small-shop-mysql-runtime.json` and that directory's `mysql.pid` file, for
cleanup from the host terminal. The existing MySQL service must remain running.

User-management verification includes Argon2 storage, bootstrap idempotence,
case-normalized unique emails, account CRUD, administrator/operator permissions,
shared-shop access, password reset, deactivation, token revocation, password
whitespace, rejection of legacy sessions, and preservation of the final active
administrator and original owner. `scripts/users_browser_check.py` exercises those
flows through the real interface with a temporary account that is deleted afterward.
Custom demo sign-ins can be supplied to browser checks with `BROWSER_ADMIN_EMAIL`
and `BROWSER_ADMIN_PASSWORD` environment variables; keep password values out of
shared command history.
