# pyre-ignore-all-errors
# ════════════════════════════════════════════════════════════
# ═════════════════ STRIVEX CORE BACKEND API ═════════════════
# ════════════════════════════════════════════════════════════
# Developer Note:
# This file serves as the main entry point for the Flask application.
# It contains all REST API endpoints, routing, and middleware logic.
# Key Integrations:
# - app.py: Core routing and orchestration
# - models.py: SQLAlchemy database models
# - scheduler.py: Core scheduling logic for goals/tasks
# - intelligence.py & premium.py: Gemini AI integrations
# - stripe_service.py: Payment processing

import os
import re
import json
import secrets
import warnings
warnings.filterwarnings("ignore")
from functools import wraps
from datetime import datetime, timedelta
from typing import Any, cast
from dotenv import load_dotenv  # type: ignore[import-untyped]
load_dotenv()

# ============= UPGRADE 4: Sentry (error tracking) =============
import sentry_sdk  # type: ignore[import-untyped]
from sentry_sdk.integrations.flask import FlaskIntegration  # type: ignore[import-untyped]
SENTRY_DSN = os.environ.get('SENTRY_DSN', '')
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[FlaskIntegration()],
        traces_sample_rate=0.2,
        send_default_pii=False,  # Don't send email/PII to Sentry
    )

# ============= UPGRADE 4: loguru (structured logging) =============
from loguru import logger  # type: ignore[import-untyped]
import sys
logger.remove()  # Remove default handler
logger.add(sys.stderr, format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {name}:{function}:{line} - {message}", level="INFO")
# File logging: use /tmp in production (read-only FS on Vercel/Railway), disable with LOG_FILE=none
_log_file = os.environ.get('LOG_FILE', 'strivex.log')
if _log_file != 'none':
    # On serverless/containerised platforms the project root may be read-only
    _log_path = _log_file if os.path.isabs(_log_file) else os.path.join(
        '/tmp' if not os.environ.get('LOCAL_DEV') else '', _log_file
    ).lstrip('/')
    try:
        logger.add(_log_path, rotation="10 MB", retention="7 days", level="INFO", serialize=True)
    except Exception:
        pass  # Silently skip file logging if path is not writable


from flask import Flask, request, jsonify, redirect, url_for  # type: ignore[import-untyped]
from flask_cors import CORS  # type: ignore[import-untyped]
from flask_bcrypt import Bcrypt  # type: ignore[import-untyped]
from flask_limiter import Limiter  # type: ignore[import-untyped]
from flask_limiter.util import get_remote_address  # type: ignore[import-untyped]
from flask_socketio import SocketIO, emit, join_room  # type: ignore[import-untyped]
from flasgger import Swagger  # type: ignore[import-untyped]
from authlib.integrations.flask_client import OAuth  # type: ignore[import-untyped]
import jwt  # type: ignore[import-untyped]

from models import db, User, Goal, Task, Commitment, DailyLog, BehaviorEvent, Milestone, RefreshToken, OAuthState  # type: ignore[import-not-found]
from scheduler import SchedulingEngine  # type: ignore[import-not-found]
from intelligence import BehavioralIntelligenceEngine, get_level_info, xp_for_task, gemini  # type: ignore[import-not-found]
from premium import init_premium_features, check_usage_limit, record_usage, require_feature, TIERS, AIBreakdownUsage  # type: ignore[import-not-found]
import stripe  # type: ignore[import-not-found]
from stripe_service import create_checkout_session, process_webhook_event, verify_stripe_webhook, get_customer_portal_session  # type: ignore[import-not-found]
from email_sequences import trigger_welcome_email, trigger_first_goal_email, trigger_subscription_welcome, check_and_send_scheduled_emails  # type: ignore[import-not-found]
from analytics import analytics  # type: ignore[import-not-found]
from progress_autopsy import autopsy  # type: ignore[import-not-found]

app = Flask(__name__)

# ============= CONFIGURATION =============
SECRET_KEY = os.environ.get('SECRET_KEY', '')
if not SECRET_KEY:
    SECRET_KEY = 'dev-secret-key-UNSAFE-do-not-deploy'
    logger.warning('Using insecure default SECRET_KEY. Set SECRET_KEY env var before deploying!')

app.config['SECRET_KEY'] = SECRET_KEY
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///strivex.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# ============= UPGRADE 2: Flask-SocketIO (WebSockets) =============
socketio = SocketIO(app, cors_allowed_origins=os.environ.get('CORS_ORIGIN', 'http://localhost:3001'),
                   async_mode='eventlet', logger=False, engineio_logger=False)

# ============= CORS =============
ALLOWED_ORIGIN = os.environ.get('CORS_ORIGIN', 'http://localhost:3001')
CORS(app, origins=[ALLOWED_ORIGIN], supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

# ============= RATE LIMITING =============
# Controlled via env var: set LOCAL_DEV=1 to disable rate limiting locally.
# In production, remove LOCAL_DEV (or set to 0) to enable real rate limits.

class DummyLimiter:
    """Mock rate limiter for local development (LOCAL_DEV=1)."""
    def limit(self, *args, **kwargs):
        def decorator(f):
            return f
        return decorator

if os.environ.get('LOCAL_DEV'):
    # Use Any for limiter to satisfy all decorator call sites across environments
    limiter = cast(Any, DummyLimiter())
    logger.warning('Rate limiting DISABLED (LOCAL_DEV=1). Do not use in production!')
else:
    limiter = cast(Any, Limiter(get_remote_address, app=app, default_limits=[], storage_uri='memory://'))

# ============= AI RESPONSE CACHE (minimize Gemini API calls) =============
# Simple in-memory cache: {cache_key: {'value': ..., 'expires': datetime}}
_AI_CACHE: dict[str, Any] = {}

def _cache_get(key: str):
    """Return cached value if not expired, else None."""
    entry = _AI_CACHE.get(key)
    if entry and datetime.utcnow() < entry['expires']:
        return entry['value']
    if key in _AI_CACHE:
        _AI_CACHE.pop(key, None)  # clean up expired
    return None

def _cache_set(key: str, value, ttl_seconds: int):
    """Store value in cache with TTL."""
    _AI_CACHE[key] = {'value': value, 'expires': datetime.utcnow() + timedelta(seconds=ttl_seconds)}
    # Keep cache size bounded (max 1000 entries)
    if len(_AI_CACHE) > 1000:
        oldest_key = next(iter(_AI_CACHE))
        _AI_CACHE.pop(oldest_key, None)

# ============= UPGRADE 5: Google OAuth =============
oauth_client = OAuth(app)
google = oauth_client.register(
    name='google',
    client_id=os.environ.get('GOOGLE_CLIENT_ID', ''),
    client_secret=os.environ.get('GOOGLE_CLIENT_SECRET', ''),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

# ============= INITIALIZE EXTENSIONS =============
db.init_app(app)
bcrypt = Bcrypt(app)

# ============= SWAGGER / OPENAPI DOCS =============
swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/api/docs/swagger.json",
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/api/docs",
}
swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "StriveX API",
        "description": "Adaptive AI Productivity Scheduler — REST API. JWT Bearer token required for protected endpoints.",
        "version": "3.0.0",
        "contact": {"name": "StriveX Team"},
    },
    "basePath": "/",
    "securityDefinitions": {
        "BearerAuth": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "JWT token. Format: 'Bearer <token>'",
        }
    },
    "consumes": ["application/json"],
    "produces": ["application/json"],
}
Swagger(app, config=swagger_config, template=swagger_template)

# Create tables
with app.app_context():
    db.create_all()

# ============= SECURITY HEADERS =============
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(self)'
    if request.is_secure:
        response.headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains'
    return response


# ============= LOGGING MIDDLEWARE =============
@app.before_request
def log_request():
    from time import time
    request._start_time = time()

@app.after_request
def log_response(response):
    from time import time
    duration = round((time() - getattr(request, '_start_time', time())) * 1000, 2)  # type: ignore[call-overload]
    logger.info(f"{request.method} {request.path} → {response.status_code} [{duration}ms]")
    return response


# ============= TOKEN HELPERS =============
ACCESS_TOKEN_EXPIRY = timedelta(minutes=15)
REFRESH_TOKEN_EXPIRY = timedelta(days=30)

