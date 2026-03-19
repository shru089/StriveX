"""
StriveX Analytics & Conversion Tracking
Advanced behavioral analytics for product optimization
"""
from flask import Blueprint, jsonify, request  # type: ignore
from models import db, User, Goal, Task, DailyLog, BehaviorEvent  # type: ignore
from sqlalchemy import func, extract, cast, Date  # type: ignore
from datetime import datetime, timedelta
from collections import defaultdict
from functools import wraps
import json
from loguru import logger  # type: ignore
from intelligence import BehavioralIntelligenceEngine  # type: ignore

analytics = Blueprint('analytics', __name__)


# ---------------------------------------------------------------------------
# Auth helper: import dynamically to avoid circular import at module load time
# ---------------------------------------------------------------------------
def _token_required(f):
    """Thin wrapper that delegates to app.token_required, imported lazily."""
    @wraps(f)
    def decorated(*args, **kwargs):
        from app import token_required as _tr  # type: ignore # noqa: PLC0415
        return _tr(f)(*args, **kwargs)
    return decorated


# ════════════════════════════════════════════════════════════
# CONVERSION FUNNEL TRACKING
# ════════════════════════════════════════════════════════════

@analytics.route('/funnel', methods=['GET'])
@_token_required
def get_conversion_funnel(current_user):
    """
    Get conversion funnel metrics.
    Tracks: Signups → Activated → First Goal → Premium → Retained
    
    Returns drop-off points and conversion rates.
    """
    # current_user is guaranteed by @_token_required
    # Calculate funnel stages
    total_users = User.query.count()
    
    # Activated: Completed at least 1 task
    activated_users = User.query.join(User.todo_items).filter(
        Task.completed_at.isnot(None)
    ).distinct().count()
    
    # First goal created
    users_with_goals = User.query.join(User.goals).distinct().count()
    
    # Premium subscribers
    premium_users = User.query.filter(
        User.subscription_tier.in_(['premium', 'pro'])
    ).count()
    
    # Retained (active in last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    retained_users = User.query.filter(
        User.last_activity_date >= week_ago.date()
    ).count()
    
    funnel = {
        'stages': [
            {'name': 'Signups', 'count': total_users, 'percentage': 100},
            {'name': 'Activated (1+ task)', 'count': activated_users, 
             'percentage': round(activated_users / max(1, total_users) * 100, 2)},
            {'name': 'Created First Goal', 'count': users_with_goals,
             'percentage': round(users_with_goals / max(1, total_users) * 100, 2)},
            {'name': 'Premium Subscriber', 'count': premium_users,
             'percentage': round(premium_users / max(1, total_users) * 100, 2)},
            {'name': 'Retained (7-day)', 'count': retained_users,
             'percentage': round(retained_users / max(1, total_users) * 100, 2)}
        ],
        'insights': []
    }
    
    # Generate insights
    activation_rate = activated_users / max(1, total_users)
    if activation_rate < 0.5:
        funnel['insights'].append({
            'type': 'warning',
            'message': f'Activation rate is {activation_rate*100:.1f}% (industry avg: 50%)',
            'recommendation': 'Improve onboarding flow or add interactive tutorial'
        })
    
    goal_creation_rate = users_with_goals / max(1, activated_users)
    if goal_creation_rate < 0.6:
        funnel['insights'].append({
            'type': 'warning',
            'message': f'Only {goal_creation_rate*100:.1f}% of activated users create goals',
            'recommendation': 'Add goal creation prompts during onboarding'
        })
    
    premium_conversion = premium_users / max(1, total_users)
    if premium_conversion < 0.05:
        funnel['insights'].append({
            'type': 'info',
            'message': f'Premium conversion is {premium_conversion*100:.2f}% (target: 5%)',
            'recommendation': 'Consider lowering price or adding more premium features'
        })
    
    return jsonify(funnel), 200


# ════════════════════════════════════════════════════════════
# MOVED FROM app.py (Consolidation)
# ════════════════════════════════════════════════════════════

@analytics.route('/patterns', methods=['GET'])
@_token_required
def get_patterns(current_user):
    try:
        engine = BehavioralIntelligenceEngine(current_user)
        patterns = engine.full_analysis()
        return jsonify(patterns), 200
    except Exception as e:
        logger.error(f'Pattern analysis error: {e}')
        return jsonify({'patterns': [], 'recommendations': [], 'burnout_risk': False}), 200


