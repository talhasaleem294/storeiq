import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { SkeletonPage } from '@/components/ui/Skeleton'
import { ROUTES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

export function AuthCallback(): JSX.Element {
  const navigate = useNavigate()

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        void navigate(ROUTES.WORKSPACES, { replace: true })
      } else {
        void navigate(ROUTES.LOGIN, { replace: true })
      }
    })
  }, [navigate])

  return <SkeletonPage />
}
