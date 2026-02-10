from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from datetime import datetime, timedelta
import jwt
import os
from functools import wraps

from models import db, User, Goal, Task, Commitment, DailyLog
from scheduler import SchedulingEngine
from detector import ProcrastinationDetector

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///strivex.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Initialize extensions
db.init_app(app)
bcrypt = Bcrypt(app)

# Create tables
with app.app_context():
    db.create_all()


# ============= AUTH MIDDLEWARE =============

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            # Remove 'Bearer ' prefix if present
            if token.startswith('Bearer '):
                token = token[7:]
            
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = User.query.get(data['user_id'])
            
            if not current_user:
                return jsonify({'error': 'User not found'}), 401
            
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated


# ============= AUTH ROUTES =============

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    
    # Validate required fields
    required_fields = ['email', 'password']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required fields'}), 400
    
    # Check if user exists
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 400
    
    # Create new user
    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    
    new_user = User(
        email=data['email'],
        password_hash=hashed_password
    )
    
    db.session.add(new_user)
    db.session.commit()
    
    # Generate token
    token = jwt.encode({
        'user_id': new_user.id,
        'exp': datetime.utcnow() + timedelta(days=30)
    }, app.config['SECRET_KEY'], algorithm='HS256')
    
    return jsonify({
        'message': 'User created successfully',
        'token': token,
        'user': new_user.to_dict()
    }), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    
    if not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password required'}), 400
    
    user = User.query.filter_by(email=data['email']).first()
    
    if not user or not bcrypt.check_password_hash(user.password_hash, data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Generate token
    token = jwt.encode({
        'user_id': user.id,
        'exp': datetime.utcnow() + timedelta(days=30)
    }, app.config['SECRET_KEY'], algorithm='HS256')
    
    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user': user.to_dict()
    }), 200


# ============= ONBOARDING ROUTES =============

@app.route('/api/onboarding/profile', methods=['POST'])
@token_required
def complete_onboarding(current_user):
    data = request.json
    
    # Update user profile
    current_user.wake_time = data.get('wake_time')
    current_user.sleep_time = data.get('sleep_time')
    current_user.energy_type = data.get('energy_type')
    
    db.session.commit()
    
    return jsonify({
        'message': 'Profile updated successfully',
        'user': current_user.to_dict()
    }), 200


@app.route('/api/onboarding/commitments', methods=['POST'])
@token_required
def add_commitments(current_user):
    data = request.json
    commitments = data.get('commitments', [])
    
    for c in commitments:
        commitment = Commitment(
            user_id=current_user.id,
            title=c['title'],
            day_of_week=c.get('day_of_week'),
            specific_date=datetime.fromisoformat(c['specific_date']).date() if c.get('specific_date') else None,
            start_time=c['start_time'],
            end_time=c['end_time'],
            recurring=c.get('recurring', True)
        )
        db.session.add(commitment)
    
    db.session.commit()
    
    return jsonify({'message': f'{len(commitments)} commitments added'}), 201


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
    
    # Create goal
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
    
    # Generate schedule
    engine = SchedulingEngine(current_user, goal)
    success, weekly_plan, message = engine.generate_schedule()
    
    if not success:
        return jsonify({'error': message}), 400
    
    # Save tasks to database
    for day_plan in weekly_plan:
        for block in day_plan['time_blocks']:
            if block['type'] == 'task':
                task_data = block['task_data']
                task = Task(
                    goal_id=goal.id,
                    title=task_data['title'],
                    estimated_hours=task_data['hours'],
                    difficulty=task_data['difficulty'],
                    scheduled_date=datetime.fromisoformat(day_plan['date']).date(),
                    scheduled_start_time=block['start_time'],
                    scheduled_end_time=block['end_time'],
                    xp_value=10 + (task_data['difficulty'] * 5)
                )
                db.session.add(task)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Goal created and schedule generated',
        'goal': goal.to_dict(),
        'weekly_plan': weekly_plan
    }), 201


@app.route('/api/goals/<int:goal_id>', methods=['GET'])
@token_required
def get_goal(current_user, goal_id):
    goal = Goal.query.filter_by(id=goal_id, user_id=current_user.id).first()
    
    if not goal:
        return jsonify({'error': 'Goal not found'}), 404
    
    return jsonify(goal.to_dict()), 200


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
    
    # Award XP
    current_user.xp += task.xp_value
    
    # Update streak
    today = datetime.now().date()
    if current_user.last_activity_date == today - timedelta(days=1):
        current_user.streak_count += 1
    elif current_user.last_activity_date != today:
        current_user.streak_count = 1
    
    current_user.last_activity_date = today
    
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


