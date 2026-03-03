---
inclusion: always
---

# Project Structure

## Directory Layout

```
StriveX/
├── backend/              # Flask API server
│   ├── app.py           # Main Flask app (~1,600 lines)
│   ├── models.py        # SQLAlchemy models (User, Goal, Task, etc.)
│   ├── scheduler.py     # Adaptive scheduling engine
│   ├── intelligence.py  # AI behavioral analysis (Gemini integration)
│   ├── requirements.txt # Python dependencies
│   ├── .env.example     # Environment variable template
│   └── test_*.py        # Test suites
├── frontend/            # PWA frontend
│   ├── index.html       # Landing/login page
│   ├── onboarding.html  # 4-step user setup
│   ├── dashboard.html   # Main app interface
│   ├── offline.html     # Offline fallback page
│   ├── manifest.json    # PWA manifest
│   ├── sw.js            # Service Worker
│   ├── css/             # Stylesheets
│   │   ├── style.css    # Landing page styles
│   │   ├── onboarding.css
│   │   └── dashboard.css
│   ├── js/              # Frontend logic
│   │   ├── auth.js      # Authentication & token management
│   │   ├── landing.js   # Landing page interactions
│   │   ├── onboarding.js
│   │   ├── dashboard.js # Main app logic
│   │   └── utils.js     # Shared utilities
│   └── icons/           # PWA icons (192x192, 512x512)
├── .kiro/               # Kiro AI assistant config
│   └── steering/        # Project guidance documents
├── docker-compose.yml   # Multi-container orchestration
├── Dockerfile           # Backend container definition
├── netlify.toml         # Netlify deployment config
├── vercel.json          # Vercel deployment config
└── serve_node.js        # Node.js dev server for frontend
```

## Backend Architecture

### Core Modules

- `app.py`: Flask routes, middleware, WebSocket handlers, security headers
- `models.py`: Database schema (User, Goal, Task, Commitment, DailyLog, BehaviorEvent, Milestone, RefreshToken, OAuthState)
- `scheduler.py`: SchedulingEngine class - breaks goals into tasks, time-blocks, handles replanning
- `intelligence.py`: BehavioralIntelligenceEngine - analyzes patterns, generates nudges, calculates XP/levels

### Database Models

- User: Profile, auth, gamification (XP, streaks)
- Goal: User goals with deadlines and time estimates
- Task: Individual work units scheduled in time blocks
- Commitment: External calendar events (meetings, classes)
- DailyLog: Daily completion stats and energy levels
- BehaviorEvent: Procrastination/focus pattern tracking
- Milestone: Goal checkpoints
- RefreshToken: JWT refresh token storage (hashed)
- OAuthState: CSRF protection for OAuth flows

### API Patterns

- All routes prefixed with `/api`
- JWT required via `@token_required` decorator
- Rate limiting on auth endpoints
- CORS restricted to configured origin
- Error responses: `{"error": "message"}` with appropriate HTTP status
- Success responses: `{"message": "...", "data": {...}}`

## Frontend Architecture

### Page Flow

1. `index.html` → Login/Register
2. `onboarding.html` → 4-step profile setup (wake/sleep times, energy type, work style)
3. `dashboard.html` → Main app (today's tasks, goals, feasibility, XP)

### JavaScript Modules

- `auth.js`: Token storage, refresh scheduling, OAuth callback handling
- `dashboard.js`: Task rendering, "Replan My Day", focus sessions, XP updates
- `onboarding.js`: Multi-step form with validation
- `utils.js`: Shared helpers (API requests, date formatting, etc.)

### Security Patterns

- All user input sanitized via `escapeHtml()` before DOM injection
- JWT expiry checked on page load via `isTokenValid()`
- Tokens stored in localStorage (access + refresh)
- Auto-refresh 2 minutes before expiry
- OAuth tokens captured from URL params and cleaned

### Styling Conventions

- Glassmorphism design (backdrop-filter, semi-transparent backgrounds)
- CSS custom properties for theming
- Mobile-first responsive design
- Dark theme (#08090a background, #5e6ad2 accent)

## Configuration Files

- `.env` (backend): SECRET_KEY, DATABASE_URL, CORS_ORIGIN, GOOGLE_CLIENT_ID/SECRET, SENTRY_DSN
- `manifest.json`: PWA metadata (name, icons, theme colors, shortcuts)
- `docker-compose.yml`: Backend + frontend services with health checks
- `netlify.toml` / `vercel.json`: Frontend deployment with API proxying

## Naming Conventions

- Python: snake_case for functions/variables, PascalCase for classes
- JavaScript: camelCase for functions/variables
- Database tables: lowercase plural (users, goals, tasks)
- API endpoints: kebab-case where applicable
- CSS classes: kebab-case

## File References

When working with file paths in code:
- Backend uses absolute imports from project root
- Frontend uses relative paths from HTML file location
- API_URL auto-detected in `auth.js` (localhost vs production)
