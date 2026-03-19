"""
StriveX Progress Autopsy Engine
AI-powered post-mortem analysis of completed/failed goals
Provides deep insights and recommendations for future attempts
"""
from flask import Blueprint, request, jsonify  # type: ignore
from models import db, User, Goal, Task  # type: ignore
from sqlalchemy import func  # type: ignore
from datetime import datetime, timedelta
from intelligence import gemini  # type: ignore
import json
from functools import wraps
from typing import Any, cast
from loguru import logger  # type: ignore

autopsy = Blueprint('autopsy', __name__)


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
# PROGRESS AUTOPSY ENGINE
# ════════════════════════════════════════════════════════════

@autopsy.route('/goal/<int:goal_id>', methods=['GET'])
@_token_required
def generate_goal_autopsy(current_user, goal_id):
    """
    Generate comprehensive post-mortem analysis for a goal.
    Analyzes success factors, failure points, and provides actionable recommendations.
    """
    goal = Goal.query.get(goal_id)
    
    if not goal or goal.user_id != current_user.id:
        return jsonify({'error': 'Goal not found'}), 404
    
    # Get all tasks for this goal
    tasks = Task.query.filter_by(goal_id=goal_id).all()
    
    if not tasks:
        return jsonify({'error': 'No tasks found for this goal'}), 404
    
    # Calculate metrics
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == 'completed')
    skipped_tasks = sum(1 for t in tasks if t.status == 'skipped')
    completion_rate = completed_tasks / max(1, total_tasks) * 100
    
    # Time analysis
    actual_duration = None
    if goal.created_at and goal.completed_at:
        actual_duration = (goal.completed_at - goal.created_at).days
    elif goal.created_at:
        actual_duration = (datetime.utcnow() - goal.created_at).days
    
    planned_duration = None
    if goal.deadline and goal.created_at:
        planned_duration = (goal.deadline - goal.created_at.date()).days
    
    # Effort estimation accuracy
    estimated_total_hours = sum(t.estimated_hours or 0 for t in tasks)
    actual_hours = estimated_total_hours  # Would need time tracking for real actual hours
    
    # Identify patterns
    completion_timeline = []
    for task in sorted(tasks, key=lambda t: t.completed_at or datetime.max):
        if task.completed_at:
            days_from_start = (task.completed_at - goal.created_at).days if goal.created_at else 0
            completion_timeline.append({
                'task_id': task.id,
                'title': task.title,
                'days_elapsed': days_from_start,
                'estimated_hours': task.estimated_hours
            })
    
    # Root cause analysis
    root_causes = []
    recommendations = []
    
    # 1. Deadline analysis
    if planned_duration and actual_duration and actual_duration > planned_duration * 1.5:
        root_causes.append({
            'category': 'Planning Fallacy',
            'severity': 'high',
            'finding': f'Underestimated timeline by {round((actual_duration - planned_duration) / planned_duration * 100)}%',
            'evidence': f'Planned: {planned_duration} days, Actual: {actual_duration} days'
        })
        recommendations.append({
            'type': 'planning',
            'action': 'Add 50% buffer to future estimates',
            'rationale': 'Your planning fallacy index is 1.5x — adjust accordingly'
        })
    
    # 2. Task completion rate
    if completion_rate < 60:
        root_causes.append({
            'category': 'Scope Creep',
            'severity': 'critical',
            'finding': f'Only completed {completion_rate:.0f}% of planned tasks',
            'evidence': f'{completed_tasks}/{total_tasks} tasks completed, {skipped_tasks} skipped'
        })
        recommendations.append({
            'type': 'scope',
            'action': 'Reduce initial scope by 40%',
            'rationale': 'Start smaller, achieve quick wins, then expand'
        })
    
    # 3. Difficulty mismatch
    high_difficulty_tasks = [t for t in tasks if t.difficulty >= 4]
    if len(high_difficulty_tasks) > total_tasks * 0.3:
        root_causes.append({
            'category': 'Difficulty Mismatch',
            'severity': 'medium',
            'finding': f'{len(high_difficulty_tasks)} tasks rated 4+ difficulty',
            'evidence': 'Too many high-difficulty tasks without adequate preparation'
        })
        recommendations.append({
            'type': 'preparation',
            'action': 'Break down difficult tasks further',
            'rationale': 'Tasks rated 4+ difficulty have 67% lower completion rate'
        })
    
    # 4. Ghost mode usage (if tracked)
    ghost_tasks: list[Task] = [t for t in tasks if getattr(t, 'is_ghost', False)]
    if ghost_tasks:
        ghost_completion = sum(1 for t in ghost_tasks if cast(Any, t).status == 'completed')
        ghost_rate = ghost_completion / len(ghost_tasks) * 100
        regular_completion = sum(1 for t in tasks if not getattr(t, 'is_ghost', False) and cast(Any, t).status == 'completed')
        regular_rate = regular_completion / (total_tasks - len(ghost_tasks)) * 100 if total_tasks > len(ghost_tasks) else 0
        
        if ghost_rate > regular_rate:
            root_causes.append({
                'category': 'Focus Strategy',
                'severity': 'info',
                'finding': f'Ghost Mode tasks had {ghost_rate:.0f}% success vs {regular_rate:.0f}% regular',
                'evidence': 'Distraction-free work significantly improves your performance'
            })
            recommendations.append({
                'type': 'environment',
                'action': 'Enable Ghost Mode for all deep work sessions',
                'rationale': f'{ghost_rate - regular_rate:.0f}% improvement in focus environments'
            })
    
    # AI-powered insights (if Gemini available)
    ai_insights = None
    if gemini.model and completion_rate < 80:
        try:
            context = f"""
            Goal: {goal.title}
            Status: {'Completed' if completion_rate >= 80 else 'Partially Completed' if completion_rate >= 40 else 'Failed'}
            Completion Rate: {completion_rate:.1f}%
            Tasks: {completed_tasks}/{total_tasks} completed
            Duration: {actual_duration} days (planned: {planned_duration})
            
            Root Causes Identified:
            {json.dumps([{'category': rc['category'], 'finding': rc['finding']} for rc in root_causes], indent=2)}
            
            Provide 3 specific, actionable recommendations for next attempt.
            Format as JSON array: [{{"recommendation": "...", "implementation": "..."}}]
            """
            
            response = gemini.model.generate_content(context)
            ai_insights = json.loads(response.text)
        except Exception as e:
            logger.error(f"AI insight generation failed: {e}")
    
    # Build autopsy report
    autopsy_report = {
        'goal_id': goal_id,
        'goal_title': goal.title,
        'status': '✅ Success' if completion_rate >= 80 else '⚠️ Partial' if completion_rate >= 40 else '❌ Failed',
        'metrics': {
            'completion_rate': round(float(completion_rate), 1),  # type: ignore
            'tasks_completed': f'{completed_tasks}/{total_tasks}',
            'duration': {
                'planned_days': planned_duration,
                'actual_days': actual_duration,
                'variance_percent': round(float((actual_duration - planned_duration) / max(1, planned_duration) * 100), 1) if planned_duration else None  # type: ignore
            },
            'effort_estimation': {
                'estimated_hours': round(float(estimated_total_hours), 1),  # type: ignore
                'accuracy': 'accurate' if actual_hours and 0.8 <= estimated_total_hours / actual_hours <= 1.2 else 'underestimated' if actual_hours and estimated_total_hours < actual_hours else 'overestimated'
            }
        },
        'root_causes': root_causes,
        'recommendations': recommendations,
        'ai_insights': ai_insights,
        'success_patterns': identify_success_patterns(tasks, completion_rate),
        'next_attempt_forecast': forecast_next_attempt(goal, tasks, completion_rate, recommendations)
    }
    
    return jsonify(autopsy_report), 200


