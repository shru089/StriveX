"""
StriveX Behavioral Intelligence Engine — Stage 4 + Gemini AI
Includes: behavioral learning, burnout detection, schedule adaptation,
and Gemini LLM for smart goal parsing and personalized AI nudges.
"""

import os
import json
import re
from datetime import datetime, timedelta
from collections import defaultdict

from models import db, BehaviorEvent, Task, DailyLog


# ============================================================
# GEMINI AI ADVISOR
# ============================================================

class GeminiAdvisor:
    """
    Wraps Google Gemini API for smart goal parsing and AI nudges.
    Gracefully falls back to rule-based logic if API key not set.
    """

    def __init__(self):
        self.model = None
        api_key = os.environ.get('GEMINI_API_KEY', '')
        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel('gemini-1.5-flash')
            except Exception:
                self.model = None

    def parse_goal(self, raw_text: str) -> dict:
        """
        Parse natural language goal description into structured data.
        e.g. "Learn React in 3 months, 2 hours daily" →
             {title, hours, deadline_days, priority}
        Falls back to regex if Gemini unavailable.
        """
        if self.model:
            try:
                prompt = f"""Extract goal details from this text and return ONLY valid JSON (no markdown):
"{raw_text}"

Return exactly this structure:
{{
  "title": "concise goal title (max 60 chars)",
  "hours": <estimated total hours as number>,
  "deadline_days": <days from today as number>,
  "priority": <1-5 where 1=critical, 5=casual>
}}"""
                response = self.model.generate_content(prompt)
                text = response.text.strip()
                # Strip markdown code fences if present
                text = re.sub(r'```(?:json)?', '', text).strip()
                return json.loads(text)
            except Exception:
                pass

        # Fallback: simple regex heuristics
        result = {'title': raw_text[:60], 'hours': 20, 'deadline_days': 30, 'priority': 3}
        months = re.search(r'(\d+)\s*month', raw_text, re.I)
        weeks = re.search(r'(\d+)\s*week', raw_text, re.I)
        hours = re.search(r'(\d+)\s*hours?\s+(?:a\s+)?(?:day|daily|per day)', raw_text, re.I)
        if months:
            result['deadline_days'] = int(months.group(1)) * 30
        elif weeks:
            result['deadline_days'] = int(weeks.group(1)) * 7
        if hours:
            result['hours'] = int(hours.group(1)) * result['deadline_days']
        return result

    def generate_nudge(self, user_context: dict) -> str:
        """
        Generate a personalized motivational nudge based on user context.
        Falls back to rule-based nudge if Gemini unavailable.
        """
        if self.model:
            try:
                ctx = user_context
                prompt = f"""You are a supportive productivity coach for StriveX app. 
Generate ONE short (max 2 sentences) personalized motivational nudge for this user.
Be specific, warm, and actionable. NO emojis.

User context:
- Name: {ctx.get('name', 'Striver')}
- Streak: {ctx.get('streak', 0)} days
- Today completion rate: {ctx.get('today_pct', 0):.0%}
- Burnout risk: {ctx.get('burnout', False)}
- Top goal: {ctx.get('top_goal', 'N/A')}
- Current hour: {ctx.get('hour', 12)}

Return ONLY the nudge text, nothing else."""
                response = self.model.generate_content(prompt)
                return response.text.strip()
            except Exception:
                pass

        # Fallback nudge
        pct = user_context.get('today_pct', 0)
        if pct > 0.7:
            return "Great momentum today. Keep this going and you'll finish ahead of schedule."
        elif pct > 0.3:
            return "Solid progress. One more focused session will put you in a great spot."
        return "Every expert started as a beginner. Start with the smallest task and build from there."

    def daily_brief(self, user_data: dict) -> str:
        """Generate a personalized daily briefing for the dashboard."""
        if self.model:
            try:
                prompt = f"""Generate a short (3-4 sentences) morning briefing for a productivity app user.
User data:
- Goals: {user_data.get('goals', [])}
- Tasks today: {user_data.get('tasks_today', 0)}
- Streak: {user_data.get('streak', 0)} days
- Efficiency last 7 days: {user_data.get('efficiency', 0):.0%}
- Time: {user_data.get('time_of_day', 'morning')}

Be concise, specific, and motivating. NO emojis. Return ONLY the briefing text."""
                response = self.model.generate_content(prompt)
                return response.text.strip()
            except Exception:
                pass
        return f"You have {user_data.get('tasks_today', 0)} tasks scheduled today. Stay consistent and keep your streak alive."


