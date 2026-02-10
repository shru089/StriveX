"""
Simple test script to verify StriveX backend is working
Run this after starting the Flask server
"""

import requests
import json
from datetime import datetime, timedelta

API_URL = "http://localhost:5000/api"

def test_health():
    """Test if server is running"""
    print("🔍 Testing server health...")
    try:
        response = requests.get(f"{API_URL}/health")
        if response.status_code == 200:
            print("✅ Server is running!")
            return True
        else:
            print("❌ Server responded with error")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Make sure Flask is running on port 5000")
        return False

def test_registration():
    """Test user registration"""
    print("\n🔍 Testing user registration...")
    
    test_email = f"test_{datetime.now().timestamp()}@strivex.com"
    test_password = "test123456"
    
    response = requests.post(
        f"{API_URL}/auth/register",
        json={"email": test_email, "password": test_password}
    )
    
    if response.status_code == 201:
        data = response.json()
        print(f"✅ User registered successfully!")
        print(f"   Email: {test_email}")
        print(f"   Token received: {data['token'][:20]}...")
        return data['token']
    else:
        print(f"❌ Registration failed: {response.json()}")
        return None

def test_onboarding(token):
    """Test onboarding endpoints"""
    print("\n🔍 Testing onboarding...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Update profile
    profile_data = {
        "wake_time": "07:00",
        "sleep_time": "23:00",
        "energy_type": "morning"
    }
    
    response = requests.post(
        f"{API_URL}/onboarding/profile",
        json=profile_data,
        headers=headers
    )
    
    if response.status_code == 200:
        print("✅ Profile updated successfully!")
    else:
        print(f"❌ Profile update failed: {response.json()}")
        return False
    
    # Add commitments
    commitments_data = {
        "commitments": [
            {
                "title": "College Classes",
                "day_of_week": 0,  # Monday
                "start_time": "09:00",
                "end_time": "17:00",
                "recurring": True
            }
        ]
    }
    
    response = requests.post(
        f"{API_URL}/onboarding/commitments",
        json=commitments_data,
        headers=headers
    )
    
    if response.status_code == 201:
        print("✅ Commitments added successfully!")
        return True
    else:
        print(f"❌ Commitments failed: {response.json()}")
        return False

def test_goal_creation(token):
    """Test goal creation and schedule generation"""
    print("\n🔍 Testing goal creation and scheduling...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    deadline = (datetime.now() + timedelta(days=30)).date().isoformat()
    
    goal_data = {
        "title": "Complete Python Basics",
        "description": "Learn Python fundamentals",
        "deadline": deadline,
        "estimated_hours": 25
    }
    
    response = requests.post(
        f"{API_URL}/goals",
        json=goal_data,
        headers=headers
    )
    
    if response.status_code == 201:
        data = response.json()
        print("✅ Goal created and schedule generated!")
        print(f"   Goal: {data['goal']['title']}")
        print(f"   Tasks created: {len(data['goal']['tasks'])}")
        print(f"   Weekly plan days: {len(data['weekly_plan'])}")
        return data['goal']['id']
    else:
        print(f"❌ Goal creation failed: {response.json()}")
        return None

def test_dashboard(token):
    """Test dashboard endpoint"""
    print("\n🔍 Testing dashboard...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(
        f"{API_URL}/dashboard",
        headers=headers
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Dashboard loaded successfully!")
        print(f"   User XP: {data['user']['xp']}")
        print(f"   Streak: {data['user']['streak_count']}")
        print(f"   Today's tasks: {len(data['today_tasks'])}")
        print(f"   Active goals: {len(data['active_goals'])}")
        return True
    else:
        print(f"❌ Dashboard failed: {response.json()}")
        return False

def run_all_tests():
    """Run all tests"""
    print("=" * 50)
    print("🚀 StriveX Backend Test Suite")
    print("=" * 50)
    
    # Test 1: Health check
    if not test_health():
        print("\n❌ Server is not running. Start it with: python app.py")
        return
    
    # Test 2: Registration
    token = test_registration()
    if not token:
        print("\n❌ Registration failed. Cannot continue tests.")
        return
    
    # Test 3: Onboarding
    if not test_onboarding(token):
        print("\n❌ Onboarding failed. Cannot continue tests.")
        return
    
    # Test 4: Goal creation
    goal_id = test_goal_creation(token)
    if not goal_id:
        print("\n❌ Goal creation failed. Cannot continue tests.")
        return
    
    # Test 5: Dashboard
    test_dashboard(token)
    
    print("\n" + "=" * 50)
    print("✅ All tests passed! StriveX backend is working!")
    print("=" * 50)
    print("\n📝 Next steps:")
    print("1. Open frontend/index.html in your browser")
    print("2. Create an account")
    print("3. Complete onboarding")
    print("4. Start using StriveX!")

if __name__ == "__main__":
    run_all_tests()
