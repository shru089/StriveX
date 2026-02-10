# StriveX Scheduling Algorithm

## 🎯 Core Objective
Generate realistic, adaptive daily schedules that respect human limitations and adapt to procrastination patterns.

## 📊 Algorithm Overview

### Input Parameters
```python
UserProfile:
    - wake_time: datetime
    - sleep_time: datetime
    - energy_type: "morning" | "night" | "flexible"
    - fixed_commitments: List[TimeBlock]

Goal:
    - title: str
    - deadline: datetime
    - estimated_hours: int (auto-calculated or user-provided)
    - priority: int (1-5)

Context:
    - current_date: datetime
    - user_history: CompletionPatterns
```

### Output
```python
WeeklyPlan:
    - days: List[DailySchedule]
    
DailySchedule:
    - date: datetime
    - time_blocks: List[TaskBlock]
    - total_work_hours: float
    - difficulty_score: float (1-5)
    - buffer_percentage: float
```

---

## 🧮 Step-by-Step Algorithm

### Step 1: Calculate Available Time
```python
def calculate_available_hours(user_profile, date):
    """
    Calculate realistic work hours for a given day
    """
    # Total waking hours
    waking_hours = (user_profile.sleep_time - user_profile.wake_time).hours
    
    # Subtract fixed commitments
    commitment_hours = sum(c.duration for c in get_commitments(date))
    
    # Subtract essential activities (meals, hygiene, etc.)
    essential_hours = 3  # Conservative estimate
    
    # Subtract break time (Pomodoro: 25 min work, 5 min break = 16.7% breaks)
    available_hours = waking_hours - commitment_hours - essential_hours
    work_hours = available_hours * 0.75  # 75% efficiency factor
    
    return work_hours
```

**Example**:
- Wake: 7am, Sleep: 11pm = 16 waking hours
- Commitments: 6 hours (college)
- Essentials: 3 hours
- Available: 7 hours
- Realistic work: 5.25 hours

---

### Step 2: Break Goal into Tasks
```python
def break_into_tasks(goal):
    """
    Use heuristics to break goals into executable tasks
    """
    # Simple rule-based breakdown
    if "learn" in goal.title.lower() and "python" in goal.title.lower():
        tasks = [
            {"title": "Variables & Data Types", "hours": 2, "difficulty": 1},
            {"title": "Control Flow (if/else/loops)", "hours": 3, "difficulty": 2},
            {"title": "Functions", "hours": 3, "difficulty": 2},
            {"title": "Lists & Dictionaries", "hours": 3, "difficulty": 2},
            {"title": "File Handling", "hours": 2, "difficulty": 3},
            # ... more tasks
        ]
    else:
        # Generic breakdown: divide by estimated hours
        num_tasks = max(5, goal.estimated_hours // 2)
        hours_per_task = goal.estimated_hours / num_tasks
        tasks = [
            {
                "title": f"{goal.title} - Part {i+1}",
                "hours": hours_per_task,
                "difficulty": random.randint(1, 3)
            }
            for i in range(num_tasks)
        ]
    
    return tasks
```

---

### Step 3: Backward Planning from Deadline
```python
def distribute_tasks(tasks, start_date, deadline, available_hours_per_day):
    """
    Distribute tasks backward from deadline
    """
    days_available = (deadline - start_date).days
    total_hours_needed = sum(t['hours'] for t in tasks)
    total_hours_available = days_available * available_hours_per_day
    
    # Check feasibility
    if total_hours_needed > total_hours_available * 0.8:
        # Goal is too ambitious
        return None, "DEADLINE_TOO_TIGHT"
    
    # Distribute evenly with buffer
    target_hours_per_day = total_hours_needed / days_available
    
    # Add 20% buffer
    target_hours_per_day *= 1.2
    
    # Create daily allocations
    daily_plan = []
    remaining_tasks = tasks.copy()
    
    for day in range(days_available):
        day_hours = 0
        day_tasks = []
        
        while day_hours < target_hours_per_day and remaining_tasks:
            task = remaining_tasks.pop(0)
            
            # Split task if too long for one day
            if task['hours'] > available_hours_per_day * 0.6:
                # Split into chunks
                chunk_hours = available_hours_per_day * 0.6
                day_tasks.append({**task, 'hours': chunk_hours})
                remaining_tasks.insert(0, {
                    **task,
                    'hours': task['hours'] - chunk_hours,
                    'title': task['title'] + ' (cont.)'
                })
                day_hours += chunk_hours
            else:
                day_tasks.append(task)
                day_hours += task['hours']
        
        daily_plan.append({
            'date': start_date + timedelta(days=day),
            'tasks': day_tasks,
            'total_hours': day_hours
        })
    
    return daily_plan, "SUCCESS"
```

---

