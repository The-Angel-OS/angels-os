'use client'

import { useState, useCallback, useEffect } from 'react'
import type { ChatSpace } from './types'

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || ''

/** Slug used for the system-created AI Bus space */
export const AI_BUS_SPACE_SLUG = 'ai-bus'

/**
 * Hook to fetch spaces the current user is a member of.
 *
 * Fetches active space-memberships with depth=1 to populate the space
 * relationship, then deduplicates and sorts (AI Bus last, alphabetical otherwise).
 *
 * @param initialSpaces - Optional server-side pre-loaded spaces (avoids extra fetch)
 */
export function useSpaces(initialSpaces?: ChatSpace[]) {
  const [spaces, setSpaces] = useState<ChatSpace[]>(initialSpaces || [])
  const [isLoading, setIsLoading] = useState(!initialSpaces?.length)
  const [error, setError] = useState<string | null>(null)

  const loadSpaces = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Resolve current user ID so we only fetch OUR memberships (not all users')
      let userId: string | undefined
      try {
        const meRes = await fetch(`${SERVER_URL}/api/users/me`, { credentials: 'include' })
        if (meRes.ok) {
          const meData = await meRes.json()
          userId = meData.user?.id ? String(meData.user.id) : undefined
        }
      } catch {
        // Fall through — query without user filter (access control still applies)
      }

      // Fetch active memberships with space populated, filtered to current user
      const userFilter = userId ? `&where[user][equals]=${userId}` : ''
      const res = await fetch(
        `${SERVER_URL}/api/space-memberships?where[status][equals]=active${userFilter}&depth=1&limit=100`,
        { credentials: 'include' },
      )

      if (res.status === 401 || res.status === 403) {
        setError('Not authenticated')
        setIsLoading(false)
        return
      }

      if (!res.ok) {
        setError('Failed to load spaces')
        setIsLoading(false)
        return
      }

      const data = await res.json()
      const docs = data.docs || []

      // Extract unique spaces from memberships
      const seen = new Set<string>()
      const extracted: ChatSpace[] = []

      for (const doc of docs) {
        const space =
          typeof doc.space === 'object' && doc.space !== null
            ? (doc.space as Record<string, unknown>)
            : null
        if (!space) continue
        const id = String(space.id)
        if (seen.has(id)) continue
        seen.add(id)

        extracted.push({
          id,
          name: String(space.name || ''),
          slug: String(space.slug || ''),
          description: space.description ? String(space.description) : undefined,
          visibility: (space.visibility as ChatSpace['visibility']) || 'invite_only',
          isSystem: String(space.slug || '') === AI_BUS_SPACE_SLUG,
        })
      }

      // Also fetch public spaces the user may not have joined yet
      // (mirrors fetchUserSpaces server-side logic for consistency)
      try {
        const pubRes = await fetch(
          `${SERVER_URL}/api/spaces?where[visibility][equals]=public&depth=0&limit=50`,
          { credentials: 'include' },
        )
        if (pubRes.ok) {
          const pubData = await pubRes.json()
          for (const space of pubData.docs || []) {
            const id = String(space.id)
            if (seen.has(id)) continue
            seen.add(id)
            extracted.push({
              id,
              name: String(space.name || ''),
              slug: String(space.slug || ''),
              description: space.description ? String(space.description) : undefined,
              visibility: 'public',
              isSystem: String(space.slug || '') === AI_BUS_SPACE_SLUG,
            })
          }
        }
      } catch {
        // Non-critical — user still sees spaces they're explicitly members of
      }

      // Sort: regular spaces alphabetically, AI Bus at the end
      extracted.sort((a, b) => {
        if (a.isSystem && !b.isSystem) return 1
        if (!a.isSystem && b.isSystem) return -1
        return a.name.localeCompare(b.name)
      })

      setSpaces(extracted)
    } catch {
      setError('Network error loading spaces')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load on mount if no initial spaces provided
  useEffect(() => {
    if (!initialSpaces?.length) {
      loadSpaces()
    }
  }, [loadSpaces, initialSpaces])

  return { spaces, isLoading, error, reload: loadSpaces }
}
