# StoreIQ — Project Context

## What We Are Building

A lightweight SaaS product for Shopify / eCommerce brands in Pakistan that gives store owners one dashboard to see their real profit and track ad performance.

**The core problem it solves:**
> "I run a Shopify store. I spend money on ads, I get orders, but at the end of the month I have no idea if I actually made money or lost money."

Target: 5–10 paying clients to validate demand before scaling.
Timeline: 3–4 weeks MVP (solo developer).

---

## Target Users

- Shopify store owners / eCommerce brands
- Small to mid-size businesses running Meta ads
- Users who may own or manage multiple Shopify stores
- Initial market: Pakistan

---

## Core Features (MVP Scope)

### 1. Shopify Profit Dashboard

**Data pulled from Shopify API:**
- Revenue
- Refunds
- Returns

**Formula:**
```
Net Profit = Revenue - Ad Spend - Refunds - Returns
```

- Monthly and weekly breakdown
- No complex reconciliation logic for MVP
- Cache Shopify API responses aggressively (rate limit: ~2 calls/sec per store)

---

### 2. Meta Ads Performance Dashboard

**Metrics shown (MVP):** ✅ COMPLETE
- Ad Spend (toggle: USD ↔ PKR via `USD_TO_PKR_RATE` constant)
- ROAS (Return on Ad Spend)
- CTR (Click Through Rate)
- Campaign Status (Active / Paused / Archived) — requires migration 20240005 + meta-sync redeploy
- Top campaigns by spend (paginated display, last 30 days synced)
- Date filter: 7 days / 30 days (filters locally from synced data)
- Low ROAS alert banner — shown when any campaign ROAS < 1.0 and spend > 0
- CSV export of campaign data

**Performance badge logic:**
- ROAS ≥ 2.0x → **Good** (green)
- ROAS ≥ 1.0x → **Break-even** (orange)
- ROAS < 1.0x → **Losing** (red)

**Data sync:** `meta-sync` Edge Function fetches `last_30d` from Meta Insights API on page load (once per session via `useRef`). Also fetches current `effective_status` for each campaign via a separate `/campaigns` call before the insights loop.

**Currency note:** Meta returns `spend` in the ad account's billing currency. Pakistani ad accounts bill in PKR, so `spend` is stored as PKR in `ads_data`. The PKR toggle shows the raw stored value; the USD toggle divides by `USD_TO_PKR_RATE` to convert.

**Alerts:**
- Low ROAS banner — shown in UI when campaigns have ROAS < 1.0 (client-side, no cron)
- ROAS drop email alert — cron job deferred to post-MVP

**Deferred metrics (post-MVP):**
- CPM, CPC, Frequency
- Ad fatigue detection
- Winning campaign detection
- Date range beyond 30 days on Ads page (re-sync for custom ranges)

---

### 3. Manual Payment System (MVP Only)

- No Stripe or PayPal in MVP
- Clients pay via bank transfer
- Admin manually activates account in admin panel
- Subscription status tracked in database (active / inactive / trial)
- Billing unit is per workspace (one plan per store)
- Simple admin panel to manage client accounts

---

## Deferred Features

### Courier / RTO Tracking — Post-MVP (Paid Upgrade)
Shopify already provides refunds and returns data which is sufficient for the profit formula.
Full courier integration (Leopards, PostEx, TCS, Trax) with RTO rate tracking and COD
reconciliation will be added as a Pro plan feature once there are paying clients.

| Courier | API Status | When |
|---|---|---|
| Leopards | Confirmed REST API | Post-MVP |
| PostEx | Confirmed REST API | Post-MVP |
| TCS | Confirmed REST API | Post-MVP |
| Trax | API exists, no public docs | Post-MVP |
| Dex | No public API (B2B only) | Excluded |

### Google Ads Integration — Post-MVP
YouTube and Google Search/Display ad insights deferred due to Google Ads API developer
token approval process (manual review, 1–2 weeks). Will add once there are paying clients
who explicitly need it.

**Plan when building:**
- OAuth scope: `https://www.googleapis.com/auth/adwords` (Google Cloud project + consent screen required)
- New Edge Function: `google-ads-sync` — fetches campaign-level spend, ROAS, CTR from Google Ads API
- Add `source text DEFAULT 'meta'` column to `ads_data` to distinguish Meta vs Google rows
- YouTube-specific metrics (views, view rate, CPV) may need additional columns
- Ads page: source filter toggle (All / Meta / Google) + combined totals across both

### Omnichannel Inbox — Post-MVP
Instagram DM + Facebook Messenger unified inbox deferred due to Meta App Review
dependency (`pages_messaging` permission). Will build once there are paying clients.

---

## Multi-Tenancy — Workspace Model

### The Problem
A single user may own or manage multiple Shopify stores (different brands). Tying one
account to one store would force them to create separate logins — bad UX.

### The Solution — Workspaces
One user login, multiple workspaces. Each workspace represents one store with its own
Shopify and Meta connections. Think Slack — one account, switch between workspaces freely.

```
Ahmed (one login)
    |
    |-- Owner of "Brand A Store"       ← his own store
    |-- Admin of "Brand B Store"       ← his partner's store, invited him
```

### Key Rules
- One user can belong to multiple workspaces
- One workspace can have multiple users (members)
- Every workspace has exactly one Owner (the creator)
- Billing is per workspace (each store = one subscription)
- All data (orders, ads) is scoped to `workspace_id`

---

## Role Based Access Control (RBAC)

### Roles

| Role | Permissions | MVP? |
|---|---|---|
| **Owner** | Full access — settings, billing, delete workspace, manage members | Yes |
| **Admin** | Full access except billing and workspace deletion; can invite members (any role) and remove Supervisors | Yes |
| **Supervisor** | Read-only — dashboards only; Settings tab hidden/blocked | Yes ✅ |

### Invite Flow (MVP) ✅ COMPLETE
1. Owner or Admin opens workspace Settings → Members
2. Enters email + selects role (Admin or Supervisor) → clicks Send Invite
3. `workspace-invite` Edge Function creates a row in `workspace_invites`, calls `supabase.auth.admin.inviteUserByEmail` with metadata (`pending_workspace_id`, `pending_role`, `invite_token`)
4. Invitee receives Supabase invite email → clicks link → lands on `/auth/callback` with `type=invite`
5. `AuthCallback.tsx` detects invite, calls `accept_workspace_invite` RPC → user added to `workspace_members` → redirected to `/set-password?workspaceId=xxx`
6. User sets a password on `/set-password` → redirected to workspace dashboard (ensures they can log back in after signing out)
6. Owner can remove any member; Admin can only remove Supervisors

### Role Permissions Detail

| Action | Owner | Admin | Supervisor |
|---|---|---|---|
| View dashboards | Yes | Yes | Yes |
| Connect / reconnect Shopify | Yes | Yes | No |
| Connect / reconnect Meta | Yes | Yes | No |
| Access Settings tab | Yes | Yes | No (Access Denied card) |
| Invite members | Yes | Yes | No |
| Remove members | Yes | Supervisors only | No |
| Change member roles | Yes | No | No |
| Manage billing / subscription | Yes | No | No |
| Delete workspace | Yes | No | No |

### Permissions Module
All permissions are defined in `src/lib/permissions.ts` as a central `ROLE_PERMISSIONS` map.
To add a new permission or role in the future: **one line change** in that file, nothing else.

```typescript
// src/lib/permissions.ts — single source of truth
type Permission = 'settings:view' | 'integrations:manage' | 'members:invite' | 'members:remove' | 'members:view'
const ROLE_PERMISSIONS: Record<WorkspaceMemberRole, ReadonlySet<Permission>> = { ... }
export function hasPermission(role, permission): boolean
```

### MVP Behaviour
- Every user who creates a workspace is automatically assigned `Owner` (via DB trigger)
- Owner and Admin can invite new members (Admin or Supervisor role)
- Supervisor: Settings nav item hidden in AppLayout; direct URL access to `/settings` shows "Access Denied" card
- Admin cannot change roles of other Admins or the Owner — Owner-only privilege

---

## URL Structure

Single domain, path-based routing. No subdomains for MVP.

```
yourapp.com                                   ← landing / marketing page
yourapp.com/login                             ← auth (GuestGuard: redirects to /workspaces if logged in)
yourapp.com/signup                            ← auth (GuestGuard: redirects to /workspaces if logged in)
yourapp.com/signup?plan=growth                ← auth with pre-selected plan; plan cards shown inline if no ?plan param
yourapp.com/auth/callback                     ← Supabase email confirmation, invite acceptance + password reset redirect
yourapp.com/auth/accept-invite                ← alias for /auth/callback (invite redirect target)
yourapp.com/workspaces                        ← list + create workspaces
yourapp.com/app/[workspace-id]/dashboard      ← profit overview
yourapp.com/app/[workspace-id]/profit         ← profit dashboard
yourapp.com/app/[workspace-id]/ads            ← meta ads dashboard
yourapp.com/app/[workspace-id]/settings       ← connect shopify, meta, manage members
yourapp.com/app/[workspace-id]/profile        ← user profile (name, phone, password)
yourapp.com/admin                             ← your internal admin panel (auto-redirect for admin@storeiq.com)
```

