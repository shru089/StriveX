from datetime import datetime, timedelta, time, date
from models import Task, Commitment, DailyLog, Goal  # type: ignore[import-not-found]
import json


class SchedulingEngine:
    """
    Core scheduling engine for StriveX
    Generates intelligent, adaptive daily schedules
    """
    
    def __init__(self, user, goal):
        self.user = user
        self.goal = goal
        self.wake_time = self._parse_time(user.wake_time or '07:00')
        self.sleep_time = self._parse_time(user.sleep_time or '23:00')
        # Behavioral intelligence link
        from intelligence import BehavioralIntelligenceEngine  # type: ignore[import-not-found]
        self.intelligence = BehavioralIntelligenceEngine(user)  # type: ignore[call-arg]
        self.behavior_recs = []
        try:
            analysis = self.intelligence.full_analysis()
            self.behavior_recs = analysis.get("recommendations", [])
        except Exception:
            pass
            
    def _parse_time(self, time_str):
        """Convert '07:00' to time object"""
        hours, minutes = map(int, time_str.split(':'))
        return time(hours, minutes)
    
    def _time_to_minutes(self, t):
        """Convert time object to minutes since midnight"""
        return t.hour * 60 + t.minute
    
    def _minutes_to_time(self, minutes):
        """Convert minutes since midnight to time object"""
        minutes = max(0, min(1439, int(minutes)))
        return time(minutes // 60, minutes % 60)

    def _time_str_to_minutes(self, time_str):
        """Convert '09:30' string to minutes"""
        h, m = map(int, time_str.split(':'))
        return h * 60 + m

    def calculate_available_hours(self, target_date):
        """Calculate realistic work hours for a given day"""
        wake_minutes = self._time_to_minutes(self.wake_time)
        sleep_minutes = self._time_to_minutes(self.sleep_time)
        waking_hours = (sleep_minutes - wake_minutes) / 60
        
        commitment_hours = self._get_commitment_hours(target_date)
        essential_hours = 3  # meals, hygiene etc.
        
        available_hours = waking_hours - commitment_hours - essential_hours
        work_hours = available_hours * 0.75  # 75% efficiency
        
        return max(0, work_hours)
    
    def _get_commitment_hours(self, target_date):
        """Get total commitment hours for a specific date"""
        from models import db  # type: ignore[import-not-found]
        day_of_week = target_date.weekday()
        commitments = Commitment.query.filter_by(user_id=self.user.id).filter(
            db.or_(
                db.and_(Commitment.recurring == True, Commitment.day_of_week == day_of_week),
                Commitment.specific_date == target_date
            )
        ).all()
        
        total_hours = 0
        for c in commitments:
            start = self._parse_time(c.start_time)
            end = self._parse_time(c.end_time)
            duration = (self._time_to_minutes(end) - self._time_to_minutes(start)) / 60
            total_hours += duration
        return total_hours
    
    def calculate_feasibility_score(self):
        """
        PRD 5.1: Feasibility Score
        Returns: score (0.0-1.0), risk_level, consequence_message
        """
        today = datetime.now().date()
        deadline = self.goal.deadline
        days_remaining = (deadline - today).days
        
        if days_remaining <= 0:
            return 0.0, 'CRITICAL', 'Deadline has passed!'
        
        # Count remaining incomplete tasks and their hours
        remaining_tasks = [
            t for t in self.goal.tasks
            if t.status == 'pending' and (t.scheduled_date is None or t.scheduled_date >= today)
        ]
        
        # Also include tasks that were skipped/expired
        skipped_tasks = [
            t for t in self.goal.tasks
            if t.status in ('skipped', 'expired', 'rescheduled')
        ]
        
        all_incomplete = remaining_tasks + skipped_tasks
        remaining_work_hours = sum(t.estimated_hours for t in all_incomplete)
        
        # Total available hours until deadline
        available_hours = sum(
            self.calculate_available_hours(today + timedelta(days=i))
            for i in range(days_remaining)
        )
        
        if available_hours <= 0:
            return 0.0, 'CRITICAL', 'No available time before deadline.'
        
        # Efficiency factor from recent daily logs
        efficiency_factor = self._get_efficiency_factor()
        
        # Ratio: how overloaded are we?
        ratio = remaining_work_hours / (available_hours * efficiency_factor)
        
        # Convert ratio to probability (sigmoid-like)
        if ratio <= 0.5:
            score = 0.95
            risk_level = 'LOW'
        elif ratio <= 0.8:
            score = 0.85
            risk_level = 'LOW'
        elif ratio <= 1.0:
            score = 0.72
            risk_level = 'MEDIUM'
        elif ratio <= 1.2:
            score = 0.55
            risk_level = 'HIGH'
        elif ratio <= 1.5:
            score = 0.35
            risk_level = 'HIGH'
        else:
            score = max(0.05, 0.35 / ratio)
            risk_level = 'CRITICAL'
        
        # Consequence message
        today_tasks = [t for t in self.goal.tasks if t.scheduled_date == today]
        missed_today = [t for t in today_tasks if t.status in ('pending', 'skipped')]
        
        if missed_today:
            missed_hours = sum(t.estimated_hours for t in missed_today)
            tomorrow_pct = round((missed_hours / max(1, remaining_work_hours)) * 100, 1)  # type: ignore[call-overload]
            consequence = f"Missing today adds {tomorrow_pct}% to tomorrow's workload"
        elif risk_level == 'LOW':
            consequence = f"You're on track — {days_remaining} days to complete {remaining_work_hours:.1f}h of work"
        elif risk_level == 'MEDIUM':
            consequence = f"Falling slightly behind — pick up pace to hit deadline"
        else:
            consequence = f"At risk: {remaining_work_hours:.1f}h remaining, only {available_hours * efficiency_factor:.1f}h realistic capacity"
        
        return round(score, 2), risk_level, consequence  # type: ignore[call-overload]
    
    def _get_efficiency_factor(self):
        """Get recent completion efficiency from daily logs"""
        from models import db  # type: ignore[import-not-found]
        recent_logs = DailyLog.query.filter_by(user_id=self.user.id).order_by(
            DailyLog.date.desc()
        ).limit(7).all()
        
        if not recent_logs:
            return 0.75  # default
        
        ratios = []
        for log in recent_logs:
            if log.total_tasks_scheduled and log.total_tasks_scheduled > 0:
                ratios.append(log.total_tasks_completed / log.total_tasks_scheduled)
        
        if not ratios:
            return 0.75
        return max(0.3, min(1.0, sum(ratios) / len(ratios)))
    
    def replan_today(self):
        """
        PRD 5.3 / 10.3: Replan My Day
        Re-schedules remaining tasks from current time, returns diff + new feasibility.
        """
        now = datetime.now()
        now_minutes = now.hour * 60 + now.minute
        today = now.date()
        sleep_minutes = self._time_to_minutes(self.sleep_time)
        
        # Step 1: Expire all past unfinished tasks
        expired_count = 0
        today_tasks = [t for t in self.goal.tasks if t.scheduled_date == today]
        
        for task in today_tasks:
            if task.scheduled_end_time and task.status == 'pending':
                task_end_min = self._time_str_to_minutes(task.scheduled_end_time)
                if task_end_min < now_minutes:
                    task.status = 'expired'
                    expired_count += 1
        
        # Step 2: Collect remaining incomplete tasks for today
        remaining = [
            t for t in today_tasks
            if t.status == 'pending'
        ]
        
        # Also pull in high-priority tasks from other goals if time permits
        # (Phase 2 feature, skip for now to keep it scoped)
        
        # Step 3: Calculate remaining time window
        remaining_minutes = sleep_minutes - now_minutes - 60  # 1hr buffer before sleep
        
        if remaining_minutes <= 0 or not remaining:
            feasibility_score, risk_level, consequence = self.calculate_feasibility_score()
            return {
                'moved': 0,
                'removed': expired_count,
                'added': 0,
                'summary': f'No time left today. {expired_count} tasks expired.',
                'feasibility_score': feasibility_score,
                'risk_level': risk_level,
                'consequence': consequence,
                'updated_tasks': []
            }
        
        # Step 4: Get commitments (hard constraints for rest of today)
        commitments = self._get_day_commitments(today)
        
        # Step 5: Sort remaining by priority (difficulty as proxy)
        sorted_remaining = sorted(remaining, key=lambda t: t.difficulty, reverse=True)
        
        # Step 6: Re-assign times greedily
        current_time = now_minutes + 5  # Start 5 min from now
        moved_count = 0
        unscheduled_count = 0
        updated_tasks = []
        
        for task in sorted_remaining:
            duration_minutes = int(task.estimated_hours * 60)
            
            # Skip over commitments
            start_slot = self._find_slot_in_window(
                current_time, duration_minutes,
                current_time, sleep_minutes - 30,
                commitments
            )
            
            if start_slot is None:
                # No room — push to tomorrow
                task.scheduled_date = today + timedelta(days=1)
                task.scheduled_start_time = None
                task.scheduled_end_time = None
                unscheduled_count += 1
            else:
                old_start = task.scheduled_start_time
                new_start = self._minutes_to_time(start_slot).strftime('%H:%M')
                new_end = self._minutes_to_time(start_slot + duration_minutes).strftime('%H:%M')
                
                task.scheduled_start_time = new_start
                task.scheduled_end_time = new_end
                
                if old_start != new_start:
                    moved_count += 1
                
                updated_tasks.append(task.to_dict())
                # Add buffer
                current_time = start_slot + duration_minutes + 15
        
        # Step 7: Recalculate feasibility
        feasibility_score, risk_level, consequence = self.calculate_feasibility_score()
        
        summary = f"Moved {moved_count} task{'s' if moved_count != 1 else ''}"
        if unscheduled_count:
            summary += f", pushed {unscheduled_count} to tomorrow"
        if expired_count:
            summary += f", {expired_count} expired"
        percent = round(feasibility_score * 100)
        summary += f" — your day is now {percent}% feasible"
        
        return {
            'moved': moved_count,
            'removed': expired_count,
            'pushed_to_tomorrow': unscheduled_count,
            'summary': summary,
            'feasibility_score': feasibility_score,
            'risk_level': risk_level,
            'consequence': consequence,
            'updated_tasks': updated_tasks
        }
    
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
        # DSA / Interview prep
        elif any(kw in title_lower for kw in ["dsa", "algorithm", "interview", "leetcode", "coding"]):
            tasks = [
                {"title": "Arrays & Strings fundamentals", "hours": 3, "difficulty": 2},
                {"title": "Two Pointers & Sliding Window", "hours": 3, "difficulty": 3},
                {"title": "Hashing & Frequency maps", "hours": 2, "difficulty": 2},
                {"title": "Recursion & Backtracking", "hours": 4, "difficulty": 4},
                {"title": "Binary Search patterns", "hours": 3, "difficulty": 3},
                {"title": "Linked Lists", "hours": 3, "difficulty": 3},
                {"title": "Trees & BFS/DFS", "hours": 4, "difficulty": 4},
                {"title": "Dynamic Programming basics", "hours": 5, "difficulty": 5},
                {"title": "Graphs & Shortest Path", "hours": 4, "difficulty": 4},
                {"title": "Mock interview practice", "hours": 3, "difficulty": 3},
            ]
        # Generic breakdown
        else:
            estimated_hours = self.goal.estimated_hours or 20
            num_tasks = max(5, int(estimated_hours / 2))
            hours_per_task = estimated_hours / num_tasks
            
            tasks = [
                {
                    "title": f"{self.goal.title} - Part {i+1}",
                    "hours": round(hours_per_task, 1),  # type: ignore[call-overload]
                    "difficulty": min(5, max(1, (i % 3) + 2))
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
        
        task_templates = self.break_into_tasks()
        total_hours_needed = sum(t['hours'] for t in task_templates)
        
        total_hours_available = sum(
            self.calculate_available_hours(start_date + timedelta(days=i))
            for i in range(days_available)
        )
        
        if total_hours_needed > total_hours_available * 0.8:
            return False, [], "Deadline is too tight. Consider extending deadline or reducing scope."
        
        daily_plan = self._distribute_tasks(task_templates, start_date, days_available)
        weekly_plan = self._create_time_blocks(daily_plan, start_date)
        
        return True, weekly_plan, "Schedule generated successfully"
    
    def _distribute_tasks(self, task_templates, start_date, days_available):
        """Distribute tasks evenly across available days"""
        total_hours = sum(t['hours'] for t in task_templates)
        target_hours_per_day = (total_hours / days_available) * 1.2
        
        daily_plan = []
        remaining_tasks = task_templates.copy()
        
        for day_offset in range(days_available):
            target_date = start_date + timedelta(days=day_offset)
            available_hours = self.calculate_available_hours(target_date)
            
            day_hours = 0
            day_tasks = []
            
            while day_hours < min(target_hours_per_day, available_hours) and remaining_tasks:
                task = remaining_tasks[0]  # type: ignore
                
                if day_hours + task['hours'] <= available_hours:
                    day_tasks.append(task)
                    day_hours += task['hours']
                    remaining_tasks.pop(0)
                else:
                    remaining_hours = available_hours - day_hours
                    if remaining_hours >= 1:
                        split_task = {
                            **task,
                            'hours': remaining_hours,
                            'title': task['title'] + ' (Part 1)'
                        }
                        day_tasks.append(split_task)
                        remaining_tasks[0] = {
                            **task,
                            'hours': task['hours'] - remaining_hours,
                            'title': task['title'] + ' (Part 2)'
                        }
                        day_hours += remaining_hours
                    break
            
            if day_tasks:
                daily_plan.append({
                    'date': target_date,
                    'tasks': day_tasks,
                    'total_hours': day_hours
                })
        
        return daily_plan
    
    def _create_time_blocks(self, daily_plan, start_date):
        """Convert task list into specific time blocks"""
        weekly_plan = []
        
        for day in daily_plan:
            target_date = day['date']
            tasks = day['tasks']
            
            energy_windows = self._get_energy_windows()
            sorted_tasks = sorted(tasks, key=lambda t: t['difficulty'], reverse=True)
            commitments = self._get_day_commitments(target_date)
            
            current_time = self._time_to_minutes(self.wake_time)
            time_blocks = []
            
            for task in sorted_tasks:
                task_duration_minutes = int(task['hours'] * 60)
                
                # ADAPTIVE: Apply latency shift from behavioral intelligence
                latency_shift = 0
                for rec in self.behavior_recs:
                    if rec["type"] == "shift_start":
                        latency_shift = rec["params"].get("shift_minutes", 0)
                
                # Apply shift to search start
                effective_search_start = current_time + latency_shift  # type: ignore[operator]
                
                slot_start = self._find_next_slot(
                    effective_search_start, task_duration_minutes,
                    commitments, energy_windows, task['difficulty']
                )
                
                if slot_start is None:
                    continue
                
                slot_end = slot_start + task_duration_minutes
                
                # WORK STYLE AWARENESS (PRD 10.1)
                # 'deep' style avoids small breaks between related tasks
                style = self.user.work_style or 'varied'
                
                time_blocks.append({
                    'type': 'task',
                    'task_data': task,
                    'start_time': self._minutes_to_time(slot_start).strftime('%H:%M'),
                    'end_time': self._minutes_to_time(slot_end).strftime('%H:%M')
                })
                
                # If 'deep' work style, group tasks or use longer buffers
                if style == 'deep':
                    break_duration = 10 if task['hours'] < 3 else 20
                else: 
                    # Default 'varied' / Pomodoro style
                    break_duration = 15 if task['hours'] >= 1.5 else 5
                
                time_blocks.append({
                    'type': 'break',
                    'task_data': {'title': 'Adaptive Break', 'difficulty': 0, 'hours': break_duration / 60},
                    'start_time': self._minutes_to_time(slot_end).strftime('%H:%M'),
                    'end_time': self._minutes_to_time(slot_end + break_duration).strftime('%H:%M')
                })
                
                current_time = slot_end + break_duration
            
            weekly_plan.append({
                'date': target_date.isoformat(),
                'time_blocks': time_blocks,
                'total_hours': day['total_hours']
            })
        
        return weekly_plan
    
    def _get_energy_windows(self):
        """Define high-energy windows based on User Peak Hours or Energy Type"""
        wake_min = self._time_to_minutes(self.wake_time)
        sleep_min = self._time_to_minutes(self.sleep_time)
        
        # Priority 1: Specific Peak Start/End from User Profile (Onboarding data)
        if self.user.peak_start and self.user.peak_end:
            try:
                p_start = self._time_to_minutes(self._parse_time(self.user.peak_start))
                p_end = self._time_to_minutes(self._parse_time(self.user.peak_end))
                return {
                    'high': [(p_start, p_end)],
                    'medium': [(wake_min, p_start), (p_end, sleep_min)],
                    'low': []
                }
            except Exception:
                pass

        # Priority 2: Generic Energy Type
        if self.user.energy_type == "morning":
            return {
                'high': [(wake_min, wake_min + 240)],
                'medium': [(wake_min + 240, sleep_min - 180)],
                'low': [(sleep_min - 180, sleep_min)]
            }
        elif self.user.energy_type == "night":
            return {
                'high': [(max(wake_min, sleep_min - 300), sleep_min)],
                'medium': [(wake_min + 180, sleep_min - 300)],
                'low': [(wake_min, wake_min + 180)]
            }
        else:
            return {
                'high': [(wake_min + 120, wake_min + 360)],
                'medium': [(wake_min, wake_min + 120), (wake_min + 360, sleep_min)],
                'low': []
            }
    
    def _get_day_commitments(self, target_date):
        """Get commitments for a specific day as time ranges"""
        from models import db  # type: ignore[import-not-found]
        day_of_week = target_date.weekday()
        commitments = Commitment.query.filter_by(user_id=self.user.id).filter(
            db.or_(
                db.and_(Commitment.recurring == True, Commitment.day_of_week == day_of_week),
                Commitment.specific_date == target_date
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
        
        preferred_windows = energy_windows['high'] if difficulty >= 3 else energy_windows['medium'] + energy_windows['high']
        
        for window_start, window_end in preferred_windows:
            slot = self._find_slot_in_window(current_time, duration, window_start, window_end, commitments)
            if slot is not None:
                return slot
        
        return self._find_slot_in_window(current_time, duration, current_time, sleep_min, commitments)
    
    def _find_slot_in_window(self, current_time, duration, window_start, window_end, commitments):
        """Find available slot within a specific time window"""
        search_start = max(current_time, window_start)
        
        while search_start + duration <= window_end:  # type: ignore[operator]
            slot_end = search_start + duration  # type: ignore[operator]
            overlaps = False
            
            for commit_start, commit_end in commitments:
                if not (slot_end <= commit_start or search_start >= commit_end):
                    overlaps = True
                    search_start = commit_end
                    break
            
            if not overlaps:
                return search_start
        
        return None
