"""
Smoke tests for the new StriveX v2 endpoints.
Requires backend running on http://localhost:5000
"""
import requests
import json
import time
import sys

BASE_URL = "http://localhost:5000/api"
EMAIL = f"smoke_{time.time()}@strivex.com"
PASSWORD = "Test1234!"

def h(resp):
    return resp.status_code, resp.json() if resp.content else {}

def ok(tag, resp, expected_status=200):
    status, data = h(resp)
    if status == expected_status:
        print(f"  ✅ {tag} — {status}")
        return data
    else:
        print(f"  ❌ {tag} — got {status}: {data}")
        return None

# 1. Register
r = requests.post(f"{BASE_URL}/auth/register", json={"email": EMAIL, "password": PASSWORD})
user_data = ok("Register", r, 201)
token = user_data["token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# 2. Onboarding
r = requests.post(f"{BASE_URL}/onboarding/profile", json={
    "wake_time": "07:00", "sleep_time": "23:00",
    "energy_type": "morning", "peak_start": "09:00", "peak_end": "12:00"
}, headers=headers)
ok("Profile (w/ peak_start/peak_end)", r)

# 3. Create goal
from datetime import datetime, timedelta
deadline = (datetime.now() + timedelta(days=45)).date().isoformat()
r = requests.post(f"{BASE_URL}/goals", json={
    "title": "Complete Python Basics",
    "deadline": deadline,
    "estimated_hours": 25
}, headers=headers)
goal_data = ok("Create Goal", r, 201)
goal_id = goal_data["goal"]["id"] if goal_data else None

print("\n--- NEW ENDPOINTS ---")

# 4. Feasibility endpoint
if goal_id:
    r = requests.get(f"{BASE_URL}/goals/{goal_id}/feasibility", headers=headers)
    f_data = ok("GET /goals/<id>/feasibility", r)
    if f_data:
        print(f"     score={f_data['feasibility_percent']}%, risk={f_data['risk_level']}")
        print(f"     consequence: {f_data['consequence']}")

# 5. Replan endpoint
r = requests.post(f"{BASE_URL}/tasks/replan", headers=headers)
rp_data = ok("POST /tasks/replan", r)
if rp_data:
    print(f"     summary: {rp_data['summary']}")

# 6. NLP parse — move command
r = requests.post(f"{BASE_URL}/nlp/parse", json={"command": "move gym to 6 pm"}, headers=headers)
nlp_data = ok("POST /nlp/parse (move)", r)
if nlp_data:
    print(f"     action={nlp_data.get('action')}, msg={nlp_data.get('message')}")

# 7. NLP parse — add command
r = requests.post(f"{BASE_URL}/nlp/parse", json={"command": "add 2 hours deep work tomorrow"}, headers=headers)
nlp_data2 = ok("POST /nlp/parse (add)", r)
if nlp_data2:
    print(f"     action={nlp_data2.get('action')}, msg={nlp_data2.get('message')}")

# 8. NLP parse — limit day command
r = requests.post(f"{BASE_URL}/nlp/parse", json={"command": "I only have 3 hours today"}, headers=headers)
ok("POST /nlp/parse (limit)", r)

# 9. NLP parse — error case
r = requests.post(f"{BASE_URL}/nlp/parse", json={"command": "xyzzy frobulate the wibble"}, headers=headers)
ok("POST /nlp/parse (unrecognised → 400)", r, 400)

# 10. Behavior event
r = requests.post(f"{BASE_URL}/behavior/event", json={"task_id": None, "event_type": "hover"}, headers=headers)
ok("POST /behavior/event", r, 201)

# 11. Heatmap
r = requests.get(f"{BASE_URL}/analytics/heatmap", headers=headers)
hm_data = ok("GET /analytics/heatmap", r)
if hm_data:
    print(f"     days={hm_data['days']}, total_events={hm_data['total_resistance_events']}")

# 12. Weekly analytics
r = requests.get(f"{BASE_URL}/analytics/weekly", headers=headers)
wk_data = ok("GET /analytics/weekly", r)
if wk_data:
    print(f"     7 days data: {[d['day'] for d in wk_data['weekly_data']]}")
    print(f"     burnout_risk={wk_data['burnout_risk']}")

# 13. Start task focus session
r = requests.get(f"{BASE_URL}/tasks/today", headers=headers)
today_tasks = ok("GET /tasks/today", r) if r.status_code == 200 else []
if today_tasks:
    task_id = today_tasks[0]["id"]
    r = requests.post(f"{BASE_URL}/tasks/{task_id}/start", headers=headers)
    ok(f"POST /tasks/{task_id}/start", r)

    # Ghost toggle
    r = requests.post(f"{BASE_URL}/tasks/{task_id}/ghost", headers=headers)
    gh_data = ok(f"POST /tasks/{task_id}/ghost", r)
    if gh_data:
        print(f"     is_ghost={gh_data['is_ghost']}")

print("\n✅ All new endpoint smoke tests complete!")
