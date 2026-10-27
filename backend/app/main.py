from fastapi import FastAPI

app = FastAPI(title="Small Shop Sales API", version="0.1.0")


@app.get("/api/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
