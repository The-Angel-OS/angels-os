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
      // Fetch active memberships with space populated
      const res = await fetch(
        `${SERVER_URL}/api/space-memberships?where[status][equals]=active&depth=1&limit=100`,
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
