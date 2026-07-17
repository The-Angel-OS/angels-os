'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

/**
 * ContactsImportPanel — start a Google contacts import and report the result.
 *
 * The button sends the user through the on-demand Google consent (contacts.readonly)
 * on this same registered OAuth redirect; the callback imports into their own
 * address book and redirects back here with ?contactsImport=... which we toast.
 * @see src/endpoints/auth-google.ts @see src/utilities/googleContactsImport.ts
 */
const RETURN_PATH = '/dashboard/account/connections'
const START_URL = `/api/auth/google?contacts=1&redirect=${encodeURIComponent(RETURN_PATH)}`

export function ContactsImportPanel() {
  const params = useSearchParams()
  const handled = useRef(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (handled.current) return
    const status = params.get('contactsImport')
    if (!status) return
    handled.current = true
    let outcome: { ok: boolean; text: string }
    if (status === 'ok') {
      const imported = Number(params.get('imported') || 0)
      const updated = Number(params.get('updated') || 0)
      const total = Number(params.get('total') || 0)
      outcome = {
        ok: true,
        text:
          imported + updated > 0
            ? `Imported ${imported} new contact${imported === 1 ? '' : 's'}${updated ? ` (updated ${updated})` : ''} from Google.`
            : total > 0
              ? 'Your Google contacts are already up to date.'
              : 'No contacts found on that Google account.',
      }
    } else {
      outcome = { ok: false, text: "Couldn't import your Google contacts — please try again." }
    }
    setResult(outcome)
    // Bonus toast where a Toaster is mounted; the inline banner below is the
    // guaranteed feedback (the dashboard shell doesn't always mount one).
    ;(outcome.ok ? toast.success : toast.error)(outcome.text)
    // Clean the query params so a refresh doesn't re-report.
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', RETURN_PATH)
    }
  }, [params])

  return (
    <div>
      {result && (
        <div
          className={`mb-3 rounded-md border px-3 py-2 text-sm ${
            result.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'
          }`}
        >
          {result.text}
        </div>
      )}
      <h2 className="text-sm font-semibold mb-1">Import contacts</h2>
      <p className="text-sm text-muted-foreground mb-3">
        Pull in your Google contacts so LEO can invite people without you re-typing
        addresses. You approve it on Google&apos;s own screen, and they import into
        your own address book only.
      </p>
      <a
        href={START_URL}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.85 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.67-2.84Z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.67 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
        </svg>
        Import Google contacts
      </a>
    </div>
  )
}
