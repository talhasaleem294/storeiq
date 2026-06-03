# Integration Setup Guide

Step-by-step instructions for every external service this app uses.
Complete these before writing any code.

---

## 1. Supabase

### Step 1 — Create Project
1. Go to **app.supabase.com** → sign up with your dedicated business email
2. Click **New Project**
3. Name it (e.g. `yourappname-prod`)
4. Set a strong database password — **save it in a password manager**
5. Region: **Southeast Asia (Singapore)** — closest to Pakistan
6. Wait ~2 minutes for setup

### Step 2 — Get Your Keys
Go to **Settings → API Keys** and copy:

| Key | Where It Goes |
|---|---|
| Project URL | Frontend `.env` + Edge Functions |
| Publishable Key (`sb_publishable_xxx`) | Frontend `.env` only |
| Secret Key (`sb_secret_xxx`) | Edge Functions only — never frontend |

### Step 3 — Auth Configuration
Go to **Settings → Authentication**

- **Email provider:** Enable
- **Confirm email:** Enable (users must verify email)
- **Allow new users to sign up:** DISABLE — you want invite-only after launch
  - Keep enabled during development so you can create test accounts
  - Disable before going live with real clients
- **JWT expiry:** Leave at default 3600 seconds (1 hour)

### Step 4 — Configure Auth Redirect URLs
Go to **Settings → Authentication → URL Configuration**

Add these to **Redirect URLs:**
```
http://localhost:5173/auth/callback
http://localhost:5173/auth/accept-invite
https://yourapp.com/auth/callback
https://yourapp.com/auth/accept-invite
```

### Step 5 — Customize Email Templates
Go to **Authentication → Email Templates**

Customize these templates with your app name and branding:
- **Confirm signup** — sent when a new user registers
- **Invite user** — sent when Owner invites a team member
- **Reset password** — sent on forgot password

Important variable for invite template: `{{ .ConfirmationURL }}`

### Step 6 — Install Supabase CLI (on your machine)
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Your project ref is in **Settings → General** (the string after `supabase.co/project/`)

### Step 7 — Frontend Setup
```bash
npm install @supabase/supabase-js
```

Create `src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)
```

Create `.env.local` in project root:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
```

### Step 8 — Enable Realtime
In **Table Editor**, for each table that needs live updates:
- Click the table → scroll to **Replication** → toggle **Enable realtime**

Tables to enable realtime on: `shipments`, `ads_data`, `orders`

### Free Tier Limits to Know
| Resource | Limit |
|---|---|
| Database storage | 500 MB |
| Monthly active users | 50,000 |
| Edge Function calls | 500,000/month |
| Realtime connections | 200 concurrent |
| Active projects | 2 |

Free tier is sufficient for MVP. Upgrade to Pro ($25/mo) when you have paying clients.

---

## 2. Meta (For Ads Dashboard Only)

> No `pages_messaging` permission needed. This is purely read-only Ads API access.
> No Meta App Review required for this scope.

### Step 1 — Create Dedicated Facebook Account
1. Open a new browser profile (keep this separate from your personal Facebook)
2. Go to **facebook.com** → Create new account
3. Use your dedicated business email (not personal)
4. Complete phone verification

### Step 2 — Create Meta Business Portfolio
1. Go to **business.facebook.com**
2. Click **Create account**
3. Enter your business/app name
4. This Business Portfolio will own your Meta App

### Step 3 — Create Meta Developer Account
1. Go to **developers.facebook.com**
2. Click **Get Started**
3. Log in with the Facebook account you just created
4. Verify your account (phone number)
5. Accept developer terms

### Step 4 — Create a Meta App
1. Go to **developers.facebook.com/apps**
2. Click **Create App**
3. Select **Other** as use case
4. Select **Business** as app type
5. Enter app name (your product name)
6. Link it to your Business Portfolio
7. Click **Create App**

### Step 5 — Add Marketing API Product
1. In your app dashboard, click **Add Product**
2. Find **Marketing API** → click **Set Up**
3. This gives you access to Ads Insights (spend, ROAS, CTR)

### Step 6 — Get Your App Credentials
Go to **App Settings → Basic**

Copy and save:
- **App ID**
- **App Secret** (click Show)

These go into your Supabase Edge Function secrets — never in the frontend.

### Step 7 — Generate a Long-Lived System User Token
This is the token your app uses to call the Ads API on behalf of clients.

1. Go to **Business Settings → Users → System Users**
2. Click **Add** → create a System User (role: Admin)
3. Click **Generate New Token**
4. Select your App
5. Select these permissions:
   - `ads_read`
   - `ads_management` (read-only operations)
   - `business_management`
6. Click **Generate Token**
7. Copy and save this token securely

> This token does not expire (System User tokens are permanent unless revoked).
> Store it encrypted in your Supabase database per workspace.

### Step 8 — Note for Client Onboarding
When a client connects their Meta Ads account, they will:
1. Click "Connect Meta Ads" in your app
2. Go through OAuth → grant `ads_read` permission
3. Select their Ads Account ID
4. Your app stores their access token (encrypted) per workspace

The OAuth flow is handled by your Supabase Edge Function.
Client tokens expire every 60 days — build a reconnect prompt for this.

---

## 3. Shopify

### Step 1 — Create a Shopify Partner Account
1. Go to **partners.shopify.com**
2. Sign up with your business email
3. This account lets you create apps and test stores for free

### Step 2 — Create a Development Store (for testing)
1. In Partner Dashboard → **Stores → Add store**
2. Select **Development store**
3. This is your test Shopify store — free, no subscription needed
4. Add some fake orders so you have data to work with

### Step 3 — Create a Custom App in Partner Dashboard
1. Go to **Apps → Create app**
2. Select **Create app manually**
3. Enter app name
4. Enter App URL: `https://yourapp.com` (use localhost during dev)
5. Enter Redirect URL: `https://yourapp.com/auth/shopify/callback`

