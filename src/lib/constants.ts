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
  },
  ADMIN: '/admin',
  AUTH_CALLBACK: '/auth/callback',
  AUTH_ACCEPT_INVITE: '/auth/accept-invite',
} as const

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const

export const CACHE_TTL_MINUTES = {
  SHOPIFY_ORDERS: 15,
  META_ADS: 30,
} as const
