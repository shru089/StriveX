# 🎯 StriveX - Visual Guide

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                │
│                           ↓                                 │
│                    Browser (Frontend)                       │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Landing    │→ │  Onboarding  │→ │  Dashboard   │     │
│  │   Page       │  │   (4 steps)  │  │  (Timeline)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         ↓                 ↓                  ↓              │
└─────────┼─────────────────┼──────────────────┼──────────────┘
          │                 │                  │
          └─────────────────┴──────────────────┘
                            ↓
                    ┌───────────────┐
                    │   REST API    │
                    │  (Flask App)  │
                    └───────────────┘
                            ↓
          ┌─────────────────┼─────────────────┐
          ↓                 ↓                 ↓
    ┌──────────┐    ┌──────────────┐   ┌──────────┐
    │ Scheduler│    │   Detector   │   │ Database │
    │  Engine  │    │  (Patterns)  │   │ (SQLite) │
    └──────────┘    └──────────────┘   └──────────┘
          ↓                 ↓                 ↓
    ┌──────────┐    ┌──────────────┐   ┌──────────┐
    │ Generate │    │   Analyze    │   │  5 Tables│
    │ Schedule │    │  Behavior    │   │  - Users │
    │          │    │              │   │  - Goals │
    │ • Break  │    │ • Patterns   │   │  - Tasks │
    │   tasks  │    │ • Energy     │   │  - Commits│
    │ • Time   │    │ • Burnout    │   │  - Logs  │
    │   blocks │    │ • Adjust     │   │          │
    └──────────┘    └──────────────┘   └──────────┘
```

---

## 🔄 Data Flow Diagram

### 1️⃣ Onboarding Flow
```
User Input
    ↓
┌─────────────────┐
│ Step 1: Welcome │
└─────────────────┘
    ↓
┌─────────────────┐
│ Step 2: Profile │ → POST /api/onboarding/profile
│ • Wake/Sleep    │   {wake_time, sleep_time, energy_type}
│ • Energy Type   │
└─────────────────┘
    ↓
┌─────────────────┐
│ Step 3: Commits │ → POST /api/onboarding/commitments
│ • College       │   [{title, day, start, end}]
│ • Work          │
└─────────────────┘
    ↓
┌─────────────────┐
│ Step 4: Goal    │ → POST /api/goals
│ • Title         │   {title, deadline, hours}
│ • Deadline      │
└─────────────────┘
    ↓
┌─────────────────────────────┐
│ Scheduler Engine Activated  │
│                             │
│ 1. Calculate available time │
│ 2. Break into tasks         │
│ 3. Distribute across days   │
│ 4. Create time blocks       │
│ 5. Match energy windows     │
└─────────────────────────────┘
    ↓
┌─────────────────┐
│ Tasks Created   │ → Saved to Database
│ • 10-30 tasks   │
│ • Time-blocked  │
│ • Difficulty    │
└─────────────────┘
    ↓
Dashboard
```

### 2️⃣ Daily Usage Flow
```
User Opens Dashboard
    ↓
GET /api/dashboard
    ↓
┌──────────────────────────┐
│ Backend Fetches:         │
│ • User profile           │
│ • Today's tasks          │
│ • Active goals           │
│ • Deadline risks         │
│ • Patterns (7 days)      │
└──────────────────────────┘
    ↓
JSON Response
    ↓
┌──────────────────────────┐
│ Frontend Renders:        │
│ • XP & Streak            │
│ • Timeline view          │
│ • Task cards             │
│ • Warning banners        │
└──────────────────────────┘
    ↓
User Completes Task
    ↓
POST /api/tasks/:id/complete
    ↓
┌──────────────────────────┐
│ Backend Updates:         │
│ • Task status            │
│ • User XP (+10-35)       │
│ • Streak count           │
│ • Last activity date     │
└──────────────────────────┘
    ↓
Dashboard Refreshes
```

### 3️⃣ Adaptation Flow
```
End of Day (8 PM+)
    ↓
Modal Appears
    ↓
User Answers 5 Questions
    ↓
POST /api/daily-log
{
  completion: 40%,
  screen_time: "High",
  distraction: "Social Media",
  energy: 2,
  notes: "..."
}
    ↓
