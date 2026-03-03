---
inclusion: always
---

# Product Overview

StriveX is an adaptive AI productivity scheduler that eliminates decision fatigue by automatically generating daily schedules from user goals.

## Core Value Proposition

Users set goals with deadlines and time estimates. StriveX breaks them into time-blocked tasks, auto-schedules around commitments, and adapts in real-time. The system learns user behavior patterns and adjusts scheduling to match actual productivity rhythms.

## Key Features

- Adaptive daily scheduling with automatic rescheduling ("Replan My Day")
- AI behavioral mentor with personalized nudges based on productivity patterns
- Live feasibility scoring (0-100% probability of hitting deadlines)
- Gamification layer (XP, levels, streaks)
- Ghost Mode for protected time blocks
- Voice-to-goal parsing
- PWA with offline support

## Target Users

Students and young professionals managing multiple goals (exam prep, learning to code, project deadlines) who struggle with planning and decision fatigue.

## Architecture

- Frontend: PWA (HTML/CSS/Vanilla JS) with offline-first design
- Backend: Flask REST API with JWT auth
- Database: SQLite (dev) / PostgreSQL (prod)
- AI: Google Gemini for behavioral analysis and goal parsing
- Real-time: WebSockets via Flask-SocketIO
