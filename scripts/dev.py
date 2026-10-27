"""Start the local API and React frontend together. Stop both with Ctrl+C."""

import os
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
python = (
    ROOT / "backend/.venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
)
if not python.exists():
    raise SystemExit("Set up backend/.venv first; see README.md")
existing = set()
checks = {
    8000: ("/openapi.json", "Small Shop Sales API"),
    5173: ("/", "Small Shop Sales"),
}
for port, (path, marker) in checks.items():
    with socket.socket() as connection:
        if connection.connect_ex(("127.0.0.1", port)) == 0:
            try:
                with urllib.request.urlopen(
                    f"http://127.0.0.1:{port}{path}", timeout=3
                ) as response:
                    content = response.read().decode()
                if marker not in content:
                    raise ValueError("Different application")
            except (urllib.error.URLError, ValueError):
                raise SystemExit(
                    f"Port {port} is in use by another application. Stop that server first."
                )
            existing.add(port)
            print(f"Reusing the existing project server on port {port}.", flush=True)
processes = []
try:
    if 8000 not in existing:
        processes.append(
            subprocess.Popen(
                [
                    str(python),
                    "-m",
                    "uvicorn",
                    "app.main:app",
                    "--reload",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "8000",
                ],
                cwd=ROOT / "backend",
                start_new_session=os.name != "nt",
            )
        )
    if 5173 not in existing:
        processes.append(
            subprocess.Popen(
                ["npm", "run", "dev", "--", "--port", "5173", "--strictPort"],
                cwd=ROOT / "web",
                start_new_session=os.name != "nt",
            )
        )
    print(
        "\nFrontend: http://127.0.0.1:5173\nAPI docs: http://127.0.0.1:8000/docs\nPress Ctrl+C to stop servers started by this command.\n",
        flush=True,
    )
    while processes and all(process.poll() is None for process in processes):
        time.sleep(0.5)
except KeyboardInterrupt:
    pass
finally:
    for process in processes:
        if process.poll() is None:
            if os.name == "nt":
                process.terminate()
            else:
                os.killpg(process.pid, signal.SIGTERM)
    for process in processes:
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            if os.name == "nt":
                process.kill()
            else:
                os.killpg(process.pid, signal.SIGKILL)
            process.wait()
