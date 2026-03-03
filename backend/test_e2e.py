import requests, time
from datetime import datetime, timedelta

BASE = 'http://localhost:5001/api'

email = f'e2e_{int(time.time())}@strivex.com'
print('=== FULL E2E TEST ===')

# 1. Register
r = requests.post(f'{BASE}/auth/register', json={'email': email, 'password': 'Test1234!'})
assert r.status_code == 201, f'Register failed: {r.text}'
token = r.json()['token']
H = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
print('1. Register: OK')

# 2. Onboarding profile (with work_style)
r = requests.post(f'{BASE}/onboarding/profile', json={
    'wake_time': '07:00', 'sleep_time': '23:00', 'energy_type': 'morning',
    'peak_start': '09:00', 'peak_end': '12:00', 'work_style': 'deep'
}, headers=H)
assert r.status_code == 200, f'Profile failed: {r.text}'
print('2. Onboarding Profile: OK')

# 3. Commitments (no day_of_week)
r = requests.post(f'{BASE}/onboarding/commitments', json={
    'commitments': [{'title': 'College', 'start_time': '09:00', 'end_time': '17:00'}]
}, headers=H)
assert r.status_code == 201, f'Commitments failed: {r.text}'
print('3. Commitments: OK')

# 4. Create goal
dl = (datetime.now() + timedelta(days=30)).date().isoformat()
r = requests.post(f'{BASE}/goals', json={'title': 'Python Mastery', 'deadline': dl, 'estimated_hours': 20}, headers=H)
assert r.status_code == 201, f'Goal failed: {r.text}'
gid = r.json()['goal']['id']
print(f'4. Goal Created: OK (id={gid})')

# 5. Dashboard
r = requests.get(f'{BASE}/dashboard', headers=H)
assert r.status_code == 200, f'Dashboard failed: {r.text}'
data = r.json()
goal_d = data['active_goals'][0]
today_count = len(data['today_tasks'])
tasks_count = goal_d.get('tasks_count', 'MISSING')
tasks_completed = goal_d.get('tasks_completed', 'MISSING')
print(f'5. Dashboard: OK (today_tasks={today_count}, tasks_count={tasks_count}, tasks_completed={tasks_completed})')

# 6. Goal dict structure
assert 'tasks_count' in goal_d, 'Missing tasks_count in goal'
assert 'tasks_completed' in goal_d, 'Missing tasks_completed in goal'
print('6. Goal dict structure: OK')

# 7. Milestones
r = requests.get(f'{BASE}/goals/{gid}/milestones', headers=H)
assert r.status_code == 200, f'Milestones failed: {r.text}'
mcount = len(r.json()['milestones'])
print(f'7. Milestones: OK ({mcount} milestones)')

# 8. XP level
r = requests.get(f'{BASE}/user/level', headers=H)
assert r.status_code == 200
print(f'8. XP Level: OK (Level {r.json()["level"]} - {r.json()["title"]})')

# 9. Behavioral
r = requests.get(f'{BASE}/analytics/behavioral', headers=H)
assert r.status_code == 200
print(f'9. Behavioral Analysis: OK (burnout_risk={r.json()["burnout_risk"]})')

# 10. Complete a task if any today
if data['today_tasks']:
    tid = data['today_tasks'][0]['id']
    r = requests.post(f'{BASE}/tasks/{tid}/complete', headers=H)
    assert r.status_code == 200, f'Complete task failed: {r.text}'
    xp = r.json().get('xp_earned', '?')
    print(f'10. Complete Task: OK (+{xp} XP)')
else:
    print('10. Complete Task: SKIPPED (no tasks scheduled today)')

# 11. Replan
r = requests.post(f'{BASE}/tasks/replan', headers=H)
assert r.status_code == 200, f'Replan failed: {r.text}'
print(f'11. Replan: OK ({r.json().get("summary", "")})')

print()
print('=== ALL 11 TESTS PASSED ===')