---

## Database Schema

All tables deployed to Supabase project `wotnhebzmrrkeplgohiq`.

```sql
-- Core auth (managed by Supabase Auth)
auth.users
  id, email, created_at

-- Workspaces (one per store)
workspaces
  id uuid default gen_random_uuid()
  name text
  owner_user_id uuid → auth.users(id)
  subscription_status text  -- 'active' | 'inactive' | 'trial'
  created_at timestamptz

-- Membership + RBAC
workspace_members
  workspace_id uuid → workspaces(id)
  user_id uuid → auth.users(id)
  role text  -- 'owner' | 'admin' | 'supervisor'
  created_at timestamptz
  PRIMARY KEY (workspace_id, user_id)

-- Pending invites (sent but not yet accepted)
workspace_invites
  id uuid, workspace_id, invited_email, role ('admin'|'supervisor'), invited_by, token uuid, accepted_at, expires_at (7 days), created_at
  UNIQUE INDEX on (workspace_id, invited_email) WHERE accepted_at IS NULL  -- prevents duplicate pending invites

-- Integrations (per workspace)
shopify_connections
  id uuid, workspace_id, shop_domain, access_token, token_expires_at
  UNIQUE (workspace_id)   -- one Shopify store per workspace

meta_connections
  id uuid, workspace_id, ads_account_id, access_token, token_expires_at
  UNIQUE (workspace_id)

-- Data tables (all scoped to workspace_id)
orders
  id uuid, workspace_id, shopify_order_id, revenue, refund_amount, status, created_at
  UNIQUE (workspace_id, shopify_order_id)

ads_data
  id uuid, workspace_id, campaign_id, campaign_name, spend, roas, ctr, date, status (DEFAULT 'UNKNOWN')
  UNIQUE (workspace_id, campaign_id, date)

-- workspaces also has (added migration 20240006):
--   selected_plan text DEFAULT NULL  — plan key chosen on landing page (starter/growth/pro/agency)
-- workspaces also has (added migration 20240008):
--   trial_started_at timestamptz DEFAULT NOW()  — used for trial countdown banner
```

**RLS:** Every table has Row Level Security. All reads/writes scoped through `is_workspace_member()`, `is_workspace_owner()`, and `is_workspace_owner_or_admin()` helper functions.

**Trigger:** `handle_workspace_created()` — fires after workspace insert, auto-inserts creator into `workspace_members` as `owner`.

**RPCs (security definer):**
- `create_workspace(workspace_name text)` — used instead of direct INSERT to reliably resolve `auth.uid()`
- `get_workspace_members_with_email(ws_id uuid)` — joins `workspace_members` with `auth.users` to expose emails; owner/admin only
- `remove_workspace_member(ws_id uuid, target_user_id uuid)` — enforces: owner can remove anyone (except themselves), admin can only remove supervisors
- `accept_workspace_invite(invite_token uuid)` — validates token, upserts into `workspace_members`, marks invite accepted, returns `{ workspace_id, role }`

**Migrations applied:**
- `20240001000000_initial_schema.sql` — all 6 tables, RLS, trigger, helper functions, indexes
- `20240002000000_fix_grants_and_workspace_rpc.sql` — explicit GRANT statements + `create_workspace` RPC
- `20240003000000_fix_shopify_connection_delete.sql` — `GRANT DELETE` on `shopify_connections` + DELETE RLS policy for owner/admin roles
- `20240004000000_fix_meta_connection_delete.sql` — `GRANT DELETE` on `meta_connections` + DELETE RLS policy for owner/admin roles (same pattern as migration 3)
- `20240005000000_add_campaign_status.sql` — adds `status text DEFAULT 'UNKNOWN'` to `ads_data` ✅ applied
- `20240006000000_add_plan_and_admin.sql` — adds `selected_plan text` to `workspaces`, updates `create_workspace` RPC to accept `selected_plan`, adds `admin_get_all_workspaces()` + `admin_set_subscription_status()` security definer RPCs, seeds test admin user `admin@storeiq.com` ✅ applied
- `20240007000000_invite_and_supervisor_role.sql` — adds `supervisor` role, `workspace_invites` table, `is_workspace_owner_or_admin()` helper, updated RLS on `workspace_members` (admins can invite/remove supervisors), 4 new security definer RPCs ✅ applied
- `20240008000000_add_trial_started_at.sql` — adds `trial_started_at timestamptz DEFAULT NOW()` to `workspaces`, backfills existing trial rows from `created_at` ✅ applied

---

## Tech Stack

### Frontend
- **React 19 + Vite 8** (not Next.js) — fast SPA, static build output
- **React Router v7** — nested layout routes with route guards
- **TypeScript 6** — strict mode, `erasableSyntaxOnly: true` (no `enum`, use string unions)
- **Tailwind CSS v4** — `@tailwindcss/vite` plugin, `@theme` in CSS, no `tailwind.config.ts`
- **clsx** — conditional class composition
- **recharts** — `AreaChart` for Revenue vs Refunds trend chart

### Backend / Database
- **Supabase** (project: `wotnhebzmrrkeplgohiq`, region: Tokyo)
  - PostgreSQL — primary database
  - Supabase Auth — email/password auth, session management
  - Supabase Edge Functions (Deno) — all server-side logic
  - Row Level Security — workspace-level data isolation

### APIs
- **Shopify Admin API** — orders, revenue, refunds (OAuth + webhooks) — **integrated**
- **Meta Graph API v21.0** — Ads data (spend, ROAS, CTR) — **integrated**

### Hosting
- **Vercel** or **Cloudflare Pages** — static React build (not yet deployed)
- Supabase Edge Functions handle all server-side logic

---

## Architecture Overview

```
React (Vite) SPA  [localhost:5173 / yourapp.com]
    |
    |-- Supabase Client (anon JWT key → auth + RLS-scoped DB queries)
    |-- Supabase Edge Functions (Deno)
         |
         |-- shopify-oauth         → OAuth token exchange, webhook reg, initial sync
         |-- shopify-webhook       → receive order/refund events, upsert into orders
         |-- shopify-sync          → on-demand historical order sync (GraphQL, last 90 days)
         |-- shopify-token-connect → save API token directly (bypasses OAuth for dev/testing)
         |-- meta-oauth            → Meta OAuth callback, token exchange, save ads_account_id
         |-- meta-sync             → fetch last 30d campaign insights, upsert into ads_data
         |-- workspace-invite      → validate caller role, create invite row, send Supabase invite email

Supabase PostgreSQL (RLS enforced)
    |-- workspaces, workspace_members
    |-- shopify_connections (access_token server-side only)
    |-- meta_connections (access_token server-side only)
    |-- orders, ads_data (synced from external APIs)
```

---

## Folder Structure (Actual)

