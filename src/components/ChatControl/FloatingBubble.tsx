'use client'

import { useState, useEffect } from 'react'
import { ChatControl } from './index'
import { useAuth } from '@/providers/Auth'
import Link from 'next/link'

/**
 * Global floating chat bubble - appears on every page.
 * Wrap this in the root layout for site-wide LEO access.
 *
 * Authenticated users get the full chat interface.
 * Guests see a teaser icon linking to login.
 *
 * @param spaceId - Resolved server-side from the tenant's default space.
 *                  If not provided, fetches user's first available space.
 */
export function FloatingBubble({ spaceId }: { spaceId?: string }) {
  const { status } = useAuth()
  const [resolvedSpaceId, setResolvedSpaceId] = useState(spaceId || '')

  // If no spaceId prop and user is logged in, resolve from API
  useEffect(() => {
    if (spaceId || status !== 'loggedIn' || resolvedSpaceId) return

    fetch('/api/spaces?limit=1&sort=createdAt&depth=0', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const firstSpace = data?.docs?.[0]
        if (firstSpace?.id) {
          setResolvedSpaceId(String(firstSpace.id))
        }
      })
      .catch(() => {
        // Non-critical — will fallback
      })
  }, [spaceId, status, resolvedSpaceId])

  // Full chat for authenticated users
  if (status === 'loggedIn') {
    // Wait for space resolution before rendering chat
    if (!resolvedSpaceId) return null

    return (
      <ChatControl
        mode="minimalist"
        spaceId={resolvedSpaceId}
        channelSlug="general"
        position="bottom-right"
      />
    )
  }

  // Don't show anything until auth check completes
  if (status === undefined) return null

  // Teaser bubble for guests — links to login
  return (
    <Link
      href="/login"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform"
      title="Chat with LEO — Log in to start"
      aria-label="Log in to chat with LEO"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      </svg>
    </Link>
  )
}
