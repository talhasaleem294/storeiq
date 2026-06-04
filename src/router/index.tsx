import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AuthGuard } from '@/components/guards/AuthGuard'
import { WorkspaceGuard } from '@/components/guards/WorkspaceGuard'
import { AppLayout } from '@/components/layouts/AppLayout'
import { ROUTES } from '@/lib/constants'
import { Ads } from '@/pages/app/Ads'
import { Dashboard } from '@/pages/app/Dashboard'
import { Profit } from '@/pages/app/Profit'
import { Settings } from '@/pages/app/Settings'
import { Admin } from '@/pages/Admin'
import { AuthCallback } from '@/pages/AuthCallback'
import { Landing } from '@/pages/Landing'
import { Login } from '@/pages/Login'
import { Privacy } from '@/pages/Privacy'
import { Signup } from '@/pages/Signup'
import { Workspaces } from '@/pages/Workspaces'

export const router = createBrowserRouter([
  // Public routes
  { path: ROUTES.LANDING, element: <Landing /> },
  { path: ROUTES.LOGIN, element: <Login /> },
  { path: ROUTES.SIGNUP, element: <Signup /> },
  { path: ROUTES.PRIVACY, element: <Privacy /> },
  { path: '/auth/callback', element: <AuthCallback /> },

  // Auth-required routes
  {
    element: <AuthGuard />,
    children: [
      { path: ROUTES.WORKSPACES, element: <Workspaces /> },
      { path: ROUTES.ADMIN, element: <Admin /> },

      // Workspace-scoped routes
      {
        path: '/app/:workspaceId',
        element: <WorkspaceGuard />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <Navigate to="dashboard" replace /> },
              { path: 'dashboard', element: <Dashboard /> },
              { path: 'profit', element: <Profit /> },
              { path: 'ads', element: <Ads /> },
              { path: 'settings', element: <Settings /> },
            ],
          },
        ],
      },
    ],
  },
])