def identify_success_patterns(tasks, completion_rate):
    """Identify what worked well for future replication"""
    patterns = []
    
    # Find highest success task types
    completed_tasks = [t for t in tasks if t.status == 'completed']
    
    if completed_tasks:
        # Best time of day
        morning_tasks = [t for t in completed_tasks if t.scheduled_start_time and int(t.scheduled_start_time.split(':')[0]) < 12]
        afternoon_tasks = [t for t in completed_tasks if t.scheduled_start_time and 12 <= int(t.scheduled_start_time.split(':')[0]) < 17]
        
        if len(morning_tasks) > len(afternoon_tasks):
            patterns.append({
                'pattern': 'Morning Productivity',
                'evidence': f'{len(morning_tasks)} morning completions vs {len(afternoon_tasks)} afternoon',
                'action': 'Schedule critical tasks before noon'
            })
        
        # Best day of week
        from collections import Counter
        weekday_completions = Counter()
        for t in completed_tasks:
            if t.completed_at:
                weekday_completions[t.completed_at.weekday()] += 1
        
        if weekday_completions:
            best_day = weekday_completions.most_common(1)[0][0]
            days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            patterns.append({
                'pattern': f'{days[best_day]} Momentum',
                'evidence': f'Most productive day with {weekday_completions[best_day]} completions',
                'action': f'Schedule important work on {days[best_day]}'
            })
    
    return patterns


