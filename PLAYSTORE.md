# StriveX → Google Play Store Guide

## How it works
StriveX is a PWA (Progressive Web App). To publish it on the Play Store, we use a **TWA (Trusted Web Activity)** — a free Google-supported method that wraps a deployed web app in a native Android shell.

---

## Prerequisites
- [ ] StriveX deployed to a public HTTPS URL (e.g. via Netlify or Vercel)
- [ ] Google Play Developer account ($25 one-time fee) — [console.play.google.com](https://play.google.com/console)
- [ ] Screenshots for the Play Store listing

---

## Step 1 — Deploy StriveX

Deploy to Netlify (already configured in `netlify.toml`):

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=frontend
```

Or push to your Git repo — Netlify auto-deploys. Your public URL will look like:
`https://strivex-yourname.netlify.app`

---

## Step 2 — Take Screenshots for the Play Store

The manifest already references two screenshot files you need to create:

| File | Size | How to capture |
|------|------|----------------|
| `frontend/icons/screenshot-mobile.png` | 390×844 px | DevTools → iPhone 14 Pro size → screenshot |
| `frontend/icons/screenshot-desktop.png` | 1280×800 px | Browser window → full-page screenshot |

Minimum: **2 screenshots** required by Play Store (max 8).

---

## Step 3 — Generate TWA Package with PWABuilder

1. Go to **[pwbuilder.com](https://www.pwabuilder.com)**
2. Paste your Netlify URL (e.g. `https://strivex-app.netlify.app`)
3. Click **Start** → it validates your manifest & service worker
4. Click **Package for Stores** → **Google Play Store**
5. Fill in:
   - Package name: `com.strivex.app`
   - App version: `1`
   - App version name: `1.0.0`
   - Signing key: let PWABuilder generate one (save the `.keystore` file safely!)
6. Click **Generate** — download the `.aab` file

---

## Step 4 — Submit to Play Store

1. Go to [Google Play Console](https://play.google.com/console)
2. **Create app** → set name, language, app/game, free/paid
3. Go to **Production** → **Releases** → **Create new release**
4. Upload the `.aab` file from PWABuilder
5. Fill in the store listing:
   - **Title**: StriveX — The Decision Engine
   - **Short description** (80 chars): AI-powered scheduler that eliminates decision fatigue
   - **Full description**: copy from `README.md`
   - **Icons**: upload `icons/icon-512.png` as the hi-res icon
   - **Screenshots**: upload the files from Step 2
   - **Category**: Productivity
6. Complete the **Content rating questionnaire** (takes ~5 min)
7. Set up **Pricing & distribution** (free, all countries)
8. Click **Submit for review**

Review typically takes **3–7 business days**.

---

## Step 5 — Digital Asset Links (Required!)

Play Store TWAs require you to verify domain ownership. After submitting:

1. PWABuilder will give you an `assetlinks.json` file
2. Host it at: `https://yourdomain.com/.well-known/assetlinks.json`

For Netlify, create `frontend/.well-known/assetlinks.json` with the content PWABuilder provides, then redeploy.

---

## File Checklist

```
frontend/
├── manifest.json          ✅ Play Store compliant
├── sw.js                  ✅ v2 with offline fallback
├── offline.html           ✅ Offline fallback page
├── icons/
│   ├── icon-192.png       ✅ Generated
│   ├── icon-512.png       ✅ Generated
│   ├── screenshot-mobile.png   ⬜ YOU NEED TO CAPTURE
│   └── screenshot-desktop.png  ⬜ YOU NEED TO CAPTURE
└── .well-known/
    └── assetlinks.json    ⬜ From PWABuilder after signing
```

---

## Quick Audit

Run this in Chrome DevTools → Lighthouse → select "Progressive Web App" to verify everything passes before submitting:

- ✅ Installable
- ✅ Service Worker
- ✅ Manifest with icons
- ✅ Offline fallback
- ✅ HTTPS (automatic on Netlify/Vercel)
