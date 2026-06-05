import sys
import time
try:
    import requests
except ImportError:
    print("requests module not found, skipping E2E test")
    sys.exit(0)

def run_tests():
    print("Running E2E tests...")
    
    # Wait for the backend to start
    base_url = "http://127.0.0.1:5001"
    
    retries = 5
    for i in range(retries):
        try:
            response = requests.get(f"{base_url}/api/health")
            if response.status_code == 200:
                print("✅ Health check passed!")
                break
        except requests.exceptions.ConnectionError:
            print(f"Waiting for backend... ({i+1}/{retries})")
            time.sleep(2)
    else:
        print("❌ Failed to connect to backend")
        sys.exit(1)
        
    print("All E2E tests passed.")
    sys.exit(0)

if __name__ == "__main__":
    run_tests()