@analytics.route('/deadline-risk/<int:goal_id>', methods=['GET'])
@_token_required
def get_deadline_risk(current_user, goal_id):
    goal = Goal.query.filter_by(id=goal_id, user_id=current_user.id).first()
    if not goal:
        return jsonify({'error': 'Goal not found'}), 404

    try:
        # Compute progress inline from tasks (Goal model has no 'progress' or 'end_date' fields)
        tasks = goal.tasks
        total_tasks = len(tasks)
        completed_tasks = sum(1 for t in tasks if t.status == 'completed')
        progress = round(float(completed_tasks / max(1, total_tasks) * 100))
        days_left = (goal.deadline - datetime.utcnow().date()).days if goal.deadline else 999
        if days_left < 3 and progress < 80:
            risk_level, message = 'high', f'Only {days_left}d left with {progress}% done — push hard!'
        elif days_left < 7 and progress < 50:
            risk_level, message = 'high', f'Less than a week and only {progress}% complete.'
        elif days_left < 14 and progress < 30:
            risk_level, message = 'medium', 'Falling behind — consider re-prioritising.'
        else:
            risk_level, message = 'low', 'On track — keep the momentum!'
    except Exception:
        progress = 0
        risk_level, message = 'low', 'Keep going!'

    return jsonify({'risk_level': risk_level, 'message': message, 'progress_pct': progress}), 200


@analytics.route('/heatmap', methods=['GET'])
@_token_required
def get_heatmap(current_user):
    """PRD 6.2: Procrastination heatmap data — resistance events by hour/day"""
    events = BehaviorEvent.query.filter_by(user_id=current_user.id).filter(
        BehaviorEvent.event_type.in_(['skip', 'start_late', 'hover'])
    ).order_by(BehaviorEvent.timestamp.desc()).limit(500).all()
    
    # Aggregate by day_of_week × hour_of_day
    grid = {}
    for event in events:
        metadata = json.loads(event.metadata_json) if event.metadata_json else {}
        hour = metadata.get('hour_of_day', event.timestamp.hour)
        day = metadata.get('day_of_week', event.timestamp.weekday())
        key = f"{day}_{hour}"
        grid[key] = grid.get(key, 0) + 1
    
    # Build 7×24 grid
    heatmap = [[0] * 24 for _ in range(7)]
    for key, count in grid.items():
        parts = key.split('_')
        if len(parts) == 2:
            d, h = int(parts[0]), int(parts[1])
            heatmap[d][h] = count
    
    return jsonify({
        'heatmap': heatmap,
        'days': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        'total_resistance_events': len(events)
    }), 200


@analytics.route('/weekly', methods=['GET'])
@_token_required
def get_weekly_analytics(current_user):
    """Real 7-day completion data for analytics chart"""
    engine = BehavioralIntelligenceEngine(current_user)
    analysis = engine.full_analysis()
    
    return jsonify({
        'weekly_data': analysis["completion_trend"],
        'burnout_risk': analysis["burnout_risk"],
        'burnout_message': analysis["burnout_message"]
    }), 200


# ════════════════════════════════════════════════════════════
# USER BEHAVIORAL ANALYTICS
# ════════════════════════════════════════════════════════════

@analytics.route('/user-behavior', methods=['GET'])
@_token_required
def get_user_behavior(current_user):
    """
    Deep dive into individual user behavior patterns.
    Shows productivity rhythms, task completion rates, etc.
    """
    user = current_user
    
    # Time-based analysis
    tasks = Task.query.join(Task.goal).filter(
        Task.goal.has(user_id=user.id)
    ).all()
    
    # Hourly productivity
    hourly_completion = defaultdict(lambda: {'completed': 0, 'total': 0})
    for task in tasks:
        if task.completed_at:
            hour = task.completed_at.hour
            hourly_completion[hour]['completed'] += 1
        hourly_completion[task.scheduled_start_time.split(':')[0] if task.scheduled_start_time else '12']['total'] += 1
    
    # Day-of-week analysis
    daily_completion = defaultdict(lambda: {'completed': 0, 'total': 0})
    for task in tasks:
        if task.completed_at:
            dow = task.completed_at.weekday()
            daily_completion[dow]['completed'] += 1
        if task.scheduled_date:
            dow = task.scheduled_date.weekday()
            daily_completion[dow]['total'] += 1
    
    # Task category performance
    category_stats = defaultdict(lambda: {'completed': 0, 'total': 0, 'avg_hours': 0.0})
    for task in tasks:
        category = task.goal.title[:20] if task.goal else 'Uncategorized'
        category_stats[category]['total'] += 1
        if task.status == 'completed':
            category_stats[category]['completed'] += 1
        if task.estimated_hours:
            category_stats[category]['avg_hours'] = (
                float(category_stats[category]['avg_hours']) + float(task.estimated_hours)
            ) / 2.0
    
    behavior_data = {
        'hourly_productivity': [
            {
                'hour': hour,
                'completed': data['completed'],
                'scheduled': data['total'],
                'success_rate': round(float(data['completed'] / max(1, data['total']) * 100), 2)  # type: ignore
            }
            for hour, data in sorted(hourly_completion.items())
        ],
        'daily_productivity': [
            {
                'day': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][int(dow)],
                'completed': data['completed'],
                'scheduled': data['total'],
                'success_rate': round(float(data['completed'] / max(1, int(data['total']))) * 100, 2)  # type: ignore
            }
            for dow, data in sorted(daily_completion.items())
            if isinstance(dow, (int, float)) and 0 <= int(dow) < 7
        ],
        'category_performance': [
            {
                'category': str(cat),
                'completed': data['completed'],
                'total': data['total'],
                'success_rate': round(float(data['completed'] / max(1, int(data['total']))) * 100, 2),  # type: ignore
                'avg_hours': round(float(data['avg_hours']), 1)  # type: ignore
            }
            for cat, data in sorted(category_stats.items(), key=lambda x: x[1]['total'] if isinstance(x[1], dict) else 0, reverse=True)[:10]  # type: ignore
        ]
    }
    
    # Generate AI-powered insights
    insights = generate_behavioral_insights(user, behavior_data)
    behavior_data['insights'] = insights
    
    return jsonify(behavior_data), 200


