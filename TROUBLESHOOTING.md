# 🔧 Troubleshooting Login Issues

## Quick Fix Checklist

### ✅ Step 1: Make Sure Backend is Running

Open a terminal and run:
```powershell
cd c:\Users\admini\Desktop\StriveX\backend
python app.py
```

You should see:
```
 * Running on http://127.0.0.1:5000
```

**Keep this terminal open!**

---

### ✅ Step 2: Make Sure Frontend is Running

Open ANOTHER terminal and run:
```powershell
cd c:\Users\admini\Desktop\StriveX
python serve_frontend.py
```

You should see:
```
Open in browser: http://localhost:3000
```

---

### ✅ Step 3: Open the Website

Open your browser and go to:
**http://localhost:3000**

(NOT file:///c:/Users/... - use the server!)

---

## Common Errors & Solutions

### Error: "Connection error. Please make sure the backend server is running"

**Problem**: Backend isn't running or wrong port

**Solution**:
1. Check if backend terminal is running
2. Make sure it says "Running on http://127.0.0.1:5000"
3. Try visiting http://localhost:5000/api/health in browser
   - Should show: `{"status":"healthy"}`

---

### Error: "CORS policy" or "Access-Control-Allow-Origin"

**Problem**: Opening index.html directly instead of using server

**Solution**:
- DON'T open `file:///c:/Users/admini/Desktop/StriveX/frontend/index.html`
- DO use: http://localhost:3000

---

### Error: "Email already registered"

**Problem**: You already created an account with that email

**Solution**:
- Use the login form instead
- OR use a different email
- OR delete the database: `backend/strivex.db` and restart backend

---

### Error: "Invalid credentials"

**Problem**: Wrong email or password

**Solution**:
- Check your email/password
- Passwords are case-sensitive
- Try creating a new account

---

## Test the Backend Directly

### Test Health Endpoint:
Open browser: http://localhost:5000/api/health

Should show:
```json
{
  "status": "healthy",
  "message": "StriveX API is running"
}
```

### Test Registration (using curl or Postman):
```powershell
curl -X POST http://localhost:5000/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","password":"test123"}'
```

Should return a token.

---

## Complete Fresh Start

If nothing works, try this:

### 1. Stop Everything
- Close all terminals
- Close browser

### 2. Delete Database
```powershell
cd c:\Users\admini\Desktop\StriveX\backend
del strivex.db
```

### 3. Start Backend
```powershell
cd c:\Users\admini\Desktop\StriveX\backend
python app.py
```

### 4. Start Frontend
```powershell
cd c:\Users\admini\Desktop\StriveX
python serve_frontend.py
```

### 5. Open Browser
http://localhost:3000

### 6. Create New Account
- Email: test@strivex.com
- Password: test123

---

## Check Browser Console

1. Open browser (http://localhost:3000)
2. Press F12 (Developer Tools)
3. Go to "Console" tab
4. Try to login
5. Look for red error messages

Common console errors:

### "Failed to fetch"
→ Backend not running

### "CORS error"
→ Using file:// instead of http://localhost:3000

### "401 Unauthorized"
→ Wrong credentials

### "404 Not Found"
→ Wrong API URL in auth.js

---

## Verify Setup

### Backend Running?
```powershell
# In terminal, you should see:
 * Serving Flask app 'app'
 * Running on http://127.0.0.1:5000
```

### Frontend Running?
```powershell
# In terminal, you should see:
Open in browser: http://localhost:3000
```

### Browser URL?
Should be: `http://localhost:3000`
NOT: `file:///c:/Users/...`

---

## Still Not Working?

### Check the error message carefully:

1. **"Connection error. Please make sure the backend server is running"**
   → Backend not running on port 5000

2. **"Login failed. Please check your credentials"**
   → Wrong email/password

3. **"Email already registered"**
   → Account exists, use login instead

4. **"Password must be at least 6 characters"**
   → Password too short

---

## Quick Test Account

Try these credentials:
- Email: `test@strivex.com`
- Password: `test123`

If this doesn't exist, create it first with signup.

---

## Need More Help?

1. Check browser console (F12)
2. Check backend terminal for errors
3. Make sure both servers are running
4. Use http://localhost:3000 (not file://)

---

**Most common issue**: Backend not running!

**Solution**: Open terminal, `cd backend`, `python app.py`
