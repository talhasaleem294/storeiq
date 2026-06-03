import { useState } from 'react'
import { Link } from 'react-router-dom'

import { APP_NAME, ROUTES } from '@/lib/constants'

// TODO: Confirm final prices with team before launch
const PLANS = [
  {
    name: 'Starter',
    price: 'PKR 5,500',
    period: '/month',
    description: 'For single-store owners who want to know their real profit.',
    popular: false,
    features: [
      '1 Shopify store',
      '1 Meta Ads account',
      'Profit dashboard',
      'Ads performance dashboard',
      'Owner access only',
      'Email support',
    ],
  },
  {
    name: 'Growth',
    price: 'PKR 10,000',
    period: '/month',
    description: 'For active brands running Meta campaigns and growing fast.',
    popular: true,
    features: [
      'Up to 3 workspaces',
      'Everything in Starter',
      'Team access (Owner + Admin)',
      'CSV export — orders & campaigns',
      'Campaign performance filters',
      'Priority email support',
    ],
  },
  {
    name: 'Pro',
    price: 'PKR 18,000',
    period: '/month',
    description: 'For serious brands with teams and high ad spend.',
    popular: false,
    features: [
      'Up to 10 workspaces',
      'Everything in Growth',
      'Up to 5 team members',
      '1 onboarding session included',
      'WhatsApp support',
      'Early access to new features',
    ],
  },
  {
    name: 'Agency',
    price: 'PKR 35,000',
    period: '/month',
    description: 'For agencies managing multiple client stores.',
    popular: false,
    features: [
      'Unlimited workspaces',
      'Everything in Pro',
      'Unlimited team members',
      'Dedicated account manager',
      'Custom onboarding for your team',
      'WhatsApp + call support',
    ],
  },
] as const

const PAIN_POINTS = [
  {
    icon: '📊',
    title: 'Revenue looks good — but is it profit?',
    desc: "Your Shopify dashboard shows sales going up. But after ad spend and refunds, you're not sure if you actually made money this month.",
  },
  {
    icon: '📉',
    title: "Which ads are actually working?",
    desc: "You're spending on Meta campaigns but you can't tell which ones are profitable and which ones are quietly draining your budget.",
  },
  {
    icon: '🗂️',
    title: 'Multiple stores, zero visibility',
    desc: "You manage more than one brand and jump between Shopify dashboards constantly. There's no single place to see the full picture.",
  },
] as const

const FEATURES = [
  {
    title: 'Real Profit Formula',
    desc: 'Revenue − Ad Spend − Refunds. One number that tells you the truth, not just the top line.',
  },
  {
    title: 'Meta Ads Dashboard',
    desc: 'ROAS, CTR, and spend per campaign — synced from your Meta account. Know exactly what your ads cost.',
  },
  {
    title: 'Good vs Losing Campaigns',
    desc: "Filter campaigns by performance in one click. Stop spending on what's losing, double down on what's working.",
  },
  {
    title: 'Multi-store Workspaces',
    desc: 'One login, multiple brands. Switch between workspaces like switching tabs — no separate accounts.',
  },
  {
    title: 'PKR Currency View',
    desc: 'Meta charges in USD. We convert your ad spend to PKR so your numbers make sense in your context.',
  },
  {
    title: 'Team Access',
    desc: 'Invite your store manager as an Admin. They get full dashboard access — you keep billing control.',
  },
] as const

const STEPS = [
  {
    number: '01',
    title: 'Connect your Shopify store',
    desc: 'OAuth takes under a minute. We pull order revenue and refunds automatically.',
  },
  {
    number: '02',
    title: 'Connect your Meta Ads account',
    desc: 'Link your ad account with one click. We sync the last 30 days of campaign data.',
  },
  {
    number: '03',
    title: 'See your real profit',
    desc: 'Your dashboard goes live instantly — Revenue, Refunds, Ad Spend, and Net Profit in one view.',
  },
] as const

