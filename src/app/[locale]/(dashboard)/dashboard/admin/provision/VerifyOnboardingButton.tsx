'use client'

import { useState } from 'react'
import { verifyOnboardingAction } from './actions'

/**
 * Runs the repeatable onboarding verifier against the CURRENT portal and shows
 * the heal report inline. The factory button: assert + self-heal on demand.
 */
export function VerifyOnboardingButton() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof verifyOnboardingAction>> | null>(null)

  const run = async () => {
    setBusy(true)
    setResult(null)
    setResult(await verifyOnboardingAction())
    setBusy(false)
  }

  const r = result?.report

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Verify portal onboarding</h3>
          <p className="text-xs text-muted-foreground">
            Ensures AI Bus, Community, and Direct Messages spaces, re-homes page-comment
            channels onto the AI Bus, and joins every active member to every space.
            Idempotent — safe to run anytime.
          </p>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? 'Verifying…' : 'Verify & heal'}
        </button>
      </div>

      {result && !result.success && (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400">{result.error}</p>
      )}

      {r && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <p>
            Spaces: <strong>{r.spacesCount}</strong> (AI Bus {r.aiBus ? '✓' : '✗'}, Main{' '}
            {r.main ? '✓' : '✗'}, DMs {r.dms ? '✓' : '✗'})
          </p>
          <p>
            Members: <strong>{r.membersCount}</strong> active · memberships backfilled:{' '}
            <strong>{r.membersBackfilled}</strong> · page channels re-homed:{' '}
            <strong>{r.pageChannelsReparented}</strong>
          </p>
          {r.errors.length > 0 ? (
            <p className="text-amber-600 dark:text-amber-400">Warnings: {r.errors.join('; ')}</p>
          ) : (
            <p className="text-emerald-600 dark:text-emerald-400">At baseline — no issues.</p>
          )}
        </div>
      )}
    </div>
  )
}
