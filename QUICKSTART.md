# 🚀 StriveX MVP - Quick Start Guide

## ✅ What You Have

A **complete, working MVP** of StriveX with:

### Backend (Python Flask)
- ✅ User authentication (JWT)
- ✅ Smart scheduling engine
- ✅ Procrastination detection
- ✅ Auto-rescheduling logic
- ✅ Deadline risk assessment
- ✅ Gamification (XP & streaks)
- ✅ RESTful API

### Frontend (HTML/CSS/JS)
- ✅ Beautiful landing page
- ✅ Multi-step onboarding
- ✅ Interactive dashboard
- ✅ Timeline view
- ✅ End-of-day check
- ✅ Responsive design

---

## 🏃 Quick Start (5 Minutes)

### Step 1: Install Python Dependencies

```powershell
cd backend
pip install -r requirements.txt
```

### Step 2: Start the Backend

```powershell
python app.py
```

You should see:
```
* Running on http://127.0.0.1:5000
```

### Step 3: Open the Frontend

Open `frontend/index.html` in your browser, or use a live server:

**Option A: Double-click**
- Navigate to `frontend/index.html`
- Double-click to open in browser

**Option B: VS Code Live Server** (Recommended)
- Install "Live Server" extension in VS Code
- Right-click `frontend/index.html`
- Click "Open with Live Server"

---

## 🎯 Test the MVP

### 1. Create Account
- Click "Get Started Free"
- Enter email: `test@strivex.com`
- Password: `test123`

### 2. Complete Onboarding
- **Wake time**: 7:00 AM
- **Sleep time**: 11:00 PM
- **Energy type**: Morning Person
- **Add a commitment**: College (Mon-Fri, 9:00-17:00)
- **Goal**: "Complete Python basics"
- **Deadline**: 30 days from today

### 3. See Your Schedule
- StriveX will generate a 7-day plan
- Tasks are broken down and time-blocked
- Dashboard shows today's timeline

### 4. Complete a Task
- Click "✓ Complete" on any task
- See XP increase
- Streak counter updates

### 5. End of Day Check
- After completing tasks, submit daily log
- Answer 5 quick questions
- See tomorrow's plan adapt!

---

## 🧪 Testing Procrastination Detection

To see the AI adaptation in action:

1. **Skip some tasks** instead of completing them
2. **Submit end-of-day log** with:
   - Low completion (30%)
   - High screen time
   - Energy level: 2/5
3. **Check tomorrow's schedule**:
   - Task load reduced
   - Easier tasks scheduled
   - More breaks added

---

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login

### Onboarding
- `POST /api/onboarding/profile` - Save user profile
- `POST /api/onboarding/commitments` - Add commitments

### Goals & Tasks
- `POST /api/goals` - Create goal (auto-generates schedule)
- `GET /api/tasks/today` - Get today's tasks
- `POST /api/tasks/:id/complete` - Mark complete
- `POST /api/tasks/:id/skip` - Skip task

### Analytics
- `POST /api/daily-log` - Submit end-of-day check
- `GET /api/analytics/patterns` - Get behavior patterns
- `GET /api/analytics/deadline-risk/:id` - Check deadline risk

### Dashboard
- `GET /api/dashboard` - Get all dashboard data

---

## 🎨 Features Implemented

### ✅ Core MVP (All Done!)

1. **Smart Onboarding** (< 2 min)
   - Wake/sleep times
   - Energy type
   - Fixed commitments
   - First goal

2. **Intelligent Scheduling**
   - Breaks goals into tasks
   - Time-blocked daily schedule
   - Respects sleep & commitments
   - Matches energy windows
   - 20% buffer time

3. **Daily Dashboard**
   - Timeline view
   - One-tap actions (Complete/Skip)
   - XP & streak display
   - Deadline warnings

4. **Procrastination Detection**
   - 5-question end-of-day check
   - Pattern analysis (7 days)
   - Energy mismatch detection
   - Burnout risk detection

5. **Auto-Rescheduling**
   - Reduces load on burnout
   - Shifts difficult tasks
   - Adds breaks
   - Protects deadlines

6. **Deadline Guardrail**
   - Backward planning
   - Risk detection (LOW/MEDIUM/HIGH)
   - Warning banners

7. **Gamification**
   - XP per task (10-35 XP)
   - Daily streak counter
   - Level system

8. **Security**
   - Password hashing (bcrypt)
   - JWT authentication
   - Session management

---

## 🔧 Troubleshooting

### Backend won't start
```powershell
# Make sure you're in the backend folder
cd backend

# Install dependencies again
pip install -r requirements.txt

# Run
python app.py
```

### Frontend shows CORS error
- Make sure backend is running on `http://localhost:5000`
- Check `js/auth.js` - API_URL should be `http://localhost:5000/api`

### Database errors
```powershell
# Delete and recreate database
cd backend
rm strivex.db  # or delete manually
python app.py  # Will auto-create tables
```

---

## 📈 Next Steps (Post-MVP)

If the MVP is successful, add:

1. **Week view** - See full 7-day plan
2. **Goal progress** - Visual progress bars
3. **Analytics dashboard** - Charts & insights
4. **Mobile app** - React Native
5. **Notion integration** - Sync tasks
6. **AI chat** - Ask questions about your schedule
7. **Team features** - Collaborate on goals

---

## 🎯 Demo Script (For Judges)

**Setup** (30 seconds):
> "Meet Sarah, a college student who wants to learn Python in 30 days."

**Demo** (2 minutes):
1. Show onboarding - "Under 2 minutes to set up"
2. Show generated schedule - "AI breaks it down into daily tasks"
3. Complete 2 tasks - "XP and streak increase"
4. Skip 1 task - "Life happens"
5. Submit end-of-day check - "5 quick questions"
6. Show adjusted tomorrow - "AI adapts automatically"
7. Show deadline tracker - "Never miss deadlines"

**Impact** (30 seconds):
> "Traditional planners are static. StriveX adapts to YOU.  
> Privacy-first, encrypted, no data selling.  
> Next: Scale to teams, integrate Notion, add voice assistant."

---

## 🏆 Success Criteria

MVP is successful if:
- ✅ User completes onboarding in < 2 minutes
- ✅ Schedule generates in < 5 seconds
- ✅ User uses it for 5 consecutive days
- ✅ Schedule actually adapts to behavior
- ✅ User says: *"This planned my day better than I would have"*

---

## 📝 Technical Notes

### Database Schema
- SQLite (easy to migrate to PostgreSQL later)
- 5 main tables: Users, Goals, Tasks, Commitments, DailyLogs
- All relationships properly defined

### Scheduling Algorithm
- Time complexity: O(n × d) where n=tasks, d=days
- Runs in < 100ms for typical goals
- See `docs/ALGORITHM.md` for details

### Procrastination Detection
- Rule-based (no ML needed yet)
- 7-day rolling window
- 5 adjustment rules
- See `backend/detector.py`

---

## 🎉 You're Ready!

Everything is built and ready to run. Just:

1. Start backend: `python backend/app.py`
2. Open frontend: `frontend/index.html`
3. Create account and test!

**Questions?** Check the docs folder or the inline code comments.

**Good luck with your demo! 🚀**
