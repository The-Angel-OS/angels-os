'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Client-side invite accept button — sends JSON to API and redirects on success.
 * Fixes the bug where HTML form POST sent URL-encoded data but endpoint expected JSON.
 */
export function InviteAcceptButton({ token, locale }: { token: string; locale: string }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAccept = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          // Not logged in — redirect to login with return URL
          router.push(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/invite/${token}`)}`)
          return
        }
        setError(data?.error || 'Failed to accept invitation. Please try again.')
        return
      }

      // Success — go to the room they were invited to, not the list of rooms.
      const dest =
        typeof data?.destination === 'string' && data.destination.startsWith('/')
          ? data.destination
          : '/dashboard/spaces'
      router.push(`/${locale}${dest}`)
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
