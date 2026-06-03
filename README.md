# StoreIQ

> See your real Shopify profit and spot which ads are draining your budget — all in one dashboard.

A lightweight SaaS for Shopify / eCommerce brands in Pakistan. Connect your Shopify store and Meta Ads account to get a single dashboard showing true net profit after refunds and ad spend.

## Tech Stack

- **Frontend:** React 19 + Vite 8, TypeScript 6, Tailwind CSS v4, React Router v7
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **APIs:** Shopify Admin GraphQL API, Meta Graph API v21.0

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template and fill in your keys
cp .env.example .env

# 3. Start the dev server
npm run dev
# → http://localhost:5173
```

**Required `.env` keys:**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=   # JWT format (eyJhbGci...), not sb_publishable_...
VITE_SHOPIFY_CLIENT_ID=
VITE_META_APP_ID=
```

## Edge Functions (Supabase)

```bash
# Deploy all functions
supabase functions deploy

# meta-oauth must be deployed without JWT verification (Meta callback has no user JWT)
supabase functions deploy meta-oauth --no-verify-jwt

# Apply DB migrations
echo "Y" | supabase db push
```

## Project Structure

```
src/
├── pages/        # Landing, Login, Signup, Workspaces, Dashboard, Profit, Ads, Settings
├── components/   # UI library (Button, Card, Input, Badge, Skeleton, EmptyState)
├── hooks/        # useAuth, useWorkspace, useOrders, useAdsData, useShopifyConnection, useMetaConnection
├── lib/          # supabase client, formatters, constants
└── router/       # Route guards + nested layout routes

supabase/
├── functions/    # shopify-oauth, shopify-webhook, shopify-sync, meta-oauth, meta-sync
└── migrations/   # 4 applied migrations
```

See [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) for full architecture, decisions log, and build status.
