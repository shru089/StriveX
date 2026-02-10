# 🚀 Deploy StriveX

## Option 1: Vercel (Recommended for Full-Stack)

### Deploy Backend + Frontend Together

1. **Install Vercel CLI**:
```bash
npm i -g vercel
```

2. **Deploy**:
```bash
cd c:\Users\admini\Desktop\StriveX
vercel
```

3. **Follow prompts**:
   - Set up and deploy: Yes
   - Which scope: Your account
   - Link to existing project: No
   - Project name: strivex
   - Directory: ./
   - Override settings: No

4. **Environment Variables** (in Vercel Dashboard):
   - `SECRET_KEY`: your-secret-key-here
   - `DATABASE_URL`: (use Vercel Postgres or external DB)

---

## Option 2: Netlify (Frontend) + Render (Backend)

### Frontend on Netlify

1. **Deploy via Netlify CLI**:
```bash
npm i -g netlify-cli
cd c:\Users\admini\Desktop\StriveX
netlify deploy
```

2. **Or via Netlify Dashboard**:
   - Drag and drop the `frontend` folder
   - Build command: (leave empty)
   - Publish directory: `frontend`

### Backend on Render

1. Go to [render.com](https://render.com)
2. New Web Service
3. Connect GitHub repo or upload `backend` folder
4. Settings:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`
   - Add environment variables

---

## Option 3: Local Development (Quick Test)

### Start Backend:
```powershell
cd c:\Users\admini\Desktop\StriveX\backend
python app.py
```

### Open Frontend:
Just open `frontend/index.html` in your browser!

Or use Live Server in VS Code.

---

## 🎨 Frontend-Only Deploy (Static)

If you want to deploy just the frontend first:

### Vercel:
```bash
cd frontend
vercel
```

### Netlify:
```bash
cd frontend
netlify deploy
```

**Note**: Update `API_URL` in `frontend/js/auth.js` to your backend URL.

---

## 📝 Pre-Deploy Checklist

- [ ] Update `API_URL` in `frontend/js/auth.js`
- [ ] Set `SECRET_KEY` environment variable
- [ ] Configure CORS in `backend/app.py`
- [ ] Test locally first
- [ ] Add `.gitignore` for sensitive files

---

## 🔐 Environment Variables Needed

### Backend:
- `SECRET_KEY` - Random secret key for JWT
- `DATABASE_URL` - PostgreSQL URL (for production)
- `CORS_ORIGIN` - Your frontend URL

### Frontend:
- Update `API_URL` in `js/auth.js` to backend URL

---

## 🎯 Quick Deploy Commands

### Vercel (Full Stack):
```bash
vercel --prod
```

### Netlify (Frontend Only):
```bash
netlify deploy --prod
```

---

**Your site will be live at**: `https://strivex.vercel.app` or `https://strivex.netlify.app`
