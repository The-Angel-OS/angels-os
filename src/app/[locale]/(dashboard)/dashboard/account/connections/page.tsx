import { SocialProvidersPanel } from '@/components/forms/SocialProvidersPanel'

/**
 * Dashboard Account — Connections page.
 *
 * Dedicated view for managing OAuth/social provider connections.
 * Reuses SocialProvidersPanel (reads from useAuth context, no props).
 */
export default function DashboardConnectionsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Connected Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Link your social accounts for easier sign-in and identity verification.
        </p>
      </div>

      <div className="border p-6 md:p-8 rounded-lg bg-primary-foreground">
        <SocialProvidersPanel />
      </div>
    </div>
  )
}
