# StriveX - Stripe Payment Setup Guide

## 🚀 Quick Start (15 minutes)

### Step 1: Create Stripe Account
1. Go to https://stripe.com
2. Click "Sign up" (free account)
3. Verify email and complete onboarding

### Step 2: Get API Keys
1. Go to https://dashboard.stripe.com/apikeys
2. Copy **Publishable key** → `STRIPE_PUBLISHABLE_KEY`
3. Click "Reveal test key" → Copy **Secret key** → `STRIPE_SECRET_KEY`
4. Add these to `backend/.env`

### Step 3: Create Products & Prices
1. Go to https://dashboard.stripe.com/products
2. Click "Add product"

**Product 1: Premium**
```
Name: StriveX Premium
Description: Unlimited AI breakdowns + advanced features
Pricing: Recurring → $4.99/month
```
3. After creating, copy the **Price ID** (starts with `price_`)
4. Add to `.env`: `STRIPE_PRICE_PREMIUM=price_xxxxx`

**Product 2: Pro**
```
Name: StriveX Pro
Description: Everything in Premium + team features
Pricing: Recurring → $9.99/month
```
5. Copy **Price ID** → Add to `.env`: `STRIPE_PRICE_PRO=price_xxxxx`

### Step 4: Setup Webhook (Local Development)

#### Install Stripe CLI:
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows (PowerShell as Admin)
winget install Stripe.StripeCLI

# Or download from: https://github.com/stripe/stripe-cli/releases
```

#### Login to Stripe CLI:
```bash
stripe login
# Press Enter to open browser
# Authorize the CLI
```

#### Forward webhooks locally:
```bash
# In a new terminal (keep running while testing)
stripe listen --forward-to localhost:5001/api/billing/webhook
```

This will output your **webhook signing secret**:
```
> Ready! Your webhook signing secret is: whsec_xxxxxxxxxxxxx
```

Copy this and add to `.env`: `STRIPE_WEBHOOK_SECRET=whsec_xxxxx`

### Step 5: Test Locally
```bash
# Terminal 1 - Backend
cd backend
python app.py

# Terminal 2 - Stripe CLI (keep running)
stripe listen --forward-to localhost:5001/api/billing/webhook

# Terminal 3 - Frontend
cd frontend-react
npm run dev
```

Go to http://localhost:3001/billing and click "Upgrade to Premium"

You'll be redirected to Stripe Checkout (hosted by Stripe).

### Step 6: Test Webhook Events

Trigger a test payment event:
```bash
stripe trigger checkout.session.completed
```

Check your backend logs - you should see:
```
✅ Subscription created: User 1 upgraded from free to premium
```

---

## 🔒 Security Features Implemented

### ✅ What Makes This Secure:

1. **Stripe Checkout (Not Self-Hosted)**
   - Payments happen on Stripe's domain (checkout.stripe.com)
   - You NEVER handle credit card data
   - PCI DSS compliant by default

2. **Webhook Signature Verification**
   ```python
   event = stripe.Webhook.construct_event(
       payload, sig_header, STRIPE_WEBHOOK_SECRET
   )
   ```
   - Verifies webhook actually came from Stripe
   - Prevents hackers from faking payment events
   - Uses HMAC signature (cryptographically secure)

3. **Client Reference ID**
   ```python
   client_reference_id=f"strivex_user_{user.id}"
   ```
   - Links Stripe session to your user
   - Prevents session tampering
   - Cannot be modified by client

4. **Database Email (Not Client Input)**
   ```python
   customer_email=user.email  # From database
   ```
   - User can't change email during checkout
   - Prevents fraud/account sharing

5. **Atomic Database Transactions**
   ```python
   try:
       # Update subscription
       db.session.commit()
   except:
       db.session.rollback()
   ```
   - All-or-nothing updates
   - Prevents partial/corrupted data

6. **Comprehensive Logging**
   ```python
   logger.info(f"✅ Subscription created: User {user.id}...")
   logger.error(f"Invalid webhook signature: {e}")
   ```
   - Audit trail for all payment events
   - Debugging and fraud detection

7. **Rate Limiting**
   ```python
   @app.route('/api/billing/create-checkout', methods=['POST'])
   # Flask-Limiter automatically limits to 5/minute
   ```
   - Prevents spam/abuse
   - Protects against DoS attacks

---

## 🎯 Production Deployment

### When Ready for Live Payments:

1. **Switch to Live Mode**
   - Go to Stripe Dashboard → Toggle "Test Mode" off
   - Get LIVE API keys (start with `sk_live_`, `pk_live_`)
   - Update `.env` with live keys

2. **Create Live Products**
   - Create products again in live mode
   - Get live Price IDs
   - Update `.env`

3. **Deploy Webhook**
   - Deploy your app (Railway/Render/Heroku)
   - Get production URL: `https://your-app.com`
   - Add webhook in Stripe Dashboard:
     ```
     Endpoint URL: https://your-app.com/api/billing/webhook
     Events to send:
       ✓ checkout.session.completed
       ✓ customer.subscription.updated
       ✓ customer.subscription.deleted
     ```