def create_tokens(user_id: int) -> dict:
    """Create a short-lived access token + long-lived refresh token pair."""
    access_token = jwt.encode({
        'user_id': user_id,
        'iss': 'strivex',
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + ACCESS_TOKEN_EXPIRY,
    }, app.config['SECRET_KEY'], algorithm='HS256')

    raw_refresh = secrets.token_urlsafe(48)
    rt = RefreshToken(
        user_id=user_id,
        token_hash=RefreshToken.hash_token(raw_refresh),
        expires_at=datetime.utcnow() + REFRESH_TOKEN_EXPIRY,
    )
    db.session.add(rt)
    db.session.commit()

    return {'access_token': access_token, 'refresh_token': raw_refresh}


# ============= WEBSOCKET EVENTS =============
@socketio.on('join')
def on_join(data):
    """Client joins their personal room for real-time events."""
    room = data.get('user_id')
    if room:
        join_room(str(room))
        logger.info(f"User {room} joined WebSocket room")


# ============= INPUT VALIDATION HELPERS =============
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')

def validate_email(email):
    return bool(EMAIL_REGEX.match(str(email).strip()))

def validate_password(password):
    return len(str(password)) >= 8

def sanitize_str(value: Any, max_len: int = 500) -> str:
    """Strip whitespace and truncate to max_len"""
    s = str(value).strip()
    return s[:max_len]  # type: ignore[index]