### Step 4 — Configure App Scopes
In your app → **Configuration → Admin API scopes**

Select these scopes:
```
read_orders
read_products
read_customers
read_inventory
read_fulfillments
read_shipping
```

That's all you need. Do not request write scopes you don't use.

### Step 5 — Get App Credentials
Go to **App credentials**

Copy and save:
- **Client ID** (API Key)
- **Client Secret**

These go into your Supabase Edge Function secrets.

### Step 6 — Set Up Webhooks
In your Shopify app → **Webhooks**

Register these webhook topics (point them to your Edge Function URL):
```
orders/create    → https://xxxxx.supabase.co/functions/v1/shopify-webhook
orders/updated   → https://xxxxx.supabase.co/functions/v1/shopify-webhook
orders/paid      → https://xxxxx.supabase.co/functions/v1/shopify-webhook
refunds/create   → https://xxxxx.supabase.co/functions/v1/shopify-webhook
```

### Step 7 — Note for Client Onboarding
When a client installs your app on their store:
1. They go to your app's install URL
2. Shopify OAuth flow starts
3. They approve the requested scopes on their store
4. Your Edge Function receives the access token
5. Token stored encrypted per workspace in your database

Shopify access tokens do not expire unless the client uninstalls your app.

---

## 4. Leopards Courier

### Step 1 — Create a Merchant Account
1. Go to **leopardscourier.com**
2. Contact their merchant team or sign up online as a shipper
3. You need a business account (not a personal account)
4. Alternatively email: **merchantapi@leopardscourier.com** and request API access

### Step 2 — Get API Credentials
Once your merchant account is approved, you receive:
- **API Key**
- **API Password**

Base API URL: `https://merchantapi.leopardscourier.com/api/`

### Step 3 — Key Endpoints You Will Use
```
POST /bookPacket         → Create a shipment
POST /trackBookedPacket  → Track shipment by tracking number
GET  /getCities          → List of available cities
POST /getPacketsByStatus → Filter shipments by status (delivered/returned)
```

### Step 4 — Authentication
All requests include credentials in the request body:
```json
{
  "api_key": "YOUR_API_KEY",
  "api_password": "YOUR_API_PASSWORD",
  ...request data
}
```

### Step 5 — Store in Supabase
Each client provides their own Leopards API Key + Password.
Store encrypted in `courier_connections` table per workspace.
Never hardcode your own credentials — each client has their own account.

---

## 5. PostEx

### Step 1 — Create a Merchant Account
1. Go to **postex.pk**
2. Sign up as a shipper/merchant
3. Complete business verification

### Step 2 — Get API Token
1. Log in to PostEx merchant portal
2. Go to **Settings → API Integration** or **Developers**
3. Generate your API token