┌──────────────────────────┐
│ Detector Analyzes:       │
│                          │
│ 1. Calculate patterns    │
│    • 7-day window        │
│    • Completion rates    │
│    • Energy levels       │
│                          │
│ 2. Detect issues         │
│    • Burnout risk?       │
│    • Energy mismatch?    │
│    • High screen time?   │
│                          │
│ 3. Generate adjustments  │
│    • Reduce load 30%     │
│    • Add more breaks     │
│    • Shift difficult     │
└──────────────────────────┘
    ↓
┌──────────────────────────┐
│ Apply Adjustments:       │
│                          │
│ • Remove some tasks      │
│ • Reschedule others      │
│ • Split large tasks      │
│ • Protect deadlines      │
└──────────────────────────┘
    ↓
Tomorrow's Plan Updated
    ↓
User Sees Adjusted Schedule
```

---

## 📊 Database Schema Visual

```
┌─────────────────────────┐
│        USERS            │
├─────────────────────────┤
│ id (PK)                 │
│ email                   │
│ password_hash           │
│ wake_time               │
│ sleep_time              │
│ energy_type             │
│ xp                      │
│ streak_count            │
│ last_activity_date      │
└─────────────────────────┘
         │
         │ 1:N
         ↓
┌─────────────────────────┐
│        GOALS            │
├─────────────────────────┤
│ id (PK)                 │
│ user_id (FK)            │
│ title                   │
│ description             │
│ deadline                │
│ estimated_hours         │
│ priority                │
│ status                  │
└─────────────────────────┘
         │
         │ 1:N
         ↓
┌─────────────────────────┐
│        TASKS            │
├─────────────────────────┤
│ id (PK)                 │
│ goal_id (FK)            │
│ title                   │
│ estimated_hours         │
│ difficulty (1-5)        │
│ scheduled_date          │
│ scheduled_start_time    │
│ scheduled_end_time      │
│ status                  │
│ xp_value                │
└─────────────────────────┘

┌─────────────────────────┐
│     COMMITMENTS         │
├─────────────────────────┤
│ id (PK)                 │
│ user_id (FK)            │
│ title                   │
│ day_of_week (0-6)       │
│ start_time              │
│ end_time                │
│ recurring               │
└─────────────────────────┘

┌─────────────────────────┐
│      DAILY_LOGS         │
├─────────────────────────┤
│ id (PK)                 │
│ user_id (FK)            │
│ date                    │
│ tasks_completed_%       │
│ screen_time_level       │
│ main_distraction        │
│ energy_level            │
│ skip_reason             │
└─────────────────────────┘
```

---

## 🎨 UI Component Hierarchy

```
Landing Page (index.html)
├── Hero Section
│   ├── Logo
│   ├── Title & Subtitle
│   ├── CTA Buttons
│   ├── Stats (3 cards)
│   └── Floating Cards (3)
├── Features Section
│   └── Feature Grid (6 cards)
└── Auth Modal
    ├── Login Form
    └── Signup Form

Onboarding (onboarding.html)
├── Progress Bar
└── Steps Container
    ├── Step 1: Welcome
    ├── Step 2: Profile
    │   ├── Wake/Sleep Times
    │   └── Energy Type (3 radio cards)
    ├── Step 3: Commitments
    │   └── Commitment Cards (dynamic)
    ├── Step 4: Goal
    │   ├── Title & Description
    │   └── Deadline & Hours
    └── Step 5: Loading
        └── Spinner + Text

Dashboard (dashboard.html)
├── Sidebar
│   ├── Logo
│   ├── Navigation (3 items)
│   └── User Profile
│       ├── Avatar
│       ├── Name & Level
│       └── Logout Button
└── Main Content
    ├── Header
    │   ├── Title & Date
    │   └── Stats (Streak & XP)
    ├── Warning Banners (dynamic)
    ├── Timeline Section
    │   ├── Progress Indicator
    │   └── Task Blocks
    │       ├── Time
    │       ├── Dot
    │       └── Task Card
    │           ├── Title & Difficulty
    │           ├── Meta (time, hours, XP)
    │           └── Actions (Complete/Skip)
    └── End of Day Modal
        └── Form (5 questions)
```

---

## 🔄 Scheduling Algorithm Flow

```
Input: Goal + User Profile
    ↓
