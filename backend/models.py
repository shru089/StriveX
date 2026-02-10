from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # Profile data
    wake_time = db.Column(db.String(5))  # "07:00"
    sleep_time = db.Column(db.String(5))  # "23:00"
    energy_type = db.Column(db.String(20))  # "morning", "night", "flexible"
    
    # Gamification
    xp = db.Column(db.Integer, default=0)
    streak_count = db.Column(db.Integer, default=0)
    last_activity_date = db.Column(db.Date)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    goals = db.relationship('Goal', backref='user', lazy=True, cascade='all, delete-orphan')
    commitments = db.relationship('Commitment', backref='user', lazy=True, cascade='all, delete-orphan')
    daily_logs = db.relationship('DailyLog', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'wake_time': self.wake_time,
            'sleep_time': self.sleep_time,
            'energy_type': self.energy_type,
            'xp': self.xp,
            'streak_count': self.streak_count,
            'last_activity_date': self.last_activity_date.isoformat() if self.last_activity_date else None
        }


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
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    # Relationships
    tasks = db.relationship('Task', backref='goal', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'deadline': self.deadline.isoformat(),
            'estimated_hours': self.estimated_hours,
            'priority': self.priority,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'tasks': [task.to_dict() for task in self.tasks]
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
    status = db.Column(db.String(20), default='pending')  # pending, completed, skipped, rescheduled
    completed_at = db.Column(db.DateTime)
    
    # XP reward
    xp_value = db.Column(db.Integer, default=10)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
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
