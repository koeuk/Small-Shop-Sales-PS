# Small Shop Sales Prediction System

A complete university prototype: **React (JavaScript) + FastAPI + MySQL**.
The interface is called **little shop**. It manages sales history, validates
CSV/XLSX imports, compares forecasting models, and saves seven-day revenue forecasts.

## Run this workspace

MySQL is configured in ignored `backend/.env`, using the dedicated
`smallshop_ps` account and `small_shop_sales_ps` database on localhost:3306.
The root database password is not stored in the project.

From the project root:

```bash
python3 scripts/dev.py
```

Open **http://127.0.0.1:5173**. API documentation: **http://127.0.0.1:8000/docs**.
Ctrl+C stops servers started by the command; existing project servers are reused. Keep the MySQL service running.

Default local demo sign-in:

- Email: `admin@smallshop.local`
- Password: `shopdemo2026`

The sign-in page can fill these demo credentials. Synthetic sample sales, trained
models, and forecasts generated during verification are available in the local
workspace. On an empty database, use **Load sample data** on the overview.

## Step-by-step usage

1. **Products:** create or edit products and their catalog prices.
2. **Sales records:** add sales or edit historical records; totals are calculated on
   the server and historical prices are retained.
3. **Import data:** choose CSV/XLSX, preview row errors, then confirm importing valid
   rows. Existing active products are required. Identical completed files are blocked.
4. **Model training:** review date coverage and missing days, then compare historical
   average, previous-week baseline, Linear Regression and Random Forest. The
   recommendation uses chronological validation MAE.
5. **Forecasts:** choose a trained model, generate tomorrow through seven days ahead,
   inspect daily estimates and download CSV. Past runs retain their original model.
6. **Overview:** review revenue, daily charts, bestsellers, dataset quality and your
   current upcoming forecast. Retrain after historical sales change.

Forecasts are estimates. Synthetic data is explicitly labeled. No forecast accuracy
is guaranteed. The classroom generator produces 900 sales over 180 completed days.

## Set up on another machine

Requirements: Python 3.12+, Node.js 22.12+, npm, and MySQL 8.0.16+ (8.4 recommended).

### 1. MySQL

Use your own project database/account and fill the `DB_*` settings in
`backend/.env`, or start the optional isolated Docker database:

```bash
docker compose up -d --wait
```

Docker exposes MySQL only on localhost:3307, creates `small_shop_sales`, and stores
its data in a named volume. The defaults in `backend/.env.example` match this Docker
configuration. On machines where Docker requires elevation, use `sudo docker compose
up -d --wait`. Keep the configured existing-server `.env` when using localhost:3306.

```bash
cp backend/.env.example backend/.env
```

Run that copy command only for a new setup; it would replace this workspace's
configured credentials. The API creates the five tables automatically on first
startup. Inspect the schema in [database/schema.sql](database/schema.sql).

### 2. Python API

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If the system lacks `ensurepip`, create the environment with the installed `uv`
tool instead: `uv venv --seed --python 3.12 .venv`.

### 3. React frontend

In a second terminal, from the project root:

```bash
cd web
npm ci
npm run dev
```

Vite proxies `/api` to localhost:8000. For a hosted frontend, configure
`VITE_API_BASE_URL` and backend `CORS_ORIGINS`. The Vite preview server has the same
local API proxy. All fonts are bundled; no external font request is needed.

## Checks

```bash
cd backend
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m scripts.test_mysql
ruff check app tests
```

`backend/requirements-dev.lock.txt` records the complete verified Python environment
when identical dependency versions are needed.

MySQL tests require a separate project `_test` schema; the configured workspace has
one. Ordinary `python -m pytest -q` uses a temporary SQLite test harness and does
not use the application database. SQLite is not the application's default storage.

```bash
cd web
npm run lint
npm run build
```

The full browser script is `scripts/browser_check.py`; see
[verification instructions](docs/testing.md). It loads synthetic demo data and
should be used only on a demo database.

## Project layout

```text
backend/app/         Auth, API, models, imports, preprocessing/training/forecasting
backend/tests/       Integration and ML leakage regression tests
backend/data/        Ignored local secrets and trusted model artifacts
backend/.env         Ignored MySQL and administrator settings
web/src/             React screens, charts, API client, and styles
database/            MySQL DDL
samples/             Example CSV and synthetic dataset / evaluation export
docs/                Implementation guide, test notes, browser screenshots
scripts/             Development launcher and browser workflow checks
```

Read the [step-by-step implementation guide](docs/implementation.md) for the data
model, import contract, ML methodology and presentation flow. The updated
requirements are in [plan.md](plan.md).

## Configuration and persistence

`APP_MODE=demo` enables sample loading and default local credentials. Production
mode requires a custom administrator password and a random `JWT_SECRET` of at least
32 characters. JWTs expire after eight hours. No external authentication provider
is used. The administrator is configured on the server; there is no users table.

MySQL records and `backend/data/artifacts/` must be backed up together. Training
is synchronous and creates new model versions. Model artifacts are validated
before loading, are not uploaded by users, and must never be replaced by untrusted
files. The prototype covers one administrator, shop, and USD currency.
