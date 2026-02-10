from datetime import datetime, timedelta, time
from models import Task, Commitment, DailyLog
import json


class SchedulingEngine:
    """
    Core scheduling engine for StriveX
    Generates intelligent, adaptive daily schedules
    """
    
    def __init__(self, user, goal):
        self.user = user
        self.goal = goal
        self.wake_time = self._parse_time(user.wake_time)
        self.sleep_time = self._parse_time(user.sleep_time)
        
    def _parse_time(self, time_str):
        """Convert '07:00' to time object"""
        hours, minutes = map(int, time_str.split(':'))
        return time(hours, minutes)
    
    def _time_to_minutes(self, t):
        """Convert time object to minutes since midnight"""
        return t.hour * 60 + t.minute
    
    def _minutes_to_time(self, minutes):
        """Convert minutes since midnight to time object"""
        return time(minutes // 60, minutes % 60)
    
    def calculate_available_hours(self, date):
        """Calculate realistic work hours for a given day"""
        # Total waking hours
        wake_minutes = self._time_to_minutes(self.wake_time)
        sleep_minutes = self._time_to_minutes(self.sleep_time)
        waking_hours = (sleep_minutes - wake_minutes) / 60
        
        # Subtract fixed commitments for this day
        commitment_hours = self._get_commitment_hours(date)
        
        # Subtract essential activities (meals, hygiene, etc.)
        essential_hours = 3
        
        # Calculate available hours with efficiency factor
        available_hours = waking_hours - commitment_hours - essential_hours
        work_hours = available_hours * 0.75  # 75% efficiency
        
        return max(0, work_hours)  # Never negative
    
    def _get_commitment_hours(self, date):
        """Get total commitment hours for a specific date"""
        from models import db
        
        day_of_week = date.weekday()
        commitments = Commitment.query.filter_by(
            user_id=self.user.id
        ).filter(
            db.or_(
                db.and_(Commitment.recurring == True, Commitment.day_of_week == day_of_week),
                Commitment.specific_date == date
            )
        ).all()
        
        total_hours = 0
        for c in commitments:
            start = self._parse_time(c.start_time)
            end = self._parse_time(c.end_time)
            duration = (self._time_to_minutes(end) - self._time_to_minutes(start)) / 60
            total_hours += duration
        
        return total_hours
    
    def break_into_tasks(self):
        """Break goal into executable tasks using heuristics"""
        title_lower = self.goal.title.lower()
        tasks = []
        
        # Python learning pattern
        if "python" in title_lower and ("learn" in title_lower or "complete" in title_lower):
            tasks = [
                {"title": "Python Basics: Variables & Data Types", "hours": 2, "difficulty": 1},
                {"title": "Python Basics: Control Flow (if/else/loops)", "hours": 3, "difficulty": 2},
                {"title": "Python Basics: Functions", "hours": 3, "difficulty": 2},
                {"title": "Python Basics: Lists & Dictionaries", "hours": 3, "difficulty": 2},
                {"title": "Python Basics: File Handling", "hours": 2, "difficulty": 3},
                {"title": "Python Basics: Error Handling", "hours": 2, "difficulty": 3},
                {"title": "Python Basics: Modules & Packages", "hours": 2, "difficulty": 2},
                {"title": "Python Basics: OOP Concepts", "hours": 4, "difficulty": 4},
                {"title": "Python Basics: Practice Project 1", "hours": 3, "difficulty": 3},
                {"title": "Python Basics: Practice Project 2", "hours": 3, "difficulty": 3},
            ]
        # Generic breakdown
        else:
            estimated_hours = self.goal.estimated_hours or 20
            num_tasks = max(5, int(estimated_hours / 2))
            hours_per_task = estimated_hours / num_tasks
            
            tasks = [
                {
                    "title": f"{self.goal.title} - Part {i+1}",
                    "hours": hours_per_task,
                    "difficulty": min(5, max(1, (i % 3) + 2))  # Vary difficulty
                }
                for i in range(num_tasks)
            ]
        
        return tasks
    
    def generate_schedule(self):
        """
        Main scheduling function
        Returns: (success: bool, weekly_plan: list, message: str)
        """
        start_date = datetime.now().date()
        deadline = self.goal.deadline
        days_available = (deadline - start_date).days
        
        if days_available <= 0:
            return False, [], "Deadline has passed"
        
        # Break goal into tasks
        task_templates = self.break_into_tasks()
        total_hours_needed = sum(t['hours'] for t in task_templates)
        
        # Calculate total available hours
        total_hours_available = sum(
            self.calculate_available_hours(start_date + timedelta(days=i))
            for i in range(days_available)
        )
        
        # Check feasibility (need 80% buffer)
        if total_hours_needed > total_hours_available * 0.8:
            return False, [], "Deadline is too tight. Consider extending deadline or reducing scope."
        
        # Distribute tasks across days
        daily_plan = self._distribute_tasks(task_templates, start_date, days_available)
        
        # Create time blocks for each day
        weekly_plan = self._create_time_blocks(daily_plan, start_date)
        
        return True, weekly_plan, "Schedule generated successfully"
    
    def _distribute_tasks(self, task_templates, start_date, days_available):
        """Distribute tasks evenly across available days"""
        total_hours = sum(t['hours'] for t in task_templates)
        target_hours_per_day = (total_hours / days_available) * 1.2  # 20% buffer
        
        daily_plan = []
        remaining_tasks = task_templates.copy()
        
        for day_offset in range(days_available):
            date = start_date + timedelta(days=day_offset)
            available_hours = self.calculate_available_hours(date)
            
            day_hours = 0
            day_tasks = []
            
            while day_hours < min(target_hours_per_day, available_hours) and remaining_tasks:
                task = remaining_tasks[0]
                
                # Check if task fits in remaining time
                if day_hours + task['hours'] <= available_hours:
                    day_tasks.append(task)
                    day_hours += task['hours']
                    remaining_tasks.pop(0)
                else:
                    # Split task if it's too long
                    remaining_hours = available_hours - day_hours
                    if remaining_hours >= 1:  # Only split if at least 1 hour available
                        split_task = {
                            **task,
                            'hours': remaining_hours,
                            'title': task['title'] + ' (Part 1)'
                        }
                        day_tasks.append(split_task)
                        
                        # Update remaining task
                        remaining_tasks[0] = {
                            **task,
                            'hours': task['hours'] - remaining_hours,
                            'title': task['title'] + ' (Part 2)'
                        }
                        day_hours += remaining_hours
                    break
            
            if day_tasks:
                daily_plan.append({
                    'date': date,
                    'tasks': day_tasks,
                    'total_hours': day_hours
                })
        
        return daily_plan
    
    def _create_time_blocks(self, daily_plan, start_date):
        """Convert task list into specific time blocks"""
        weekly_plan = []
        
        for day in daily_plan:
            date = day['date']
            tasks = day['tasks']
            
            # Get energy windows
            energy_windows = self._get_energy_windows()
            
            # Sort tasks by difficulty (hardest first)
            sorted_tasks = sorted(tasks, key=lambda t: t['difficulty'], reverse=True)
            
            # Get commitments for this day
            commitments = self._get_day_commitments(date)
            
            # Start scheduling from wake time
            current_time = self._time_to_minutes(self.wake_time)
            time_blocks = []
            
            for task in sorted_tasks:
                # Find next available slot
                task_duration_minutes = int(task['hours'] * 60)
                
                # Skip over commitments
                slot_start = self._find_next_slot(
                    current_time,
                    task_duration_minutes,
                    commitments,
                    energy_windows,
                    task['difficulty']
                )
                
                if slot_start is None:
                    continue  # Skip if no slot found
                
                slot_end = slot_start + task_duration_minutes
                
                time_blocks.append({
                    'type': 'task',
                    'task_data': task,
                    'start_time': self._minutes_to_time(slot_start).strftime('%H:%M'),
                    'end_time': self._minutes_to_time(slot_end).strftime('%H:%M')
                })
                
                # Add break after task (10-15 minutes)
                break_duration = 15 if task['hours'] >= 2 else 10
                time_blocks.append({
                    'type': 'break',
                    'task_data': {'title': 'Break', 'difficulty': 0},
                    'start_time': self._minutes_to_time(slot_end).strftime('%H:%M'),
                    'end_time': self._minutes_to_time(slot_end + break_duration).strftime('%H:%M')
                })
                
                current_time = slot_end + break_duration
            
            weekly_plan.append({
                'date': date.isoformat(),
                'time_blocks': time_blocks,
                'total_hours': day['total_hours']
            })
        
        return weekly_plan
    
    def _get_energy_windows(self):
        """Define high-energy windows based on user type"""
        wake_min = self._time_to_minutes(self.wake_time)
        sleep_min = self._time_to_minutes(self.sleep_time)
        
        if self.user.energy_type == "morning":
            return {
                'high': [(wake_min, wake_min + 240)],  # First 4 hours
                'medium': [(wake_min + 240, sleep_min - 180)],
                'low': [(sleep_min - 180, sleep_min)]
            }
        elif self.user.energy_type == "night":
            return {
                'high': [(sleep_min - 240, sleep_min)],  # Last 4 hours
                'medium': [(wake_min + 180, sleep_min - 240)],
                'low': [(wake_min, wake_min + 180)]
            }
        else:  # flexible
            return {
                'high': [(wake_min, sleep_min)],
                'medium': [(wake_min, sleep_min)],
                'low': []
            }
    
    def _get_day_commitments(self, date):
        """Get commitments for a specific day as time ranges"""
        from models import db
        
        day_of_week = date.weekday()
        commitments = Commitment.query.filter_by(
            user_id=self.user.id
        ).filter(
            db.or_(
                db.and_(Commitment.recurring == True, Commitment.day_of_week == day_of_week),
                Commitment.specific_date == date
            )
        ).all()
        
        blocked_times = []
        for c in commitments:
            start = self._time_to_minutes(self._parse_time(c.start_time))
            end = self._time_to_minutes(self._parse_time(c.end_time))
            blocked_times.append((start, end))
        
        return blocked_times
    
    def _find_next_slot(self, current_time, duration, commitments, energy_windows, difficulty):
        """Find next available time slot that fits the task"""
        sleep_min = self._time_to_minutes(self.sleep_time)
        
        # Prefer high-energy windows for difficult tasks
        preferred_windows = energy_windows['high'] if difficulty >= 3 else energy_windows['medium'] + energy_windows['high']
        
        # Try to find slot in preferred windows first
        for window_start, window_end in preferred_windows:
            slot = self._find_slot_in_window(current_time, duration, window_start, window_end, commitments)
            if slot is not None:
                return slot
        
        # Fallback: find any available slot
        slot = self._find_slot_in_window(current_time, duration, current_time, sleep_min, commitments)
        return slot
    
    def _find_slot_in_window(self, current_time, duration, window_start, window_end, commitments):
        """Find available slot within a specific time window"""
        search_start = max(current_time, window_start)
        
        while search_start + duration <= window_end:
            # Check if this slot overlaps with any commitment
            slot_end = search_start + duration
            overlaps = False
            
            for commit_start, commit_end in commitments:
                if not (slot_end <= commit_start or search_start >= commit_end):
                    overlaps = True
                    search_start = commit_end  # Jump to end of commitment
                    break
            
            if not overlaps:
                return search_start
        
        return None
