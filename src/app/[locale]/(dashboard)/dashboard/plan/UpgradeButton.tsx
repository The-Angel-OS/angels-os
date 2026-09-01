'use client'

import React, { useState } from 'react'

/**
 * "Move to Site / Business" — starts the plan change.
 *
 * This replaced a link to `spacesangels.com/plans?portal=…&plan=…`, which no
 * route on this platform has ever read. Clicking it took a customer to a
 * marketing page and their plan never moved; that is why no portal has ever been
 * on a paid plan.
 *
 * The button posts to the portal's OWN host, so the tenant comes from the
 * request rather than from the query string it used to carry — a portal id in a
 * URL is an invitation to upgrade somebody else's site.
 *
 * ponytail: no toast library, no form state machine. A disabled button, an
 * inline error, and a redirect covers every outcome this has.
 */
export function UpgradeButton({ plan, label }: { plan: 'site' | 'business'; label: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/plan-ops/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not start the plan change.')
        setBusy(false)
        return
      }
      // Stripe's hosted page. Deliberately a full navigation, not a popup —
      // popups get blocked and the customer never learns why.
      window.location.href = data.url
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setBusy(false)
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {busy ? 'Starting…' : `Move to ${label}`}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
