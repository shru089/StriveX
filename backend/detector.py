from datetime import datetime, timedelta
from models import DailyLog, Task, db
from scheduler import SchedulingEngine


class ProcrastinationDetector:
    """
    Analyzes user behavior patterns and detects procrastination signals
    Provides recommendations for schedule adjustments
    """
    
    def __init__(self, user):
        self.user = user
    
    def analyze_patterns(self, days=7):
        """
        Analyze completion patterns over the last N days
        Returns: dict of insights
        """
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days)
        
        logs = DailyLog.query.filter(
            DailyLog.user_id == self.user.id,
            DailyLog.date >= start_date,
            DailyLog.date <= end_date
        ).all()
        
        if not logs:
            return {
                'has_data': False,
                'message': 'Not enough data yet'
            }
        
        # Calculate metrics
        patterns = {
            'has_data': True,
            'avg_completion_rate': 0,
            'avg_energy_level': 0,
            'screen_time_trend': 'Unknown',
            'common_distractions': [],
            'energy_mismatch': False,
            'burnout_risk': False,
            'consistency_score': 0
        }
        
        total_completion = 0
        total_energy = 0
        screen_time_high_count = 0
        distractions = {}
        
        for log in logs:
            if log.tasks_completed_percentage is not None:
                total_completion += log.tasks_completed_percentage
            
            if log.energy_level is not None:
                total_energy += log.energy_level
            
            if log.screen_time_level == "High":
                screen_time_high_count += 1
            
            if log.main_distraction:
                distractions[log.main_distraction] = distractions.get(log.main_distraction, 0) + 1
        
        num_logs = len(logs)
        patterns['avg_completion_rate'] = total_completion / num_logs if num_logs > 0 else 0
        patterns['avg_energy_level'] = total_energy / num_logs if num_logs > 0 else 0
        
        # Screen time trend
        if screen_time_high_count > num_logs * 0.6:
            patterns['screen_time_trend'] = 'High'
        elif screen_time_high_count > num_logs * 0.3:
            patterns['screen_time_trend'] = 'Medium'
        else:
            patterns['screen_time_trend'] = 'Low'
        
        # Common distractions
        if distractions:
            patterns['common_distractions'] = sorted(
                distractions.items(),
                key=lambda x: x[1],
                reverse=True
            )[:3]
        
        # Detect energy mismatch
        if self.user.energy_type == "morning":
            # Check morning task completion
            morning_tasks = self._get_morning_completion_rate()
            if morning_tasks < 0.5:
                patterns['energy_mismatch'] = True
        elif self.user.energy_type == "night":
            # Check evening task completion
            evening_tasks = self._get_evening_completion_rate()
            if evening_tasks < 0.5:
                patterns['energy_mismatch'] = True
        
        # Detect burnout risk
        if patterns['avg_energy_level'] < 2.5 and patterns['avg_completion_rate'] < 50:
            patterns['burnout_risk'] = True
        
        # Consistency score (0-100)
        completion_variance = self._calculate_variance([
            log.tasks_completed_percentage for log in logs if log.tasks_completed_percentage is not None
        ])
        patterns['consistency_score'] = max(0, 100 - completion_variance)
        
        return patterns
    
    def _get_morning_completion_rate(self):
        """Calculate completion rate for morning tasks (6am-12pm)"""
        # Simplified: check tasks scheduled before noon
        recent_tasks = Task.query.join(Task.goal).filter(
            Task.goal.has(user_id=self.user.id),
            Task.scheduled_date >= datetime.now().date() - timedelta(days=7),
            Task.scheduled_start_time < '12:00'
        ).all()
        
        if not recent_tasks:
            return 1.0  # No data, assume OK
        
        completed = sum(1 for t in recent_tasks if t.status == 'completed')
        return completed / len(recent_tasks)
    
    def _get_evening_completion_rate(self):
        """Calculate completion rate for evening tasks (6pm-11pm)"""
        recent_tasks = Task.query.join(Task.goal).filter(
            Task.goal.has(user_id=self.user.id),
            Task.scheduled_date >= datetime.now().date() - timedelta(days=7),
            Task.scheduled_start_time >= '18:00'
        ).all()
        
        if not recent_tasks:
            return 1.0
        
        completed = sum(1 for t in recent_tasks if t.status == 'completed')
        return completed / len(recent_tasks)
    
    def _calculate_variance(self, values):
        """Calculate variance of a list of values"""
        if not values or len(values) < 2:
            return 0
        
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / len(values)
        return variance ** 0.5  # Standard deviation
    
    def get_adjustment_recommendations(self, patterns, today_log=None):
        """
        Based on patterns and today's log, recommend schedule adjustments
        Returns: list of adjustment actions
        """
        adjustments = []
        
        # Rule 1: Burnout detected
        if patterns.get('burnout_risk'):
            adjustments.append({
                'type': 'reduce_load',
                'severity': 'high',
                'message': '⚠️ Burnout risk detected. Reducing task load by 40%.',
                'action': 'reduce_tasks',
                'params': {'reduction_factor': 0.4}
            })
        
        # Rule 2: Low energy today
        if today_log and today_log.energy_level is not None and today_log.energy_level <= 2:
            adjustments.append({
                'type': 'reduce_load',
                'severity': 'medium',
                'message': 'Low energy detected. Lightening tomorrow\'s schedule.',
                'action': 'reduce_tasks',
                'params': {'reduction_factor': 0.3}
            })
        
        # Rule 3: Energy mismatch
        if patterns.get('energy_mismatch'):
            adjustments.append({
                'type': 'reschedule',
                'severity': 'medium',
                'message': 'Energy pattern mismatch detected. Rescheduling difficult tasks.',
                'action': 'shift_difficult_tasks',
                'params': {}
            })
        
        # Rule 4: High screen time
        if patterns.get('screen_time_trend') == 'High':
            adjustments.append({
                'type': 'add_breaks',
                'severity': 'low',
                'message': 'High screen time detected. Adding more breaks.',
                'action': 'increase_breaks',
                'params': {'break_frequency': 45}  # Break every 45 min
            })
        
        # Rule 5: Low completion rate
        if patterns.get('avg_completion_rate', 0) < 40:
            adjustments.append({
                'type': 'simplify',
                'severity': 'high',
                'message': 'Low completion rate. Breaking tasks into smaller chunks.',
                'action': 'split_tasks',
                'params': {'max_task_hours': 1.5}
            })
        
        return adjustments
    
    def apply_adjustments(self, goal, adjustments):
        """
        Apply recommended adjustments to upcoming tasks
        Returns: number of tasks modified
        """
        if not adjustments:
            return 0
        
        modified_count = 0
        
        # Get pending tasks for this goal
        pending_tasks = Task.query.filter_by(
            goal_id=goal.id,
            status='pending'
        ).filter(
            Task.scheduled_date >= datetime.now().date()
        ).all()
        
        for adjustment in adjustments:
            action = adjustment['action']
            params = adjustment['params']
            
            if action == 'reduce_tasks':
                # Remove or postpone some tasks
                reduction_factor = params.get('reduction_factor', 0.3)
                num_to_remove = int(len(pending_tasks) * reduction_factor)
                
                # Remove easiest tasks first (can be rescheduled later)
                tasks_to_postpone = sorted(pending_tasks, key=lambda t: t.difficulty)[:num_to_remove]
                
                for task in tasks_to_postpone:
                    task.scheduled_date = None
                    task.scheduled_start_time = None
                    task.scheduled_end_time = None
                    modified_count += 1
            
            elif action == 'shift_difficult_tasks':
                # Move difficult tasks to high-energy windows
                difficult_tasks = [t for t in pending_tasks if t.difficulty >= 3]
                
                for task in difficult_tasks:
                    # Shift to morning for morning people, evening for night people
                    if self.user.energy_type == "morning" and task.scheduled_start_time and task.scheduled_start_time > '12:00':
                        # Reschedule to morning
                        task.scheduled_start_time = '09:00'
                        # Recalculate end time
                        start_minutes = 9 * 60
                        duration_minutes = int(task.estimated_hours * 60)
                        end_minutes = start_minutes + duration_minutes
                        task.scheduled_end_time = f'{end_minutes // 60:02d}:{end_minutes % 60:02d}'
                        modified_count += 1
                    
                    elif self.user.energy_type == "night" and task.scheduled_start_time and task.scheduled_start_time < '18:00':
                        # Reschedule to evening
                        task.scheduled_start_time = '19:00'
                        start_minutes = 19 * 60
                        duration_minutes = int(task.estimated_hours * 60)
                        end_minutes = start_minutes + duration_minutes
                        task.scheduled_end_time = f'{end_minutes // 60:02d}:{end_minutes % 60:02d}'
                        modified_count += 1
            
            elif action == 'split_tasks':
                # Break large tasks into smaller ones
                max_hours = params.get('max_task_hours', 1.5)
                large_tasks = [t for t in pending_tasks if t.estimated_hours > max_hours]
                
                for task in large_tasks:
                    # Split into 2 tasks
                    half_hours = task.estimated_hours / 2
                    
                    # Update original task
                    task.estimated_hours = half_hours
                    task.title = task.title + " (Part 1)"
                    
                    # Create second part
                    new_task = Task(
                        goal_id=task.goal_id,
                        title=task.title.replace("Part 1", "Part 2"),
                        description=task.description,
                        estimated_hours=half_hours,
                        difficulty=task.difficulty,
                        status='pending'
                    )
                    db.session.add(new_task)
                    modified_count += 2
        
        db.session.commit()
        return modified_count
    
    def check_deadline_risk(self, goal):
        """
        Check if goal is at risk of missing deadline
        Returns: risk_level ("LOW", "MEDIUM", "HIGH"), message
        """
        today = datetime.now().date()
        days_remaining = (goal.deadline - today).days
        
        if days_remaining <= 0:
            return "CRITICAL", "⚠️ Deadline has passed!"
        
        # Count remaining tasks
        remaining_tasks = Task.query.filter_by(
            goal_id=goal.id,
            status='pending'
        ).count()
        
        if remaining_tasks == 0:
            return "LOW", "✅ All tasks completed!"
        
        # Calculate required daily progress
        total_hours_remaining = db.session.query(
            db.func.sum(Task.estimated_hours)
        ).filter_by(
            goal_id=goal.id,
            status='pending'
        ).scalar() or 0
        
        # Calculate user's average completion rate
        patterns = self.analyze_patterns(days=7)
        avg_completion_rate = patterns.get('avg_completion_rate', 50) / 100
        
        # Estimate hours available per day
        engine = SchedulingEngine(self.user, goal)
        avg_hours_per_day = sum(
            engine.calculate_available_hours(today + timedelta(days=i))
            for i in range(min(7, days_remaining))
        ) / min(7, days_remaining)
        
        # Adjust for completion rate
        effective_hours_per_day = avg_hours_per_day * avg_completion_rate
        
        # Calculate if on track
        required_hours_per_day = total_hours_remaining / days_remaining
        
        if required_hours_per_day > effective_hours_per_day * 1.5:
            return "HIGH", f"⚠️ High risk! Need {required_hours_per_day:.1f}h/day but averaging {effective_hours_per_day:.1f}h/day"
        elif required_hours_per_day > effective_hours_per_day:
            return "MEDIUM", f"⚠️ Moderate risk. Need to increase pace slightly."
        else:
            return "LOW", f"✅ On track! {days_remaining} days remaining."