function CheckIcon(): JSX.Element {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

export function Landing(): JSX.Element {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  return (
    <div className="min-h-svh flex flex-col bg-bg">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur-sm sm:px-8">
        <span className="text-lg font-bold text-accent">{APP_NAME}</span>
        <div className="flex items-center gap-3">
          <Link
            to={ROUTES.LOGIN}
            className="text-sm font-medium text-text transition-colors hover:text-heading"
          >
            Sign in
          </Link>
          <Link
            to={ROUTES.SIGNUP}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ── */}
        <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <div className="mb-5 inline-flex items-center rounded-full border border-accent-bg bg-accent-bg px-3 py-1 text-xs font-medium text-accent">
            Built for Pakistani eCommerce brands
          </div>

          <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight text-heading sm:text-5xl lg:text-6xl">
            Stop guessing.{' '}
            <span className="text-accent">Know your real profit.</span>
          </h1>

          <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed text-text">
            You run a Shopify store, spend on Meta ads, get orders every day — but at the end of
            the month you have no idea if you actually made money.{' '}
            <span className="font-medium text-heading">{APP_NAME} fixes that.</span>
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to={ROUTES.SIGNUP}
              className="min-h-[48px] rounded-lg bg-accent px-8 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              Start your free trial
            </Link>
            <Link
              to={ROUTES.LOGIN}
              className="min-h-[48px] rounded-lg border border-border px-8 py-3 text-base font-medium text-heading transition-colors hover:bg-surface"
            >
              Sign in
            </Link>
          </div>

          <p className="mt-4 text-xs text-text">
            No credit card required &nbsp;·&nbsp; Setup in 5 minutes &nbsp;·&nbsp; Bank transfer billing
          </p>
        </section>

        {/* ── Pain Points ── */}
        <section className="border-y border-border bg-surface py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-accent">
              Sound familiar?
            </p>
            <h2 className="mb-10 text-center text-2xl font-bold text-heading sm:text-3xl">
              The problem every Shopify store owner faces
            </h2>
            <div className="grid gap-5 sm:grid-cols-3">
              {PAIN_POINTS.map((p) => (
                <div
                  key={p.title}
                  className="rounded-xl border border-border bg-bg p-5 shadow-sm"
                >
                  <div className="mb-3 text-2xl">{p.icon}</div>
                  <h3 className="mb-2 text-sm font-semibold text-heading">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-text">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-accent">
              How it works
            </p>
            <h2 className="mb-10 text-center text-2xl font-bold text-heading sm:text-3xl">
              Live in three steps
            </h2>
            <div className="relative grid gap-8 sm:grid-cols-3">
              {/* Single line from center of first circle to center of last — desktop only */}
              <div className="absolute top-5 left-[calc(100%/6)] right-[calc(100%/6)] hidden h-px bg-border sm:block" />
              {STEPS.map((s) => (
                <div key={s.number} className="flex flex-col items-center text-center">
                  {/* ring-bg creates a halo so the line doesn't overlap the circle visually */}
                  <div className="relative z-10 mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-accent-bg text-sm font-bold text-accent ring-4 ring-bg">
                    {s.number}
                  </div>
                  <h3 className="mb-2 text-sm font-semibold text-heading">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-text">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="border-y border-border bg-surface py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-accent">
              Features
            </p>
            <h2 className="mb-10 text-center text-2xl font-bold text-heading sm:text-3xl">
              Everything you need, nothing you don't
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-border bg-bg p-5 shadow-sm"
                >
                  <h3 className="mb-2 text-sm font-semibold text-heading">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-text">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-accent">
              Pricing
            </p>
            <h2 className="mb-2 text-center text-2xl font-bold text-heading sm:text-3xl">
              Simple, honest pricing
            </h2>
            <p className="mb-10 text-center text-sm text-text">
              All plans billed monthly. Pay via bank transfer. No credit card required.
            </p>

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {PLANS.map((plan) => {
                const isSelected = selectedPlan === plan.name
                const planKey = plan.name.toLowerCase()
                return (
                  <div
                    key={plan.name}
                    onClick={() => { setSelectedPlan(plan.name) }}
                    className={`relative flex cursor-pointer flex-col rounded-xl border bg-bg p-6 shadow-sm transition-all duration-150 ${
                      isSelected
                        ? 'border-accent shadow-lg ring-2 ring-accent/20'
                        : plan.popular
                          ? 'border-accent/50 shadow-md hover:border-accent'
                          : 'border-border hover:border-accent/40 hover:shadow-md'
                    }`}
                  >
                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">
                          Selected
                        </span>
                      </div>
                    )}
                    {!isSelected && plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="mb-4">
                      <h3 className="mb-1 text-base font-bold text-heading">{plan.name}</h3>
                      <p className="text-xs leading-relaxed text-text">{plan.description}</p>
                    </div>

                    <div className="mb-5 flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-heading">{plan.price}</span>
                      <span className="text-sm text-text">{plan.period}</span>
                    </div>

                    <ul className="mb-6 flex-1 space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-text">
                          <CheckIcon />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <Link
                      to={`${ROUTES.SIGNUP}?plan=${planKey}`}
                      onClick={(e) => { e.stopPropagation() }}
                      className={`flex min-h-[44px] items-center justify-center rounded-lg px-4 text-sm font-semibold transition-all hover:opacity-90 ${
                        isSelected || plan.popular
                          ? 'bg-accent text-white'
                          : 'border border-border bg-bg text-heading hover:bg-surface'
                      }`}
                    >
                      {isSelected ? `Start with ${plan.name}` : 'Get started'}
                    </Link>
                  </div>
                )
              })}
            </div>

            {selectedPlan && (
              <p className="mt-6 text-center text-sm text-heading">
                You selected <span className="font-semibold text-accent">{selectedPlan}</span>.{' '}
                Click <span className="font-medium">"Start with {selectedPlan}"</span> to create your account.
              </p>
            )}

            <p className="mt-4 text-center text-xs text-text">
              Need a custom plan for a larger operation?{' '}
              <a href="mailto:support@storeiq.app" className="text-accent hover:underline">
                Contact us
              </a>
            </p>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="border-t border-accent-bg bg-accent-bg py-16">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <h2 className="mb-3 text-2xl font-bold text-heading sm:text-3xl">
              Ready to see your real numbers?
            </h2>
            <p className="mb-8 text-base text-text">
              Join Pakistani Shopify brands who've stopped guessing and started growing.
            </p>
            <Link
              to={ROUTES.SIGNUP}
              className="inline-flex min-h-[52px] items-center rounded-lg bg-accent px-10 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              Start your free trial
            </Link>
            <p className="mt-4 text-xs text-text">No credit card required</p>
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-6 text-center text-xs text-text">
        © 2025 {APP_NAME}. Built for Shopify stores in Pakistan.{' '}
        <Link to={ROUTES.PRIVACY} className="underline underline-offset-2 transition-colors hover:text-heading">
          Privacy Policy
        </Link>
      </footer>

    </div>
  )
}