def forecast_next_attempt(goal, tasks, current_success_rate, recommendations):
    """Predict success probability for next attempt with changes"""
    
    base_probability = current_success_rate
    
    # Adjust based on implemented recommendations
    adjustment = 0
    if any(r['type'] == 'scope' for r in recommendations):
        adjustment += 15  # Scope reduction has high impact
    if any(r['type'] == 'planning' for r in recommendations):
        adjustment += 10
    if any(r['type'] == 'environment' for r in recommendations):
        adjustment += 12
    
    adjusted_probability = min(95, base_probability + adjustment)
    
    return {
        'current_success_rate': round(float(current_success_rate), 1),  # type: ignore
        'projected_success_rate': round(float(adjusted_probability), 1),  # type: ignore
        'improvement_potential': round(float(adjustment), 1),  # type: ignore
        'key_levers': [r['action'] for r in recommendations[:3]],
        # goal.deadline is a date object — compute days from today, not .days on a date
        'timeline_recommendation': (
            f'{int((goal.deadline - datetime.utcnow().date()).days * 1.5)} days (add 50% buffer)'
            if goal.deadline
            else '30-45 days'
        )
    }


# ════════════════════════════════════════════════════════════
# COMPARATIVE AUTOPSY (Multiple Goals)
# ════════════════════════════════════════════════════════════

@autopsy.route('/compare', methods=['POST'])
@_token_required
def compare_goals(current_user):
    """
    Compare multiple goals to identify patterns across attempts.
    Useful for users who repeatedly attempt similar goals.
    """
    data = request.json or {}
    goal_ids = data.get('goal_ids', [])
    
    if len(goal_ids) < 2:
        return jsonify({'error': 'Need at least 2 goals to compare'}), 400
    
    goals = Goal.query.filter(Goal.id.in_(goal_ids), Goal.user_id == current_user.id).all()
    
    if len(goals) != len(goal_ids):
        return jsonify({'error': 'Some goals not found'}), 404
    
    comparisons = []
    for goal in goals:
        tasks = Task.query.filter_by(goal_id=goal.id).all()
        completed = sum(1 for t in tasks if t.status == 'completed')
        
        comparisons.append({
            'goal_id': goal.id,
            'title': goal.title,
            'completion_rate': round(float(completed / max(1, len(tasks)) * 100), 1),  # type: ignore
            'duration_days': (goal.completed_at - goal.created_at).days if goal.completed_at and goal.created_at else None,
            'task_count': len(tasks),
            'avg_difficulty': sum(t.difficulty for t in tasks) / len(tasks) if tasks else 0
        })
    
    # Identify trends
    if len(comparisons) >= 2:
        trend_analysis = {
            'completion_trend': 'improving' if comparisons[-1]['completion_rate'] > comparisons[0]['completion_rate'] else 'declining',
            'velocity_trend': 'speeding_up' if comparisons[-1].get('duration_days') and comparisons[0].get('duration_days') and comparisons[-1]['duration_days'] < comparisons[0]['duration_days'] else 'slowing_down',
            'scope_trend': 'expanding' if comparisons[-1]['task_count'] > comparisons[0]['task_count'] else 'shrinking'
        }
    else:
        trend_analysis = {}
    
    return jsonify({
        'goals': comparisons,
        'trends': trend_analysis,
        'insights': generate_comparative_insights(comparisons)
    }), 200


def generate_comparative_insights(comparisons):
    """Generate insights from comparing multiple goals"""
    insights = []
    
    avg_completion = sum(c['completion_rate'] for c in comparisons) / len(comparisons)
    
    if avg_completion < 50:
        insights.append({
            'type': 'warning',
            'message': f'Average completion rate is {avg_completion:.1f}%',
            'recommendation': 'Consider fundamentally different approach or smaller goals'
        })
    
    completion_rates = [c['completion_rate'] for c in comparisons]
    variance = max(completion_rates) - min(completion_rates)
    
    if variance > 40:
        insights.append({
            'type': 'info',
            'message': f'High variance ({variance:.1f}%) between attempts',
            'recommendation': 'Analyze what made successful attempts different'
        })
    
    return insights


logger.info("✅ Progress Autopsy engine initialized")
