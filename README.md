# StriveX - AI-Powered Adaptive Productivity System

## 🎯 MVP Goal
Prove one thing: **StriveX can intelligently plan a user's day and adapt when they procrastinate.**

## 🚀 Core Features (MVP Only)

### 1. Smart Onboarding (< 2 minutes)
- Wake/sleep times
- Fixed commitments
- Primary goal + deadline
- Energy type (morning/night/flexible)

### 2. Intelligent Scheduling Engine ⭐ (THE HEART)
- 7-day adaptive plan
- Time-blocked daily schedule
- Breaks goals into executable tasks
- Respects sleep, commitments, focus windows
- Auto-buffers & difficulty balancing

### 3. Daily To-Do + Timeline View
- Clear time blocks
- One-tap actions: ✅ Done | ⏸ Skip | 🔄 Reschedule
- No clutter

### 4. Procrastination Detection (Light & Smart)
- End-of-day check (3-5 questions)
- Pattern detection (late sleep → missed morning)
- Auto-adjusts tomorrow's plan

### 5. Auto-Rescheduling Logic
- Reshuffles on skip/low energy
- Protects critical deadlines
- No guilt, just adaptation

### 6. Deadline Guardrail
- Backward planning from deadline
- ⚠️ Risk detection
- Progress tracking

### 7. Minimal Gamification
- Daily streak counter
- XP for task completion

### 8. MVP Security
- Email/phone auth
- Encrypted storage
- Privacy-first design

## 🛠️ Tech Stack
- **Frontend**: HTML + Vanilla CSS + JavaScript
- **Backend**: Python Flask
- **Database**: SQLite
- **Scheduling**: Custom algorithm (rule-based + pattern learning)

## 📊 Success Criteria
✅ User uses it 5 days in a row  
✅ Schedule actually adapts  
✅ User says: *"This planned my day better than I would have"*

## 🚫 NOT in MVP
- Notion-style pages
- Social features
- AI chat assistant
- Voice input
- Deep analytics
- Multi-device sync perfection

## 🏃 Quick Start
```bash
# Backend
cd backend
pip install -r requirements.txt
python app.py

# Frontend
cd frontend
# Open index.html in browser (or use live server)
```

## 📁 Project Structure
```
StriveX/
├── frontend/           # UI (HTML/CSS/JS)
│   ├── index.html     # Landing/login
│   ├── onboarding.html
│   ├── dashboard.html # Main daily view
│   ├── css/
│   └── js/
├── backend/           # Flask API
│   ├── app.py        # Main server
│   ├── scheduler.py  # Smart scheduling engine
│   ├── detector.py   # Procrastination detection
│   └── models.py     # Database models
├── database/
│   └── schema.sql
└── docs/
    └── algorithm.md  # Scheduling logic explained
```

## 🧠 Core Algorithm (Simplified)
1. **Input**: Goals, deadlines, availability, energy type
2. **Process**:
   - Break goals into tasks (estimated duration)
   - Distribute backward from deadline
   - Fit into available time slots
   - Balance difficulty (deep vs light work)
   - Add buffer time (20% rule)
3. **Adapt**:
   - Track completion patterns
   - Detect energy mismatches
   - Reshuffle on procrastination signals
   - Protect critical path to deadline

## 🔐 Security Notes
- Passwords hashed (bcrypt)
- Session tokens (JWT)
- HTTPS in production
- No unnecessary data collection

---

**Built for hackathons, designed for real impact.**