```
/
├── .env                              # VITE_ prefixed keys (gitignored)
├── .gitignore
├── index.html
├── vite.config.ts                    # Vite + Tailwind + path alias
├── tsconfig.app.json                 # strict + erasableSyntaxOnly + ignoreDeprecations: "6.0"
├── eslint.config.js
├── package.json
│
├── src/
│   ├── main.tsx
│   ├── index.css                     # Tailwind @import + @theme tokens + .dark class overrides
│   │
│   ├── pages/
│   │   ├── Landing.tsx               # Marketing landing page
│   │   ├── Login.tsx                 # Email/password sign-in form
│   │   ├── Signup.tsx                # Email/password sign-up + confirmation state
│   │   ├── AuthCallback.tsx          # /auth/callback — handles email confirmation redirect
│   │   ├── Workspaces.tsx            # List + create workspaces
│   │   └── app/
│   │       ├── Dashboard.tsx         # Profit summary + chart + ratios + order status breakdown
│   │       ├── Profit.tsx            # Date-range profit breakdown + chart + ratios + CSV export
│   │       ├── Ads.tsx               # Meta ads: date filter, ROAS alert, status badges, PKR toggle, CSV export
│   │       ├── Settings.tsx          # Shopify connect/disconnect, Meta connect/disconnect, Members
│   │       └── Profile.tsx           # User profile: display name, phone, change password (supabase.auth.updateUser)
│   │
│   ├── components/
│   │   ├── guards/
│   │   │   ├── AuthGuard.tsx         # Redirects to /login if no session
│   │   │   ├── GuestGuard.tsx        # Redirects to /workspaces if already logged in (protects /login, /signup)
│   │   │   └── WorkspaceGuard.tsx    # Redirects to /workspaces if not a member
│   │   ├── layouts/
│   │   │   ├── AppLayout.tsx         # Desktop sidebar + mobile bottom nav + dark/light toggle
│   │   │   └── AuthLayout.tsx        # Centered card layout for login/signup
│   │   ├── features/
│   │   │   ├── ProfitSummaryCard.tsx # Metric card (label + value + trend badge)
│   │   │   ├── OrdersTable.tsx       # Table on desktop, cards on mobile
│   │   │   ├── RevenueChart.tsx      # recharts AreaChart — Revenue vs Refunds by day
│   │   │   └── WorkspaceMembers.tsx  # Members list + invite form + pending invites (owner/admin only)
│   │   └── ui/
│   │       ├── Button.tsx            # primary/secondary/ghost/danger, loading state
│   │       ├── Card.tsx
│   │       ├── Input.tsx             # label + error + hint
│   │       ├── Badge.tsx             # success/warning/error/neutral/accent
│   │       ├── Skeleton.tsx          # SkeletonCard, SkeletonPage, SkeletonTable
│   │       ├── EmptyState.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── icons/
│   │           ├── DashboardIcon.tsx
│   │           ├── ProfitIcon.tsx
│   │           ├── AdsIcon.tsx
│   │           └── SettingsIcon.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                # Session + onAuthStateChange
│   │   ├── useWorkspace.ts           # Single workspace by ID
│   │   ├── useWorkspaceList.ts       # All workspaces for current user
│   │   ├── useWorkspaceMutations.ts  # createWorkspace via RPC
│   │   ├── useWorkspaceRole.ts       # Current user's role in a workspace (from workspace_members)
│   │   ├── useOrders.ts              # Two parallel queries: summary (no limit) + display (paginated)
│   │   ├── useAdsData.ts             # Two parallel queries: totals (no limit) + display (paginated)
│   │   ├── useShopifyConnection.ts   # Connection status + connect/connectWithToken/disconnect
│   │   ├── useMetaConnection.ts      # Connection status + connect (OAuth) / disconnect
│   │   └── useTheme.ts               # Dark/light theme toggle — reads localStorage, applies .dark to <html>
│   │
│   ├── lib/
│   │   ├── supabase.ts               # Supabase client (anon JWT key)
│   │   ├── formatters.ts             # formatCurrency (PKR), formatDate, formatPercentage
│   │   ├── constants.ts              # APP_NAME, ROUTES, PAGINATION, CACHE_TTL_MINUTES, USD_TO_PKR_RATE, TRIAL_DAYS, PLANS, PLAN_PRICES, ADMIN_EMAIL, BANK_DETAILS
│   │   ├── permissions.ts            # WorkspaceMemberRole type+const, Permission type, ROLE_PERMISSIONS map, hasPermission()
│   │   ├── csv.ts                    # exportOrdersCSV(), exportCampaignsCSV() — client-side download
│   │   └── validators.ts
│   │
│   ├── types/
│   │   ├── app.ts                    # Workspace, Order, AdsData, WorkspaceMemberWithEmail, WorkspaceInvite, etc. (WorkspaceMemberRole re-exported from permissions.ts)
│   │   └── global.d.ts               # Global JSX namespace (React 19 compat)
│   │
│   └── router/
│       └── index.tsx                 # Nested routes: AuthGuard → WorkspaceGuard → AppLayout
│
├── supabase/
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── cors.ts               # corsHeaders + handleCors()
│   │   │   ├── auth.ts               # getSupabaseClient() + getServiceClient()
│   │   │   └── response.ts           # jsonResponse() + errorResponse()
│   │   ├── shopify-oauth/index.ts    # HMAC validation, token exchange, webhook reg, sync
│   │   ├── shopify-webhook/index.ts  # orders/create, orders/updated, refunds/create
│   │   ├── shopify-sync/index.ts     # On-demand historical order sync (GraphQL API)
│   │   ├── shopify-token-connect/index.ts  # Direct API token save (dev/custom app flow)
│   │   ├── meta-oauth/index.ts       # Meta OAuth callback — token exchange, get ads_account_id, save to meta_connections
│   │   ├── meta-sync/index.ts        # Fetch last 30d campaign insights from Meta Graph API, upsert ads_data
│   │   └── workspace-invite/index.ts # Validate caller role, create workspace_invites row, send Supabase invite email (--no-verify-jwt)
│   └── migrations/
│       ├── 20240001000000_initial_schema.sql
│       ├── 20240002000000_fix_grants_and_workspace_rpc.sql
│       ├── 20240003000000_fix_shopify_connection_delete.sql
│       ├── 20240004000000_fix_meta_connection_delete.sql
│       ├── 20240005000000_add_campaign_status.sql
│       ├── 20240006000000_add_plan_and_admin.sql
│       └── 20240007000000_invite_and_supervisor_role.sql
│
├── shopify.app.toml                  # Shopify CLI app config (redirect URLs, scopes)
└── PROJECT_CONTEXT.md                # This file — architecture, decisions, setup status
```

---

## Key Security Rules

- All Shopify/Meta API tokens stored in `shopify_connections` / `meta_connections` — **never returned to the browser** (client queries always exclude `access_token` column)
- Supabase service role key lives only in Edge Function secrets — never in `.env` or frontend
- `VITE_` prefix = safe to expose in browser bundle. No `VITE_` prefix = Edge Function only
- RLS policies enforce workspace isolation at the database level
- Workspace creation uses a `security definer` RPC function — safe, server-side auth check
- `META_APP_SECRET` must NEVER go in `.env` — Edge Function secret only. Only `VITE_META_APP_ID` (public client ID) goes in `.env`

---

## Environment Variables

```bash
# .env — frontend (VITE_ prefix required for Vite to expose to browser)
VITE_SUPABASE_URL=https://wotnhebzmrrkeplgohiq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon JWT key — eyJhbGci... format, NOT sb_publishable_...>
VITE_SHOPIFY_CLIENT_ID=120a78ec022c821eb30fbda587fdce60
VITE_META_APP_ID=2458407957958041

# Supabase secrets (set via: supabase secrets set KEY=value) — never in .env
# SHOPIFY_SECRET=shpss_...
# SHOPIFY_WEBHOOK_SECRET=<set after first webhook registration>
# META_APP_ID=2458407957958041        ← also set as secret for Edge Functions
# META_APP_SECRET=<meta app secret>
# APP_URL=http://localhost:5173       ← change to prod domain when deploying
```

**Critical:** Use the JWT-format anon key (`eyJhbGci...`), not the `sb_publishable_...` format.
The `sb_publishable_...` key does not encode role information and causes `auth.uid()` to
return null in RLS policies. Get the JWT key from:
`supabase projects api-keys --project-ref wotnhebzmrrkeplgohiq`

---

## Supabase Project Details

| Item | Value |
|---|---|
| Project ref | `wotnhebzmrrkeplgohiq` |
| Region | Northeast Asia (Tokyo) |
| DB URL | `https://wotnhebzmrrkeplgohiq.supabase.co` |
| Shopify Client ID | `120a78ec022c821eb30fbda587fdce60` |
| Shopify Secret | set as Supabase secret `SHOPIFY_SECRET` — never commit the value |
| Meta App ID | `2458407957958041` |
| Meta App Secret | set as Supabase secret `META_APP_SECRET` |

**Edge Function URLs:**
```
shopify-oauth:   https://wotnhebzmrrkeplgohiq.supabase.co/functions/v1/shopify-oauth
shopify-webhook: https://wotnhebzmrrkeplgohiq.supabase.co/functions/v1/shopify-webhook
shopify-sync:    https://wotnhebzmrrkeplgohiq.supabase.co/functions/v1/shopify-sync
meta-oauth:      https://wotnhebzmrrkeplgohiq.supabase.co/functions/v1/meta-oauth  (--no-verify-jwt)
meta-sync:       https://wotnhebzmrrkeplgohiq.supabase.co/functions/v1/meta-sync
```

**Important:** `meta-oauth` must be deployed with `--no-verify-jwt` because the callback
comes from Meta (no user JWT). Command: `supabase functions deploy meta-oauth --no-verify-jwt`

---

## Shopify App Configuration

- **Partner Dashboard:** partners.shopify.com → StoreIQ app
- **Client ID:** `120a78ec022c821eb30fbda587fdce60`
- **Dev store:** `storeiq-wuwfpjau.myshopify.com`
- **Distribution method:** Custom distribution (selected in Partner Dashboard → StoreIQ → Distribution)
  - Per-client onboarding: generate a custom install link per store in Partner Dashboard → send to client → they click and approve
  - Not listed in the Shopify App Store — manual link distribution only (correct for MVP)