def generate_behavioral_insights(user, data):
    """Generate actionable insights from behavior data"""
    insights = []
    
    # Peak performance hours
    peak_hour = None
    peak_rate = 0
    for hour_data in data['hourly_productivity']:
        if hour_data['success_rate'] > peak_rate and hour_data['completed'] >= 3:
            peak_rate = hour_data['success_rate']
            peak_hour = hour_data['hour']
    
    if peak_hour is not None:
        p_hour = int(peak_hour)  # type: ignore
        time_of_day = "morning" if p_hour < 12 else "afternoon" if p_hour < 17 else "evening"
        insights.append({
            'type': 'optimization',
            'title': f'Your Peak Time: {p_hour}:00 {time_of_day}',
            'description': f'You complete {peak_rate:.0f}% of tasks scheduled at this time',
            'action': f'Schedule your most important tasks between {max(0, p_hour-1)}:00 and {min(23, p_hour+1)}:00'
        })
    
    # Weakest day
    weakest_day = None
    weakest_rate = 100
    for day_data in data['daily_productivity']:
        if day_data['success_rate'] < weakest_rate and day_data['scheduled'] >= 5:
            weakest_rate = day_data['success_rate']
            weakest_day = day_data['day']
    
    if weakest_day and weakest_rate < 60:
        insights.append({
            'type': 'warning',
            'title': f'{weakest_day} is Your Challenge Day',
            'description': f'Only {weakest_rate:.0f}% success rate on this day',
            'action': 'Consider lighter scheduling or accountability measures on this day'
        })
    
    # Streak insight
    if user.streak_count >= 7:
        insights.append({
            'type': 'positive',
            'title': f'{user.streak_count}-Day Streak!',
            'description': 'You\'re in the top 15% of consistent users',
            'action': 'Maintain momentum by reviewing your progress weekly'
        })
    
    return insights


# ════════════════════════════════════════════════════════════
# GOAL SUCCESS PREDICTION
# ════════════════════════════════════════════════════════════

@analytics.route('/goal-success-prediction/<int:goal_id>', methods=['GET'])
@_token_required
def predict_goal_success(current_user, goal_id):
    """
    Predict likelihood of goal completion based on historical patterns.
    Uses similar goals, user velocity, and risk factors.
    """
    goal = Goal.query.get(goal_id)
    
    if not goal or goal.user_id != current_user.id:
        return jsonify({'error': 'Goal not found'}), 404
    
    # Find similar historical goals
    similar_goals = Goal.query.filter(
        Goal.user_id == current_user.id,
        Goal.id != goal_id,
        Goal.status.in_(['completed', 'abandoned'])
    ).all()
    
    # Calculate similarity score
    def calculate_similarity(g1, g2):
        # Simple text similarity based on title overlap
        words1 = set(g1.title.lower().split())
        words2 = set(g2.title.lower().split())
        return len(words1 & words2) / len(words1 | words2) if words1 | words2 else 0.0
    
    # Cast base collection to list to ensure slicing works in IDE
    most_similar = sorted(cast(list, similar_goals), key=lambda g: calculate_similarity(goal, g), reverse=True)[:5]  # type: ignore
    
    # Historical success rate with similar goals
    completed_similar = sum(1 for g in most_similar if g.status == 'completed')
    base_success_rate = completed_similar / len(most_similar) if most_similar else 0.5
    
    # Current goal health indicators
    tasks = Task.query.filter_by(goal_id=goal_id).all()
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == 'completed')
    
    task_completion_rate = completed_tasks / max(1, total_tasks)
    
    # Deadline pressure
    days_until_deadline = (goal.deadline - datetime.utcnow().date()).days if goal.deadline else 30
    estimated_remaining_hours = sum(t.estimated_hours for t in tasks if t.status != 'completed')
    hours_per_day_needed = estimated_remaining_hours / max(1, days_until_deadline)
    
    feasibility = 'high' if hours_per_day_needed <= 2 else 'medium' if hours_per_day_needed <= 4 else 'low'
    
    prediction = {
        'goal_id': goal_id,
        'success_probability': round(float((base_success_rate * 0.4 + task_completion_rate * 0.6) * 100), 1),  # type: ignore
        'confidence': 'high' if len(most_similar) >= 3 else 'medium' if len(most_similar) >= 1 else 'low',
        'factors': {
            'historical_similarity': f'{base_success_rate*100:.1f}%',
            'current_progress': f'{task_completion_rate*100:.1f}%',
            'deadline_pressure': f'{hours_per_day_needed:.1f} hrs/day needed',
            'feasibility': feasibility
        },
        'recommendations': []
    }
    
    # Generate recommendations
    recs = cast(list, prediction['recommendations'])
    if hours_per_day_needed > 4:
        recs.append({
            'priority': 'high',
            'action': 'Extend deadline or reduce scope',
            'reason': f'You need {hours_per_day_needed:.1f} hrs/day — unsustainable pace'
        })
    
    if task_completion_rate < 0.3 and days_until_deadline < 14:
        recs.append({
            'priority': 'high',
            'action': 'Focus on quick wins',
            'reason': 'Behind schedule with limited time remaining'
        })
    
    if base_success_rate < 0.5:
        recs.append({
            'priority': 'medium',
            'action': 'Review past failures',
            'reason': 'Similar goals have low completion rate for you'
        })
    
    return jsonify(prediction), 200


