import { useState } from 'react'
import { Link } from 'react-router-dom'

import { AuthLayout } from '@/components/layouts/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ROUTES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

export function Signup(): JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault()
    if (password !== confirm) {
      setError("Passwords don't match")
      return
    }
    setLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signUp({ email, password })

    if (authError) {
      setError(authError.message)
    } else {
      setDone(true)
    }
    setLoading(false)
  }

  if (done) {
    return (
      <AuthLayout title="Check your email" subtitle="Almost there!">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm text-text">
            We sent a confirmation link to <strong className="text-heading">{email}</strong>.
            Click it to activate your account.
          </p>
          <Link to={ROUTES.LOGIN} className="inline-block text-sm text-accent hover:underline">
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start your free trial today">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); }}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); }}
          placeholder="Min. 8 characters"
          required
          autoComplete="new-password"
        />

        <Input
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); }}
          placeholder="••••••••"
          required
          autoComplete="new-password"
        />

        <Button type="submit" variant="primary" loading={loading} className="w-full">
          Create account
        </Button>

        <p className="text-center text-sm text-text">
          Already have an account?{' '}
          <Link to={ROUTES.LOGIN} className="text-accent hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