- **Redirect URLs registered** (via `shopify app deploy`):
  - `https://wotnhebzmrrkeplgohiq.supabase.co/functions/v1/shopify-oauth`
  - `http://localhost:5173/auth/callback`
- **OAuth scopes:** `read_orders,read_products`
- **Webhook topics auto-registered** by `shopify-oauth` on connect: `orders/create`, `orders/updated`, `refunds/create`
- **Protected Customer Data access:** Requested and active for dev store — Store management + Analytics reasons
  _(Partners Dashboard → App distribution → StoreIQ → API access requests → Protected customer data access)_
- **shopify.app.toml** manages app config — push changes with `shopify app deploy`

### Shopify API Notes
- **REST API orders endpoint is blocked** without Protected Customer Data approval (even for GraphQL `Order` type)
- **Use GraphQL Admin API** (`/admin/api/2026-04/graphql.json`) for order sync — fields used: `id`, `totalPrice`, `displayFinancialStatus`, `createdAt`
- **Shopify GQL IDs** are in format `gid://shopify/Order/12345` — extract numeric ID with `.split('/').pop()`
- **`shopify-token-connect`** Edge Function allows connecting via pasted Admin API token (for custom apps / dev testing without OAuth)

---

## Meta App Configuration

- **Meta Developer Dashboard:** developers.facebook.com → StoreIQ app (App ID: `2458407957958041`)
- **Business Portfolio:** `Storeiq` (separate from personal perfume brand `vellora.fragnances`)
- **Facebook Login for Business** product added
- **Valid OAuth Redirect URI registered:** `https://wotnhebzmrrkeplgohiq.supabase.co/functions/v1/meta-oauth`
- **OAuth scope used:** `ads_read` only (NOT `read_insights` — that is invalid as a login scope)
- **Graph API version:** `v21.0`
- **App status:** Development (unpublished) — only added testers can connect

### Meta API Notes
- `ads_read` scope gives access to both ad data AND insights — `read_insights` is not a valid OAuth scope
- `meta-oauth` Edge Function must be deployed `--no-verify-jwt` — Meta callback has no user JWT
- After OAuth, fetch `ads_account_id` from `/me/adaccounts?fields=id,name` — stored as `act_XXXXXXXXX`
- `meta-sync` fetches `last_30d` from `/act_{ads_account_id}/insights` at campaign level
- `meta-sync` also fetches `/act_{ads_account_id}/campaigns?fields=id,effective_status` before the insights loop to populate `status` column
- ROAS from Meta API: `purchase_roas[0].value` (array, parse as float, 0 if no purchases)
- CTR from Meta API: returned as percentage (e.g. `"3.5"`) — divide by 100 before storing (stored as decimal)
- `ads_data` table stores CTR as decimal (0.035 = 3.5%) — UI multiplies by 100 for display
- Campaign status values from Meta: `ACTIVE`, `PAUSED`, `ARCHIVED`, `DELETED` — stored as-is in `status` column
- Sync triggered once per session on Ads page mount (via `useRef` flag) — not on every render

---

## Per-Client Onboarding Flow

1. Client signs up at `/signup` → confirms email → lands on `/workspaces`
2. Creates a workspace (one per store)
3. Goes to `/app/[id]/settings` → enters their `.myshopify.com` domain → clicks Connect Shopify
4. OAuth redirects to Shopify → client approves → redirected back to settings
5. `shopify-oauth` Edge Function: exchanges code → stores token → registers webhooks → syncs last 90 days of orders
6. Goes to Settings → clicks Connect via Meta → Meta OAuth screen → approves
7. `meta-oauth` Edge Function: exchanges code → fetches `ads_account_id` → stores in `meta_connections`
8. Ads page auto-syncs on first load → campaign data appears
9. Dashboard shows true net profit: Revenue - Refunds - Ad Spend

---

## Profit Calculation Logic

### When only Shopify is connected:
```
Net Profit = Revenue - Refunds
```
Dashboard and Profit pages show 3 cards: Revenue | Refunds | Net Profit

### When both Shopify + Meta are connected:
```
Net Profit (after ads) = Revenue - Refunds - Ad Spend
```
Dashboard and Profit pages show 4 cards: Revenue | Refunds | Ad Spend | Net Profit (after ads)

The ad spend subtracted is the total from `ads_data` for the same date range as orders.
`useAdsData` accepts an optional `dateRange` param — Profit page passes its selected date range.
Dashboard passes no date range (all-time).

---

## Known Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Shopify API rate limits (2 req/sec per store) | 500ms delay between paginated sync requests |
| `sb_publishable_...` key breaks `auth.uid()` in RLS | Always use JWT anon key (`eyJhbGci...`) for `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Missing GRANT statements in migrations | Migrations 20240002–20240004 explicitly grant permissions |
| Workspace creation RLS timing issues | `create_workspace()` security definer RPC bypasses client-side auth uncertainty |
| Shopify REST `orders.json` blocked without Protected Data approval | Use GraphQL Admin API instead |
| Per-workspace Shopify token expiry | Reconnect prompt in Settings when token_expires_at approaches |
| Meta access token expiry (60 days) | Show reconnect prompt before expiry (post-MVP) |
| Shopify OAuth install blocked ("app can't be installed yet") | Fixed by selecting Custom distribution in Partner Dashboard |
| `shopify_connections` delete silently fails | Fixed in migration 20240003: GRANT DELETE + DELETE RLS policy |
| `meta_connections` delete silently fails | Fixed in migration 20240004: GRANT DELETE + DELETE RLS policy |
| Profit page shows data after disconnect | Fixed: pages check connection status and show empty state when disconnected |
| `meta-oauth` returns 404 (function not found) | Must deploy with `--no-verify-jwt` flag — Meta callback has no JWT |
| `read_insights` is invalid OAuth scope | Use `ads_read` only — it covers both ad data and insights |
| `META_APP_SECRET` exposed in `.env` | Secret must only be in Supabase secrets, never in `.env` or frontend bundle |
| Meta ROAS shows 0 despite ad spend | Expected when Meta Pixel not installed or no purchase events fired — spend and CTR still accurate |
| Profit numbers wrong for stores with >20 orders | Fixed: `useOrders` and `useAdsData` run two parallel queries — summary from unlimited rows, display paginated at 20 |
| Campaign status shows UNKNOWN after migration | Expected until next meta-sync runs — triggers on next Ads page load |

---

## Known Issues — To Fix When We Have Time

Issues that won't cause problems at 5–10 clients but will need attention before scaling.

### API Rate Limits & Resilience

| Issue | Where | What Happens Without Fix | Fix |
|---|---|---|---|
| `shopify-sync` has no retry on Shopify `429` | `supabase/functions/shopify-sync/index.ts` | Large stores (1000s of orders) fail mid-sync silently, orders missing from dashboard | Catch `429`, read `Retry-After` header, wait and resume pagination |
| `meta-sync` doesn't read `x-ad-account-usage` header | `supabase/functions/meta-sync/index.ts` | Ad accounts with 100+ campaigns can hit Meta throttle mid-loop, partial data synced | Check header after each campaign call, bail early + log warning if usage > 80% |
| `meta-sync` makes one API call per campaign in a loop | `supabase/functions/meta-sync/index.ts` | 100 campaigns = 101 sequential Meta API calls per sync, slow and throttle-prone | Batch insights requests using Meta's batch API endpoint (`/`) or use `fields` to reduce calls |
| No retry logic on any Edge Function | All Edge Functions | Transient network errors cause silent failures with no user feedback | Wrap fetch calls in a simple retry with exponential backoff (2–3 attempts max) |

### Token Expiry

| Issue | Where | What Happens Without Fix | Fix |
|---|---|---|---|
| Meta access token expires after 60 days — no warning | `Settings.tsx`, `useMetaConnection.ts` | Dashboard silently stops syncing ad data, user doesn't know why | Check `token_expires_at` in `meta_connections`, show reconnect banner in Settings when < 7 days remaining |
| Shopify access token expiry — no warning | `Settings.tsx`, `useShopifyConnection.ts` | Webhooks and syncs fail silently | Same pattern — check `token_expires_at` in `shopify_connections`, show reconnect banner |

### Next Tasks

1. **Invite set-password page** ✅ DONE
   - After invite acceptance, user lands on `/set-password?workspaceId=xxx` (instead of going straight to dashboard)
   - `SetPassword.tsx` — shows user's email, new password + confirm fields, calls `supabase.auth.updateUser({ password })`
   - On success → redirects to workspace dashboard
   - Ensures invited users can sign back in after signing out

2. **Forgot password flow** ✅ DONE
   - "Forgot password?" link on `/login` → inline mode switch (login / forgot / forgot-sent states)
   - Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + ROUTES.AUTH_CALLBACK })`
   - `AuthCallback.tsx` detects `type=recovery` in hash → redirects to `/set-password` (no `workspaceId`)
   - `SetPassword.tsx` already handles missing `workspaceId` → redirects to `/workspaces` on success

