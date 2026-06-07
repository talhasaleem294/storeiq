import { clsx } from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'

import { AdsIcon } from '@/components/ui/icons/AdsIcon'
import { CampaignsIcon } from '@/components/ui/icons/CampaignsIcon'
import { DashboardIcon } from '@/components/ui/icons/DashboardIcon'
import { InfluencersIcon } from '@/components/ui/icons/InfluencersIcon'
import { ProfitIcon } from '@/components/ui/icons/ProfitIcon'
import { SettingsIcon } from '@/components/ui/icons/SettingsIcon'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useWorkspaceRole } from '@/hooks/useWorkspaceRole'
import { APP_NAME, ROUTES, TRIAL_DAYS } from '@/lib/constants'
import { hasPermission } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'

interface NavItem {
  label: string
  to: string
  icon: (props: { size?: number; className?: string }) => JSX.Element
  end?: boolean
}

function getNavItems(workspaceId: string): NavItem[] {
  return [
    { label: 'Dashboard',   to: ROUTES.APP.DASHBOARD(workspaceId),   icon: DashboardIcon, end: true },
    { label: 'Profit',      to: ROUTES.APP.PROFIT(workspaceId),      icon: ProfitIcon },
    { label: 'Ads',         to: ROUTES.APP.ADS(workspaceId),         icon: AdsIcon },
    { label: 'Campaigns',   to: ROUTES.APP.CAMPAIGNS(workspaceId),   icon: CampaignsIcon },
    { label: 'Influencers', to: ROUTES.APP.INFLUENCERS(workspaceId), icon: InfluencersIcon },
    { label: 'Settings',    to: ROUTES.APP.SETTINGS(workspaceId),    icon: SettingsIcon },
  ]
}

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return clsx(
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
    isActive
      ? 'bg-accent-bg text-accent'
      : 'text-text hover:bg-surface hover:text-heading'
  )
}

function bottomNavClass({ isActive }: { isActive: boolean }): string {
  return clsx(
    'flex flex-1 flex-col items-center justify-center gap-1 py-1 text-xs font-medium transition-colors duration-150 min-h-[44px]',
    isActive ? 'text-accent' : 'text-text'
  )
}

function trialDaysRemaining(trialStartedAt: string | null): number {
  if (!trialStartedAt) return TRIAL_DAYS
  const expires = new Date(trialStartedAt).getTime() + TRIAL_DAYS * 86_400_000
  return Math.max(Math.ceil((expires - Date.now()) / 86_400_000), 0)
}

export function AppLayout(): JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { theme, toggleTheme } = useTheme()
  const { workspace } = useWorkspace(workspaceId ?? '')
  const status = workspace?.subscription_status ?? null
  const isTrial = status === 'trial'
  const isPendingActivation = status !== null && status !== 'active' && status !== 'trial'
  const daysLeft = isTrial ? trialDaysRemaining(workspace?.trial_started_at ?? null) : 0
  const { user } = useAuth()
  const { role } = useWorkspaceRole(workspaceId ?? '')
  const navItems = getNavItems(workspaceId ?? '').filter(
    (item) => item.label !== 'Settings' || hasPermission(role, 'settings:view')
  )
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const userInitial = (user?.email ?? 'U').charAt(0).toUpperCase()

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleOutsideClick)
    return () => { document.removeEventListener('mousedown', handleOutsideClick) }
  }, [menuOpen])

  async function handleSignOut(): Promise<void> {
    await supabase.auth.signOut()
    void navigate(ROUTES.LOGIN, { replace: true })
  }

  return (
    <div className="grid min-h-svh grid-cols-1 md:grid-cols-[220px_1fr]">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex md:flex-col md:sticky md:top-0 md:h-svh border-r border-border bg-bg overflow-y-auto">
        <div className="flex h-14 shrink-0 items-center px-4 border-b border-border">
          <span className="text-base font-bold text-accent">{APP_NAME}</span>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass} end={item.end}>
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="shrink-0 border-t border-border p-3">
          <p className="text-xs text-text">StoreIQ MVP</p>
        </div>
      </aside>

      {/* Right column */}
      <div className="flex min-h-svh flex-col md:min-h-0">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur-sm">
          <span className="font-bold text-accent md:hidden">{APP_NAME}</span>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            {/* Dark / light toggle */}
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-text transition-colors hover:bg-surface hover:text-heading"
            >
              {theme === 'dark' ? (
                /* Sun icon — click to go light */
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              ) : (
                /* Moon icon — click to go dark */
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            {/* Avatar + dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => { setMenuOpen((o) => !o) }}
                aria-label="Open user menu"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-bg text-xs font-semibold text-accent transition-opacity hover:opacity-80"
              >
                {userInitial}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-10 z-50 w-44 rounded-xl border border-border bg-bg py-1 shadow-lg">
                  <Link
                    to={ROUTES.APP.PROFILE(workspaceId ?? '')}
                    onClick={() => { setMenuOpen(false) }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text transition-colors hover:bg-surface hover:text-heading"
                  >
                    Profile
                  </Link>
                  <hr className="my-1 border-border" />
                  <button
                    onClick={() => { void handleSignOut() }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-surface dark:text-red-400"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Trial countdown banner */}
        {isTrial && (
          <div className={`flex items-center justify-between gap-3 border-b px-4 py-2 ${
            daysLeft > 3
              ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
              : daysLeft >= 1
                ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
          }`}>
            <p className={`text-xs ${
              daysLeft > 3
                ? 'text-blue-800 dark:text-blue-300'
                : daysLeft >= 1
                  ? 'text-amber-800 dark:text-amber-300'
                  : 'text-red-700 dark:text-red-400'
            }`}>
              {daysLeft > 0
                ? <><span className="font-semibold">{daysLeft} day{daysLeft === 1 ? '' : 's'} left in your trial.</span>{' '}Activate to keep access.</>
                : <><span className="font-semibold">Trial expired.</span>{' '}Activate your account to continue.</>
              }
            </p>
            <Link
              to={ROUTES.WORKSPACES}
              className={`shrink-0 text-xs font-semibold underline underline-offset-2 ${
                daysLeft > 3
                  ? 'text-blue-700 hover:text-blue-900 dark:text-blue-400'
                  : daysLeft >= 1
                    ? 'text-amber-700 hover:text-amber-900 dark:text-amber-400'
                    : 'text-red-700 hover:text-red-900 dark:text-red-400'
              }`}
            >
              Activate now →
            </Link>
          </div>
        )}

        {/* Pending activation banner (inactive / unpaid, not in trial) */}
        {isPendingActivation && (
          <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <span className="font-semibold">Account pending activation.</span>{' '}
              Transfer payment and WhatsApp your receipt to activate.
            </p>
            <Link
              to={ROUTES.WORKSPACES}
              className="shrink-0 text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900 dark:text-amber-400"
            >
              View instructions →
            </Link>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t border-border bg-bg md:hidden">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={bottomNavClass} end={item.end}>
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