### Step 3 — Key Endpoints You Will Use
```
POST /order/create          → Create shipment
GET  /order/track/{number}  → Track order
GET  /order/list            → List orders (with date + status filter)
GET  /cities                → Operational cities
GET  /order/payment-status  → COD payment status (critical for reconciliation)
```

### Step 4 — Authentication
All requests use Bearer token in header:
```
Authorization: Bearer YOUR_API_TOKEN
```

### Step 5 — COD Reconciliation
PostEx has a payment status endpoint — use this to build the COD reconciliation feature.
It tells you: how much COD was collected and whether it has been transferred to you.

### Step 6 — Store in Supabase
Same as Leopards — each client provides their own PostEx API token.
Store encrypted in `courier_connections` per workspace.

---

## 6. TCS

### Step 1 — Create a TCS Account
1. Go to **tcscourier.com** or contact TCS corporate sales
2. Sign up as a corporate/eCommerce shipper
3. Request API access from their tech team

### Step 2 — Access the Developer Portal
- Sandbox: **sandbox.tcscourier.com**
- Production: **envio.tcscourier.com**
- API Manual: **envio.tcscourier.com/COD-API-UserManual.pdf** (download and read this)

### Step 3 — Get OAuth Credentials
TCS uses OAuth 2.0:
1. You receive a **Client ID** and **Client Secret** from TCS
2. Call the auth endpoint to get an access token:
```
POST https://envio.tcscourier.com/ecom/api/authentication
```
3. Access token is short-lived — refresh it before each API session

### Step 4 — Complete UAT (Required)
TCS requires you to complete UAT (User Acceptance Testing) before production access:
1. Test all integration flows in sandbox
2. Submit UAT completion to TCS
3. They approve and grant production access

**Start this early — TCS approval can take a few days.**

### Step 5 — Key Endpoints You Will Use
```
POST /ecom/api/booking/create     → Create shipment
POST /ecom/api/tracking           → Track consignment by CN number
GET  /ecom/api/payment            → COD payment transaction retrieval
POST /ecom/api/booking/reverse    → Reverse pickup request
```

### Step 6 — Store in Supabase
Each client provides their TCS Client ID + Client Secret.
Store encrypted in `courier_connections` per workspace.

---

## 7. Trax (Post-MVP)

### Current Status
Trax has an API (confirmed — they have a Shopify integration) but documentation is not publicly available.

### What To Do
1. Go to **trax.pk**
2. Contact: **[email protected]** or call **021-111-11-8729**
3. Request API documentation and merchant API access
4. Add "Trax — Coming Soon" placeholder in the courier settings UI

Once you receive docs, the integration pattern will be similar to Leopards/PostEx.

---

## Credentials Checklist

Before writing any code, collect and store these in a password manager:

### Supabase
- [ ] Project URL
- [ ] Publishable Key (frontend)
- [ ] Secret Key (Edge Functions only)
- [ ] Database password

### Meta
- [ ] App ID
- [ ] App Secret
- [ ] System User long-lived token

### Shopify
- [ ] Client ID (API Key)
- [ ] Client Secret

### Leopards (your test account for development)
- [ ] API Key
- [ ] API Password

### PostEx (your test account for development)
- [ ] API Token

### TCS
- [ ] Client ID
- [ ] Client Secret
- [ ] UAT approval confirmation

---

## Supabase Edge Function Secrets

Once you have all credentials, store them as Edge Function secrets:

```bash
supabase secrets set META_APP_ID=your_value
supabase secrets set META_APP_SECRET=your_value
supabase secrets set SHOPIFY_CLIENT_ID=your_value
supabase secrets set SHOPIFY_CLIENT_SECRET=your_value
supabase secrets set SITE_URL=https://yourapp.com
```

Client-specific credentials (Leopards key, PostEx token per client) are stored
**encrypted in the database** — not as Edge Function secrets — since each client
has different credentials.

---

## Priority Order

Do these in this order to unblock development as fast as possible:

1. **Supabase** — set up today, blocks everything else
2. **Shopify Partner account + dev store** — needed to test profit dashboard
3. **Meta Developer account + app** — needed for ads dashboard
4. **Leopards merchant account** — contact them for API docs
5. **PostEx merchant account** — sign up online
6. **TCS** — contact corporate, start UAT process early (takes longest)
7. **Trax** — contact for docs, add as coming soon in UI