---

### Pending Tasks

1. **Test full signup flow end-to-end**
   - Go to `/` → select a plan → `/signup?plan=growth` → sign up → confirm email → land on `/workspaces`
   - Also test direct `/signup` → inline plan cards appear → select plan → sign up
   - Verify: `localStorage.getItem('storeiq_pending_plan')` is set correctly in both paths
   - Verify: pending activation banner shows with correct price + bank details
   - Create a workspace → verify `selected_plan` is saved in DB
   - Go to `/admin` (as admin) → verify workspace appears → click Activate → verify banner disappears
   - Check the thin amber banner inside the app (Dashboard) disappears after activation

2. **Trial days remaining banner** ✅ DONE
   - Shown in `Workspaces.tsx` and `AppLayout.tsx`, colour-coded by urgency:
     - > 3 days left → blue ("5 days left in your trial")
     - 1–3 days left → amber ("2 days left — activate today")
     - Expired → red ("Trial expired — activate to continue")
   - Hidden when `subscription_status === 'active'`
   - Migration 20240008 applied — `trial_started_at timestamptz DEFAULT NOW()` on `workspaces`
   - `TRIAL_DAYS = 7` constant in `constants.ts`; `trial_started_at` added to `Workspace` type and both workspace hooks

### Admin UX

| Issue | Where | What Happens Without Fix | Fix |
|---|---|---|---|
| Admin panel has no summary stats | `Admin.tsx` | No quick overview of total clients, active vs trial counts | Add a 3-card summary row at the top: Total Workspaces / Active / Pending |
| No search or filter on admin workspace list | `Admin.tsx` | With 20+ clients, hard to find a specific workspace | Add a text filter input above the table that filters by workspace name or owner email client-side |

### Pagination & Data Completeness

| Issue | Where | What Happens Without Fix | Fix |
|---|---|---|---|
| CSV export on Ads page only exports current page (20 rows) | `Ads.tsx` → Export CSV button | Users with many campaigns get incomplete CSV | Add a separate unlimited query triggered only on export click, or warn user in the button tooltip |
| `shopify-sync` syncs last 90 days only on connect — no periodic re-sync | `shopify-sync` Edge Function | Historical data beyond the initial sync window never updates unless user reconnects | Add a periodic re-sync (Inngest cron, already listed as post-MVP) or a manual "Re-sync" button in Settings |

---

## Feature Backlog

Features identified from product review. Organized by priority. Do not build out of order.

---

### Launch Blockers — Ship Before Taking Money

These must be done before charging a single customer. Estimated total: 2–3 days.

| Feature | Notes | Est. Time |
|---|---|---|
| ~~**Forgot password flow**~~ | ✅ DONE — inline forgot/sent modes on Login, `type=recovery` in AuthCallback, reuses SetPassword | 2h |
| **Deploy to Vercel + custom domain** | Static build, 10 minutes. No customer will pay for `localhost:5173`. | 2h |
| **Branded Supabase email templates** | Confirmation, invite, and reset emails must come from your domain. Supabase dashboard → Auth → Email Templates. | 2h |
| **Meta App Review submission** | App is in Dev mode — only added testers can connect. Submit `ads_read` for review: Privacy Policy URL (done), demo video, use case description. Approval: 24–72h. | 1 day |
| ~~**Trial countdown banner**~~ | ✅ DONE — colour-coded by days left in both AppLayout and Workspaces; migration 20240008 applied | 3h |
| **Re-sync button in Settings** | Calls `shopify-sync` Edge Function on demand. Without periodic sync, customers who connected weeks ago have stale data. | 3h |
| **Periodic Shopify sync** | Supabase `pg_cron` or Inngest — sync all workspaces with active Shopify connections daily at 2am PKT. Stagger one workspace per 30s to avoid rate limits. | 4h |
| **Meta token expiry warning** | Check `token_expires_at` in `meta_connections`. Show reconnect banner in Settings when <7 days remaining. Token expires after 60 days — silent failure destroys trust. | 2h |
| **Shopify token expiry warning** | Same pattern as Meta. Check `token_expires_at` in `shopify_connections`, show reconnect banner. | 1h |
| **Connection health indicator on Dashboard** | Small status row: "Shopify: Connected, last synced X hours ago \| Meta: Connected". Surfaces data freshness to the user. | 2h |
| **Fix hardcoded USD_TO_PKR_RATE** | Currently `278` in constants. PKR/USD moves 5–10% monthly. Options: pull from an exchange rate API daily and cache in DB, or expose as admin-configurable setting. Wrong rate = wrong USD display = trust erosion. | 3h |

---

### Must Have — Week 2 (Retention Anchors)

Ship within 2 weeks of first paying customer. These are the features that prevent churn.

| Feature | Notes | Complexity | Est. Time |
|---|---|---|---|
| **Daily email report** | Yesterday's revenue, refunds, ad spend, net profit per workspace. Resend (free tier) + Supabase `pg_cron`. Sends at 8am PKT. Requires periodic Shopify sync to be accurate. | Low | 2 days |
| **Profit drop alert (email)** | "Your profit dropped X% vs last week." Threshold-based, cooldown to avoid alert fatigue (once per breach, not hourly). `pg_cron` comparison job. | Low–Medium | 2 days |
| **ROAS drop alert (email)** | Upgrade existing low-ROAS banner into an email notification. Already have the detection logic, just need the delivery layer. | Low | 1 day |
| **Revenue alert (email)** | "You crossed PKR 100k today." Celebration moments create product love and daily engagement. | Low | 1 day |
| **Admin summary stats** | 3-card row at top of `Admin.tsx`: Total Workspaces / Active / Trial. Currently no overview. | Low | 2h |
| **Admin panel search/filter** | Text filter above workspace table — filter by workspace name or owner email, client-side. Needed before 20 clients. | Low | 2h |
| **Onboarding checklist** | Dismissible 3-step card on Dashboard for new workspaces: Connect Shopify → Connect Meta → See your profit. Without it, 60% of signups will never complete setup. | Low | 3h |

---

### Must Have — Week 3 (Differentiators)

Features that separate StoreIQ from every English-language competitor in Pakistan.

| Feature | Notes | Complexity | Est. Time |
|---|---|---|---|
| **WhatsApp daily report** | Opt-in. Sends at 8am PKT via Meta Cloud API (you already have Meta Business Portfolio — use it). Template messages require Meta pre-approval (24–72h). Single message: yesterday's revenue, ad spend, net profit. This is your #1 retention anchor and viral loop. | Medium | 3 days |
| **WhatsApp profit/ROAS alerts** | Same infrastructure as daily report. Threshold-based alerts via WhatsApp instead of (or in addition to) email. | Medium | 1 day (after WhatsApp report is live) |
| **Top products by revenue** | Extend `shopify-sync` GraphQL query to include `lineItems`. New `order_line_items` table (`workspace_id`, `order_id`, `product_id`, `product_title`, `variant_title`, `quantity`, `price`). New UI card on Dashboard/Profit page. Note: mapping refunds to specific products requires `refundLineItems` — non-trivial but doable. | Medium | 4 days |
| **Meta Batch API** | Replace sequential campaign loop in `meta-sync` with Meta Batch API (`POST /`). 100 campaigns = 101 sequential calls → 2 batch calls. Sync time drops from 30–50s to 3–5s. Required before 20 clients. | Medium | 2 days |

---

### Should Have — Month 2

Valuable but not launch blockers. Build after first 10 paying customers.

| Feature | Notes | Complexity | Est. Time |
|---|---|---|---|
| **Multi-store combined view** | Aggregate revenue, ad spend, and profit across all workspaces on the `/workspaces` page. Architecture already supports it — workspace model is correct. UI-only change, no schema needed. | Low | 1–2 days |
| **COD-aware profit calculation** | Pakistan is ~80% COD. Shopify records a COD order as revenue at placement. If returned, money was never collected. Add a "COD pending" vs "collected" revenue view. Requires `displayFinancialStatus` mapping. High impact for Pakistani stores with high RTO. | Medium | 3–4 days |
| **New vs returning customers** | Requires Shopify customer API (`customerId` on orders). Medium complexity. Valuable insight but does not directly affect the profit formula. | Medium | 3 days |
| **Repeat purchase rate** | Same data source as new vs returning. | Medium | 1 day (after above) |
| **Shopify webhook delivery monitoring** | Poll Shopify's webhook health endpoint periodically. Alert admin if deliveries are failing. Currently no visibility into silent webhook failures. | Medium | 2 days |
| **Dynamic exchange rate** | Pull PKR/USD from an exchange rate API (e.g. Open Exchange Rates free tier) daily, cache in DB. Replace hardcoded constant. | Low | 1 day |

