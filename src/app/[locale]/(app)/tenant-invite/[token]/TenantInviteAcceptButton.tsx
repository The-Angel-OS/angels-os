'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface AcceptedMembership {
  tenantSlug?: string | null
  tenantDomain?: string | null
}

/**
 * Build the dashboard URL that lands the user inside the tenant they just joined.
 * Prefers the tenant's real custom domain; else a slug subdomain off the current
 * apex; else a same-origin fallback (the apex dashboard). Returns absolute URLs
 * for cross-host hops, relative for same-origin.
 */
function tenantDashboardUrl(membership: AcceptedMembership | undefined, locale: string): string {
  const fallback = `/${locale}/dashboard`
  if (typeof window === 'undefined' || !membership) return fallback

  const stripWww = (d: string) => d.replace(/^www\./, '')
  const isReal = (d?: string | null) => !!d && !d.endsWith('.local') && !d.includes('localhost')

  if (isReal(membership.tenantDomain)) {
    return `https://${stripWww(membership.tenantDomain as string)}/${locale}/dashboard`
  }

  const host = window.location.hostname
  const onLocal = host.includes('localhost') || host.endsWith('.local')
  if (membership.tenantSlug && !onLocal) {
    // Derive the apex from the current host (invites land on www/apex).
    const apex = stripWww(host)
    return `${window.location.protocol}//${membership.tenantSlug}.${apex}/${locale}/dashboard`
  }

  return fallback
}

/**
 * Client-side tenant invite accept button — sends JSON to API and redirects on success.
 * Fixes the bug where HTML form POST sent URL-encoded data but endpoint expected JSON.
 */
export function TenantInviteAcceptButton({ token, locale }: { token: string; locale: string }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAccept = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/tenant-invite/accept', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          // Not logged in — redirect to login with return URL
          router.push(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/tenant-invite/${token}`)}`)
          return
        }
        setError(data?.error || 'Failed to accept invitation. Please try again.')
        return
      }

      // Success — land the user INSIDE the tenant they just joined (their identity
      // is platform-global; this routes them from the apex into the right Enterprise
      // subdomain). Cross-subdomain auth requires COOKIE_DOMAIN=.<apex> in prod.
      const dest = tenantDashboardUrl(data?.membership, locale)
      if (dest.startsWith('http')) {
        window.location.href = dest
      } else {
        router.push(dest)
      }
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleAccept}
        disabled={isLoading}
        className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Accepting...' : 'Accept Invitation'}
      </button>
    </>
  )
}
