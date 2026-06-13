import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AuthGuard } from '@/components/guards/AuthGuard'
import { GuestGuard } from '@/components/guards/GuestGuard'
import { WorkspaceGuard } from '@/components/guards/WorkspaceGuard'
import { AppLayout } from '@/components/layouts/AppLayout'
import { ROUTES } from '@/lib/constants'
import { Admin } from '@/pages/Admin'
import { Ads } from '@/pages/app/Ads'
import { CampaignDetail } from '@/pages/app/CampaignDetail'
import { Campaigns } from '@/pages/app/Campaigns'
import { Dashboard } from '@/pages/app/Dashboard'
import { InfluencerDetail } from '@/pages/app/InfluencerDetail'
import { Influencers } from '@/pages/app/Influencers'
import { Profile } from '@/pages/app/Profile'
import { Profit } from '@/pages/app/Profit'
import { Settings } from '@/pages/app/Settings'
import { AuthCallback } from '@/pages/AuthCallback'
import { Landing } from '@/pages/Landing'
import { Login } from '@/pages/Login'
import { Privacy } from '@/pages/Privacy'
import { RoasCalculator } from '@/pages/RoasCalculator'
import { SetPassword } from '@/pages/SetPassword'
import { Signup } from '@/pages/Signup'
import { Workspaces } from '@/pages/Workspaces'

export const router = createBrowserRouter([
  // Public routes
  { path: ROUTES.LANDING, element: <Landing /> },
  { path: ROUTES.PRIVACY, element: <Privacy /> },
  { path: '/tools/roas-calculator', element: <RoasCalculator /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  { path: ROUTES.AUTH_ACCEPT_INVITE, element: <AuthCallback /> },

  // Guest-only routes (redirect to /workspaces if already logged in)
  {
    element: <GuestGuard />,
    children: [
      { path: ROUTES.LOGIN, element: <Login /> },
      { path: ROUTES.SIGNUP, element: <Signup /> },
    ],
  },

  // Auth-required routes
  {
    element: <AuthGuard />,
    children: [
      { path: ROUTES.WORKSPACES, element: <Workspaces /> },
      { path: ROUTES.ADMIN, element: <Admin /> },
      { path: ROUTES.SET_PASSWORD, element: <SetPassword /> },

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
              { path: 'campaigns', element: <Campaigns /> },
              { path: 'campaigns/:campaignId', element: <CampaignDetail /> },
              { path: 'influencers', element: <Influencers /> },
              { path: 'influencers/:influencerId', element: <InfluencerDetail /> },
              { path: 'settings', element: <Settings /> },
              { path: 'profile', element: <Profile /> },
            ],
          },
        ],
      },
    ],
  },
])
