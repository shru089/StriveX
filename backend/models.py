from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json
import hashlib
import secrets

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)  # Nullable for OAuth users

    # OAuth fields
    oauth_provider = db.Column(db.String(20), nullable=True)   # 'google', None
    oauth_id = db.Column(db.String(128), nullable=True)         # provider's user ID
    name = db.Column(db.String(100), nullable=True)             # display name
    avatar_url = db.Column(db.String(500), nullable=True)       # profile picture URL

    # Profile data
    wake_time = db.Column(db.String(5))
    sleep_time = db.Column(db.String(5))
    energy_type = db.Column(db.String(20))
    work_style = db.Column(db.String(20), default='deep')

    # Energy windows
    peak_start = db.Column(db.String(5))
    peak_end = db.Column(db.String(5))

    # Gamification
    xp = db.Column(db.Integer, default=0)
    streak_count = db.Column(db.Integer, default=0)
    last_activity_date = db.Column(db.Date)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    goals = db.relationship('Goal', backref='user', lazy=True, cascade='all, delete-orphan')
    commitments = db.relationship('Commitment', backref='user', lazy=True, cascade='all, delete-orphan')
    daily_logs = db.relationship('DailyLog', backref='user', lazy=True, cascade='all, delete-orphan')
    behavior_events = db.relationship('BehaviorEvent', backref='user', lazy=True, cascade='all, delete-orphan')
    refresh_tokens = db.relationship('RefreshToken', backref='user', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'wake_time': self.wake_time,
            'sleep_time': self.sleep_time,
            'energy_type': self.energy_type,
            'peak_start': self.peak_start,
            'peak_end': self.peak_end,
            'xp': self.xp,
            'streak_count': self.streak_count,
            'last_activity_date': self.last_activity_date.isoformat() if self.last_activity_date else None,
            'name': self.name,
            'avatar_url': self.avatar_url,
            'oauth_provider': self.oauth_provider,
        }


class RefreshToken(db.Model):
    """
    Stores hashed refresh tokens for secure token rotation.
    The actual token is never stored — only its SHA-256 hash.
    """
    __tablename__ = 'refresh_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token_hash = db.Column(db.String(64), unique=True, nullable=False)  # SHA-256 hex
    expires_at = db.Column(db.DateTime, nullable=False)
    revoked = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @staticmethod
    def hash_token(token: str) -> str:
        import hashlib
        return hashlib.sha256(token.encode()).hexdigest()

    def is_valid(self) -> bool:
        return not self.revoked and datetime.utcnow() < self.expires_at


