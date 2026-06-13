import type { WorkspaceMemberRole } from '@/lib/permissions'

export type { WorkspaceMemberRole }

export type SubscriptionStatus = 'active' | 'inactive' | 'trial'

export const SubscriptionStatus = {
  Active: 'active' as const,
  Inactive: 'inactive' as const,
  Trial: 'trial' as const,
}

export interface Workspace {
  id: string
  name: string
  owner_user_id: string
  subscription_status: SubscriptionStatus
  selected_plan: string | null
  created_at: string
  trial_started_at: string | null
}

export interface AdminWorkspace {
  id: string
  name: string
  owner_email: string
  subscription_status: SubscriptionStatus
  selected_plan: string | null
  created_at: string
  trial_started_at: string | null
}

export interface WorkspaceMember {
  workspace_id: string
  user_id: string
  role: WorkspaceMemberRole
  created_at: string
}

export interface WorkspaceMemberWithEmail {
  workspace_id: string
  user_id: string
  role: WorkspaceMemberRole
  email: string
  created_at: string
}

export interface WorkspaceInvite {
  id: string
  workspace_id: string
  invited_email: string
  role: 'admin' | 'supervisor'
  invited_by: string
  token: string
  accepted_at: string | null
  expires_at: string
  created_at: string
}

export interface ShopifyConnection {
  id: string
  workspace_id: string
  shop_domain: string
  token_expires_at: string | null
  created_at: string
}

export interface MetaConnection {
  id: string
  workspace_id: string
  ads_account_id: string
  token_expires_at: string | null
  created_at: string
}

export type ConfirmationStatus = 'confirmed' | 'no_response' | 'cancelled'

export interface Order {
  id: string
  workspace_id: string
  shopify_order_id: string
  revenue: number
  refund_amount: number
  status: string
  fulfillment_status: string | null
  created_at: string
  confirmation_status: ConfirmationStatus | null
  city?: string | null
  customer_id?: string | null
}

export interface AdsData {
  id: string
  workspace_id: string
  campaign_id: string
  campaign_name: string
  spend: number
  roas: number
  ctr: number
  date: string
  status: string
}

export interface DateRange {
  from: string
  to: string
}

export interface OrdersSummary {
  totalRevenue: number
  totalRefunds: number
  netProfit: number
}

export interface AdsDataTotals {
  totalSpend: number
  avgRoas: number
  avgCtr: number
}

// ── PR & Influencer Module ────────────────────────────────────

export type InfluencerPlatform = 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'other'
export const InfluencerPlatform = {
  Instagram: 'instagram' as const,
  TikTok:    'tiktok'    as const,
  YouTube:   'youtube'   as const,
  Facebook:  'facebook'  as const,
  Other:     'other'     as const,
}

export type InfluencerNiche = 'fashion' | 'lifestyle' | 'beauty' | 'tech' | 'food' | 'other'

export type ContentType =
  | 'reel' | 'story' | 'feed_post' | 'tiktok'
  | 'youtube_video' | 'youtube_short' | 'live' | 'other'

export type DeliverableStatus = 'pending' | 'posted' | 'late' | 'no_show'

export type PaymentMethod =
  | 'bank_transfer' | 'easypaisa' | 'jazzcash' | 'cash' | 'barter' | 'other'

export type CampaignStatus = 'planned' | 'active' | 'completed' | 'cancelled'

export interface MarketingCampaign {
  id:           string
  workspace_id: string
  name:         string
  start_date:   string | null
  end_date:     string | null
  status:       CampaignStatus
  notes:        string | null
  created_at:   string
}

export interface Influencer {
  id:             string
  workspace_id:   string
  name:           string
  platform:       InfluencerPlatform | null
  handle:         string | null
  niche:          InfluencerNiche | null
  follower_count: number | null
  notes:          string | null
  created_at:     string
}

export interface InfluencerDeal {
  id:             string
  workspace_id:   string
  influencer_id:  string
  campaign_id:    string | null
  deal_date:      string
  total_amount:   number
  advance_paid:   number
  balance_due:    number   // GENERATED ALWAYS AS — never include in INSERT/UPDATE payloads
  product_value:  number
  payment_method: PaymentMethod | null
  promo_code:     string | null
  notes:          string | null
  created_at:     string
}

export interface InfluencerDeliverable {
  id:           string
  deal_id:      string
  workspace_id: string
  content_type: ContentType
  amount:       number
  due_date:     string | null
  posted_at:    string | null
  post_url:     string | null
  status:       DeliverableStatus
  notes:        string | null
  created_at:   string
}

export interface CampaignAdLink {
  id:                string
  campaign_id:       string
  workspace_id:      string
  ads_campaign_id:   string
  ads_campaign_name: string | null
  created_at:        string
}

export interface DealWithDeliverables extends InfluencerDeal {
  deliverables: InfluencerDeliverable[]
  influencer:   Pick<Influencer, 'id' | 'name' | 'platform' | 'handle'>
}
