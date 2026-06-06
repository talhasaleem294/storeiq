export type Permission =
  | 'settings:view'
  | 'integrations:manage'
  | 'members:invite'
  | 'members:remove'
  | 'members:view'

export type WorkspaceMemberRole = 'owner' | 'admin' | 'supervisor'

export const WorkspaceMemberRole = {
  Owner:      'owner'      as const,
  Admin:      'admin'      as const,
  Supervisor: 'supervisor' as const,
}

// Central permissions map — to add a role or permission, update only this object
const ROLE_PERMISSIONS: Record<WorkspaceMemberRole, ReadonlySet<Permission>> = {
  owner: new Set([
    'settings:view',
    'integrations:manage',
    'members:invite',
    'members:remove',
    'members:view',
  ]),
  admin: new Set([
    'settings:view',
    'integrations:manage',
    'members:invite',
    'members:remove',
    'members:view',
  ]),
  supervisor: new Set([]),
}

export function hasPermission(
  role: WorkspaceMemberRole | null | undefined,
  permission: Permission
): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role].has(permission)
}