---

### Nice to Have — Build Only If Customers Ask

Do not schedule until at least one customer explicitly requests the feature.

| Feature | Notes |
|---|---|
| **Campaign leaderboard** | Already have campaign table with ROAS badges and pagination. Cosmetic improvement only. |
| **Campaign performance history** | Chart of ROAS over time per campaign. Requires historical `ads_data` rows — already storing them. UI work only. |
| **Refund rate alerts** | "Your refund rate exceeded 20% this week." Niche but useful for fashion/clothing stores. |
| **White-label reports** | PDF or email reports branded with the client's store logo. Only matters for agencies. |
| **Agency reseller dashboard** | Manage multiple client workspaces under one agency account. Post-MVP. |

---

### Avoid For Now — Do Not Build

These features will consume weeks and return nothing at 10–50 clients.

| Feature | Why |
|---|---|
| **AI insights** | Generic advice without sufficient data volume. Pakistan store owners want numbers, not paragraphs. Revisit after 100+ clients and 6+ months of data. |
| **Attribution modeling** | Requires TikTok, Google, email, SMS, organic — not just Meta. Cannot build meaningful attribution with two sources. Triple Whale has spent millions on this. |
| **COGS tracking** | Shopify `cost` field on `InventoryItem` requires `read_inventory` scope and is often blank. Manual entry per SKU = data quality nightmare. Users will enter wrong values and blame your profit calculation. |
| **Inventory forecasting** | Requires months of sales velocity data, supplier lead times, seasonality. Not relevant for stores under 500 orders/month. |
| **Shipping cost tracking** | Shopify gives `shipping_price` but it varies by order and carrier. Net shipping cost is not reliably accessible via API. |
| **Payment fee tracking** | EasyPaisa/JazzCash/COD/bank fees in Pakistan are inconsistent. No API gives actual net fee per order. |
| **Google Ads integration** | Pakistani ecommerce brands are almost entirely Meta-dependent. Google Ads developer token approval takes 1–2 weeks manual review. Revisit post-MVP if clients ask. |
| **Telegram reports** | Pakistan does not run on Telegram. WhatsApp only. |
| **Product profitability** | Requires COGS per SKU. See COGS section above. |
| **Omnichannel inbox** | Meta App Review dependency (`pages_messaging`). Post-MVP. |

---

### Technical Notes for Planned Features

| Feature | Key Technical Consideration |
|---|---|
| WhatsApp API | Use Meta Cloud API directly (you have Meta Business Portfolio). Template messages need pre-approval (24–72h). Free-form messages only within 24h of user initiating contact — use templates for scheduled reports. |
| Daily reports | Require periodic Shopify sync to be accurate. Ship sync before reports. |
| `order_line_items` table | Add `workspace_id` index. Each order can have 1–20 items. 5,000 orders × 10 items = 50,000 rows per workspace. Fine at MVP scale. |
| `pg_cron` jobs | All cron jobs (sync, alerts, reports) should stagger workspaces to avoid simultaneous API calls. One workspace per 30s is safe. |
| Alert cooldowns | Implement a `last_alerted_at` column or a separate `alert_log` table to prevent alert fatigue (once per threshold breach, not continuously). |
| Meta Batch API | `POST https://graph.facebook.com/` with `batch` array. Up to 50 requests per batch. Reduces 100-campaign sync from 101 sequential calls to 2 batch calls. |

---

## Build Phases

### Phase 1 — Foundation ✅ COMPLETE
- [x] Supabase schema + auth setup (deployed)
- [x] Workspace model + workspace switcher UI
- [x] Route guards (AuthGuard, WorkspaceGuard)
- [x] Login / Signup pages with Supabase auth
- [x] Tailwind CSS v4 setup + UI component library (Button, Input, Card, Badge, Skeleton, EmptyState, ErrorBoundary)
- [x] AppLayout (responsive: desktop sidebar + mobile bottom nav)
- [x] Shopify OAuth connect flow (Edge Function deployed)
- [x] Webhook handler + historical order sync (Edge Functions deployed)
- [x] Profit dashboard (revenue - refunds = net profit)
- [x] Date range selector on Profit page
- [x] Responsive OrdersTable (table → cards on mobile)

### Phase 2 — Ads + Team + Billing ✅ COMPLETE
- [x] Shopify redirect URL registered (shopify.app.toml + `shopify app deploy`)
- [x] Protected Customer Data access active for dev store
- [x] End-to-end Shopify connect tested — OAuth flow, order sync, dashboard working
- [x] GraphQL order sync implemented (REST blocked by Shopify Protected Data policy)
- [x] `shopify-token-connect` Edge Function for alternative token-paste flow
- [x] Infinite API call bug fixed (useMemo on dateRange in Profit page)
- [x] Shopify disconnect bug fixed — DELETE RLS policy + GRANT added (migration 20240003)
- [x] Profit page connection gate added — shows empty state when store is disconnected
- [x] Shopify app distribution set to Custom — per-client install links via Partner Dashboard
- [x] Meta Developer account created (App ID: 2458407957958041, Business Portfolio: Storeiq)
- [x] Meta OAuth integration — `meta-oauth` Edge Function deployed (--no-verify-jwt)
- [x] Meta data sync — `meta-sync` Edge Function deployed
- [x] `useMetaConnection` hook — connect/disconnect/refetch
- [x] Settings page — Meta connect/disconnect card (replaced "Coming soon")
- [x] Ads page — checks Meta connection, triggers sync on load, shows campaigns
- [x] Dashboard + Profit — show Ad Spend card + true net profit when Meta connected
- [x] Migration 20240004 — GRANT DELETE + RLS DELETE policy for meta_connections
- [x] Meta Ads tested end-to-end — real campaign data showing (vellora.fragnances ad account)
- [x] Revenue vs Refunds chart (recharts AreaChart) — Dashboard + Profit pages
- [x] Key Ratios row (Refund Rate, Profit Margin, Ad Spend Ratio %) — Dashboard + Profit pages
- [x] CSV export — orders (Profit page) + campaigns (Ads page)
- [x] Date range filter on Ads page (7 days / 30 days, filters local synced data)
- [x] Low ROAS alert banner — Ads page, shown when any campaign ROAS < 1.0 and spend > 0
- [x] Order status breakdown badges — Dashboard recent orders section
- [x] PKR / USD currency toggle — Ads page (USD_TO_PKR_RATE = 278 in constants)
- [x] Dark / Light mode toggle — AppLayout header, persisted to localStorage, system preference as default
- [x] Profit numbers pagination bug fixed — two parallel queries (summary unlimited, display paginated)
- [x] Campaign Status badge — `ads_data.status` column, meta-sync updated, migration pushed ✅
- [x] Campaign pagination — server-side with `?page` + `perfFilter`, debounced, `totalCount` from Supabase `count: 'exact'`
- [x] Campaign performance filter — All / Good / Losing (server-side ROAS filter, resets page on change)
- [x] Landing page — full marketing redesign: hero, pain points, how it works, features, pricing, final CTA
- [x] Pricing — 4 tiers (Starter PKR 5,500 / Growth PKR 10,000 / Pro PKR 18,000 / Agency PKR 35,000), selectable cards
- [x] Privacy Policy page at `/privacy` (Meta App Review requirement)
- [x] Manual billing flow — plan selected on landing → saved to `localStorage` → survives email confirmation redirect
- [x] Pending activation banner — shown on Workspaces page with bank details + WhatsApp receipt link
- [x] Thin activation banner in AppLayout — shown inside the app when workspace is not `active`
- [x] `selected_plan` stored in DB on workspace creation (via updated `create_workspace` RPC)
- [x] Admin panel at `/admin` — lists all workspaces with owner email, plan, status; Activate/Deactivate per row; desktop table + mobile cards; access denied screen for non-admins
- [x] Admin RPCs — `admin_get_all_workspaces()` + `admin_set_subscription_status()` security definer, email-gated
- [x] Test admin user seeded in migration — `admin@storeiq.com` / `admin1234` (pre-confirmed, no inbox needed)
- [x] Migration 20240006 pushed ✅
- [x] Admin redirect — `admin@storeiq.com` auto-redirects to `/admin` after login and email confirmation ✅
- [x] GuestGuard — logged-in users redirected away from `/login` and `/signup` ✅
- [x] Avatar dropdown in AppLayout — user initial, Profile link, Sign out ✅
- [x] Profile page at `/app/:workspaceId/profile` — name, phone, password change ✅
- [x] Eye icon on all password fields (Input component, works everywhere) ✅
- [x] Inline plan selector on `/signup` — shown when no `?plan` param; required before submit ✅
- [x] `PLANS` constant added to `constants.ts` — single source of truth for plan data ✅
- [x] Ads spend currency fix — stored as PKR (Meta billing currency); PKR toggle shows raw, USD divides by rate ✅
- [x] Permissions module (`src/lib/permissions.ts`) — central role→permission map, `hasPermission()` helper ✅
- [x] `supervisor` role added — `workspace_members` role constraint updated (migration 20240007) ✅
- [x] `workspace_invites` table — pending invite tracking with expiry and token ✅
- [x] `useWorkspaceRole` hook — fetches current user's role for a workspace ✅
- [x] Settings tab gated — hidden from Supervisors in nav; Access Denied card on direct URL ✅
- [x] Team Members UI in Settings — live members list, invite form (email + role), pending invites with revoke ✅
- [x] `workspace-invite` Edge Function deployed (`--no-verify-jwt`) — sends Supabase invite email ✅
- [x] `AuthCallback.tsx` — handles `type=invite` link, calls `accept_workspace_invite` RPC ✅
- [x] Migration 20240007 pushed — supervisor role, workspace_invites, 4 new RPCs, updated RLS ✅
- [x] `SetPassword.tsx` — post-invite set-password page (`/set-password?workspaceId=xxx`); also reusable for forgot-password recovery flow ✅
- [x] Forgot password flow — inline forgot/sent mode on Login, `type=recovery` in `AuthCallback`, reuses `/set-password` ✅
- [x] Trial countdown banner — colour-coded (blue/amber/red) in AppLayout + Workspaces; migration 20240008 applied ✅
- [ ] Supabase email templates — brand the confirmation/reset/invite emails
- [ ] End-to-end signup flow test (both paths: landing → signup and direct signup)
- [ ] ROAS drop email alert (Inngest cron)
- [ ] Deploy frontend to Vercel / Cloudflare Pages

