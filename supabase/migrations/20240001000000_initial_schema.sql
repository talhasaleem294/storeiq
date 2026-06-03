-- ============================================================
-- WORKSPACES
-- ============================================================
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  subscription_status text not null default 'trial'
    check (subscription_status in ('active', 'inactive', 'trial')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('owner', 'admin', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Auto-add creator as owner when workspace is created
create or replace function handle_workspace_created()
returns trigger as $$
begin
  insert into workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_user_id, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_workspace_created
  after insert on workspaces
  for each row execute function handle_workspace_created();

-- ============================================================
-- SHOPIFY CONNECTIONS
-- ============================================================
create table shopify_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  shop_domain text not null,
  access_token text not null,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id)
);

-- ============================================================
-- META CONNECTIONS
-- ============================================================
create table meta_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  ads_account_id text not null,
  access_token text not null,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id)
);

-- ============================================================
-- ORDERS (synced from Shopify)
-- ============================================================
create table orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  shopify_order_id text not null,
  revenue numeric(12, 2) not null default 0,
  refund_amount numeric(12, 2) not null default 0,
  status text not null default 'paid',
  created_at timestamptz not null default now(),
  unique (workspace_id, shopify_order_id)
);

-- ============================================================
-- ADS DATA (synced from Meta)
-- ============================================================
create table ads_data (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  campaign_id text not null,
  campaign_name text not null,
  spend numeric(12, 2) not null default 0,
  roas numeric(8, 4) not null default 0,
  ctr numeric(8, 4) not null default 0,
  date date not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, campaign_id, date)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table shopify_connections enable row level security;
alter table meta_connections enable row level security;
alter table orders enable row level security;
alter table ads_data enable row level security;

-- Helper: check if current user is a member of a workspace
create or replace function is_workspace_member(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Helper: check if current user is owner of a workspace
create or replace function is_workspace_owner(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid() and role = 'owner'
  );
$$ language sql security definer stable;

-- workspaces policies
create policy "members can view workspaces"
  on workspaces for select
  using (is_workspace_member(id));

create policy "authenticated users can create workspaces"
  on workspaces for insert
  with check (owner_user_id = auth.uid());

create policy "owners can update workspaces"
  on workspaces for update
  using (is_workspace_owner(id));

create policy "owners can delete workspaces"
  on workspaces for delete
  using (is_workspace_owner(id));

-- workspace_members policies
create policy "members can view workspace members"
  on workspace_members for select
  using (is_workspace_member(workspace_id));

create policy "owners can insert members"
  on workspace_members for insert
  with check (is_workspace_owner(workspace_id));

create policy "owners can update member roles"
  on workspace_members for update
  using (is_workspace_owner(workspace_id));

create policy "owners can remove members"
  on workspace_members for delete
  using (is_workspace_owner(workspace_id));

-- shopify_connections policies (access_token excluded in client queries)
create policy "members can view shopify connection"
  on shopify_connections for select
  using (is_workspace_member(workspace_id));

-- meta_connections policies
create policy "members can view meta connection"
  on meta_connections for select
  using (is_workspace_member(workspace_id));

-- orders policies
create policy "members can view orders"
  on orders for select
  using (is_workspace_member(workspace_id));

-- ads_data policies
create policy "members can view ads data"
  on ads_data for select
  using (is_workspace_member(workspace_id));

-- ============================================================
-- INDEXES
-- ============================================================
create index orders_workspace_created on orders (workspace_id, created_at desc);
create index ads_data_workspace_date on ads_data (workspace_id, date desc);
create index workspace_members_user on workspace_members (user_id);

-- ============================================================
-- ROLLBACK (run manually to undo)
-- drop trigger on_workspace_created on workspaces;
-- drop function handle_workspace_created();
-- drop function is_workspace_owner(uuid);
-- drop function is_workspace_member(uuid);
-- drop table ads_data, orders, meta_connections, shopify_connections, workspace_members, workspaces;
-- ============================================================
