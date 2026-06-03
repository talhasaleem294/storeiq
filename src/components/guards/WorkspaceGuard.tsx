import { Navigate, Outlet, useParams } from 'react-router-dom'

import { SkeletonPage } from '@/components/ui/Skeleton'
import { useWorkspace } from '@/hooks/useWorkspace'
import { ROUTES } from '@/lib/constants'

export function WorkspaceGuard(): JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { workspace, loading, error } = useWorkspace(workspaceId ?? '')

  if (loading) return <SkeletonPage />
  if (error !== null || !workspace) return <Navigate to={ROUTES.WORKSPACES} replace />

  return <Outlet />
}
