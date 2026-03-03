# StriveX — Explained Simply

> A plain-English guide to what StriveX is, how it works, and what every part of the project does.
> Written for anyone — no coding knowledge needed.

---

## 💡 The Idea

Most productivity apps ask you to **plan your own day**. You open the app, stare at a blank screen, and spend 20 minutes deciding what to do first. That's called **decision fatigue** — and it kills motivation before you even start.

**StriveX flips this.**

You tell StriveX:
- *"I want to learn Python by April 30th"*
- *"I have about 40 hours to put into it"*
- *"I wake up at 7am and sleep at 11pm"*

And StriveX figures out the rest. It builds your entire daily schedule automatically — which task to do today, at what time, for how long. Every morning your plan is already made. If something comes up (meeting overran, bad day), you hit **"Replan My Day"** and it reshuffles everything in 2 seconds.

Over time, it watches your patterns — when you procrastinate, when you're most focused — and adjusts your schedule to fit *how you actually are*, not how you think you should be.

---

## 🧠 How It Works — Step by Step

```
You set a goal  →  StriveX breaks it into tasks  →  Tasks get slotted into your free time
      ↓
Every day: your schedule is pre-built, waiting for you
      ↓
You do tasks, mark them done, earn XP (like a game)
      ↓
StriveX learns your patterns and gets smarter over time
      ↓
You hit your deadline without ever deciding "what do I do next?"
```

---

## 🗂️ What's in Each Folder

Think of the project like a restaurant:

| Folder / File | What it is | Simple explanation |
|---|---|---|
| `frontend/` | The **dining room** | Everything the user sees — the website, buttons, screens |
| `backend/` | The **kitchen** | The engine that processes your goals, stores data, runs logic |
| `frontend/index.html` | The **front door** | The landing page users see first |
| `frontend/dashboard.html` | The **main app screen** | Where you see your schedule, goals, and XP |
| `frontend/onboarding.html` | The **welcome form** | The 4-step setup when you first sign up |
| `frontend/offline.html` | The **"closed" sign** | What you see if you lose internet |
| `frontend/css/` | The **interior design** | Colors, fonts, layouts — makes things look good |
| `frontend/js/` | The **waiters** | JavaScript code that makes buttons work, calls the kitchen |
| `frontend/manifest.json` | The **app ID card** | Tells phones "this can be installed like an app" |
| `frontend/sw.js` | The **backup chef** | Saves things locally so the app works offline |
| `frontend/icons/` | The **logo** | App icon that appears on your phone's home screen |
| `backend/app.py` | The **head chef** | ~1,600 lines — handles all requests (login, goals, tasks) |
| `backend/models.py` | The **recipe book** | Defines what a "User", "Goal", "Task" looks like in the database |
| `backend/scheduler.py` | The **planning brain** | The algorithm that turns your goal into a daily schedule |
| `backend/intelligence.py` | The **AI layer** | Talks to Google Gemini AI for smart nudges and goal parsing |
| `backend/requirements.txt` | The **ingredients list** | Python packages the backend needs to run |
| `backend/.env.example` | The **secret template** | Shows what private keys/passwords are needed (not the real ones) |
| `vercel.json` | The **delivery instructions** | Tells Vercel how to host the website |
| `Dockerfile` | The **packaging guide** | Lets you run StriveX in a container anywhere |
| `PLAYSTORE.md` | The **app store guide** | Step-by-step how to publish to Google Play Store |
| `README.md` | The **project summary** | Technical overview for developers |

---

## 💾 Where Data Lives

StriveX stores everything in a **database** — think of it like a very organised spreadsheet that lives on the server.

It stores:

| What | Example |
|---|---|
| **Users** | Email, password (encrypted), wake/sleep times, XP points, streak count |
| **Goals** | "Learn Python", deadline April 30, 40 hours estimated |
| **Tasks** | "Python Functions" — scheduled Mon 9am–12pm, difficulty 3/5 |
| **Daily Logs** | "March 3: completed 80% of tasks, energy = High" |
| **Behaviour Events** | "User hovered on task for 3 min before starting" (used to detect procrastination) |
| **Milestones** | Week 1 checkpoint: "Complete Python basics" |

In development (on your laptop): this is a simple file called `strivex.db`.
In production (live on internet): this uses **PostgreSQL**, a proper hosted database.

---

## 🔒 How Accounts & Security Work

- Passwords are never stored as plain text — they're **hashed** (turned into a scrambled code)
- When you log in, you get a **JWT token** — like a temporary ID badge that expires after 15 minutes
- There's a **refresh token** (valid 30 days) that silently gets you a new ID badge before the old one expires — so you stay logged in without re-typing your password
- You can also sign in with **Google** (one click, no password needed)
- Rate limiting prevents someone from trying 1,000 passwords in a row

---

## 🎮 The Game Layer (XP & Streaks)

| Feature | What it does |
|---|---|
| **XP Points** | You earn points for completing tasks. Harder tasks = more XP |
| **Levels** | Accumulate enough XP → level up (shown on your profile) |
| **Streaks** | Complete tasks on consecutive days → your streak grows 🔥 |
| **Feasibility Score** | Live 0–100% probability you'll hit your deadline. Goes red when you're at risk |
| **Ghost Mode** | Add tasks to your timeline without committing — they don't affect your score |

---

## ⚡ The "Replan My Day" Feature

This is the **core feature** of StriveX:

1. It's 2pm. You had tasks scheduled at 9am that you didn't do.
2. You press "Replan My Day"
3. In under 2 seconds, StriveX:
   - Identifies which tasks are now expired
   - Looks at your remaining free time today
   - Reshuffles everything that still fits
   - Shows you exactly what changed
4. You never have to manually reschedule anything

---

## 🌐 How the App Is Deployed (Published Online)

```
You write code  →  Push to GitHub  →  Vercel auto-deploys the website
                                   →  Railway/Render runs the Python backend
                                   →  Users visit strivex.app from their browser
```

| Platform | What it hosts | Cost |
|---|---|---|
| **Vercel** | The frontend (website, HTML/CSS/JS) | Free |
| **Railway or Render** | The backend (Python server) | Free tier available |
| **PostgreSQL** (via Railway) | The database | Free tier available |
| **Google Play Store** | Android app (via PWA wrapper) | $25 one-time fee |

---

## 📱 Why It Can Go on the Play Store

StriveX is a **PWA (Progressive Web App)**. This means:

- It works in a browser like a normal website
- It can also be **installed on Android** like a real app
- It works **offline** (your schedule still loads without internet)
- It can send **push notifications**
- Using a free tool called [PWABuilder](https://www.pwabuilder.com), you can wrap it into an `.aab` file and submit to Google Play — no native Android code needed

---

## 👥 Who Built This & Why

StriveX was built as a **productivity tool** aimed at students and young professionals who struggle with planning — particularly those preparing for competitive exams, learning to code, or managing multiple goals at once.

The goal was to replace the mental overhead of planning with a system that just *decides for you* — the way a personal coach or mentor would, but available 24/7 and free.

---

*Last updated: March 2026*
