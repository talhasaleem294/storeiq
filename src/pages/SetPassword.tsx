import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { AuthLayout } from '@/components/layouts/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

export function SetPassword(): JSX.Element {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const workspaceId = searchParams.get('workspaceId')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const destination = workspaceId
    ? ROUTES.APP.DASHBOARD(workspaceId)
    : ROUTES.WORKSPACES

  async function handleSubmit(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      void navigate(destination, { replace: true })
    }
  }

  return (
    <AuthLayout
      title="Set your password"
      subtitle="Create a password so you can sign in again later."
    >
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
        You&apos;re signed in as <span className="font-medium">{user?.email}</span>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Input
          label="New password"
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(null) }}
          placeholder="••••••••"
          autoComplete="new-password"
          hint="At least 6 characters"
        />
        <Input
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); setError(null) }}
          placeholder="••••••••"
          autoComplete="new-password"
        />

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <Button type="submit" variant="primary" className="w-full" loading={loading}>
          Set password & continue →
        </Button>
      </form>
    </AuthLayout>
  )
}
