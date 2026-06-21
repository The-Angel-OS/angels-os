/**
 * Spaces deep-link route parsing — the single source of truth for the shape
 * `/dashboard/spaces/<spaceId>/<channelToken>`.
 *
 * Used by both ChatProvider (to seed the active space) and MultiChannelChat (to
 * resolve + open the deep-linked channel), so the two never disagree about what a
 * URL means. `channelToken` is normally the channel's numeric id (the canonical
 * form the URL-sync effect writes), but a legacy slug is accepted by the resolver.
 *
 * The regex matches anywhere in the path so an optional locale prefix
 * (`/es/dashboard/spaces/...`) and trailing segments/query don't break it.
 */
export function parseSpacesDeepLink(
  pathname: string | null | undefined,
): { spaceId: string; channelToken: string | null } | null {
  if (!pathname) return null
  const m = pathname.match(/\/dashboard\/spaces\/(\d+)(?:\/([^/?#]+))?/)
  if (!m) return null
  return { spaceId: m[1], channelToken: m[2] ? decodeURIComponent(m[2]) : null }
}
