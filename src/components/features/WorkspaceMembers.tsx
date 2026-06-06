import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import type { WorkspaceMemberRole } from '@/lib/permissions';
import { hasPermission } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'
import type { WorkspaceInvite,WorkspaceMemberWithEmail } from '@/types/app'

interface WorkspaceMembersProps {
  workspaceId: string
  callerRole: WorkspaceMemberRole | null
}

type RoleBadgeVariant = 'accent' | 'warning' | 'neutral'

function roleBadgeVariant(role: unknown): RoleBadgeVariant {
  if (role === 'owner') return 'accent'
  if (role === 'admin') return 'warning'
  return 'neutral'
}

function roleLabel(role: unknown): string {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  if (role === 'supervisor') return 'Supervisor'
  return typeof role === 'string' ? role : ''
}

function canRemoveMember(
  member: WorkspaceMemberWithEmail,
  callerRole: WorkspaceMemberRole | null,
  currentUserId: string | undefined
): boolean {
  if (!callerRole || !currentUserId) return false
  if (member.user_id === currentUserId) return false
  if (member.role === 'owner') return false
  if (callerRole === 'admin' && member.role !== 'supervisor') return false
  return hasPermission(callerRole, 'members:remove')
}

export function WorkspaceMembers({ workspaceId, callerRole }: WorkspaceMembersProps): JSX.Element {
  const { user, session } = useAuth()

  const [members, setMembers] = useState<WorkspaceMemberWithEmail[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [membersError, setMembersError] = useState<string | null>(null)

  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [invitesLoading, setInvitesLoading] = useState(false)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'supervisor'>('supervisor')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  const [removingUserId, setRemovingUserId] = useState<string | null>(null)

  const canInvite = hasPermission(callerRole, 'members:invite')

  function fetchMembers(): void {
    setMembersLoading(true)
    setMembersError(null)
    void supabase
      .rpc('get_workspace_members_with_email', { ws_id: workspaceId })
      .then(({ data, error: err }) => {
        if (err) {
          setMembersError(err.message)
        } else {
          const safe = Array.isArray(data) ? (data as unknown as WorkspaceMemberWithEmail[]) : []
          setMembers(safe)
        }
        setMembersLoading(false)
      })
  }

  function fetchInvites(): void {
    if (!canInvite) return
    setInvitesLoading(true)
    void supabase
      .from('workspace_invites')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const safe = Array.isArray(data) ? (data as unknown as WorkspaceInvite[]) : []
        setInvites(safe)
        setInvitesLoading(false)
      })
  }

  useEffect(() => {
    if (!workspaceId || !callerRole) return
    fetchMembers()
    fetchInvites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, callerRole])

  async function handleInvite(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault()
    const email = inviteEmail.trim().toLowerCase()
    if (!email) { setInviteError('Please enter an email address'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setInviteError('Please enter a valid email address'); return }

    setInviting(true)
    setInviteError(null)
    setInviteSuccess(false)

    try {
      const res = await fetch(
        `${String(import.meta.env.VITE_SUPABASE_URL)}/functions/v1/workspace-invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ workspaceId, invitedEmail: email, role: inviteRole }),
        }
      )

      const json = await res.json() as { error?: string; message?: string }

      if (!res.ok) {
        setInviteError((json.error ?? json.message) ?? 'Failed to send invite')
      } else {
        setInviteEmail('')
        setInviteRole('supervisor')
        setInviteSuccess(true)
        fetchInvites()
        setTimeout(() => { setInviteSuccess(false) }, 4000)
      }
    } catch {
      setInviteError('Network error — please try again')
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove(targetUserId: string): Promise<void> {
    setRemovingUserId(targetUserId)
    const { error: err } = await supabase.rpc('remove_workspace_member', {
      ws_id: workspaceId,
      target_user_id: targetUserId,
    })
    setRemovingUserId(null)
    if (!err) {
      fetchMembers()
    }
  }

  async function handleRevokeInvite(inviteId: string): Promise<void> {
    await supabase.from('workspace_invites').delete().eq('id', inviteId)
    fetchInvites()
  }

  return (
    <Card padding="lg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/30">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-heading">Team Members</h2>
          <p className="text-xs text-text">Manage who has access to this workspace.</p>
        </div>
      </div>

      {/* Members list */}
      {membersError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {membersError}
        </div>
      )}

      {membersLoading ? (
        <div className="space-y-2 mb-5">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ) : (
        <ul className="divide-y divide-border mb-5">
          {members.map((member) => (
            <li key={member.user_id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-bg text-xs font-semibold text-accent">
                  {member.email.charAt(0).toUpperCase()}
                </div>
                <span className="truncate text-sm text-heading">{member.email}</span>
                {member.user_id === user?.id && (
                  <span className="text-xs text-text">(you)</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={roleBadgeVariant(member.role)}>
                  {roleLabel(member.role)}
                </Badge>
                {canRemoveMember(member, callerRole, user?.id) && (
                  <Button
                    variant="danger"
                    size="sm"
                    loading={removingUserId === member.user_id}
                    onClick={() => void handleRemove(member.user_id)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Invite form */}
      {canInvite && (
        <>
          <div className="border-t border-border pt-5">
            <h3 className="text-sm font-medium text-heading mb-3">Invite a team member</h3>

            {inviteSuccess && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.354-9.354a.5.5 0 00-.708-.707L7 8.793 5.354 7.146a.5.5 0 10-.708.708l2 2a.5.5 0 00.708 0l4-4z" clipRule="evenodd" />
                </svg>
                Invite sent! They'll receive an email with a link to join.
              </div>
            )}

            {inviteError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                {inviteError}
              </div>
            )}

            <form onSubmit={(e) => void handleInvite(e)} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  label=""
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null) }}
                />
              </div>
              <div className="flex items-start gap-2">
                <select
                  value={inviteRole}
                  onChange={(e) => { setInviteRole(e.target.value as 'admin' | 'supervisor') }}
                  className="h-[42px] rounded-lg border border-border bg-bg px-3 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="admin">Admin</option>
                  <option value="supervisor">Supervisor</option>
                </select>
                <Button type="submit" variant="primary" size="sm" loading={inviting}>
                  Send Invite
                </Button>
              </div>
            </form>
          </div>

          {/* Pending invites */}
          {!invitesLoading && invites.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="text-sm font-medium text-heading mb-3">Pending invites</h3>
              <ul className="space-y-2">
                {invites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate text-sm text-heading">{invite.invited_email}</span>
                      <Badge variant={roleBadgeVariant(invite.role)}>
                        {roleLabel(invite.role)}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRevokeInvite(invite.id)}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
