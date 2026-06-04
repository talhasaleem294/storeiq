import { Navigate, Outlet } from 'react-router-dom'

import { SkeletonPage } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/lib/constants'

export function GuestGuard(): JSX.Element {
  const { session, loading } = useAuth()

  if (loading) return <SkeletonPage />
  if (session) return <Navigate to={ROUTES.WORKSPACES} replace />

  return <Outlet />
}
