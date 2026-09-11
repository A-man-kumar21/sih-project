import os
import signal
import subprocess
import sys
import time

processes = []

def shutdown(_signum=None, _frame=None):
    for process in processes:
        if process.poll() is None:
            process.terminate()
    for process in processes:
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
    sys.exit(0)

signal.signal(signal.SIGTERM, shutdown)
signal.signal(signal.SIGINT, shutdown)

os.environ.setdefault("AI_ENGINE_URL", "http://127.0.0.1:8000")
os.environ.setdefault("PORT", "10000")

processes.append(
    subprocess.Popen([
        "/opt/venv/bin/uvicorn", "app.main:app",
        "--host", "127.0.0.1", "--port", "8000"
    ], cwd="/app/ai-engine")
)

time.sleep(1)

processes.append(
    subprocess.Popen(["node", "src/server.js"], cwd="/app/backend-gateway")
)

while True:
    if any(process.poll() is not None for process in processes):
        shutdown()
    time.sleep(2)
