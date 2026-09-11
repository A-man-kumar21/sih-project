FROM node:20-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Install Python for the FastAPI AI engine.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies.
COPY backend-gateway/package.json backend-gateway/package.json
RUN cd backend-gateway && npm install --omit=dev

# Install frontend dependencies and build the production React app.
COPY frontend/package.json frontend/package.json
RUN cd frontend && npm install
COPY frontend/ frontend/
RUN cd frontend && npm run build

# Install Python dependencies into an isolated virtual environment.
COPY ai-engine/requirements.txt ai-engine/requirements.txt
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r ai-engine/requirements.txt

# Copy runtime source code.
COPY backend-gateway/ backend-gateway/
COPY ai-engine/ ai-engine/
COPY mock-adapters/ mock-adapters/
COPY start.sh start.sh

RUN chmod +x start.sh

EXPOSE 10000

CMD ["./start.sh"]
