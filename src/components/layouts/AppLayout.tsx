import { clsx } from 'clsx'
import { NavLink, Outlet, useParams } from 'react-router-dom'

import { AdsIcon } from '@/components/ui/icons/AdsIcon'
import { DashboardIcon } from '@/components/ui/icons/DashboardIcon'
import { ProfitIcon } from '@/components/ui/icons/ProfitIcon'
import { SettingsIcon } from '@/components/ui/icons/SettingsIcon'
import { APP_NAME, ROUTES } from '@/lib/constants'

interface NavItem {
  label: string
  to: string
  icon: (props: { size?: number; className?: string }) => JSX.Element
  end?: boolean
}

function getNavItems(workspaceId: string): NavItem[] {
  return [
    { label: 'Dashboard', to: ROUTES.APP.DASHBOARD(workspaceId), icon: DashboardIcon, end: true },
    { label: 'Profit', to: ROUTES.APP.PROFIT(workspaceId), icon: ProfitIcon },
    { label: 'Ads', to: ROUTES.APP.ADS(workspaceId), icon: AdsIcon },
    { label: 'Settings', to: ROUTES.APP.SETTINGS(workspaceId), icon: SettingsIcon },
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

export function AppLayout(): JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navItems = getNavItems(workspaceId ?? '')

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
            <div className="h-8 w-8 rounded-full bg-accent-bg flex items-center justify-center text-xs font-semibold text-accent">
              S
            </div>
          </div>
        </header>

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
