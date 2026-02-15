import { unstable_cache } from 'next/cache'

/** Redirect entry shape for compatibility; no redirects collection in this project. */
export type RedirectDoc = { from: string; to: string; type?: string }

export async function getRedirects(_depth = 1): Promise<RedirectDoc[]> {
  // No 'redirects' collection in payload.config; return empty until one is added.
  return []
}

/**
 * Returns a unstable_cache function mapped with the cache tag for 'redirects'.
 *
 * Cache all redirects together to avoid multiple fetches.
 */
export const getCachedRedirects = () =>
  unstable_cache(async () => getRedirects(), ['redirects'], {
    tags: ['redirects'],
  })
