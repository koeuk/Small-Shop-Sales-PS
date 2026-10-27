# Small Shop Sales Prediction System

 <!-- python -m uvicorn main:app --reload -->

Initial project setup only. Requirements are in [plan.md](plan.md).

```text
backend/    Python / FastAPI API
web/        React (JavaScript) / Vite frontend
```

## Requirements

- Python 3.12+
- Node.js 22.12+ and npm

## Backend

From the project root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

The virtual environment and dependencies are already installed in this workspace.
For subsequent runs, activate the environment and run Uvicorn.

If `python3 -m venv` reports that `ensurepip` is unavailable, use the installed
`uv` tool instead: `uv venv --seed --python 3.12 .venv` (inside `backend/`).

- API health check: <http://127.0.0.1:8000/api/health>
- Interactive API docs: <http://127.0.0.1:8000/docs>

## Frontend

In a second terminal, from the project root:

```bash
cd web
npm ci
npm run dev
```

Dependencies are already installed in this workspace. For subsequent runs, use
`npm run dev` from `web/`.

Open the URL printed by Vite (normally <http://localhost:5173>).

```bash
npm run lint
npm run build
```

Database, authentication, sales features, and machine learning are not configured yet.
