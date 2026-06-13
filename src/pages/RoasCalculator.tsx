import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ROUTES } from '@/lib/constants'

export function RoasCalculator(): JSX.Element {
  const [reportedRoas, setReportedRoas] = useState('')
  const [rtoRate, setRtoRate] = useState('')

  const roas = parseFloat(reportedRoas) || 0
  const rto = parseFloat(rtoRate) / 100
  const realRoas = roas > 0 && rto >= 0 && rto < 1 ? roas * (1 - rto) : null

  const shareText = realRoas !== null
    ? `I just discovered my real ROAS is ${realRoas.toFixed(2)}x, not ${roas.toFixed(2)}x. Try it:`
    : 'Check your real ROAS after RTO — free tool by StoreIQ:'

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <Link to={ROUTES.LANDING} className="text-lg font-bold text-heading">
          StoreIQ
        </Link>
      </header>

      <main className="mx-auto max-w-xl px-6 py-16">
        <div className="text-center">
          <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            Free Tool
          </span>
          <h1 className="mt-4 text-3xl font-bold text-heading">
            COD Real ROAS Calculator
          </h1>
          <p className="mt-3 text-text">
            Meta says your ROAS is 2.5x. But with 35% RTO, you never actually collected that revenue.
            See what your ROAS really is after returns.
          </p>
        </div>

        <div className="mt-10 space-y-4 rounded-2xl border border-border bg-surface p-6">
          <div>
            <label className="block text-sm font-medium text-heading" htmlFor="roas-input">
              Meta-Reported ROAS
            </label>
            <input
              id="roas-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 2.5"
              value={reportedRoas}
              onChange={(e) => { setReportedRoas(e.target.value) }}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-heading focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-heading" htmlFor="rto-input">
              Your RTO Rate (%)
            </label>
            <input
              id="rto-input"
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="e.g. 35"
              value={rtoRate}
              onChange={(e) => { setRtoRate(e.target.value) }}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-heading focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="mt-1 text-xs text-text">RTO = Return to Origin. Pakistan ecommerce average: 25–40%.</p>
          </div>

          {/* Result */}
          {realRoas !== null && (
            <div className={`mt-2 rounded-xl border-2 p-5 text-center ${realRoas >= 1 ? 'border-green-400 bg-green-50 dark:bg-green-950/30' : 'border-red-400 bg-red-50 dark:bg-red-950/30'}`}>
              <p className="text-sm font-medium text-text">Your Real ROAS after RTO</p>
              <p className={`mt-1 text-5xl font-bold ${realRoas >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                {realRoas.toFixed(2)}x
              </p>
              <p className="mt-2 text-sm text-text">
                Formula: <span className="font-mono text-heading">{roas.toFixed(2)} × (1 − {(rto * 100).toFixed(1)}%) = {realRoas.toFixed(2)}x</span>
              </p>
              {realRoas < 1 && (
                <p className="mt-2 text-sm font-semibold text-red-600">
                  You&apos;re losing money on ads after accounting for returns.
                </p>
              )}
              {realRoas >= 1 && realRoas < 1.5 && (
                <p className="mt-2 text-sm font-semibold text-amber-600">
                  Barely break-even. Consider reducing RTO or cutting ad spend.
                </p>
              )}
            </div>
          )}

          {/* Formula explanation */}
          {realRoas === null && (
            <div className="rounded-lg border border-border bg-bg p-4 text-sm text-text">
              <p className="font-medium text-heading">Formula</p>
              <p className="mt-1 font-mono">Real ROAS = Reported ROAS × (1 − RTO Rate)</p>
              <p className="mt-2">Example: 2.5x ROAS with 38% RTO = 1.55x real ROAS</p>
            </div>
          )}
        </div>

        {/* Share snippet */}
        {realRoas !== null && (
          <div className="mt-4 rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-medium text-text">Share this result</p>
            <p className="mt-1 rounded bg-bg px-3 py-2 text-sm text-heading font-mono break-all">
              {shareText} storeiq-five.vercel.app/tools/roas-calculator
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 rounded-2xl border border-accent/30 bg-accent/5 p-6 text-center">
          <p className="font-semibold text-heading">Want your real profit picture — automatically?</p>
          <p className="mt-1 text-sm text-text">
            Connect your Shopify + Meta to StoreIQ and see real ROAS, city-level RTO, and true net profit in one dashboard.
          </p>
          <Link
            to={ROUTES.SIGNUP}
            className="mt-4 inline-block rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Try StoreIQ Free →
          </Link>
        </div>
      </main>
    </div>
  )
}
