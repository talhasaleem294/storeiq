// String literal unions (erasableSyntaxOnly-compatible — no enums)
export type WorkspaceMemberRole = 'owner' | 'admin' | 'viewer'
export type SubscriptionStatus = 'active' | 'inactive' | 'trial'

export const WorkspaceMemberRole = {
  Owner: 'owner' as const,
  Admin: 'admin' as const,
  Viewer: 'viewer' as const,
}

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
}

export interface AdminWorkspace {
  id: string
  name: string
  owner_email: string
  subscription_status: SubscriptionStatus
  selected_plan: string | null
  created_at: string
}

export interface WorkspaceMember {
  workspace_id: string
  user_id: string
  role: WorkspaceMemberRole
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

export interface Order {
  id: string
  workspace_id: string
  shopify_order_id: string
  revenue: number
  refund_amount: number
  status: string
  created_at: string
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
