export const APP_NAME = 'StoreIQ'

export const ROUTES = {
  LANDING: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  WORKSPACES: '/workspaces',
  APP: {
    DASHBOARD: (workspaceId: string) => `/app/${workspaceId}/dashboard`,
    PROFIT: (workspaceId: string) => `/app/${workspaceId}/profit`,
    ADS: (workspaceId: string) => `/app/${workspaceId}/ads`,
    SETTINGS: (workspaceId: string) => `/app/${workspaceId}/settings`,
    PROFILE: (workspaceId: string) => `/app/${workspaceId}/profile`,
  },
  ADMIN: '/admin',
  PRIVACY: '/privacy',
  AUTH_CALLBACK: '/auth/callback',
  AUTH_ACCEPT_INVITE: '/auth/accept-invite',
  SET_PASSWORD: '/set-password',
} as const

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const

export const CACHE_TTL_MINUTES = {
  SHOPIFY_ORDERS: 15,
  META_ADS: 30,
} as const

// Approximate USD → PKR conversion rate for Meta ad spend display
// Update periodically to reflect current market rate
export const USD_TO_PKR_RATE = 278

// Trial period length in days — shown as countdown in AppLayout and Workspaces
export const TRIAL_DAYS = 7

// ─── Manual billing ──────────────────────────────────────────────────────────

// Admin login: admin@storeiq.com / admin1234 — change before real launch
export const ADMIN_EMAIL = 'admin@storeiq.com'

// Dummy bank details for testing — replace with real details before launch
export const BANK_DETAILS = {
  accountTitle:  'StoreIQ Payments',
  accountNumber: '1234-5678-9012',
  bankName:      'Meezan Bank',
  iban:          'PK36 MEZN 0001 2345 6789 0120',
} as const

// Dummy WhatsApp number for testing — replace before launch
export const WHATSAPP_NUMBER = '923001234567'

// Must stay in sync with the PLANS array in Landing.tsx
export const PLAN_PRICES: Record<string, string> = {
  starter: 'PKR 5,500',
  growth:  'PKR 10,000',
  pro:     'PKR 18,000',
  agency:  'PKR 35,000',
}

export const PLANS = [
  { key: 'starter', label: 'Starter', price: 'PKR 5,500/mo', description: '1 store · Meta + Shopify' },
  { key: 'growth',  label: 'Growth',  price: 'PKR 10,000/mo', description: '2 stores · Priority support' },
  { key: 'pro',     label: 'Pro',     price: 'PKR 18,000/mo', description: '5 stores · Courier tracking' },
  { key: 'agency',  label: 'Agency',  price: 'PKR 35,000/mo', description: 'Unlimited stores' },
] as const