# ════════════════════════════════════════════════════════════
# CHURN RISK ASSESSMENT
# ════════════════════════════════════════════════════════════

@analytics.route('/churn-risk', methods=['GET'])
@_token_required
def assess_churn_risk(current_user):
    """
    Identify users at risk of churning based on behavior patterns.
    Enables proactive intervention.
    """
    user = current_user
    
    risk_score = 0  # 0-100, higher = more likely to churn
    risk_factors = []
    
    # Factor 1: Days since last activity
    if user.last_activity_date:
        days_inactive = (datetime.utcnow().date() - user.last_activity_date).days
        if days_inactive > 14:
            risk_score += 40
            risk_factors.append(f'Inactive for {days_inactive} days')
        elif days_inactive > 7:
            risk_score += 20
            risk_factors.append(f'Inactive for {days_inactive} days')
        elif days_inactive > 3:
            risk_score += 10
            risk_factors.append(f'Inactive for {days_inactive} days')
    
    # Factor 2: Declining task completion
    this_week = datetime.utcnow() - timedelta(days=7)
    last_week = this_week - timedelta(days=7)
    
    tasks_this_week = Task.query.join(Task.goal).filter(
        Task.goal.has(user_id=user.id),
        Task.completed_at >= this_week
    ).count()
    
    tasks_last_week = Task.query.join(Task.goal).filter(
        Task.goal.has(user_id=user.id),
        Task.completed_at >= last_week,
        Task.completed_at < this_week
    ).count()
    
    if tasks_last_week > 0:
        decline_rate = (tasks_last_week - tasks_this_week) / tasks_last_week
        if decline_rate > 0.7:
            risk_score += 30
            risk_factors.append(f'Task completion down {decline_rate*100:.0f}% from last week')
        elif decline_rate > 0.4:
            risk_score += 15
            risk_factors.append(f'Task completion down {decline_rate*100:.0f}% from last week')
    
    # Factor 3: No goals created recently
    recent_goals = Goal.query.filter(
        Goal.user_id == user.id,
        Goal.created_at >= datetime.utcnow() - timedelta(days=30)
    ).count()
    
    if recent_goals == 0:
        risk_score += 20
        risk_factors.append('No goals created in 30 days')
    
    # Factor 4: Failed subscription (if applicable)
    if user.subscription_tier == 'free' and user.id:  # Could check for expired trials
        risk_score += 10
        risk_factors.append('On free tier (never upgraded)')
    
    risk_level = 'critical' if risk_score >= 60 else 'high' if risk_score >= 40 else 'medium' if risk_score >= 20 else 'low'
    
    intervention_suggestions = []
    if risk_level in ['critical', 'high']:
        intervention_suggestions.append({
            'type': 'email',
            'template': 'at_risk_churn',
            'urgency': 'immediate'
        })
        intervention_suggestions.append({
            'type': 'product',
            'action': 'Show re-engagement modal on next login',
            'offer': 'Free premium week to restart momentum'
        })
    
    return jsonify({
        'user_id': user.id,
        'risk_score': risk_score,
        'risk_level': risk_level,
        'risk_factors': risk_factors,
        'intervention_suggestions': intervention_suggestions
    }), 200


logger.info("✅ Analytics blueprint initialized")
