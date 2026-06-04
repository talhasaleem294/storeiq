import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

export function Profile(): JSX.Element {
  const { user } = useAuth()

  const [fullName, setFullName] = useState<string>(
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? '',
  )
  const [phone, setPhone] = useState<string>(
    (user?.user_metadata as { phone?: string } | undefined)?.phone ?? '',
  )
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [nameLoading, setNameLoading] = useState(false)
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  const [nameMsg, setNameMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [phoneMsg, setPhoneMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSaveName(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault()
    setNameLoading(true)
    setNameMsg(null)
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName.trim() } })
    setNameLoading(false)
    setNameMsg(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Name updated.' })
  }

  async function handleSavePhone(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault()
    setPhoneLoading(true)
    setPhoneMsg(null)
    const { error } = await supabase.auth.updateUser({ data: { phone: phone.trim() } })
    setPhoneLoading(false)
    setPhoneMsg(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Phone updated.' })
  }

  async function handleChangePassword(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters.' })
      return
    }
    setPasswordLoading(true)
    setPasswordMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordLoading(false)
    if (error) {
      setPasswordMsg({ type: 'error', text: error.message })
    } else {
      setPasswordMsg({ type: 'success', text: 'Password changed.' })
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">Profile</h1>
        <p className="mt-1 text-sm text-text">{user?.email}</p>
      </div>

      {/* Display name */}
      <section className="rounded-xl border border-border bg-bg p-5">
        <h2 className="mb-4 text-sm font-semibold text-heading">Display name</h2>
        <form onSubmit={(e) => void handleSaveName(e)} className="space-y-3">
          <Input
            label="Full name"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value) }}
            placeholder="Your name"
          />
          {nameMsg && (
            <p className={`text-sm ${nameMsg.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {nameMsg.text}
            </p>
          )}
          <Button type="submit" variant="primary" size="sm" loading={nameLoading}>
            Save name
          </Button>
        </form>
      </section>

      {/* Phone number */}
      <section className="rounded-xl border border-border bg-bg p-5">
        <h2 className="mb-4 text-sm font-semibold text-heading">Phone number</h2>
        <form onSubmit={(e) => void handleSavePhone(e)} className="space-y-3">
          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value) }}
            placeholder="+92 300 0000000"
          />
          {phoneMsg && (
            <p className={`text-sm ${phoneMsg.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {phoneMsg.text}
            </p>
          )}
          <Button type="submit" variant="primary" size="sm" loading={phoneLoading}>
            Save phone
          </Button>
        </form>
      </section>

      {/* Change password */}
      <section className="rounded-xl border border-border bg-bg p-5">
        <h2 className="mb-4 text-sm font-semibold text-heading">Change password</h2>
        <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-3">
          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value) }}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          <Input
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value) }}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          {passwordMsg && (
            <p className={`text-sm ${passwordMsg.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {passwordMsg.text}
            </p>
          )}
          <Button type="submit" variant="primary" size="sm" loading={passwordLoading}>
            Change password
          </Button>
        </form>
      </section>
    </div>
  )
}
