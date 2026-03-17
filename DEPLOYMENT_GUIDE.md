# StriveX Deployment & Play Store Guide 🚀

Follow these steps in order to get StriveX live and onto the Google Play Store.

---

## Part 1: Backend Deployment (Railway.app)

Railway is recommended for the backend because it handles databases and Python servers very easily.

1.  **Sign up** at [Railway.app](https://railway.app/) using your GitHub account.
2.  **Create a New Project**: Click "+ New Project" -> "Deploy from GitHub repo" -> Select `StriveX`.
3.  **Settings**:
    - Under **Variables**, click "Add Variable" for each of these:
        - `SECRET_KEY`: (Generate a long random string)
        - `DATABASE_URL`: Click "Add Service" -> "PostgreSQL". Railway will automatically link this.
        - `CORS_ORIGIN`: Set this to your Vercel URL later (e.g., `https://strivex.vercel.app`).
        - `GEMINI_API_KEY`: Your Google AI key.
        - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: (If using Google Login).
        - `LOG_FILE`: `none` (Vercel/Railway are read-only).
    - Under **Start Command**, ensure it uses `waitress` or `gunicorn`:
      `cd backend && python -m waitress --port=$PORT app:app`
4.  **Deploy**: Railway will build the container from the `Dockerfile`.
5.  **Get your URL**: Go to "Settings" -> "Public Networking" -> "Generate Domain".
    - Example: `https://strivex-production.up.railway.app`
    - **Note this URL — you will need it for the frontend.**

---

## Part 2: Frontend Deployment (Vercel)

Vercel will host your website/PWA.

1.  **Sign up** at [Vercel.com](https://vercel.com/) with GitHub.
2.  **Add New Project**: Select `StriveX`.
3.  **Configure**:
    - **Framework Preset**: Vercel should automatically detect **Vite** (since the React app uses Vite).
    - **Root Directory**: `frontend-react` (important!)
    - **Environment Variables**:
        - `VITE_API_URL`: Set this to your Railway URL + `/api` (e.g., `https://strivex-production.up.railway.app/api`).
4.  **Deploy**: Vercel will give you a live URL.
    - Example: `https://strivex.vercel.app`
5.  **Go back to Railway**: Update the `CORS_ORIGIN` variable in Railway to match this new Vercel URL.

---

## Part 3: Play Store Submission (PWABuilder)

Now that your app is live on Vercel, you can turn it into an Android app.

1.  **Capturing Screenshots**:
    - Open your Vercel URL in Chrome.
    - Press `F12` -> Toggle Device Toolbar (mobile icon).
    - Take two screenshots and save them as:
        - `frontend-react/public/icons/screenshot-mobile.png` (390×844)
        - `frontend-react/public/icons/screenshot-desktop.png` (1280×800)
    - *Tip: You can just use any image editor to resize screenshots to these exact dimensions.*
2.  **PWABuilder**: 
    - Visit [pwabuilder.com](https://www.pwabuilder.com/).
    - Enter your Vercel URL and click **Start**.
    - It should show all green checks for Manifest and Service Worker.
    - Click **Package for Store** -> **Android**.
3.  **Android Options**:
    - **Package ID**: Use `com.shru089.strivex`.
    - **App Name**: StriveX.
    - Download the **Digital Asset Links** (`assetlinks.json`).
4.  **Final Code Step**:
    - Place the `assetlinks.json` inside `.well-known` folder in your React public folder.
    - Path should be: `frontend-react/public/.well-known/assetlinks.json`
    - Commit and push to GitHub. This proves to Google that you own the website.
5.  **Play Console**:
    - Log in to your Google Play Console ($25 one-time fee).
    - Create an App.
    - Upload the `.aab` file you got from PWABuilder.
    - Upload your screenshots and icons.
    - Submit for Review (takes 3-7 days).

---

## Summary Checklist
- [ ] Backend live on Railway.
- [ ] Database connected.
- [ ] Frontend live on Vercel.
- [ ] Vercel linked to Railway via `STRIVEX_API_URL`.
- [ ] Screenshots created.
- [ ] `.aab` generated via PWABuilder.
- [ ] Submitted to Play Store.
