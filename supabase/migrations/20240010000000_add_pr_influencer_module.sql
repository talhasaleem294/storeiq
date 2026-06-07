-- ============================================================
-- MIGRATION 20240010: PR & Influencer Management Module
-- Five new tables: marketing_campaigns, influencers,
-- influencer_deals, influencer_deliverables, campaign_ad_links
-- ============================================================

-- ── 1. marketing_campaigns ───────────────────────────────────
CREATE TABLE marketing_campaigns (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  start_date   date,
  end_date     date,
  status       text        NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX marketing_campaigns_workspace
  ON marketing_campaigns (workspace_id, created_at DESC);

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_campaigns TO authenticated;

CREATE POLICY "members can view campaigns"
  ON marketing_campaigns FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "owners and admins can insert campaigns"
  ON marketing_campaigns FOR INSERT
  WITH CHECK (is_workspace_owner_or_admin(workspace_id));

CREATE POLICY "owners and admins can update campaigns"
  ON marketing_campaigns FOR UPDATE
  USING (is_workspace_owner_or_admin(workspace_id));

CREATE POLICY "owners and admins can delete campaigns"
  ON marketing_campaigns FOR DELETE
  USING (is_workspace_owner_or_admin(workspace_id));

-- ── 2. influencers ───────────────────────────────────────────
CREATE TABLE influencers (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  platform       text        CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'facebook', 'other')),
  handle         text,
  niche          text        CHECK (niche IN ('fashion', 'lifestyle', 'beauty', 'tech', 'food', 'other')),
  follower_count int,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, handle)
);

CREATE INDEX influencers_workspace
  ON influencers (workspace_id, created_at DESC);

ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON influencers TO authenticated;

CREATE POLICY "members can view influencers"
  ON influencers FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "owners and admins can insert influencers"
  ON influencers FOR INSERT
  WITH CHECK (is_workspace_owner_or_admin(workspace_id));

CREATE POLICY "owners and admins can update influencers"
  ON influencers FOR UPDATE
  USING (is_workspace_owner_or_admin(workspace_id));

CREATE POLICY "owners and admins can delete influencers"
  ON influencers FOR DELETE
  USING (is_workspace_owner_or_admin(workspace_id));

-- ── 3. influencer_deals ──────────────────────────────────────
CREATE TABLE influencer_deals (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid          NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  influencer_id  uuid          NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  campaign_id    uuid          REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  deal_date      date          NOT NULL,
  total_amount   numeric(12,2) NOT NULL DEFAULT 0,
  advance_paid   numeric(12,2) NOT NULL DEFAULT 0,
  balance_due    numeric(12,2) GENERATED ALWAYS AS (total_amount - advance_paid) STORED,
  product_value  numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text          CHECK (payment_method IN (
                   'bank_transfer', 'easypaisa', 'jazzcash', 'cash', 'barter', 'other'
                 )),
  promo_code     text,
  notes          text,
  created_at     timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX influencer_deals_workspace
  ON influencer_deals (workspace_id, deal_date DESC);

CREATE INDEX influencer_deals_influencer
  ON influencer_deals (influencer_id);

CREATE INDEX influencer_deals_campaign
  ON influencer_deals (campaign_id)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX influencer_deals_workspace_date
  ON influencer_deals (workspace_id, deal_date);

ALTER TABLE influencer_deals ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON influencer_deals TO authenticated;

CREATE POLICY "members can view deals"
  ON influencer_deals FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "owners and admins can insert deals"
  ON influencer_deals FOR INSERT
  WITH CHECK (is_workspace_owner_or_admin(workspace_id));

CREATE POLICY "owners and admins can update deals"
  ON influencer_deals FOR UPDATE
  USING (is_workspace_owner_or_admin(workspace_id));

CREATE POLICY "owners and admins can delete deals"
  ON influencer_deals FOR DELETE
  USING (is_workspace_owner_or_admin(workspace_id));

-- ── 4. influencer_deliverables ───────────────────────────────
CREATE TABLE influencer_deliverables (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      uuid          NOT NULL REFERENCES influencer_deals(id) ON DELETE CASCADE,
  workspace_id uuid          NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content_type text          NOT NULL
    CHECK (content_type IN (
      'reel', 'story', 'feed_post', 'tiktok',
      'youtube_video', 'youtube_short', 'live', 'other'
    )),
  amount       numeric(12,2) NOT NULL DEFAULT 0,
  due_date     date,
  posted_at    date,
  post_url     text,
  status       text          NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'posted', 'late', 'no_show')),
  notes        text,
  created_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX influencer_deliverables_deal
  ON influencer_deliverables (deal_id);

CREATE INDEX influencer_deliverables_workspace
  ON influencer_deliverables (workspace_id, status);

CREATE INDEX influencer_deliverables_overdue
  ON influencer_deliverables (workspace_id, due_date)
  WHERE status = 'pending';

ALTER TABLE influencer_deliverables ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON influencer_deliverables TO authenticated;

CREATE POLICY "members can view deliverables"
  ON influencer_deliverables FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "owners and admins can insert deliverables"
  ON influencer_deliverables FOR INSERT
  WITH CHECK (is_workspace_owner_or_admin(workspace_id));

CREATE POLICY "owners and admins can update deliverables"
  ON influencer_deliverables FOR UPDATE
  USING (is_workspace_owner_or_admin(workspace_id));

CREATE POLICY "owners and admins can delete deliverables"
  ON influencer_deliverables FOR DELETE
  USING (is_workspace_owner_or_admin(workspace_id));

-- ── 5. campaign_ad_links ─────────────────────────────────────
CREATE TABLE campaign_ad_links (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       uuid        NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  workspace_id      uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ads_campaign_id   text        NOT NULL,
  ads_campaign_name text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, ads_campaign_id)
);

CREATE INDEX campaign_ad_links_campaign
  ON campaign_ad_links (campaign_id);

ALTER TABLE campaign_ad_links ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON campaign_ad_links TO authenticated;

CREATE POLICY "members can view ad links"
  ON campaign_ad_links FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "owners and admins can insert ad links"
  ON campaign_ad_links FOR INSERT
  WITH CHECK (is_workspace_owner_or_admin(workspace_id));

CREATE POLICY "owners and admins can delete ad links"
  ON campaign_ad_links FOR DELETE
  USING (is_workspace_owner_or_admin(workspace_id));