### Phase 3 — Post-MVP (After First Paying Clients)
- Courier integrations (Leopards, PostEx, TCS) — Pro plan feature
- RTO tracking + COD reconciliation dashboard
- Omnichannel inbox (Instagram DM + Facebook Messenger)
- Google Ads integration (YouTube + Search/Display) — requires Google Ads API developer token approval
- Viewer role (Supervisor is the current read-only role; a more restricted Viewer can be added post-MVP with one line in permissions.ts)
- WhatsApp (via BSP like 360dialog)
- CPM / CPC / Frequency metrics
- Ad fatigue detection
- Date range selector on Ads page
- Inngest background jobs (ROAS alert cron, periodic Shopify sync)

---

## What Was Deliberately Excluded from MVP

- Courier integrations (deferred to Pro plan — Shopify data sufficient for profit formula)
- Omnichannel inbox (Meta App Review dependency)
- Viewer role (Supervisor covers the read-only use case for MVP)
- WhatsApp
- AI suggested replies
- CPM / CPC / Frequency metrics
- Stripe / PayPal payments
- Inngest background jobs (sync is triggered on connect; cron alerts deferred)
- Microservices / heavy infra
- Date range selector on Ads page (shows last 30 days always — post-MVP)

---

## Architecture Decisions Log

| Decision | Choice | Reason |
|---|---|---|
| Multi-tenancy model | Shared DB + Supabase RLS | Simplest for solo dev, Supabase built for this |
| Tenant isolation unit | Workspace (not User) | Users can own/manage multiple stores |
| Routing | Path-based (`/app/[workspace-id]/`) | No subdomain complexity for MVP |
| CSS framework | Tailwind CSS v4 (Vite plugin) | Mobile-first responsive UI with utility classes |
| Enum replacement | String literal unions + const objects | `erasableSyntaxOnly: true` in TS6 forbids `enum` |
| Supabase client key | JWT anon key (`eyJhbGci...`) | `sb_publishable_...` format breaks `auth.uid()` in RLS |
| Workspace creation | `create_workspace()` security definer RPC | Bypasses RLS edge cases; `auth.uid()` called server-side |
| Migration grants | Explicit `GRANT` in migration | Supabase dashboard auto-grants; migrations do not |
| RBAC | Owner + Admin + Supervisor in MVP | Owner/Admin for full access; Supervisor for read-only team members |
| Billing unit | Per workspace | Each store = one subscription |
| Courier tracking | Post-MVP Pro feature | Shopify data sufficient for MVP profit formula |
| Background jobs | Inngest deferred to Phase 2 | Sync triggered on OAuth connect is sufficient for MVP |
| Shopify data API | GraphQL Admin API (not REST) | REST `orders.json` blocked by Shopify Protected Customer Data policy |
| Infinite re-render fix | `useMemo` on `dateRange` in Profit page | `new Date().toISOString()` changes every ms without memo |
| Meta OAuth scope | `ads_read` only | `read_insights` is invalid as a Facebook Login OAuth scope |
| meta-oauth deployment | `--no-verify-jwt` flag | Meta callback carries no user JWT — standard Supabase JWT check would reject it |
| Meta sync trigger | On Ads page mount via `useRef` flag | Avoids re-syncing on every render; once per session is sufficient for MVP |
| Meta Business Portfolio | Separate `Storeiq` portfolio | Keeps developer app isolated from personal perfume brand `vellora.fragnances` |
| Ad spend in profit | Subtracted only when Meta connected | Keeps profit formula accurate regardless of connection state |
| Dark mode implementation | `.dark` class on `<html>` + localStorage | Media query only was not toggleable; class approach allows manual override while respecting system default |
| Profit summary accuracy | Two parallel queries per hook (summary unlimited, display paginated) | Single paginated query capped totals at 20 rows — wrong for active stores |
| Campaign status fetch | Separate `/campaigns` call before insights loop in meta-sync | Insights API doesn't return `effective_status` — requires the campaigns endpoint |
| USD_TO_PKR_RATE | Hardcoded constant in `src/lib/constants.ts` | Meta charges in USD; Pakistani store owners need PKR equivalent for budgeting |
| Billing model | Manual bank transfer, no Stripe | Pakistan market norm; avoids payment gateway complexity for MVP |
| Plan storage | `selected_plan` in `workspaces` table + `localStorage` for pre-signup flow | Plan chosen before account exists; localStorage bridges the signup redirect gap |
| Admin authorization | Email check inside security definer RPCs (`auth.email() = ADMIN_EMAIL`) | No admin role table needed; enforced at DB level so frontend cannot bypass |
| Admin user creation | SQL migration seeds `auth.users` directly with `crypt()` | Avoids needing inbox access for test admin; `WHERE NOT EXISTS` prevents duplicates |
| Admin redirect | Check `ADMIN_EMAIL` in `AuthCallback` + `Login`, redirect to `/admin` | Implemented — both entry points covered |
| GuestGuard | `Navigate` to `/workspaces` if session exists on `/login` or `/signup` | Prevents logged-in users re-seeing auth pages |
| Signup plan selection | Inline 2×2 plan cards when no `?plan` param; required before submit | Ensures every signup has a plan regardless of entry point |
| Password field eye icon | `useState` in `Input` component; activates on `type="password"` | Zero changes needed in consumer components |
| Ads spend currency | Stored as PKR (Meta billing currency for Pakistani accounts); PKR=raw, USD=÷rate | Corrects double-conversion bug where USD showed PKR value |
| Permissions architecture | Central `ROLE_PERMISSIONS` map in `src/lib/permissions.ts` + `hasPermission()` helper | Future role/permission changes require one line edit; all enforcement reads from one place |
| Supervisor Settings block | Hide nav item in AppLayout + Access Denied card in Settings.tsx (not a redirect) | Redirect would confuse users on direct URL; inline card explains why access is denied |
| Invite flow | Edge Function + `workspace_invites` table + Supabase `inviteUserByEmail` + `accept_workspace_invite` RPC | Edge Function needed for service role key; invite table enables pending invite tracking and revoke |
| workspace-invite deployment | `--no-verify-jwt` flag | Function does its own auth check (caller role verified); using `--no-verify-jwt` allows flexibility without losing security |
| Admin invite permission | Admin can invite both Admin and Supervisor roles | Admins manage the day-to-day team; Owner remains in control via role-change restriction |
| Forgot password UX | Inline mode switch on Login (login/forgot/forgot-sent) — no separate page | Avoids adding a new route; AuthLayout reused; `SetPassword.tsx` already handles the no-workspaceId recovery case |
| Trial countdown | `trial_started_at` column + `TRIAL_DAYS = 7` constant; colour-coded banner in AppLayout + Workspaces | Client-side calculation, no cron needed; colours give urgency signal without being intrusive |