# Singleton instance (shared across requests)
gemini = GeminiAdvisor()



# ============================================================
# XP LEVEL SYSTEM
# ============================================================

XP_LEVELS = [
    (0,    1,  "Newcomer",        "Level 1"),
    (100,  2,  "Beginner",        "Level 2"),
    (250,  3,  "Focused",         "Level 3"),
    (500,  4,  "Consistent",      "Level 4"),
    (900,  5,  "Disciplined",     "Level 5"),
    (1500, 6,  "High Performer",  "Level 6"),
    (2500, 7,  "Elite",           "Level 7"),
    (4000, 8,  "Champion",        "Level 8"),
    (6000, 9,  "Legend",          "Level 9"),
    (9000, 10, "Unstoppable",     "Level 10"),
]

def get_level_info(xp: int) -> dict:
    """Return current level, title, emoji, and progress to next level."""
    current = XP_LEVELS[0]
    for entry in XP_LEVELS:
        if xp >= entry[0]:
            current = entry
        else:
            break

    idx = XP_LEVELS.index(current)
    next_level = XP_LEVELS[idx + 1] if idx + 1 < len(XP_LEVELS) else None

    xp_in_level = xp - current[0]
    level_range = (next_level[0] - current[0]) if next_level else 1
    progress_pct = min(100, int((xp_in_level / level_range) * 100)) if next_level else 100

    return {
        "level":        current[1],
        "title":        current[2],
        "emoji":        current[3],
        "xp":           xp,
        "xp_to_next":   (next_level[0] - xp) if next_level else 0,
        "progress_pct": progress_pct,
        "next_title":   next_level[2] if next_level else "MAX",
    }


def xp_for_task(task) -> int:
    """Dynamic XP: base * difficulty multiplier, bonus for early completion."""
    base = 50
    difficulty_mult = {1: 1.0, 2: 1.3, 3: 1.7, 4: 2.2, 5: 3.0}
    mult = difficulty_mult.get(task.difficulty, 1.0)

    # Early-start bonus: if actual_start_time <= scheduled_start_time, +20%
    early_bonus = 1.0
    if task.actual_start_time and task.scheduled_start_time:
        actual_h, actual_m = map(int, str(task.actual_start_time)[:5].split(":"))
        sched_h, sched_m = map(int, task.scheduled_start_time.split(":"))
        actual_min = actual_h * 60 + actual_m
        sched_min = sched_h * 60 + sched_m
        if actual_min <= sched_min:
            early_bonus = 1.2

    return max(10, int(base * mult * early_bonus))


# ============================================================
# BEHAVIORAL INTELLIGENCE ENGINE
# ============================================================

