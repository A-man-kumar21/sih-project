#!/bin/sh
set -eu

# FastAPI AI engine stays private inside the container.
cd /app/ai-engine
uvicorn app.main:app --host 127.0.0.1 --port 8000 &
AI_PID=$!

# Express gateway stays private; nginx exposes the single public Render port.
cd /app/backend-gateway
export PORT=3001
export AI_ENGINE_URL="${AI_ENGINE_URL:-http://127.0.0.1:8000}"
node src/server.js &
NODE_PID=$!

term_handler() {
  kill "$AI_PID" "$NODE_PID" 2>/dev/null || true
  wait "$AI_PID" "$NODE_PID" 2>/dev/null || true
}
trap term_handler INT TERM EXIT

# nginx is the public process on Render's $PORT (10000 by default).
nginx -g 'daemon off;' &
NGINX_PID=$!

# Keep the container alive while the public server is running.
wait "$NGINX_PID"