# ============= DAILY LOG ROUTES =============

@app.route('/api/daily-log', methods=['POST'])
@token_required
def submit_daily_log(current_user):
    data = request.json
    today = datetime.now().date()
    
    # Check if log already exists
    log = DailyLog.query.filter_by(
        user_id=current_user.id,
        date=today
    ).first()
    
    if not log:
        log = DailyLog(user_id=current_user.id, date=today)
        db.session.add(log)
    
    # Update log data
    log.tasks_completed_percentage = data.get('tasks_completed_percentage')
    log.screen_time_level = data.get('screen_time_level')
    log.main_distraction = data.get('main_distraction')
    log.energy_level = data.get('energy_level')
    log.skip_reason = data.get('skip_reason')
    
    # Calculate metrics
    today_tasks = Task.query.join(Task.goal).filter(
        Task.goal.has(user_id=current_user.id),
        Task.scheduled_date == today
    ).all()
    
    log.total_tasks_scheduled = len(today_tasks)
    log.total_tasks_completed = sum(1 for t in today_tasks if t.status == 'completed')
    log.total_xp_earned = sum(t.xp_value for t in today_tasks if t.status == 'completed')
    
    db.session.commit()
    
    # Analyze patterns and adjust schedule
    detector = ProcrastinationDetector(current_user)
    patterns = detector.analyze_patterns(days=7)
    adjustments = detector.get_adjustment_recommendations(patterns, log)
    
    # Apply adjustments to active goals
    active_goals = Goal.query.filter_by(user_id=current_user.id, status='active').all()
    total_modified = 0
    
    for goal in active_goals:
        modified = detector.apply_adjustments(goal, adjustments)
        total_modified += modified
    
    return jsonify({
        'message': 'Daily log submitted',
        'patterns': patterns,
        'adjustments': [a['message'] for a in adjustments],
        'tasks_modified': total_modified
    }), 201


# ============= ANALYTICS ROUTES =============

@app.route('/api/analytics/patterns', methods=['GET'])
@token_required
def get_patterns(current_user):
    detector = ProcrastinationDetector(current_user)
    patterns = detector.analyze_patterns(days=7)
    
    return jsonify(patterns), 200


@app.route('/api/analytics/deadline-risk/<int:goal_id>', methods=['GET'])
@token_required
def get_deadline_risk(current_user, goal_id):
    goal = Goal.query.filter_by(id=goal_id, user_id=current_user.id).first()
    
    if not goal:
        return jsonify({'error': 'Goal not found'}), 404
    
    detector = ProcrastinationDetector(current_user)
    risk_level, message = detector.check_deadline_risk(goal)
    
    return jsonify({
        'risk_level': risk_level,
        'message': message
    }), 200


# ============= DASHBOARD ROUTES =============

@app.route('/api/dashboard', methods=['GET'])
@token_required
def get_dashboard(current_user):
    today = datetime.now().date()
    
    # Get today's tasks
    today_tasks = Task.query.join(Task.goal).filter(
        Task.goal.has(user_id=current_user.id),
        Task.scheduled_date == today
    ).order_by(Task.scheduled_start_time).all()
    
    # Get active goals
    active_goals = Goal.query.filter_by(
        user_id=current_user.id,
        status='active'
    ).all()
    
    # Get deadline risks
    deadline_risks = []
    detector = ProcrastinationDetector(current_user)
    
    for goal in active_goals:
        risk_level, message = detector.check_deadline_risk(goal)
        deadline_risks.append({
            'goal_id': goal.id,
            'goal_title': goal.title,
            'risk_level': risk_level,
            'message': message
        })
    
    # Get recent patterns
    patterns = detector.analyze_patterns(days=7)
    
    return jsonify({
        'user': current_user.to_dict(),
        'today_tasks': [t.to_dict() for t in today_tasks],
        'active_goals': [g.to_dict() for g in active_goals],
        'deadline_risks': deadline_risks,
        'patterns': patterns
    }), 200


# ============= HEALTH CHECK =============

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'StriveX API is running'}), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000)
