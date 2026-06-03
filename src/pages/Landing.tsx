import { Link } from 'react-router-dom'

import { APP_NAME, ROUTES } from '@/lib/constants'

export function Landing(): JSX.Element {
  return (
    <div className="min-h-svh flex flex-col bg-bg">
      {/* Nav */}
      <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-8">
        <span className="text-lg font-bold text-accent">{APP_NAME}</span>
        <div className="flex items-center gap-3">
          <Link
            to={ROUTES.LOGIN}
            className="text-sm font-medium text-text hover:text-heading transition-colors"
          >
            Sign in
          </Link>
          <Link
            to={ROUTES.SIGNUP}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center rounded-full border border-accent-bg bg-accent-bg px-3 py-1 text-xs font-medium text-accent">
            Built for Pakistani eCommerce brands
          </div>

          <h1 className="mb-6 text-4xl font-bold tracking-tight text-heading sm:text-5xl lg:text-6xl">
            See your{' '}
            <span className="text-accent">real profit</span>{' '}
            — not just revenue
          </h1>

          <p className="mb-8 text-lg text-text sm:text-xl">
            Connect your Shopify store and Meta ads. Get one dashboard that shows
            revenue minus ad spend minus refunds — your actual profit, clearly.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to={ROUTES.SIGNUP}
              className="rounded-lg bg-accent px-6 py-3 text-base font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Start for free
            </Link>
            <Link
              to={ROUTES.LOGIN}
              className="rounded-lg border border-border px-6 py-3 text-base font-medium text-heading hover:bg-surface transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-3 max-w-3xl w-full">
          {[
            {
              title: 'Profit Dashboard',
              desc: 'Revenue minus ad spend minus refunds. Real numbers, not vanity metrics.',
            },
            {
              title: 'Meta Ads Tracking',
              desc: 'ROAS, CTR, and top campaigns at a glance. Know which ads are working.',
            },
            {
              title: 'Multi-store Ready',
              desc: 'Manage multiple Shopify stores from one login with workspace switching.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-bg p-5 text-left shadow-sm"
            >
              <h3 className="mb-2 text-sm font-semibold text-heading">{f.title}</h3>
              <p className="text-sm text-text leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-text">
        © 2024 {APP_NAME}. Built for Shopify stores in Pakistan.
      </footer>
    </div>
  )
}