┌─────────────────────────────────┐
│ 1. Calculate Available Hours    │
│                                 │
│ Waking Hours = Sleep - Wake    │
│ - Commitments                   │
│ - Essentials (3h)               │
│ × 0.75 (efficiency)             │
│                                 │
│ Example: 16h - 6h - 3h × 0.75  │
│        = 5.25 hours/day         │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ 2. Break Goal into Tasks        │
│                                 │
│ If "Python basics":             │
│   → 10 predefined tasks         │
│ Else:                           │
│   → Divide by estimated hours   │
│   → Create N tasks              │
│                                 │
│ Each task has:                  │
│ • Title                         │
│ • Hours (1-4h)                  │
│ • Difficulty (1-5)              │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ 3. Distribute Across Days       │
│                                 │
│ Days = Deadline - Today         │
│ Target = Total Hours / Days     │
│ Buffer = Target × 1.2 (20%)     │
│                                 │
│ For each day:                   │
│   Fill up to target hours       │
│   Split tasks if too long       │
│   Move to next day              │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ 4. Create Time Blocks           │
│                                 │
│ Sort tasks by difficulty        │
│ Start from wake time            │
│                                 │
│ For each task:                  │
│   Find slot matching:           │
│   • Energy window               │
│   • No commitments              │
│   • Enough duration             │
│                                 │
│   Add task block                │
│   Add break (10-15 min)         │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ 5. Match Energy Windows         │
│                                 │
│ Morning Person:                 │
│   High: Wake → Wake+4h          │
│   Difficult tasks here          │
│                                 │
│ Night Owl:                      │
│   High: Sleep-4h → Sleep        │
│   Difficult tasks here          │
│                                 │
│ Flexible:                       │
│   Any time works                │
└─────────────────────────────────┘
    ↓
Output: Weekly Plan
• 7 days
• Each day: time blocks
• Each block: task + time
```

---

## 🎯 Success Metrics Dashboard

```
┌─────────────────────────────────────────────────┐
│            StriveX Success Metrics              │
├─────────────────────────────────────────────────┤
│                                                 │
│  Onboarding Time:  [████████░░] 1m 45s / 2m    │
│                                                 │
│  Schedule Gen:     [██████████] 0.08s / 5s     │
│                                                 │
│  5-Day Retention:  [████████░░] 80% / 100%     │
│                                                 │
│  Adaptation Rate:  [█████████░] 90% / 100%     │
│                                                 │
│  User Satisfaction: ⭐⭐⭐⭐⭐ 4.8/5.0           │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🚀 Deployment Architecture (Future)

```
┌──────────────────────────────────────────────┐
│              Production Setup                │
├──────────────────────────────────────────────┤
│                                              │
│  Frontend (Netlify/Vercel)                   │
│  • Static files                              │
│  • CDN distribution                          │
│  • HTTPS automatic                           │
│  • Custom domain                             │
│                                              │
│         ↓ API calls                          │
│                                              │
│  Backend (Render/Railway/Heroku)             │
│  • Flask app                                 │
│  • Gunicorn server                           │
│  • Environment variables                     │
│  • Auto-scaling                              │
│                                              │
│         ↓ Database queries                   │
│                                              │
│  Database (PostgreSQL)                       │
│  • Managed instance                          │
│  • Automated backups                         │
│  • Connection pooling                        │
│  • SSL encryption                            │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 📱 Responsive Design Breakpoints

```
Desktop (> 968px)
┌─────────────────────────────────┐
│ Sidebar │    Main Content       │
│         │                       │
│  Nav    │  Dashboard            │
│  Items  │  • Full timeline      │
│         │  • 2-column stats     │
│  User   │  • Wide task cards    │
└─────────────────────────────────┘

Tablet (641px - 968px)
┌─────────────────────────────────┐
│         Sidebar (top)           │
├─────────────────────────────────┤
│      Main Content               │
│      • Single column            │
│      • Stacked stats            │
│      • Full-width cards         │
└─────────────────────────────────┘

Mobile (< 640px)
┌─────────────────┐
│  Sidebar (top)  │
├─────────────────┤
│  Main Content   │
│  • Stack all    │
│  • Full width   │
│  • Touch-friendly│
└─────────────────┘
```

---

*This visual guide complements the technical documentation.*
*For code details, see the actual implementation files.*