### Step 4: Match Tasks to Energy Windows
```python
def create_time_blocks(daily_plan, user_profile):
    """
    Convert task list into specific time blocks based on energy type
    """
    energy_windows = get_energy_windows(user_profile)
    
    for day in daily_plan:
        time_blocks = []
        current_time = user_profile.wake_time
        
        # Sort tasks by difficulty
        tasks = sorted(day['tasks'], key=lambda t: t['difficulty'], reverse=True)
        
        for task in tasks:
            # Find best time slot based on energy and difficulty
            if task['difficulty'] >= 3:
                # Deep work → high energy window
                slot = find_next_available_slot(
                    current_time,
                    task['hours'],
                    energy_windows['high'],
                    user_profile.fixed_commitments
                )
            else:
                # Light work → any window
                slot = find_next_available_slot(
                    current_time,
                    task['hours'],
                    energy_windows['any'],
                    user_profile.fixed_commitments
                )
            
            if slot:
                time_blocks.append({
                    'task': task,
                    'start': slot['start'],
                    'end': slot['end'],
                    'type': 'work'
                })
                
                # Add break after task
                time_blocks.append({
                    'task': {'title': 'Break'},
                    'start': slot['end'],
                    'end': slot['end'] + timedelta(minutes=15),
                    'type': 'break'
                })
                
                current_time = slot['end'] + timedelta(minutes=15)
        
        day['time_blocks'] = time_blocks
    
    return daily_plan

def get_energy_windows(user_profile):
    """
    Define high-energy windows based on user type
    """
    if user_profile.energy_type == "morning":
        return {
            'high': [(user_profile.wake_time, user_profile.wake_time + timedelta(hours=4))],
            'any': [(user_profile.wake_time, user_profile.sleep_time)]
        }
    elif user_profile.energy_type == "night":
        return {
            'high': [(user_profile.sleep_time - timedelta(hours=4), user_profile.sleep_time)],
            'any': [(user_profile.wake_time, user_profile.sleep_time)]
        }
    else:  # flexible
        return {
            'high': [(user_profile.wake_time, user_profile.sleep_time)],
            'any': [(user_profile.wake_time, user_profile.sleep_time)]
        }
```

---

## 🔄 Adaptation Logic

### Detecting Procrastination Patterns
```python
def analyze_completion_patterns(user_logs):
    """
    Detect patterns from user behavior
    """
    patterns = {
        'morning_completion_rate': 0,
        'afternoon_completion_rate': 0,
        'evening_completion_rate': 0,
        'avg_screen_time': 0,
        'common_distractions': [],
        'energy_mismatch': False
    }
    
    # Analyze by time of day
    for log in user_logs:
        time_of_day = get_time_category(log.task_time)
        if log.completed:
            patterns[f'{time_of_day}_completion_rate'] += 1
    
    # Detect energy mismatch
    if user.energy_type == "morning" and patterns['morning_completion_rate'] < 0.5:
        patterns['energy_mismatch'] = True
    
    return patterns
```

### Auto-Adjustment Rules
```python
def adjust_schedule(daily_plan, patterns, procrastination_signals):
    """
    Modify schedule based on detected patterns
    """
    adjustments = []
    
    # Rule 1: Reduce load if burnout detected
    if procrastination_signals['energy_level'] <= 2:
        # Cut 30% of tasks
        daily_plan = reduce_task_load(daily_plan, 0.3)
        adjustments.append("Reduced task load due to low energy")
    
    # Rule 2: Shift difficult tasks if energy mismatch
    if patterns['energy_mismatch']:
        daily_plan = shift_difficult_tasks(daily_plan, patterns)
        adjustments.append("Moved difficult tasks to high-energy windows")
    
    # Rule 3: Add breaks if high screen time
    if procrastination_signals['screen_time'] == "High":
        daily_plan = increase_break_frequency(daily_plan)
        adjustments.append("Added more breaks to combat screen fatigue")
    
    # Rule 4: Deadline protection
    if check_deadline_risk(goal) == "HIGH_RISK":
        daily_plan = prioritize_critical_path(daily_plan, goal)
        adjustments.append("⚠️ Prioritized critical tasks for deadline")
    
    return daily_plan, adjustments
```

---

## 📈 Complexity Analysis

**Time Complexity**: O(n × d)
- n = number of tasks
- d = number of days

**Space Complexity**: O(d)
- Store daily plans

**Performance**: < 100ms for typical goals (30 tasks, 30 days)

---

## 🧪 Test Cases

### Test 1: Feasible Goal
```python
Input:
    Goal: "Complete Python basics"
    Deadline: 30 days from now
    Available hours/day: 5

Expected Output:
    ✅ 30-day plan generated
    ✅ ~2-3 hours of work per day
    ✅ 20% buffer included
    ✅ Tasks distributed evenly
```

### Test 2: Tight Deadline
```python
Input:
    Goal: "Complete Python basics"
    Deadline: 7 days from now
    Available hours/day: 3

Expected Output:
    ⚠️ Warning: "Deadline is tight"
    ✅ Plan generated with max daily load
    ✅ Suggests extending deadline or reducing scope
```

### Test 3: Procrastination Adaptation
```python
Input:
    Day 1: Completed 1/3 tasks
    Energy level: 2/5
    Screen time: High

Expected Output:
    ✅ Day 2 plan reduced by 30%
    ✅ More breaks added
    ✅ Tasks shifted to better time slots
```

---

## 🎯 Key Principles

1. **Conservative Estimates**: Better to under-promise and over-deliver
2. **Buffer Time**: Always add 20% buffer
3. **Energy Matching**: Difficult tasks → high energy windows
4. **Break Frequency**: Pomodoro-inspired (work 50 min, break 10 min)
5. **Adaptation Speed**: Adjust within 24 hours of signal detection
6. **Deadline Protection**: Critical path always prioritized

---

## 🔮 Future Enhancements

### Machine Learning Integration
- Predict task duration based on user history
- Learn optimal break frequency per user
- Detect procrastination triggers automatically
- Personalized difficulty scoring

### Advanced Features
- Multi-goal balancing
- Collaborative scheduling (teams)
- Integration with calendar apps
- Smart notifications (optimal reminder times)

---

**Remember**: The algorithm should feel invisible. Users just see a plan that "gets them."
