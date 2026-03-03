---
inclusion: always
---

# Tech Stack & Build System

## Backend

- Python 3.11+
- Flask 3.0 (REST API)
- SQLAlchemy (ORM)
- Flask-SocketIO + eventlet (WebSockets)
- PyJWT (authentication)
- Flask-Bcrypt (password hashing)
- Flask-Limiter (rate limiting)
- google-generativeai (AI integration)
- Waitress (production WSGI server)
- Sentry (error tracking)
- loguru (structured logging)

## Frontend

- Vanilla JavaScript (no framework)
- HTML5 + CSS3 (glassmorphism design)
- Service Worker (offline support)
- Web App Manifest (PWA)

## Database

- Development: SQLite (strivex.db)
- Production: PostgreSQL via DATABASE_URL env var
- Migrations: Alembic

## Authentication

- JWT tokens (15-minute access, 30-day refresh)
- OAuth 2.0 (Google Sign-In via Authlib)
- bcrypt password hashing
- Rate limiting: 5 register/hr, 10 login/hr per IP

## Common Commands

### Development

```bash
# Setup virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r backend/requirements.txt

# Start backend (port 5001)
cd backend
python app.py

# Start frontend (port 3001)
node serve_node.js
```

### Testing

```bash
# Run API tests
python backend/test_api.py

# Run E2E tests
python backend/test_e2e.py

# Run new endpoint tests
python backend/test_new_endpoints.py
```

### Docker

```bash
# Start full stack
docker-compose up

# Rebuild after changes
docker-compose up --build

# Stop services
docker-compose down
```

### Production Deployment

```bash
# Backend (Waitress WSGI)
cd backend && python -m waitress --port=$PORT app:app

# Environment variables required:
# - SECRET_KEY (generate with: python -c "import secrets; print(secrets.token_hex(32))")
# - CORS_ORIGIN (frontend URL)
# - DATABASE_URL (PostgreSQL connection string)
# - GOOGLE_CLIENT_ID (optional, for OAuth)
# - GOOGLE_CLIENT_SECRET (optional, for OAuth)
# - SENTRY_DSN (optional, for error tracking)
```

## API Documentation

Swagger/OpenAPI docs available at `/apidocs` when backend is running.

## Security Features

- CORS locked to configured origin
- Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- XSS protection via HTML escaping
- Rate limiting on auth endpoints
- JWT token rotation
- No secrets in git (.env excluded)
