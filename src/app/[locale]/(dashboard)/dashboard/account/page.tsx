import { AccountForm } from '@/components/forms/AccountForm'
import { SocialProvidersPanel } from '@/components/forms/SocialProvidersPanel'

/**
 * Dashboard Account — Profile page.
 *
 * Reuses existing AccountForm and SocialProvidersPanel client components
 * (they read user context from useAuth — no props needed).
 */
export default function DashboardAccountPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Account Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile, password, and connected accounts.</p>
      </div>

      <div className="border p-6 md:p-8 rounded-lg bg-primary-foreground">
        <h2 className="text-lg font-medium mb-6">Profile</h2>
        <AccountForm />
      </div>

      <div className="border p-6 md:p-8 rounded-lg bg-primary-foreground">
        <h2 className="text-lg font-medium mb-6">Connected Accounts</h2>
        <SocialProvidersPanel />
      </div>
    </div>
  )
}
