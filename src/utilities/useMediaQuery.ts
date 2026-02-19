'use client'

import { useState, useEffect } from 'react'

/**
 * useMediaQuery — reactive CSS media query hook.
 *
 * Returns true when the media query matches, false otherwise.
 * Server-renders as `false` to avoid hydration mismatch (mobile-first).
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 767px)')
 * const isDesktop = useMediaQuery('(min-width: 1024px)')
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

/**
 * Convenience breakpoint hooks matching Tailwind defaults.
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}

export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}