4. **Get Production Webhook Secret**
   - After creating webhook endpoint
   - Click "Reveal" next to Signing secret
   - Add to production env vars: `STRIPE_WEBHOOK_SECRET`

5. **Update Environment Variables**
   ```bash
   # Railway/Render dashboard
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_PREMIUM=price_...
   STRIPE_PRICE_PRO=price_...
   CORS_ORIGIN=https://your-domain.com
   ```

---

## 💰 Pricing Strategy

Your tiers are perfect:

| Tier | Price | Target |
|------|-------|--------|
| **Free** | $0 | Student users, testing |
| **Premium** | $4.99/mo | Serious individuals |
| **Pro** | $9.99/mo | Power users, teams |

**Revenue Projection:**
- 100 users → 5 convert to Premium = $25/mo
- 1,000 users → 50 Premium + 10 Pro = $350/mo
- 10,000 users → $3,500/mo recurring revenue

---

## 🛡️ Why Hackers Can't Copy This

### ❌ What They CAN'T Do:

1. **Fake Payment Events**
   - Webhook signature verification prevents this
   - Would need your `STRIPE_WEBHOOK_SECRET` (server-side only)

2. **Modify Session Data**
   - Checkout happens on Stripe's domain
   - Client can't modify price/tier

3. **Steal Credit Cards**
   - You never touch card data
   - Stripe handles everything

4. **Bypass Payment**
   - Subscription only activates after webhook
   - Webhook signed by Stripe (can't forge)

5. **Downgrade Without Permission**
   - Cancellation only via Stripe webhook
   - Requires actual cancellation in Stripe

### ✅ What Makes It Unique:

Your structure is NOT just code - it's:
- **Business logic** (tier design, pricing)
- **User experience** (smooth checkout flow)
- **Trust signals** (professional UI, clear value)
- **Network effects** (team features in Pro tier)

These are HARD to copy even if they see the code!

---

## 📊 Testing Scenarios

### Test These Flows:

1. **New Subscription**
   ```bash
   stripe trigger checkout.session.completed
   ```

2. **Subscription Update (Upgrade/Downgrade)**
   ```bash
   stripe trigger customer.subscription.updated
   ```

3. **Subscription Cancellation**
   ```bash
   stripe trigger customer.subscription.deleted
   ```

4. **Failed Payment**
   - Use test card: `4000000000009995` (declined)
   - Should show error, not crash

5. **Refund Flow** (Dashboard only)
   - Go to Stripe Dashboard → Payment
   - Click "Refund"
   - Check webhook fires correctly

---

## 🎨 UI Customization

### Brand Stripe Checkout:

In Stripe Dashboard → Settings → Branding:
- Upload your logo
- Set brand color (#5e6ad2)
- Add support contact

This makes checkout match your app perfectly!

---

## 🚦 Go-Live Checklist

Before launching:

- [ ] Tested all 3 subscription flows (create, update, cancel)
- [ ] Webhook signature verification working
- [ ] Error handling graceful (no crashes)
- [ ] Email notifications configured (optional)
- [ ] Customer portal working (manage/cancel)
- [ ] Switched to LIVE mode in Stripe
- [ ] Updated all environment variables
- [ ] Deployed webhook endpoint publicly
- [ ] Registered production webhook in Stripe
- [ ] Tested with real credit card (small amount)
- [ ] Refund tested successfully

---

## 📞 Support Resources

- **Stripe Docs**: https://stripe.com/docs
- **API Reference**: https://stripe.com/docs/api
- **Community**: https://support.stripe.com
- **Status Page**: https://status.stripe.com

**You're now ready to accept payments!** 💰🚀