class OAuthState(db.Model):
    """Short-lived CSRF-protection state for OAuth flows."""
    __tablename__ = 'oauth_states'

    id = db.Column(db.Integer, primary_key=True)
    state = db.Column(db.String(128), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def is_expired(self) -> bool:
        from datetime import timedelta
        return datetime.utcnow() > self.created_at + timedelta(minutes=10)


class Goal(db.Model):
    __tablename__ = 'goals'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    deadline = db.Column(db.Date, nullable=False)
    estimated_hours = db.Column(db.Float)
    priority = db.Column(db.Integer, default=3)  # 1-5
    status = db.Column(db.String(20), default='active')  # active, completed, abandoned
    feasibility_score = db.Column(db.Float, default=1.0)  # 0.0–1.0 probability
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    # Relationships
    tasks = db.relationship('Task', backref='goal', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        tasks_list = self.tasks or []
        completed = sum(1 for t in tasks_list if t.status == 'completed')
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'deadline': self.deadline.isoformat(),
            'estimated_hours': self.estimated_hours,
            'priority': self.priority,
            'status': self.status,
            'feasibility_score': self.feasibility_score,
            'created_at': self.created_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'tasks_count': len(tasks_list),
            'tasks_completed': completed,
            'tasks': [task.to_dict() for task in tasks_list]
        }


class Task(db.Model):
    __tablename__ = 'tasks'
    
    id = db.Column(db.Integer, primary_key=True)
    goal_id = db.Column(db.Integer, db.ForeignKey('goals.id'), nullable=False)
    
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    estimated_hours = db.Column(db.Float, nullable=False)
    difficulty = db.Column(db.Integer, default=2)  # 1-5
    
    # Scheduling
    scheduled_date = db.Column(db.Date)
    scheduled_start_time = db.Column(db.String(5))  # "09:00"
    scheduled_end_time = db.Column(db.String(5))  # "11:00"
    
    # Status
    status = db.Column(db.String(20), default='pending')  # pending, completed, skipped, rescheduled, expired
    completed_at = db.Column(db.DateTime)
    actual_start_time = db.Column(db.DateTime)  # For focus session tracking
    
    # Ghost mode (PRD: soft-scheduled tasks)
    is_ghost = db.Column(db.Boolean, default=False)
    
    # XP reward
    xp_value = db.Column(db.Integer, default=10)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    behavior_events = db.relationship('BehaviorEvent', backref='task', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'goal_id': self.goal_id,
            'title': self.title,
            'description': self.description,
            'estimated_hours': self.estimated_hours,
            'difficulty': self.difficulty,
            'scheduled_date': self.scheduled_date.isoformat() if self.scheduled_date else None,
            'scheduled_start_time': self.scheduled_start_time,
            'scheduled_end_time': self.scheduled_end_time,
            'status': self.status,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'actual_start_time': self.actual_start_time.isoformat() if self.actual_start_time else None,
            'is_ghost': self.is_ghost,
            'xp_value': self.xp_value
        }


class Commitment(db.Model):
    __tablename__ = 'commitments'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    title = db.Column(db.String(200), nullable=False)
    day_of_week = db.Column(db.Integer)  # 0-6 (Monday-Sunday), None for specific date
    specific_date = db.Column(db.Date)  # For one-time commitments
    start_time = db.Column(db.String(5), nullable=False)
    end_time = db.Column(db.String(5), nullable=False)
    recurring = db.Column(db.Boolean, default=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'day_of_week': self.day_of_week,
            'specific_date': self.specific_date.isoformat() if self.specific_date else None,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'recurring': self.recurring
        }


class DailyLog(db.Model):
    __tablename__ = 'daily_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    date = db.Column(db.Date, nullable=False)
    
    # End-of-day check responses
    tasks_completed_percentage = db.Column(db.Integer)  # 0-100
    screen_time_level = db.Column(db.String(20))  # "Low", "Medium", "High"
    main_distraction = db.Column(db.String(100))
    energy_level = db.Column(db.Integer)  # 1-5
    skip_reason = db.Column(db.Text)
    
    # Calculated metrics
    total_tasks_scheduled = db.Column(db.Integer, default=0)
    total_tasks_completed = db.Column(db.Integer, default=0)
    total_xp_earned = db.Column(db.Integer, default=0)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat(),
            'tasks_completed_percentage': self.tasks_completed_percentage,
            'screen_time_level': self.screen_time_level,
            'main_distraction': self.main_distraction,
            'energy_level': self.energy_level,
            'skip_reason': self.skip_reason,
            'total_tasks_scheduled': self.total_tasks_scheduled,
            'total_tasks_completed': self.total_tasks_completed,
            'total_xp_earned': self.total_xp_earned
        }


class BehaviorEvent(db.Model):
    """PRD: Resistance Event Logging for procrastination heatmap"""
    __tablename__ = 'behavior_events'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=True)
    
    # event_type: hover | open | close | skip | start_late | start | complete
    event_type = db.Column(db.String(30), nullable=False)
    
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    hour_of_day = db.Column(db.Integer)   # 0-23, for heatmap
    day_of_week = db.Column(db.Integer)   # 0=Mon, 6=Sun
    metadata_json = db.Column(db.Text)  # JSON: extra context
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'event_type': self.event_type,
            'timestamp': self.timestamp.isoformat(),
            'metadata': json.loads(self.metadata_json) if self.metadata_json else {}
        }


class Milestone(db.Model):
    """Stage 4: Goal milestones — automatic weekly checkpoints inside a goal"""
    __tablename__ = 'milestones'

    id = db.Column(db.Integer, primary_key=True)
    goal_id = db.Column(db.Integer, db.ForeignKey('goals.id'), nullable=False)

    title = db.Column(db.String(200), nullable=False)
    target_date = db.Column(db.Date, nullable=False)
    target_hours = db.Column(db.Float, default=0)

    # Progress
    status = db.Column(db.String(20), default='pending')  # pending | completed | missed
    completed_at = db.Column(db.DateTime)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'goal_id': self.goal_id,
            'title': self.title,
            'target_date': self.target_date.isoformat(),
            'target_hours': self.target_hours,
            'status': self.status,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }
