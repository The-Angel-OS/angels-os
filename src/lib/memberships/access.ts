/**
 * Client-safe viewer access helpers for gated posts and pages.
 * Mirrors `isPageViewable` in `@/utilities/pageAccess` without server-only imports.
 */

export interface ViewerAccessStanding {
  isAdmin: boolean
  isAuthenticated: boolean
  isMember: boolean
  inGoodStanding: boolean
}

export function isPostLockedForViewer(
  access: string | null | undefined,
  standing?: ViewerAccessStanding | null,
): boolean {
  if (!access || access === 'public') return false
  if (standing?.isAdmin) return false
  if (!standing?.isAuthenticated) return true
  if (access === 'authenticated') return false
  if (access === 'members') return !standing.isMember
  if (access === 'good_standing') return !standing.inGoodStanding
  return true
}