class BehavioralIntelligenceEngine:
    """
    Analyses 30 days of BehaviorEvent + DailyLog + Task data
    to build an adaptive model of the user's real productivity patterns.
    """

    def __init__(self, user):
        self.user = user
        self.days = 30

    # ─── Public API ────────────────────────────────────────────

    def full_analysis(self) -> dict:
        """
        Entry point: run all analyses and return a unified report.
        Called by /api/analytics/weekly and /api/dashboard.
        """
        resistance_matrix = self._build_resistance_matrix()
        latency_score     = self._compute_latency_score()
        completion_trend  = self._completion_trend()
        
        # Core behavioral analysis
        metrics           = self._compute_behavioral_metrics()
        
        energy_mismatch   = self._detect_energy_mismatch(resistance_matrix)
        burnout_signals   = self._burnout_signals(completion_trend, metrics["avg_energy"])
        
        patterns          = self._surface_patterns(
            resistance_matrix, latency_score, energy_mismatch, completion_trend, metrics
        )
        recommendations   = self._schedule_recommendations(
            resistance_matrix, latency_score, energy_mismatch, metrics
        )

        return {
            "resistance_matrix":   resistance_matrix,  
            "latency_score":       latency_score,       
            "completion_trend":    completion_trend,    
            "metrics":             metrics,
            "energy_mismatch":     energy_mismatch,     
            "burnout_risk":        burnout_signals["risk"],
            "burnout_message":     burnout_signals["message"],
            "patterns":            patterns,            
            "recommendations":     recommendations,     
            "level_info":          get_level_info(self.user.xp),
        }

    def get_nudges(self) -> list:
        """Generate real-time behavioral nudges."""
        analysis = self.full_analysis()
        nudges = []
        
        # Burnout nudge
        if analysis["burnout_risk"]:
            nudges.append({
                "type": "burnout",
                "message": analysis["burnout_message"],
                "priority": "high"
            })
            
        # Latency nudge
        if analysis["latency_score"] > 20:
            nudges.append({
                "type": "latency",
                "message": f"I noticed you're starting {analysis['latency_score']:.0f} mins late recently. Want me to shift your schedule?",
                "priority": "medium"
            })
            
        # Energy mismatch nudge
        if analysis["energy_mismatch"]["mismatch"]:
            nudges.append({
                "type": "energy",
                "message": "You're in a low-energy block but doing hard tasks. Coffee break? ☕",
                "priority": "low"
            })
            
        # Consistency nudge
        if not nudges and analysis["metrics"]["avg_energy"] > 4:
             nudges.append({
                "type": "praise",
                "message": "High energy detected! Perfect time for that 'Deep Work' block. 🚀",
                "priority": "medium"
            })
            
        return nudges

    def weekly_summary(self, n_days=7) -> list:
        """Return last N days' completion rate for the bar chart."""
        return self._completion_trend(n_days=n_days)

    # ─── Behavioral Metrics ─────────────────────────────────────

    def _compute_behavioral_metrics(self) -> dict:
        """Analyzes energy, screen time, and consistency from logs."""
        today = datetime.now().date()
        cutoff = today - timedelta(days=7)
        
        logs = DailyLog.query.filter(
            DailyLog.user_id == self.user.id,
            DailyLog.date >= cutoff
        ).all()
        
        metrics = {
            "avg_energy": 0,
            "screen_time_trend": "Low",
            "consistency": 0,
            "top_distractions": []
        }
        
        if not logs:
            return metrics
            
        energies = [l.energy_level for l in logs if l.energy_level is not None]
        metrics["avg_energy"] = sum(energies) / len(energies) if energies else 0
        
        high_screen_days = sum(1 for l in logs if l.screen_time_level == "High")
        if high_screen_days > len(logs) * 0.6:
            metrics["screen_time_trend"] = "High"
        elif high_screen_days > len(logs) * 0.3:
            metrics["screen_time_trend"] = "Medium"
            
        # Distractions
        distractions = defaultdict(int)
        for l in logs:
            if l.main_distraction:
                distractions[l.main_distraction] += 1
        metrics["top_distractions"] = sorted(distractions.items(), key=lambda x: x[1], reverse=True)[:3]
        
        return metrics

    # ─── Resistance Matrix (7 days × 24 hours) ─────────────────

    def _build_resistance_matrix(self):
        """
        Count BehaviorEvents where event_type ∈ {skip, hover} per
        (day_of_week, hour_of_day) over last 30 days.
        Returns a 7×24 int matrix.
        """
        cutoff = datetime.now() - timedelta(days=self.days)
        events = BehaviorEvent.query.filter(
            BehaviorEvent.user_id == self.user.id,
            BehaviorEvent.event_type.in_(["skip", "hover", "start_late"]),
            BehaviorEvent.timestamp >= cutoff
        ).all()

        matrix = [[0] * 24 for _ in range(7)]
        for ev in events:
            d = ev.day_of_week  # 0=Mon … 6=Sun
            h = ev.hour_of_day
            if 0 <= d < 7 and 0 <= h < 24:
                matrix[d][h] += 1
        return matrix

    # ─── Latency Score ──────────────────────────────────────────

    def _compute_latency_score(self) -> float:
        """
        Average minutes between scheduled_start_time and actual_start_time
        for tasks that were started (have actual_start_time set).
        Positive = late, negative = early.
        """
        cutoff = datetime.now() - timedelta(days=self.days)
        tasks = Task.query.join(Task.goal).filter(
            Task.goal.has(user_id=self.user.id),
            Task.actual_start_time.isnot(None),
            Task.scheduled_start_time.isnot(None),
            Task.scheduled_date >= cutoff.date()
        ).all()

        if not tasks:
            return 0.0

        deltas = []
        for t in tasks:
            try:
                sched_h, sched_m = map(int, t.scheduled_start_time.split(":"))
                actual_h, actual_m = map(int, str(t.actual_start_time)[:5].split(":"))
                sched_min = sched_h * 60 + sched_m
                actual_min = actual_h * 60 + actual_m
                deltas.append(actual_min - sched_min)
            except Exception:
                continue

        return round(sum(deltas) / len(deltas), 1) if deltas else 0.0

    # ─── Completion Trend ───────────────────────────────────────

    def _completion_trend(self, n_days=7) -> list:
        """
        Last n_days' task completion rates from DailyLog.
        Falls back to actual task completion counts if no logs exist.
        Returns list of {day: 'Mon', completion_rate: 72}.
        """
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        today = datetime.now().date()
        result = []

        for i in range(n_days - 1, -1, -1):
            date = today - timedelta(days=i)
            day_name = day_names[date.weekday()]

            # Try DailyLog first
            log = DailyLog.query.filter_by(user_id=self.user.id, date=date).first()
            if log and log.tasks_completed_percentage is not None:
                rate = int(log.tasks_completed_percentage)
            else:
                # Fall back to actual task counts
                day_tasks = Task.query.join(Task.goal).filter(
                    Task.goal.has(user_id=self.user.id),
                    Task.scheduled_date == date,
                    Task.status.in_(["completed", "skipped", "expired"])
                ).all()
                completed = sum(1 for t in day_tasks if t.status == "completed")
                total = len(day_tasks)
                rate = int((completed / total) * 100) if total > 0 else 0

            result.append({"day": day_name, "date": str(date), "completion_rate": rate})

        return result

    # ─── Energy Mismatch ────────────────────────────────────────

    def _detect_energy_mismatch(self, resistance_matrix) -> dict:
        """
        Compare declared peak hours (user.peak_start/peak_end) against the
        resistance matrix. If resistance is high during declared peak,
        the user is mis-scheduling hard tasks.
        """
        peak_start_h = 9
        peak_end_h   = 12

        if self.user.peak_start:
            try:
                peak_start_h = int(str(self.user.peak_start)[:2])
            except Exception:
                pass
        if self.user.peak_end:
            try:
                peak_end_h = int(str(self.user.peak_end)[:2])
            except Exception:
                pass

        # Average resistance in peak window across all days
        peak_resistance = []
        off_peak_resistance = []
        for day_row in resistance_matrix:
            for h, count in enumerate(day_row):
                if peak_start_h <= h < peak_end_h:
                    peak_resistance.append(count)
                else:
                    off_peak_resistance.append(count)

        avg_peak = sum(peak_resistance) / max(1, len(peak_resistance))
        avg_off  = sum(off_peak_resistance) / max(1, len(off_peak_resistance))

        mismatch = avg_peak > avg_off * 1.5 and avg_peak > 0.5
        description = ""
        if mismatch:
            description = (
                f"You show high resistance during your declared peak hours "
                f"({self.user.peak_start}–{self.user.peak_end}). "
                "Consider shifting hard tasks to later in the day."
            )

        return {"mismatch": mismatch, "description": description,
                "avg_peak_resistance": round(avg_peak, 2),
                "avg_off_resistance": round(avg_off, 2)}

    # ─── Burnout Signals ────────────────────────────────────────

    def _burnout_signals(self, completion_trend, avg_energy=0) -> dict:
        """
        Multi-signal burnout detection:
        - 3 consecutive days <30% completion
        - Average energy level <2.5 over last 7 logs
        - High skip rate over last 7 days
        """
        risk = False
        message = ""

        # Signal 1: consecutive low-completion days
        low_days = 0
        for day in reversed(completion_trend):
            if day["completion_rate"] < 30:
                low_days += 1
            else:
                break
        if low_days >= 3:
            risk = True
            message = f"🔴 {low_days} consecutive low-productivity days. Consider a lighter schedule tomorrow."

        # Signal 2: average energy from daily logs
        if not risk and avg_energy > 0 and avg_energy < 2.5:
            risk = True
            message = f"⚡ Average energy {avg_energy:.1f}/5 over last week — you may need a recovery day."

        # Signal 3: skip rate
        if not risk:
            cutoff = datetime.now() - timedelta(days=7)
            skip_events = BehaviorEvent.query.filter(
                BehaviorEvent.user_id == self.user.id,
                BehaviorEvent.event_type == "skip",
                BehaviorEvent.timestamp >= cutoff
            ).count()
            if skip_events >= 10:
                risk = True
                message = f"⚠️ {skip_events} task skips in the last 7 days — your schedule may be overloaded."

        return {"risk": risk, "message": message}

    # ─── Surface Patterns ───────────────────────────────────────

    def _surface_patterns(self, matrix, latency, energy_mismatch, trend, metrics) -> list:
        """Convert analysis results into human-readable insight strings."""
        patterns = []

        # Latency insight
        if latency > 20:
            patterns.append(f"You typically start tasks {latency:.0f} min late — StriveX will shift your schedule forward.")
        elif latency < -10:
            patterns.append(f"You consistently start {abs(latency):.0f} min early — great habit! 🎯")

        # Energy mismatch
        if energy_mismatch["mismatch"]:
            patterns.append(energy_mismatch["description"])
            
        # Screen time
        if metrics.get("screen_time_trend") == "High":
            patterns.append("High screen time detected recently. This correlates with your lower productivity blocks.")

        # Find worst procrastination hour
        worst_val = 0
        worst_day = 0
        worst_hour = 0
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        for d, row in enumerate(matrix):
            for h, val in enumerate(row):
                if val > worst_val:
                    worst_val = val
                    worst_day = d
                    worst_hour = h
        if worst_val >= 3:
            patterns.append(
                f"Highest resistance: {day_names[worst_day]}s around {worst_hour:02d}:00. We'll suggest breaks here."
            )

        # Completion trend
        if len(trend) >= 5:
            recent = [d["completion_rate"] for d in trend[-5:]]
            avg = sum(recent) / len(recent)
            if avg >= 75:
                patterns.append(f"Strong week! Average {avg:.0f}% completion — keep the momentum. 🔥")
            elif avg < 40 and avg > 0:
                patterns.append(f"Tough week — {avg:.0f}% avg completion. Tomorrow's schedule will be lighter.")
        return patterns

    # ─── Schedule Recommendations ───────────────────────────────


    def _schedule_recommendations(self, matrix, latency, energy_mismatch, metrics) -> list:
        """
        Return actionable recommendation dicts for the adaptive scheduler.
        """
        recs = []

        # LATENCY SHIFT
        if latency > 15:
            recs.append({
                "type": "shift_start",
                "description": f"Shift start times {int(latency)} min later to match real start times",
                "params": {"shift_minutes": int(latency)}
            })

        # ENERGY WINDOW SHIFT
        if energy_mismatch["mismatch"]:
            recs.append({
                "type": "move_hard_tasks",
                "description": "Move difficulty 4-5 tasks to your actual high-energy blocks",
                "params": {"target_window_start": "14:00", "target_window_end": "18:00"}
            })

        # SCREEN TIME BREAKS
        if metrics.get("screen_time_trend") == "High":
            recs.append({
                "type": "add_breaks",
                "description": "Increase break frequency due to high screen-time strain",
                "params": {"break_minutes": 20, "frequency": 45}
            })

        # PROTECT FOCUS DAYS
        day_totals = [sum(row) for row in matrix]
        if sum(day_totals) > 0:
            best_day_idx = day_totals.index(min(day_totals))
            day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            if min(day_totals) == 0:
                recs.append({
                    "type": "protect_day",
                    "description": f"Protect {day_names[best_day_idx]} — it's your zero-resistance day",
                    "params": {"day": best_day_idx}
                })

        return recs