---

## Development Standards

### TypeScript

- **Strict mode on** — `tsconfig.json` has `"strict": true`
- **No `any`** — if you don't know the type, use `unknown` and narrow it
- **No `enum`** — `erasableSyntaxOnly: true` forbids enums. Use string literal unions:
  ```typescript
  // Bad — TS6 erasableSyntaxOnly forbids this
  enum WorkspaceMemberRole { Owner = 'owner' }

  // Good (see src/lib/permissions.ts)
  export type WorkspaceMemberRole = 'owner' | 'admin' | 'supervisor'
  export const WorkspaceMemberRole = { Owner: 'owner' as const, Admin: 'admin' as const, Supervisor: 'supervisor' as const }
  ```
- **No type assertions (`as SomeType`)** unless absolutely unavoidable
- **Return types on all functions** — especially hooks and utilities
- **JSX return type** — use `: JSX.Element` (provided by `src/types/global.d.ts` which re-exports React's JSX namespace globally)

### ESLint

Zero errors at all times. Run `npm run lint` before every commit.

**Key rules (from `eslint.config.js`):**
- `@typescript-eslint/no-explicit-any` — error
- `@typescript-eslint/no-unsafe-assignment` — error (strictTypeChecked)
- `simple-import-sort/imports` — error
- `react-hooks/rules-of-hooks` — error
- `react-hooks/exhaustive-deps` — error
- `react-hooks/set-state-in-effect` — off (intentionally disabled; common Supabase hook pattern)
- `no-console` — warn

### Supabase Migrations

- **Never manually run SQL in the Supabase dashboard** — all schema changes go through migration files
- Every schema change = a new migration file in `supabase/migrations/`
- Run with `echo "Y" | supabase db push`
- **Always include explicit GRANT statements** — Supabase dashboard auto-grants but migrations do not
- RLS policies + helper functions are part of the migration

### UI & Mobile Responsiveness

Tailwind breakpoints used:
```
Mobile:   default (< md)
Tablet:   md: (768px+)
Desktop:  lg: (1024px+)
```

Rules:
- **Sidebar → bottom nav on mobile** — `hidden md:flex` / `flex md:hidden`
- **Tables → cards on mobile** — render both, toggle with `hidden md:block` / `md:hidden`
- **Touch targets** — `min-h-[44px] min-w-[44px]` on all interactive elements
- **Summary cards** — `grid grid-cols-1 sm:grid-cols-3 gap-4` (4 cols when Meta connected)
- **Test at 375px** (iPhone SE) as minimum baseline

### Git & Commits

```
feat: add workspace switcher component
fix: correct ROAS calculation when spend is zero
chore: add explicit GRANT statements to migration
```

Never commit `.env`, `supabase/functions/.env`, `src/types/supabase.ts`, or any file containing plaintext secrets.

**GitHub repo:** `https://github.com/talhasaleem294/storeiq`

---

## One-Line Pitch

> "See your real Shopify profit and spot which ads are draining your budget — all in one dashboard."

---

## Project Setup Status

| Task | Status |
|---|---|
| Supabase project created | ✅ Done |
| Shopify Partner account + dev store (storeiq-wuwfpjau) | ✅ Done |
| Shopify App created + Client ID & Secret saved | ✅ Done |
| Meta Developer account + App (ID: 2458407957958041) | ✅ Done |
| Meta Business Portfolio (Storeiq) created | ✅ Done |
| Meta OAuth redirect URI registered | ✅ Done |
| React + Vite project scaffolded | ✅ Done |
| TypeScript strict mode + ESLint zero-error | ✅ Done |
| Tailwind CSS v4 installed + configured | ✅ Done |
| UI component library (Button, Card, Input, Badge, Skeleton, EmptyState, ErrorBoundary) | ✅ Done |
| Route guards (AuthGuard, WorkspaceGuard) | ✅ Done |
| AppLayout — responsive sidebar + mobile bottom nav | ✅ Done |
| All pages implemented (Landing, Login, Signup, Workspaces, Dashboard, Profit, Ads, Settings) | ✅ Done |
| All data hooks (useAuth, useWorkspace, useOrders, useAdsData, useShopifyConnection, useMetaConnection) | ✅ Done |
| Supabase migrations applied to remote DB (4 migrations) | ✅ Done |
| Edge Functions deployed (shopify-oauth, shopify-webhook, shopify-sync, shopify-token-connect) | ✅ Done |
| Edge Functions deployed (meta-oauth --no-verify-jwt, meta-sync) | ✅ Done |
| Supabase secrets set (SHOPIFY_CLIENT_ID, SHOPIFY_SECRET, META_APP_ID, META_APP_SECRET, APP_URL) | ✅ Done |
| Shopify redirect URL registered (shopify app deploy) | ✅ Done |
| Shopify Protected Customer Data access for dev store | ✅ Done |
| End-to-end Shopify connect tested (OAuth + order sync working) | ✅ Done |
| End-to-end Meta connect tested (OAuth + campaign sync working) | ✅ Done |
| True net profit calculation (Revenue - Refunds - Ad Spend) | ✅ Done |
| GitHub repo created + initial code pushed | ✅ Done (`github.com/talhasaleem294/storeiq`) |
| recharts installed + Revenue vs Refunds chart | ✅ Done |
| Dark/light mode toggle (localStorage + system preference) | ✅ Done |
| Key ratios (Refund Rate, Profit Margin, Ad Spend %) | ✅ Done |
| CSV export (orders + campaigns) | ✅ Done |
| Date filter on Ads page (7d / 30d) | ✅ Done |
| Low ROAS alert banner | ✅ Done |
| Order status breakdown on Dashboard | ✅ Done |
| PKR/USD toggle on Ads page | ✅ Done |
| Profit calculation pagination bug fixed | ✅ Done |
| Campaign status badge (migration + meta-sync) | ✅ Done — migration pushed, meta-sync redeployed |
| Campaign pagination (server-side, debounced, perf filter) | ✅ Done |
| Landing page redesign (marketing + pricing) | ✅ Done |
| Privacy Policy page `/privacy` | ✅ Done |
| Manual billing flow (plan → localStorage → banner → bank transfer) | ✅ Done |
| Admin panel `/admin` (activate/deactivate workspaces) | ✅ Done |
| Migration 20240006 pushed (selected_plan, admin RPCs, seed admin user) | ✅ Done |
| Admin UX after login (redirect admin email to /admin automatically) | ✅ Done |
| GuestGuard — logged-in users redirected from /login and /signup | ✅ Done |
| Avatar dropdown — logout + Profile link in AppLayout | ✅ Done |
| Profile page /app/:workspaceId/profile (name, phone, password) | ✅ Done |
| Eye icon on password fields (Input component) | ✅ Done |
| Inline plan selector on direct /signup (no ?plan param) | ✅ Done |
| Ads spend currency bug fixed (PKR stored, not USD) | ✅ Done |
| Permissions module (`src/lib/permissions.ts`) — central role→permission map | ✅ Done |
| Supervisor role — `workspace_members` constraint updated (migration 20240007) | ✅ Done |
| `workspace_invites` table — pending invite tracking | ✅ Done |
| `useWorkspaceRole` hook — role fetch for current user | ✅ Done |
| Settings tab gated — hidden from Supervisors; Access Denied card on direct URL | ✅ Done |
| Team Members UI — live member list, invite form, pending invites, remove/revoke | ✅ Done |
| `workspace-invite` Edge Function deployed (`--no-verify-jwt`) | ✅ Done |
| Invite acceptance in `AuthCallback.tsx` (`type=invite` → `accept_workspace_invite` RPC) | ✅ Done |
| Migration 20240007 pushed | ✅ Done |
| Set-password page after invite (`/set-password?workspaceId=xxx`) | ✅ Done |
| Forgot password flow (`/login` link → reset email → `type=recovery` in `AuthCallback` → `/set-password`) | ✅ Done |
| Trial days remaining banner (Workspaces + AppLayout, color changes by urgency) | ✅ Done |
| Migration 20240008 pushed (trial_started_at on workspaces) | ✅ Done |
| Supabase email templates (branded confirmation/reset/invite emails) | 🔧 Next |
| End-to-end signup flow test (both paths) | 🔧 Next |
| Frontend deployed to Vercel / Cloudflare Pages | 🔧 Pending |
| Meta app — add clients as testers (Dev mode limitation) | 🔧 Pending |
| Token expiry warning banner in Settings (Meta 60d, Shopify) | 🔧 Pending |
| Leopards merchant account | ⏳ Pending (Post-MVP) |
| PostEx merchant account | ⏳ Pending (Post-MVP) |

**Dev server:** `npm run dev` → http://localhost:5173
