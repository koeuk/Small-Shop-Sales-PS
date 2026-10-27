"""Start the local API and React frontend together. Stop both with Ctrl+C."""

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
python = ROOT / "backend/.venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
if not python.exists():
    raise SystemExit("Set up backend/.venv first; see README.md")
for port in [8000, 5173]:
    with socket.socket() as connection:
        if connection.connect_ex(("127.0.0.1", port)) == 0:
            raise SystemExit(f"Port {port} is already in use. Stop that server first.")
processes = []
try:
    processes.append(subprocess.Popen([str(python), "-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"], cwd=ROOT / "backend"))
    processes.append(subprocess.Popen(["npm", "run", "dev", "--", "--port", "5173", "--strictPort"], cwd=ROOT / "web"))
    print("\nFrontend: http://127.0.0.1:5173\nAPI docs: http://127.0.0.1:8000/docs\nPress Ctrl+C to stop both.\n", flush=True)
    while all(process.poll() is None for process in processes):
        time.sleep(0.5)
except KeyboardInterrupt:
    pass
finally:
    for process in processes:
        process.terminate()
    for process in processes:
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
