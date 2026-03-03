# ── Stage 1: Builder ──────────────────────────────────────────────────────────
# Install deps in a clean layer so they're cached separately from app code
FROM python:3.11-slim AS builder

WORKDIR /app

# Install dependencies first (better Docker layer caching)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM python:3.11-slim AS production

# Non-root user for security
RUN groupadd -r strivex && useradd -r -g strivex strivex

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /home/strivex/.local

# Copy only backend source (frontend served separately via Netlify/CDN)
COPY backend/ .

# Ensure strivex user owns the app
RUN mkdir -p instance && chown -R strivex:strivex /app
USER strivex

# Environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/home/strivex/.local/bin:$PATH" \
    PORT=5001

EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/api/health')"

# Production server: waitress (no Flask dev server in prod)
CMD ["sh", "-c", "python -m waitress --host=0.0.0.0 --port=${PORT} app:app"]
