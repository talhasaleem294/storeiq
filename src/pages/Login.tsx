import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AuthLayout } from '@/components/layouts/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ADMIN_EMAIL, ROUTES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

type Mode = 'login' | 'forgot' | 'forgot-sent'

export function Login(): JSX.Element {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      const destination = data.user.email === ADMIN_EMAIL ? ROUTES.ADMIN : ROUTES.WORKSPACES
      void navigate(destination, { replace: true })
    }
  }

  async function handleForgot(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + ROUTES.AUTH_CALLBACK,
    })

    setLoading(false)

    if (resetError) {
      setError(resetError.message)
    } else {
      setMode('forgot-sent')
    }
  }

  if (mode === 'forgot-sent') {
    return (
      <AuthLayout title="Check your inbox" subtitle="A reset link has been sent if an account exists for that email.">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          We sent a password reset link to <span className="font-medium">{email}</span>.
          Click the link in the email to set a new password.
        </div>
        <button
          type="button"
          onClick={() => { setMode('login'); setError(null) }}
          className="mt-4 w-full text-center text-sm text-accent hover:underline"
        >
          ← Back to sign in
        </button>
      </AuthLayout>
    )
  }

  if (mode === 'forgot') {
    return (
      <AuthLayout title="Reset password" subtitle="Enter your email and we'll send you a reset link.">
        <form onSubmit={(e) => void handleForgot(e)} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value) }}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full"
          >
            Send reset link
          </Button>

          <button
            type="button"
            onClick={() => { setMode('login'); setError(null) }}
            className="w-full text-center text-sm text-text hover:text-heading"
          >
            ← Back to sign in
          </button>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your account">
      <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value) }}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />

        <div>
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value) }}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
          <div className="mt-1 text-right">
            <button
              type="button"
              onClick={() => { setMode('forgot'); setError(null) }}
              className="text-xs text-accent hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={loading}
          className="w-full"
        >
          Sign in
        </Button>

        <p className="text-center text-sm text-text">
          Don't have an account?{' '}
          <Link to={ROUTES.SIGNUP} className="text-accent hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
