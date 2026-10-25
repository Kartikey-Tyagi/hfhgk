# ==============================================================================
# Wind Forecast Intelligence — Backend Dockerfile
# Python 3.12 / FastAPI / Uvicorn
# ==============================================================================

FROM python:3.12-slim

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Install curl for container health checks and ca-certificates for verified TLS
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Create a non-privileged user and group for security
RUN groupadd -g 1000 appgroup && \
    useradd -u 1000 -g appgroup -s /bin/bash -m appuser

WORKDIR /app

# Copy dependency specifications first to leverage Docker layer cache
COPY requirements.txt .

# Upgrade pip and install production dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY app/ ./app/

# Set ownership of application files to non-privileged user
RUN chown -R appuser:appgroup /app

# Switch to non-privileged user
USER appuser

# Expose FastAPI service port
EXPOSE 8000

# Container health check against official health endpoint
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

# Start Uvicorn ASGI server bound to all network interfaces on dynamically assigned $PORT (defaults to 8000)
# 'exec' ensures Uvicorn runs as PID 1 to handle SIGTERM/SIGINT signals gracefully.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

