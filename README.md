# StriveX — Adaptive AI Productivity Scheduler

> Stop planning. Start achieving. StriveX turns your goals into an intelligent daily schedule that adapts in real-time and learns your behaviour.

[![License: MIT](https://img.shields.io/badge/License-MIT-5e6ad2.svg)](LICENSE)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue.svg)](https://python.org)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-5e6ad2.svg)](https://web.dev/progressive-web-apps/)

---

## Features

- **Adaptive Daily Scheduling** — Goals broken into time-blocked tasks, auto-rescheduled around your commitments
- **AI Behavioral Mentor** — Personalized nudges based on your productivity patterns
- **Feasibility Engine** — Live % chance of hitting your deadline, with consequence messaging
- **Ghost Mode** — Schedule protected time without distractions
- **Voice-to-Goal** — Speak your goals, StriveX parses them
- **PWA** — Install on Android/iOS as a home screen app
- **Replan My Day** — One-click rescheduler for the rest of today

---

## Quick Start (Local)

### Prerequisites
- Python 3.11+
- Node.js 18+ (for the frontend dev server)

### 1. Clone & Setup Backend
```bash
git clone https://github.com/shru089/StriveX.git
cd StriveX

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate       # Windows
# source .venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r` backend/requirements.txt
```

### 2. Configure Environment
```bash
# Copy .env.example and fill in your values
cp backend/.env.example backend/.env
```

**Required** — Generate a secure `SECRET_KEY`:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
Paste the output into `backend/.env` as `SECRET_KEY=<your key>`.

### 3. Start the App
```bash
# Windows — double-click or run:
start_strivex.bat

# Or manually:
# Terminal 1 — Backend (port 5001)
cd backend && python app.py

# Terminal 2 — Frontend (Vite App)
cd frontend-react
npm install
npm run dev
```

Open **http://localhost:3001**

---

## Deploy to Production

### Backend → [Railway](https://railway.app) (Recommended)

1. Push your repository to GitHub.
2. Go to Railway -> **New Project** -> **Deploy from GitHub repo** -> Select `StriveX`.
3. Railway will auto-detect the `railway.toml` and build the Python API.
4. **Environment Variables** (in Railway variables settings):
   - `SECRET_KEY` = your strong random key
   - `CORS_ORIGIN` = `https://your-strivex.vercel.app` (Your frontend URL)
   - `DATABASE_URL` = (optional, defaults to SQLite, or add Railway Postgres service)
5. Generate a public domain in Railway Networking settings to get your API URL.

### Frontend → [Vercel](https://vercel.com) (Free tier)

1. Import your GitHub repository to Vercel.
2. Vercel will automatically detect the **Vite** framework from `frontend-react`.
3. **Environment Variables** (in Vercel):
   - `VITE_API_URL` = `https://your-backend.up.railway.app/api` (Your Railway backend URL)
4. Deploy! Copy the final Vercel URL and set it as `CORS_ORIGIN` in your Railway backend.

---

## Install as Mobile App (PWA)

**Android (Chrome):**
1. Open the site in Chrome
2. Tap the 3-dot menu → "Add to Home screen"
3. StriveX appears as a native-looking app

**iOS (Safari):**
1. Open the site in Safari
2. Tap Share → "Add to Home Screen"
3. StriveX appears with its icon on your home screen

---

## Security

- **JWT Auth** — 7-day tokens signed with a strong secret key
- **Rate Limiting** — 5 register/hr, 10 login/hr per IP (brute-force protection)
- **CORS Locked** — Only your configured `CORS_ORIGIN` can call the API
- **Security Headers** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
- **Input Validation** — Email format, password min-length enforced server-side
- **XSS Protection** — All user data sanitized via `escapeHtml()` before DOM injection
- **No Secrets in Git** — `.gitignore` excludes `.env`, `*.db`, logs, and virtualenv

---

## Project Structure

```
StriveX/
├── backend/
│   ├── app.py           # Flask API + security middleware
│   ├── models.py        # SQLAlchemy database models
│   ├── scheduler.py     # Adaptive scheduling engine
│   ├── intelligence.py  # AI behavioral analysis
│   ├── requirements.txt
│   └── .env.example     # Environment variable template
├── frontend-react/
│   ├── src/             # React application source code
│   ├── public/          # Static assets including manifest.json for PWA
│   ├── index.html       # Vite HTML entry point
│   ├── package.json     # Dependencies & scripts
│   └── .env.example     # Environment variable template
├── .gitignore
├── docker-compose.yml   # Docker setup
└── vercel.json          # Deployment config
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3 (Glassmorphism), Vanilla JS |
| Backend | Python 3.11, Flask 3.0 |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Auth | JWT (PyJWT) + bcrypt |
| PWA | Web App Manifest + Service Worker |
| WSGI | Waitress (production) |

---

## License

MIT — see [LICENSE](LICENSE)