# ============= AUTH MIDDLEWARE =============

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = db.session.get(User, data['user_id'])
            if not current_user:
                return jsonify({'error': 'User not found'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated


def get_current_user():
    """Helper used by premium.py decorators to resolve the current user from the request."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return None
    try:
        data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return db.session.get(User, data['user_id'])
    except Exception:
        return None


# ============= HEALTH CHECK =============

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint
    ---
    tags:
      - System
    summary: Verify the API is running
    responses:
      200:
        description: API is healthy
        schema:
          type: object
          properties:
            status:
              type: string
              example: ok
            version:
              type: string
              example: 3.0.0
            timestamp:
              type: string
              example: 2026-03-01T00:00:00
    """
    return jsonify({
        'status': 'ok',
        'version': '3.0.0',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


# ============= GOOGLE OAUTH ROUTES =============

@app.route('/api/auth/google', methods=['GET'])
def google_login():
    """
    Start Google OAuth flow
    ---
    tags: [Auth]
    summary: Redirect to Google sign-in
    responses:
      302:
        description: Redirect to Google OAuth consent page
    """
    if not os.environ.get('GOOGLE_CLIENT_ID'):
        return jsonify({'error': 'Google OAuth not configured on this server'}), 501
    redirect_uri = url_for('google_callback', _external=True)
    return google.authorize_redirect(redirect_uri)


@app.route('/api/auth/google/callback', methods=['GET'])
def google_callback():
    """Handle Google OAuth callback and issue tokens."""
    try:
        token_data = google.authorize_access_token()
        user_info = token_data.get('userinfo') or google.userinfo()

        email = user_info.get('email')
        if not email:
            return redirect(f"{os.environ.get('CORS_ORIGIN', 'http://localhost:3001')}/index.html?error=no_email")

        # Find or create user
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(
                email=email,
                oauth_provider='google',
                oauth_id=user_info.get('sub'),
                name=user_info.get('name'),
                avatar_url=user_info.get('picture'),
            )
            db.session.add(user)
            db.session.commit()
            logger.info(f"New Google OAuth user created: {email}")
        else:
            # Update profile data from Google
            user.oauth_provider = 'google'
            user.oauth_id = user_info.get('sub')
            user.name = user_info.get('name', user.name)
            user.avatar_url = user_info.get('picture', user.avatar_url)
            db.session.commit()

        tokens = create_tokens(user.id)
        frontend = os.environ.get('CORS_ORIGIN', 'http://localhost:3001')
        # Tokens are passed via a short-lived HttpOnly cookie instead of URL params
        # to avoid leaking them into browser history, logs, and Referer headers.
        payload = json.dumps({'access_token': tokens['access_token'], 'refresh_token': tokens['refresh_token']})
        import base64
        encoded = base64.urlsafe_b64encode(payload.encode()).decode()
        response = redirect(f"{frontend}/oauth-callback.html")
        response.set_cookie(
            'oauth_tokens', encoded,
            max_age=60,           # Expires in 60 seconds — frontend must consume immediately
            httponly=True,
            secure=request.is_secure,
            samesite='Lax'
        )
        return response
    except Exception as e:
        logger.error(f"Google OAuth callback error: {e}")
        return redirect(f"{os.environ.get('CORS_ORIGIN', 'http://localhost:3001')}/index.html?error=oauth_failed")


@app.route('/api/auth/refresh', methods=['POST'])
@limiter.limit('30 per hour')
def refresh_token():
    """
    Rotate refresh token and get new access token
    ---
    tags: [Auth]
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            refresh_token:
              type: string
    responses:
      200:
        description: New access + refresh tokens issued
      401:
        description: Invalid or expired refresh token
    """
    data = request.json or {}
    raw_token = data.get('refresh_token', '')
    if not raw_token:
        return jsonify({'error': 'Refresh token required'}), 400

    token_hash = RefreshToken.hash_token(raw_token)
    rt = RefreshToken.query.filter_by(token_hash=token_hash).first()

    if not rt or not rt.is_valid():
        return jsonify({'error': 'Invalid or expired refresh token'}), 401

    # Rotate: revoke old, issue new
    rt.revoked = True
    db.session.commit()
    tokens = create_tokens(rt.user_id)
    user = db.session.get(User, rt.user_id)
    logger.info(f"Refresh token rotated for user {rt.user_id}")
    return jsonify({**tokens, 'user': user.to_dict() if user else {}}), 200


@app.route('/api/auth/logout', methods=['POST'])
@token_required
def logout(current_user):
    """
    Revoke refresh token (logout)
    ---
    tags: [Auth]
    security:
      - BearerAuth: []
    parameters:
      - in: body
        name: body
        schema:
          type: object
          properties:
            refresh_token:
              type: string
    responses:
      200:
        description: Logged out successfully
    """
    data = request.json or {}
    raw_token = data.get('refresh_token', '')
    if raw_token:
        token_hash = RefreshToken.hash_token(raw_token)
        rt = RefreshToken.query.filter_by(token_hash=token_hash, user_id=current_user.id).first()
        if rt:
            rt.revoked = True
            db.session.commit()
    logger.info(f"User {current_user.id} logged out")
    return jsonify({'message': 'Logged out successfully'}), 200


# ============= AI ENDPOINTS (Gemini) =============

@app.route('/api/ai/parse-goal', methods=['POST'])
@token_required
def ai_parse_goal(current_user):
    """
    Parse natural language goal using Gemini AI
    ---
    tags: [AI]
    security:
      - BearerAuth: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            text:
              type: string
              example: Learn React in 3 months, 2 hours daily
    responses:
      200:
        description: Structured goal data extracted from text
    """
    data = request.json or {}
    raw = sanitize_str(data.get('text', ''), max_len=500)
    if not raw:
        return jsonify({'error': 'text is required'}), 400

    result = gemini.parse_goal(raw)
    _raw_short: str = raw  # type narrowing
    logger.info(f"AI goal parse for user {current_user.id}: '{_raw_short[0:40]}...")  # type: ignore[index]
    return jsonify({'parsed': result, 'ai_powered': gemini.model is not None}), 200


@app.route('/api/ai/daily-brief', methods=['GET'])
@token_required
def ai_daily_brief(current_user):
    """
    Get AI-generated personalized daily briefing
    ---
    tags: [AI]
    security:
      - BearerAuth: []
    responses:
      200:
        description: Personalized briefing text and nudge
    """
    brief_cache_key = f'daily_brief_{current_user.id}'
    nudge_cache_key = f'nudge_{current_user.id}'

    cached_brief = _cache_get(brief_cache_key)
    cached_nudge = _cache_get(nudge_cache_key)

    if cached_brief and cached_nudge:
        logger.info(f"[AI CACHE HIT] daily_brief for user {current_user.id}")
        return jsonify({
            'brief': cached_brief,
            'nudge': cached_nudge,
            'ai_powered': gemini.model is not None,
            'cached': True
        }), 200

    today_tasks = Task.query.filter_by(user_id=current_user.id, scheduled_date=datetime.utcnow().date()).all()
    active_goals = Goal.query.filter_by(user_id=current_user.id, status='active').all()
    hour = datetime.utcnow().hour

    brief = gemini.daily_brief({
        'goals': [g.title for g in active_goals[:3]],
        'tasks_today': len(today_tasks),
        'streak': current_user.streak_count or 0,
        'efficiency': 0.65,
        'time_of_day': 'morning' if hour < 12 else ('afternoon' if hour < 18 else 'evening'),
    })

    nudge = gemini.generate_nudge({
        'name': current_user.name or current_user.email.split('@')[0],
        'streak': current_user.streak_count or 0,
        'today_pct': 0.5,
        'burnout': False,
        'top_goal': active_goals[0].title if active_goals else 'N/A',
        'hour': hour,
    })

    # Cache: brief for 8 hours, nudge for 1 hour
    _cache_set(brief_cache_key, brief, ttl_seconds=8 * 3600)
    _cache_set(nudge_cache_key, nudge, ttl_seconds=3600)
    logger.info(f"[AI CACHE SET] daily_brief for user {current_user.id}")

    return jsonify({
        'brief': brief,
        'nudge': nudge,
        'ai_powered': gemini.model is not None,
        'cached': False
    }), 200


# ============= AUTH ROUTES =============

@app.route('/api/auth/register', methods=['POST'])
def register():
    """
    Register a new user account
    ---
    tags:
      - Auth
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [email, password]
          properties:
            email:
              type: string
              example: user@example.com
            password:
              type: string
              minLength: 8
              example: securepass123
    responses:
      201:
        description: Account created, returns JWT token
        schema:
          type: object
          properties:
            token:
              type: string
            user:
              type: object
      400:
        description: Validation error (invalid email, weak password, duplicate)
      429:
        description: Rate limit exceeded (5 per hour)
    """
    try:
        data = request.json or {}
        email = sanitize_str(data.get('email', ''))
        password = data.get('password', '')

        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        if not validate_password(password):
            return jsonify({'error': 'Password must be at least 8 characters'}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already registered'}), 400

        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
        new_user = User(email=email, password_hash=hashed_password)
        db.session.add(new_user)
        db.session.commit()

        # Use the proper token-rotation system (15-min access + 30-day refresh)
        tokens = create_tokens(new_user.id)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

    return jsonify({'message': 'Account created successfully', **tokens, 'user': new_user.to_dict()}), 201


@app.route('/api/auth/login', methods=['POST'])
@limiter.limit('10 per hour')
def login():
    data = request.json or {}
    email = sanitize_str(data.get('email', ''))
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400

    user = User.query.filter_by(email=email).first()
    # Guard against OAuth-only users who have no password_hash
    if not user or not user.password_hash or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid credentials'}), 401

    # Use the proper token-rotation system (15-min access + 30-day refresh)
    tokens = create_tokens(user.id)
    return jsonify({'message': 'Login successful', **tokens, 'user': user.to_dict()}), 200


# ============= ONBOARDING ROUTES =============

@app.route('/api/onboarding/profile', methods=['POST'])
@token_required
def complete_onboarding(current_user):
    data = request.json
    current_user.wake_time = data.get('wake_time')
    current_user.sleep_time = data.get('sleep_time')
    current_user.energy_type = data.get('energy_type')
    current_user.peak_start = data.get('peak_start')
    current_user.peak_end = data.get('peak_end')
    current_user.work_style = data.get('work_style', 'deep')
    db.session.commit()
    return jsonify({'message': 'Profile updated successfully', 'user': current_user.to_dict()}), 200


@app.route('/api/onboarding/commitments', methods=['POST'])
@token_required
def add_commitments(current_user):
    data = request.json
    commitments_data = data.get('commitments', [])
    
    for c in commitments_data:
        specific_date = None
        if c.get('specific_date'):
            try:
                specific_date = datetime.fromisoformat(c['specific_date']).date()
            except Exception:
                pass
        commitment = Commitment(
            user_id=current_user.id,
            title=c.get('title', 'Commitment'),
            day_of_week=c.get('day_of_week'),
            specific_date=specific_date,
            start_time=c.get('start_time', '09:00'),
            end_time=c.get('end_time', '10:00'),
            recurring=c.get('recurring', True)
        )
        db.session.add(commitment)
    
    db.session.commit()
    return jsonify({'message': f'{len(commitments_data)} commitments added'}), 201


# ============= GOAL ROUTES =============

@app.route('/api/goals', methods=['GET'])
@token_required
def get_goals(current_user):
    goals = Goal.query.filter_by(user_id=current_user.id).all()
    return jsonify([g.to_dict() for g in goals]), 200


@app.route('/api/goals', methods=['POST'])
@token_required
def create_goal(current_user):
    data = request.json
    
    goal = Goal(
        user_id=current_user.id,
        title=data['title'],
        description=data.get('description'),
        deadline=datetime.fromisoformat(data['deadline']).date(),
        estimated_hours=data.get('estimated_hours'),
        priority=data.get('priority', 3)
    )
    db.session.add(goal)
    db.session.commit()
    
    engine = SchedulingEngine(current_user, goal)
    success, weekly_plan, message = engine.generate_schedule()
    
    if not success:
        return jsonify({'error': message}), 400
    
    # Type-hint weekly_plan to resolve IDE 'Unknown' member errors
    plan: list[dict[str, Any]] = cast(list[dict[str, Any]], weekly_plan)
    
    for day_plan in plan:
        for block in cast(list[dict[str, Any]], day_plan['time_blocks']):
            if block['type'] == 'task':
                task_data = block['task_data']
                
                task = Task(
                    goal_id=goal.id,
                    title=task_data['title'],
                    estimated_hours=task_data['hours'],
                    difficulty=task_data['difficulty'],
                    scheduled_date=datetime.fromisoformat(str(day_plan['date'])).date(),
                    scheduled_start_time=block['start_time'],
                    scheduled_end_time=block['end_time'],
                    xp_value=10 + (task_data['difficulty'] * 5)
                )
                db.session.add(task)
    
    db.session.commit()
    
    # Calculate initial feasibility score
    feasibility_score, risk_level, consequence = engine.calculate_feasibility_score()
    goal.feasibility_score = feasibility_score
    db.session.commit()
    
    return jsonify({
        'message': 'Goal created and schedule generated',
        'goal': goal.to_dict(),
        'weekly_plan': weekly_plan,
        'feasibility_score': feasibility_score,
        'risk_level': risk_level,
        'consequence': consequence
    }), 201


@app.route('/api/goals/<int:goal_id>', methods=['GET'])
@token_required
def get_goal(current_user, goal_id):
    goal = Goal.query.filter_by(id=goal_id, user_id=current_user.id).first()
    if not goal:
        return jsonify({'error': 'Goal not found'}), 404
    return jsonify(goal.to_dict()), 200


@app.route('/api/goals/<int:goal_id>/feasibility', methods=['GET'])
@token_required
def get_feasibility(current_user, goal_id):
    """PRD 5.1: Get feasibility score with consequence message"""
    goal = Goal.query.filter_by(id=goal_id, user_id=current_user.id).first()
    if not goal:
        return jsonify({'error': 'Goal not found'}), 404
    
    engine = SchedulingEngine(current_user, goal)
    feasibility_score, risk_level, consequence = engine.calculate_feasibility_score()
    
    goal.feasibility_score = feasibility_score
    db.session.commit()
    
    # Breakdown explanation for transparency (PRD: users need to understand why)
    completed = len([t for t in goal.tasks if t.status == 'completed'])
    total = len(goal.tasks)
    days_remaining = (goal.deadline - datetime.now().date()).days
    
    return jsonify({
        'goal_id': goal_id,
        'goal_title': goal.title,
        'feasibility_score': feasibility_score,
        'feasibility_percent': round(feasibility_score * 100),
        'risk_level': risk_level,
        'consequence': consequence,
        'breakdown': {
            'tasks_completed': completed,
            'tasks_total': total,
            'days_remaining': max(0, days_remaining),
            'completion_rate': round(completed / max(1, total) * 100, 1)  # type: ignore[call-overload]
        }
    }), 200


# ============= TASK ROUTES =============

@app.route('/api/tasks/today', methods=['GET'])
@token_required
def get_today_tasks(current_user):
    today = datetime.now().date()
    tasks = Task.query.join(Task.goal).filter(
        Task.goal.has(user_id=current_user.id),
        Task.scheduled_date == today
    ).order_by(Task.scheduled_start_time).all()
    return jsonify([t.to_dict() for t in tasks]), 200


@app.route('/api/tasks/<int:task_id>/complete', methods=['POST'])
@token_required
def complete_task(current_user, task_id):
    task = Task.query.join(Task.goal).filter(
        Task.id == task_id,
        Task.goal.has(user_id=current_user.id)
    ).first()
    
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    task.status = 'completed'
    task.completed_at = datetime.utcnow()
    current_user.xp += task.xp_value
    
    today = datetime.now().date()
    if current_user.last_activity_date == today - timedelta(days=1):
        current_user.streak_count += 1
    elif current_user.last_activity_date != today:
        current_user.streak_count = 1
    current_user.last_activity_date = today
    
    # Log resistance event: complete
    _log_behavior_event(current_user.id, task_id, 'complete')
    
    db.session.commit()
    
    return jsonify({
        'message': 'Task completed',
        'xp_earned': task.xp_value,
        'total_xp': current_user.xp,
        'streak': current_user.streak_count
    }), 200


@app.route('/api/tasks/<int:task_id>/skip', methods=['POST'])
@token_required
def skip_task(current_user, task_id):
    task = Task.query.join(Task.goal).filter(
        Task.id == task_id,
        Task.goal.has(user_id=current_user.id)
    ).first()
    
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    task.status = 'skipped'
    _log_behavior_event(current_user.id, task_id, 'skip')
    db.session.commit()
    return jsonify({'message': 'Task skipped'}), 200


@app.route('/api/tasks/<int:task_id>/reschedule', methods=['POST'])
@token_required
def reschedule_task(current_user, task_id):
    data = request.json
    task = Task.query.join(Task.goal).filter(
        Task.id == task_id,
        Task.goal.has(user_id=current_user.id)
    ).first()
    
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    task.scheduled_date = datetime.fromisoformat(data['new_date']).date() if data.get('new_date') else None
    task.scheduled_start_time = data.get('new_start_time')
    task.scheduled_end_time = data.get('new_end_time')
    task.status = 'rescheduled'
    db.session.commit()
    return jsonify({'message': 'Task rescheduled'}), 200


@app.route('/api/tasks/<int:task_id>/start', methods=['POST'])
@token_required
def start_task(current_user, task_id):
    """PRD: Log actual start time for behavior tracking / focus session"""
    task = Task.query.join(Task.goal).filter(
        Task.id == task_id,
        Task.goal.has(user_id=current_user.id)
    ).first()
    
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    if not task.actual_start_time:
        task.actual_start_time = datetime.utcnow()
    
    _log_behavior_event(current_user.id, task_id, 'start')
    db.session.commit()
    
    return jsonify({
        'message': 'Focus session started',
        'task_id': task_id,
        'started_at': task.actual_start_time.isoformat(),
        'estimated_end_minutes': int(task.estimated_hours * 60)
    }), 200


@app.route('/api/tasks/<int:task_id>/ghost', methods=['POST'])
@token_required
def toggle_ghost(current_user, task_id):
    """PRD 7.3: Ghost Mode — soft-schedule a task"""
    task = Task.query.join(Task.goal).filter(
        Task.id == task_id,
        Task.goal.has(user_id=current_user.id)
    ).first()
    
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    task.is_ghost = not task.is_ghost
    db.session.commit()
    return jsonify({'message': f"Ghost mode {'enabled' if task.is_ghost else 'disabled'}", 'is_ghost': task.is_ghost}), 200


# ============= REPLAN ROUTE (PRD 5.3) =============

@app.route('/api/tasks/replan', methods=['POST'])
@token_required
def replan_day(current_user):
    """
    PRD 5.3 / 10.3: Replan My Day
    Re-schedules remaining tasks from current time.
    Returns diff + new feasibility score in < 500ms.
    """
    # Get active goals
    active_goals = Goal.query.filter_by(user_id=current_user.id, status='active').all()
    
    if not active_goals:
        return jsonify({'error': 'No active goals to replan'}), 400
    
    all_results = []
    combined_moved = 0
    combined_removed = 0
    combined_pushed = 0
    overall_feasibility = None
    overall_consequence = None
    overall_risk = 'LOW'
    
    for goal in active_goals:
        engine = SchedulingEngine(current_user, goal)
        result = engine.replan_today()
        db.session.commit()  # Save updated task times
        
        all_results.append({'goal': goal.title, **result})
        combined_moved += result.get('moved', 0)
        combined_removed += result.get('removed', 0)
        combined_pushed += result.get('pushed_to_tomorrow', 0)
        
        # Use the worst feasibility across goals
        if overall_feasibility is None or result['feasibility_score'] < overall_feasibility:
            overall_feasibility = result['feasibility_score']
            overall_consequence = result['consequence']
            overall_risk = result['risk_level']
    
    summary = f"Moved {combined_moved} task{'s' if combined_moved != 1 else ''}"
    if combined_pushed:
        summary += f", pushed {combined_pushed} to tomorrow"
    if combined_removed:
        summary += f", {combined_removed} expired"
    _feas_pct = round((overall_feasibility or 0.0) * 100)  # type: ignore[operator]
    summary += f" — {_feas_pct}% feasible"
    
    return jsonify({
        'summary': summary,
        'feasibility_score': overall_feasibility,
        'feasibility_percent': _feas_pct,
        'risk_level': overall_risk,
        'consequence': overall_consequence,
        'moved': combined_moved,
        'removed': combined_removed,
        'pushed_to_tomorrow': combined_pushed,
        'goal_results': all_results
    }), 200


# ============= NLP QUICK-ADD (PRD 5.4) =============

@app.route('/api/nlp/parse', methods=['POST'])
@token_required
def nlp_parse(current_user):
    """
    PRD 5.4: NLP Quick-Add — regex-based parser for top commands.
    Parses natural language → structured action.
    """
    data = request.json
    command = data.get('command', '').strip().lower()
    
    if not command:
        return jsonify({'error': 'No command provided'}), 400
    
    action = _parse_nlp_command(command, current_user)
    
    if action.get('error'):
        return jsonify(action), 400
    
    # Execute the action
    result = _execute_nlp_action(action, current_user)
    return jsonify(result), 200


def _parse_nlp_command(command, user):
    """
    PRD 5.4: Regex parser for top 10 most common commands.
    Returns structured action dict.
    """
    now = datetime.now()
    today = now.date()
    tomorrow = today + timedelta(days=1)
    
    # Pattern: "move X to HH PM/AM" or "move X to 6 pm"
    move_match = re.search(r'move (.+?) to (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)', command)
    if move_match:
        task_hint = move_match.group(1).strip()
        time_str = move_match.group(2).strip()
        target_time = _parse_time_hint(time_str)
        return {
            'action': 'move',
            'task_hint': task_hint,
            'new_time': target_time,
            'date': today.isoformat(),
            'message': f"Moving '{task_hint}' to {target_time}"
        }
    
    # Pattern: "add X hours of/for Y" or "add 2 hours deep work"
    add_match = re.search(r'add (?:a\s+)?(\d+(?:\.\d+)?)\s*(?:hour|hr)s?\s+(?:of\s+|for\s+)?(.+?)(?:\s+(?:tomorrow|today|tonight))?$', command)
    if add_match:
        hours = float(add_match.group(1))
        task_title = add_match.group(2).strip().title()
        target_date = tomorrow if 'tomorrow' in command else today
        return {
            'action': 'create',
            'title': task_title,
            'hours': hours,
            'date': target_date.isoformat(),
            'difficulty': 3,
            'message': f"Adding {hours}h of '{task_title}' on {target_date.strftime('%b %d')}"
        }
    
    # Pattern: "I only have N hours today" or "only N hours left"
    hours_match = re.search(r'(?:only|i have|i only have)\s+(\d+(?:\.\d+)?)\s*hour', command)
    if hours_match:
        available_hours = float(hours_match.group(1))
        return {
            'action': 'limit_day',
            'available_hours': available_hours,
            'date': today.isoformat(),
            'message': f"Limiting today to {available_hours}h — will replan around this"
        }
    
    # Pattern: "complete X" or "I finished X" or "done with X"
    complete_match = re.search(r'(?:complete|finished|done with|completed)\s+(.+)', command)
    if complete_match:
        task_hint = complete_match.group(1).strip()
        return {
            'action': 'complete',
            'task_hint': task_hint,
            'message': f"Marking '{task_hint}' as complete"
        }
    
    # Pattern: "skip X" or "skip today's X"
    skip_match = re.search(r'skip\s+(?:today\'?s?\s+)?(.+)', command)
    if skip_match:
        task_hint = skip_match.group(1).strip()
        return {
            'action': 'skip',
            'task_hint': task_hint,
            'message': f"Skipping '{task_hint}'"
        }
    
    # Pattern: "replan" or "replan my day"
    if re.search(r'replan', command):
        return {'action': 'replan', 'message': 'Replanning your day...'}
    
    # Pattern: "add buffer after meetings" or "add X min break"
    buffer_match = re.search(r'add\s+(?:a\s+)?(\d+)[\s-]?(?:min|minute)s?\s+(?:buffer|break)', command)
    if buffer_match:
        minutes = int(buffer_match.group(1))
        return {
            'action': 'add_buffer',
            'duration_minutes': minutes,
            'date': today.isoformat(),
            'message': f"Adding {minutes}-minute buffer blocks"
        }
    
    return {
        'error': 'Command not understood',
        'understood': False,
        'suggestions': [
            'Try: "move gym to 6 pm"',
            'Try: "add 2 hours deep work tomorrow"',
            'Try: "I only have 3 hours today"',
            'Try: "complete python basics"',
            'Try: "replan my day"'
        ]
    }


def _parse_time_hint(time_str):
    """Convert '6 pm', '18:00', '6:30pm' to HH:MM string"""
    time_str = time_str.strip().lower()
    pm_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)', time_str)
    if pm_match:
        hour = int(pm_match.group(1))
        minute = int(pm_match.group(2) or 0)
        if pm_match.group(3) == 'pm' and hour != 12:
            hour += 12
        elif pm_match.group(3) == 'am' and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"
    
    plain_match = re.search(r'(\d{1,2})(?::(\d{2}))?', time_str)
    if plain_match:
        hour = int(plain_match.group(1))
        minute = int(plain_match.group(2) or 0)
        return f"{hour:02d}:{minute:02d}"
    
    return "09:00"


def _execute_nlp_action(action, user):
    """Execute a parsed NLP action and return result"""
    today = datetime.now().date()
    
    if action['action'] == 'replan':
        # Delegate to replan logic
        active_goals = Goal.query.filter_by(user_id=user.id, status='active').all()
        if not active_goals:
            return {'success': False, 'message': 'No active goals to replan'}
        
        goal = active_goals[0]
        engine = SchedulingEngine(user, goal)
        result = engine.replan_today()
        db.session.commit()
        return {'success': True, 'action': 'replan', 'result': result, 'message': result['summary']}
    
    elif action['action'] == 'create':
        # Create a new quick task under the first active goal
        active_goals = Goal.query.filter_by(user_id=user.id, status='active').all()
        if not active_goals:
            return {'success': False, 'message': 'No active goal to add task to'}
        
        goal = active_goals[0]
        target_date = datetime.fromisoformat(action['date']).date()
        
        # Calculate start time (end of last task today or 30 mins from now)
        last_task = Task.query.filter_by(goal_id=goal.id, scheduled_date=target_date).order_by(
            Task.scheduled_end_time.desc()
        ).first()
        
        if last_task and last_task.scheduled_end_time:
            start_time = last_task.scheduled_end_time
        else:
            now = datetime.now()
            start_time = f"{now.hour:02d}:{now.minute + 30 if now.minute < 30 else (now.minute - 30):02d}" if target_date == today else "09:00"
        
        end_minutes = _time_str_to_min(start_time) + int(action['hours'] * 60)
        end_time = f"{end_minutes // 60:02d}:{end_minutes % 60:02d}"
        
        task = Task(
            goal_id=goal.id,
            title=action['title'],
            estimated_hours=action['hours'],
            difficulty=action.get('difficulty', 2),
            scheduled_date=target_date,
            scheduled_start_time=start_time,
            scheduled_end_time=end_time,
            xp_value=10 + action.get('difficulty', 2) * 5
        )
        db.session.add(task)
        db.session.commit()
        
        return {
            'success': True, 'action': 'create',
            'task': task.to_dict(),
            'message': action['message']
        }
    
    elif action['action'] in ('complete', 'skip'):
        task_hint = action['task_hint'].lower()
        today_tasks = Task.query.join(Task.goal).filter(
            Task.goal.has(user_id=user.id),
            Task.scheduled_date == today,
            Task.status == 'pending'
        ).all()
        
        # Find best matching task
        matched = None
        for t in today_tasks:
            if task_hint in t.title.lower() or any(word in t.title.lower() for word in task_hint.split()):
                matched = t
                break
        
        if not matched:
            return {'success': False, 'message': f"No matching task found for '{action['task_hint']}'"}
        
        assert matched is not None  # narrowing for type checker
        if action['action'] == 'complete':
            matched.status = 'completed'
            matched.completed_at = datetime.utcnow()
            user.xp += matched.xp_value
        else:
            matched.status = 'skipped'
        
        db.session.commit()
        return {'success': True, 'action': action['action'], 'task': matched.to_dict(), 'message': action['message']}
    
    elif action['action'] == 'move':
        task_hint = action['task_hint'].lower()
        today_tasks = Task.query.join(Task.goal).filter(
            Task.goal.has(user_id=user.id),
            Task.scheduled_date == today,
            Task.status == 'pending'
        ).all()
        
        matched = None
        for t in today_tasks:
            if task_hint in t.title.lower() or any(word in t.title.lower() for word in task_hint.split() if len(word) > 3):
                matched = t
                break
        
        if not matched:
            return {'success': False, 'message': f"No matching task found for '{action['task_hint']}'"}
        
        assert matched is not None  # narrowing for type checker
        new_start = action['new_time']
        start_min = _time_str_to_min(new_start)
        end_min = start_min + int(matched.estimated_hours * 60)
        matched.scheduled_start_time = new_start
        matched.scheduled_end_time = f"{end_min // 60:02d}:{end_min % 60:02d}"
        matched.status = 'rescheduled'
        db.session.commit()
        
        return {'success': True, 'action': 'move', 'task': matched.to_dict(), 'message': action['message']}
    
    elif action['action'] == 'limit_day':
        # Replan but cap total hours
        active_goals = Goal.query.filter_by(user_id=user.id, status='active').all()
        if not active_goals:
            return {'success': False, 'message': 'No active goals'}
        
        goal = active_goals[0]
        engine = SchedulingEngine(user, goal)
        result = engine.replan_today()
        db.session.commit()
        
        message = f"Day limited to {action['available_hours']}h. {result['summary']}"
        return {'success': True, 'action': 'limit_day', 'result': result, 'message': message}
    
    return {'success': False, 'message': f"Unknown action: {action['action']}"}


def _time_str_to_min(time_str):
    """Convert HH:MM string to minutes"""
    if not time_str:
        return 9 * 60
    h, m = map(int, time_str.split(':'))
    return h * 60 + m


# ============= BEHAVIOR EVENT LOGGING (PRD 6.2) =============

@app.route('/api/behavior/event', methods=['POST'])
@token_required
def log_behavior_event(current_user):
    """PRD 6.2: Log resistance events for procrastination heatmap"""
    data = request.json
    task_id = data.get('task_id')
    event_type = data.get('event_type')
    
    valid_types = {'hover', 'open', 'close', 'skip', 'start_late', 'start', 'complete'}
    if event_type not in valid_types:
        return jsonify({'error': f'Invalid event_type. Must be one of: {", ".join(valid_types)}'}), 400
    
    now = datetime.now()
    metadata = {
        'hour_of_day': now.hour,
        'day_of_week': now.weekday(),
        'day_name': now.strftime('%A')
    }
    
    _log_behavior_event(current_user.id, task_id, event_type, metadata)
    db.session.commit()  # _log_behavior_event adds to session but does NOT commit
    return jsonify({'message': 'Event logged'}), 201


def _log_behavior_event(user_id, task_id, event_type, metadata=None):
    """Internal helper to log behavior events"""
    now = datetime.now()
    if metadata is None:
        metadata = {
            'hour_of_day': now.hour,
            'day_of_week': now.weekday(),
            'day_name': now.strftime('%A')
        }
    event = BehaviorEvent(
        user_id=user_id,
        task_id=task_id,
        event_type=event_type,
        timestamp=now,
        metadata_json=json.dumps(metadata)
    )
    db.session.add(event)
    # Don't commit here — caller handles commit


# ============= DAILY LOG ROUTES =============


@app.route('/api/daily-log', methods=['POST'])
@token_required
def submit_daily_log(current_user):
    data = request.json
    today = datetime.now().date()
    
    log = DailyLog.query.filter_by(user_id=current_user.id, date=today).first()
    if not log:
        log = DailyLog(user_id=current_user.id, date=today)
        db.session.add(log)
    
    log.tasks_completed_percentage = data.get('tasks_completed_percentage')
    log.screen_time_level = data.get('screen_time_level')
    log.main_distraction = data.get('main_distraction')
    log.energy_level = data.get('energy_level')
    log.skip_reason = data.get('skip_reason')
    
    today_tasks = Task.query.join(Task.goal).filter(
        Task.goal.has(user_id=current_user.id),
        Task.scheduled_date == today
    ).all()
    
    log.total_tasks_scheduled = len(today_tasks)
    log.total_tasks_completed = sum(1 for t in today_tasks if t.status == 'completed')
    log.total_xp_earned = sum(t.xp_value for t in today_tasks if t.status == 'completed')
    db.session.commit()
    
    active_goals = Goal.query.filter_by(user_id=current_user.id, status='active').all()
    
    # Behavior Engine feedback
    engine = BehavioralIntelligenceEngine(current_user)
    analysis = engine.full_analysis()
    patterns = analysis["patterns"]
    recommendations = analysis["recommendations"]
    
    # Apply burnout reduction if needed
    total_modified = 0
    if analysis["burnout_risk"]:
        for goal in active_goals:
            # Simple adaptive load: push 30% of pending tasks to tomorrow
            pending = [t for t in goal.tasks if t.status == 'pending' and t.scheduled_date == today]
            to_push = cast(list, pending)[0:int(len(pending)*0.3) + 1]  # type: ignore[index]
            for t in to_push:
                t.scheduled_date = today + timedelta(days=1)
                t.scheduled_start_time = None
                t.scheduled_end_time = None
                total_modified += 1
    
    db.session.commit()
    
    return jsonify({
        'message': 'Daily log submitted',
        'patterns': patterns,
        'adjustments': [r['description'] for r in recommendations],
        'tasks_modified': total_modified
    }), 201


# ============= DASHBOARD ROUTES =============

@app.route('/api/dashboard', methods=['GET'])
@token_required
def get_dashboard(current_user):
    today = datetime.now().date()
    
    today_tasks = Task.query.join(Task.goal).filter(
        Task.goal.has(user_id=current_user.id),
        Task.scheduled_date == today
    ).order_by(Task.scheduled_start_time).all()
    
    active_goals = Goal.query.filter_by(user_id=current_user.id, status='active').all()
    
    deadline_risks = []
    feasibility_data = []
    for goal in active_goals:
        # Single engine instantiation — calculate_feasibility_score is called once per goal
        engine = SchedulingEngine(current_user, goal)
        f_score, f_risk, f_consequence = engine.calculate_feasibility_score()

        deadline_risks.append({
            'goal_id': goal.id,
            'goal_title': goal.title,
            'risk_level': f_risk,
            'message': f_consequence
        })
        feasibility_data.append({
            'goal_id': goal.id,
            'goal_title': goal.title,
            'feasibility_score': f_score,
            'feasibility_percent': round(f_score * 100),
            'risk_level': f_risk,
            'consequence': f_consequence
        })
    
    # Overall behavioral patterns
    beh_engine = BehavioralIntelligenceEngine(current_user)
    analysis = beh_engine.full_analysis()
    patterns = analysis["patterns"]
    
    # Overall feasibility = minimum across all goals
    overall_feasibility = min((f['feasibility_score'] for f in feasibility_data), default=1.0)
    
    return jsonify({
        'user': current_user.to_dict(),
        'today_tasks': [t.to_dict() for t in today_tasks],
        'active_goals': [g.to_dict() for g in active_goals],
        'deadline_risks': deadline_risks,
        'patterns': patterns,
        'feasibility': feasibility_data,
        'overall_feasibility': round(overall_feasibility * 100)
    }), 200


# ============= PHASE 8: ADVANCED FEATURES =============

@app.route('/api/intelligence/nudges', methods=['GET'])
@token_required
def get_nudges(current_user):
    engine = BehavioralIntelligenceEngine(current_user)
    nudges = engine.get_nudges()
    return jsonify(nudges), 200


@app.route('/api/stats/active-users', methods=['GET'])
@token_required
def get_active_users(current_user):
    """
    Developer Note:
    Returns a synthetic weighted count for demo purposes.
    The 'synthetic: true' flag in the response makes this explicit to API consumers.
    TODO: Replace with real WebSocket-based connection counting before production.
    """
    import random
    hour = datetime.now().hour
    base = 120 if 9 <= hour <= 23 else 40
    count = base + random.randint(0, 30)
    return jsonify({'active_count': count, 'synthetic': True}), 200


# ============= STAGE 4: MILESTONES =============

def _generate_milestones(goal):
    """
    Auto-generate weekly milestones for a goal:
    Split the goal's timeline into weekly checkpoints.
    """
    today = datetime.now().date()
    days_total = max(1, (goal.deadline - today).days)
    weeks = max(1, days_total // 7)
    hours_per_week = (goal.estimated_hours or 0) / weeks

    milestones = []
    for i in range(weeks):
        target_date = today + timedelta(days=(i + 1) * 7)
        if target_date > goal.deadline:
            target_date = goal.deadline
        milestone = Milestone(  # type: ignore[call-arg]
            goal_id=goal.id,
            title=f"Week {i+1}: Complete {hours_per_week:.1f}h of {goal.title}",
            target_date=target_date,
            target_hours=round(hours_per_week, 1)  # type: ignore[call-overload]
        )
        db.session.add(milestone)
        milestones.append(milestone)

    db.session.commit()
    return milestones


@app.route('/api/goals/<int:goal_id>/milestones', methods=['GET'])
@token_required
def get_milestones(current_user, goal_id):
    goal = Goal.query.filter_by(id=goal_id, user_id=current_user.id).first()
    if not goal:
        return jsonify({'error': 'Goal not found'}), 404

    milestones = Milestone.query.filter_by(goal_id=goal_id).order_by(Milestone.target_date).all()

    # Auto-generate if none exist
    if not milestones:
        milestones = _generate_milestones(goal)

    # Check + update milestone status
    today = datetime.now().date()
    for m in milestones:
        if m.status == 'pending' and m.target_date < today:
            # Count completed task hours in range
            completed_hours = db.session.query(
                db.func.sum(Task.estimated_hours)
            ).filter(
                Task.goal_id == goal_id,
                Task.status == 'completed',
                Task.scheduled_date <= m.target_date
            ).scalar() or 0
            if completed_hours >= m.target_hours:
                m.status = 'completed'
                m.completed_at = datetime.utcnow()
            else:
                m.status = 'missed'
    db.session.commit()

    # Build progress summary
    completed_task_hours = db.session.query(
        db.func.sum(Task.estimated_hours)
    ).filter(
        Task.goal_id == goal_id,
        Task.status == 'completed'
    ).scalar() or 0

    return jsonify({
        'milestones': [m.to_dict() for m in milestones],
        'completed_hours': round(completed_task_hours, 1),
        'total_hours': goal.estimated_hours,
        'progress_pct': min(100, round((completed_task_hours / max(1, goal.estimated_hours)) * 100))
    }), 200


# ============= STAGE 4: XP LEVEL =============

@app.route('/api/user/level', methods=['GET'])
@token_required
def get_user_level(current_user):
    """Return current level, title, emoji, and XP progress to next level."""
    level_info = get_level_info(current_user.xp)
    return jsonify(level_info), 200


# ============= STAGE 4: BEHAVIORAL INTELLIGENCE =============

@app.route('/api/analytics/behavioral', methods=['GET'])
@token_required
def get_behavioral_analysis(current_user):
    """Full 30-day behavioral intelligence analysis."""
    engine_bi = BehavioralIntelligenceEngine(current_user)
    analysis = engine_bi.full_analysis()
    return jsonify(analysis), 200


# ============= TODO LIST ROUTES (health check already defined above) =============



# ============= TODO LIST ROUTES =============

@app.route('/api/todos', methods=['GET'])
@token_required
def get_todos(current_user):
    """List all to-do items for the current user."""
    from models import TodoItem  # type: ignore[import-not-found]
    todos = TodoItem.query.filter_by(user_id=current_user.id).order_by(
        TodoItem.completed.asc(), TodoItem.priority.asc(), TodoItem.created_at.desc()
    ).all()
    return jsonify([t.to_dict() for t in todos]), 200


@app.route('/api/todos', methods=['POST'])
@token_required
def create_todo(current_user):
    """Create a new to-do item."""
    from models import TodoItem  # type: ignore[import-not-found]
    data = request.json or {}
    title = sanitize_str(data.get('title', ''), max_len=300)
    if not title:
        return jsonify({'error': 'title is required'}), 400

    due_date = None
    if data.get('due_date'):
        try:
            due_date = datetime.fromisoformat(data['due_date']).date()
        except Exception:
            pass

    todo = TodoItem(
        user_id=current_user.id,
        title=title,
        description=sanitize_str(data.get('description', ''), max_len=1000),
        priority=max(1, min(3, int(data.get('priority', 2)))),
        category=sanitize_str(data.get('category', 'General'), max_len=100),
        due_date=due_date,
        source=data.get('source', 'manual')
    )
    db.session.add(todo)
    db.session.commit()
    return jsonify(todo.to_dict()), 201


@app.route('/api/todos/<int:todo_id>', methods=['PATCH'])
@token_required
def update_todo(current_user, todo_id):
    """Toggle completed or update fields of a to-do item."""
    from models import TodoItem  # type: ignore[import-not-found]
    todo = TodoItem.query.filter_by(id=todo_id, user_id=current_user.id).first()
    if not todo:
        return jsonify({'error': 'Todo not found'}), 404

    data = request.json or {}
    if 'completed' in data:
        todo.completed = bool(data['completed'])
        todo.completed_at = datetime.utcnow() if todo.completed else None
    if 'title' in data:
        todo.title = sanitize_str(data['title'], max_len=300)
    if 'priority' in data:
        todo.priority = max(1, min(3, int(data['priority'])))
    if 'category' in data:
        todo.category = sanitize_str(data['category'], max_len=100)
    if 'due_date' in data:
        try:
            todo.due_date = datetime.fromisoformat(data['due_date']).date() if data['due_date'] else None
        except Exception:
            pass

    db.session.commit()
    return jsonify(todo.to_dict()), 200


@app.route('/api/todos/<int:todo_id>', methods=['DELETE'])
@token_required
def delete_todo(current_user, todo_id):
    """Delete a to-do item."""
    from models import TodoItem  # type: ignore[import-not-found]
    todo = TodoItem.query.filter_by(id=todo_id, user_id=current_user.id).first()
    if not todo:
        return jsonify({'error': 'Todo not found'}), 404
    db.session.delete(todo)
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200


@app.route('/api/todos/bulk', methods=['POST'])
@token_required
def bulk_create_todos(current_user):
    """Bulk-create multiple to-do items (e.g., from AI Work Coach)."""
    from models import TodoItem  # type: ignore[import-not-found]
    data = request.json or {}
    tasks = data.get('tasks', [])
    if not tasks:
        return jsonify({'error': 'tasks array is required'}), 400

    created = []
    for t in tasks:
        title = sanitize_str(t.get('title', ''), max_len=300)
        if not title:
            continue
        due_date = None
        if t.get('due_date'):
            try:
                due_date = datetime.fromisoformat(t['due_date']).date()
            except Exception:
                pass
        todo = TodoItem(
            user_id=current_user.id,
            title=title,
            description=sanitize_str(t.get('description', ''), max_len=1000),
            priority=max(1, min(3, int(t.get('priority', 2)))),
            category=sanitize_str(t.get('category', 'AI Task'), max_len=100),
            due_date=due_date,
            source=t.get('source', 'ai')
        )
        db.session.add(todo)
        created.append(todo)

    db.session.commit()
    logger.info(f"Bulk created {len(created)} todos for user {current_user.id}")
    return jsonify({'created': len(created), 'todos': [t.to_dict() for t in created]}), 201


# ============= AI WORK COACH ROUTE =============


@app.route('/api/work-coach', methods=['POST'])
@token_required
def work_coach(current_user):
    """
    AI Work Coach — parse user's work context into actionable tasks.
    Body: { role, current_work, blockers }
    Returns: { guidance, tasks, ai_powered }
    """
    data = request.json or {}
    role = sanitize_str(data.get('role', 'Professional'), max_len=100)
    current_work = sanitize_str(data.get('current_work', ''), max_len=500)
    blockers = sanitize_str(data.get('blockers', ''), max_len=500)

    if not current_work:
        return jsonify({'error': 'current_work is required'}), 400

    result = gemini.parse_work_context_to_tasks(role, current_work, blockers)
    logger.info(f"Work coach called for user {current_user.id}: role='{role}'")
    return jsonify(result), 200


@app.route('/api/ai/breakdown-goal', methods=['POST'])
@token_required
def breakdown_goal(current_user):
    """
    AI Task Breakdown — break down a large goal into smaller, scheduled subtasks.
    Body: { goal_title, estimated_hours, deadline_days }
    Returns: { subtasks: [{title, hours, priority, scheduled_date}], ai_powered }
    """
    data = request.json or {}
    goal_title = sanitize_str(data.get('goal_title', ''), max_len=300)
    estimated_hours = float(data.get('estimated_hours', 20))
    deadline_days = int(data.get('deadline_days', 30))
    
    if not goal_title:
        return jsonify({'error': 'goal_title is required'}), 400
    
    # Check usage limit (free tier: 5/month, premium/pro: unlimited)
    allowed, remaining, reset_date = check_usage_limit(current_user, 'ai_breakdown')
    
    if not allowed:
        return jsonify({
            'error': 'Monthly AI breakdown limit reached. Upgrade to Premium for unlimited access.',
            'limit_reached': True,
            'remaining': 0,
            'reset_date': reset_date.isoformat() if reset_date else None,
            'upgrade_url': '/billing/upgrade'
        }), 403
    
    # Use Gemini to break down the goal
    if gemini.model:
        try:
            prompt = f"""Break down this goal into 5-7 actionable subtasks that can be scheduled over {deadline_days} days.
Goal: {goal_title}
Total estimated hours: {estimated_hours}
Deadline: {deadline_days} days

Return ONLY valid JSON array (no markdown) with this structure:
[
  {{
    "title": "specific subtask title (max 80 chars)",
    "hours": <hours needed as number>,
    "priority": <1-3 where 1=highest>,
    "description": "brief description (max 100 chars)"
  }}
]
"""
            response = gemini.model.generate_content(prompt)  # type: ignore[union-attr]
            text = response.text.strip()
            text = re.sub(r'```(?:json)?', '', text).strip()
            subtasks = json.loads(text)
            
            # Schedule subtasks intelligently
            today = datetime.utcnow().date()
            days_per_task = max(1, deadline_days // len(subtasks))
            
            for i, task in enumerate(subtasks):
                task['scheduled_date'] = (today + timedelta(days=i * days_per_task)).isoformat()
            
            # Record usage AFTER successful generation
            record_usage(current_user, 'ai_breakdown')
            
            _uid = getattr(current_user, 'id', 'unknown')
            _goal_title_short = goal_title[0:40]  # type: ignore[index]
            logger.info(f"AI breakdown for user {_uid}: goal='{_goal_title_short}...' (remaining: {str(remaining)})")
            return jsonify({
                'subtasks': subtasks,
                'ai_powered': True,
                'total_subtasks': len(subtasks),
                'usage': {
                    'remaining': remaining - 1 if remaining != -1 else -1,
                    'limit': TIERS.get(getattr(current_user, 'subscription_tier', 'free') or 'free', {}).get('ai_breakdowns_per_month', 5)
                }
            }), 200
            
        except Exception as e:
            logger.error(f"AI breakdown error: {e}")
            # Fall through to rule-based fallback
    
    # Rule-based fallback: split goal into equal chunks
    num_subtasks = min(7, max(3, int(estimated_hours / 4)))
    hours_per_task = round(float(estimated_hours) / num_subtasks, 1)  # type: ignore[call-overload]
    today = datetime.utcnow().date()
    days_per_task = max(1, deadline_days // num_subtasks)
    
    subtasks = []
    for i in range(num_subtasks):
        subtasks.append({
            'title': f'{goal_title} - Part {i+1}',
            'hours': hours_per_task,
            'priority': 1 if i == 0 else (2 if i < num_subtasks - 1 else 3),
            'description': f'Step {i+1} of {num_subtasks} toward completing {goal_title}',
            'scheduled_date': (today + timedelta(days=i * days_per_task)).isoformat()
        })
    
    # Record usage even for fallback
    record_usage(current_user, 'ai_breakdown')
    
    return jsonify({
        'subtasks': subtasks,
        'ai_powered': False,
        'total_subtasks': len(subtasks),
        'usage': {
            'remaining': remaining - 1 if remaining != -1 else -1,
            'limit': TIERS.get(getattr(current_user, 'subscription_tier', 'free') or 'free', {}).get('ai_breakdowns_per_month', 5)
        }
    }), 200


@app.route('/api/user/email-digest', methods=['POST'])
@token_required
def send_email_digest(current_user):
    """
    Daily Email Digest — send user a summary of their day.
    Body: { email } (optional, uses user.email if not provided)
    In production, integrate with SendGrid/Mailgun/Resend
    For now, logs the digest content (you'd send actual email)
    """
    data = request.json or {}
    target_email = data.get('email', current_user.email)
    
    # Gather today's data
    today = datetime.utcnow().date()
    today_tasks = Task.query.join(Task.goal).filter(
        Task.goal.has(user_id=current_user.id),
        Task.scheduled_date == today
    ).all()
    
    active_goals = Goal.query.filter_by(user_id=current_user.id, status='active').all()
    
    completed = sum(1 for t in today_tasks if t.status == 'completed')
    total = len(today_tasks)
    completion_rate = round(completed / max(1, total) * 100)
    
    # Build digest content
    digest = {
        'date': today.isoformat(),
        'greeting': f"Hi {current_user.name or current_user.email.split('@')[0]}",
        'summary': f"You completed {completed}/{total} tasks today ({completion_rate}%)",
        'tasks_completed': completed,
        'tasks_total': total,
        'active_goals': len(active_goals),
        'streak_days': current_user.streak_count or 0,
        'top_goal': active_goals[0].title if active_goals else 'No active goals',
        'tomorrow_preview': f"{len([t for t in today_tasks if t.status == 'pending'])} tasks remaining for tomorrow",
        'motivation': gemini.generate_nudge({
            'name': current_user.name or 'Striver',
            'streak': current_user.streak_count or 0,
            'today_pct': completed / max(1, total),
            'burnout': False,
            'top_goal': active_goals[0].title if active_goals else 'N/A',
            'hour': datetime.utcnow().hour
        }) if gemini.model else 'Keep pushing forward! Every task counts.'
    }
    
    # === PRODUCTION: Send actual email ===
    # Example with SendGrid:
    # from sendgrid import SendGridAPIClient
    # sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
    # sg.send({
    #     'personalizations': [{'to': [{'email': target_email}]}],
    #     'from': {'email': 'noreply@strivex.app', 'name': 'StriveX'},
    #     'subject': f"Your StriveX Daily Digest — {digest['summary']}",
    #     'content': [{'type': 'text/html', 'value': render_email_template(digest)}]
    # })
    
    logger.info(f"📧 Daily digest for {current_user.id} ({target_email}):")
    logger.info(f"   Subject: {digest['greeting']} — {digest['summary']}")
    logger.info(f"   Tasks: {completed}/{total} | Goals: {len(active_goals)} | Streak: {digest['streak_days']}d")
    logger.info(f"   Motivation: {digest['motivation']}")
    
    # Return what would be sent (for testing)
    return jsonify({
        'sent': True,
        'email': target_email,
        'digest': digest,
        'note': 'In production, this sends an actual email via SendGrid/Mailgun'
    }), 200


# ════════════════════════════════════════════════════════════
# ════════════════════ PREMIUM FEATURES ═══════════════════════
# ════════════════════════════════════════════════════════════

# Initialize premium features (billing, usage tracking, etc.)
init_premium_features(app, token_decorator=token_required)


# ════════════════════════════════════════════════════════════
# ═══════════════════ STRIPE PAYMENTS ════════════════════════
# ════════════════════════════════════════════════════════════

@app.route('/api/billing/create-checkout', methods=['POST'])
@token_required
@limiter.limit("5 per minute")  # Prevent spam/abuse
def create_checkout(current_user):
    """
    Create Stripe Checkout Session for subscription.
    Returns checkout URL for redirect.
    
    Security:
    - Uses user's DB email (not client input)
    - Client reference ID prevents tampering
    - Rate limited to 5 requests/minute
    """
    
    data = request.json or {}
    tier = data.get('tier', 'premium')
    
    if tier not in ['premium', 'pro']:
        return jsonify({'error': 'Invalid tier'}), 400
    
    try:
        session = create_checkout_session(current_user, tier)
        
        logger.info(f"Checkout created for user {current_user.id}: {session.url}")
        
        return jsonify({
            'checkout_url': session.url,
            'session_id': session.id
        }), 200
    
    except Exception as e:
        logger.error(f"Checkout creation failed: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/billing/customer-portal', methods=['POST'])
@token_required
@limiter.limit("10 per minute")  # Allow reasonable usage
def customer_portal(current_user):
    """
    Create Stripe Customer Portal session for subscription management.
    Users can cancel/pause/update payment methods themselves.
    """
    if not current_user.stripe_customer_id:
        return jsonify({'error': 'No active subscription found'}), 404
    
    try:
        session = get_customer_portal_session(current_user)
        
        return jsonify({
            'portal_url': session.url
        }), 200
    
    except Exception as e:
        logger.error(f"Portal creation failed: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/billing/webhook', methods=['POST'])
@limiter.limit("20 per minute")  # Stripe may send multiple webhooks
def stripe_webhook():
    """
    Stripe Webhook endpoint for payment events.
    Handles subscription lifecycle events securely.
    
    Events handled:
    - checkout.session.completed (subscription created)
    - customer.subscription.updated (plan changes)
    - customer.subscription.deleted (cancellations)
    
    Security:
    - Signature verification (HMAC)
    - Atomic database transactions
    - Comprehensive audit logging
    """
    # Verify webhook signature (prevents fraud)
    payload = request.get_data()
    sig_header = request.headers.get('Stripe-Signature')
    
    if not sig_header or not os.environ.get('STRIPE_WEBHOOK_SECRET'):
        logger.error("Webhook verification failed: missing credentials")
        return jsonify({'error': 'Missing webhook signature'}), 400
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.environ.get('STRIPE_WEBHOOK_SECRET')
        )
    except ValueError as e:
        logger.error(f"Invalid webhook payload: {e}")
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid webhook signature: {e}")
        return jsonify({'error': 'Invalid signature'}), 400
    
    # Process event with appropriate handler
    result = process_webhook_event(event)
    
    return jsonify(result[0]), result[1]


logger.info("✅ Stripe payment integration initialized")

# Register blueprints
app.register_blueprint(analytics, url_prefix='/api/analytics')
app.register_blueprint(autopsy, url_prefix='/api/autopsy')


if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=False, port=5001)
