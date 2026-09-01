import { headers } from 'next/headers'

/**
 * The origin of the request being served — `https://gracechapel.spacesangels.com`.
 *
 * It comes from the REQUEST, never from `NEXT_PUBLIC_SERVER_URL`. That env var
 * bakes at build time and is unset in the container build, which is how every
 * portal on the node ended up serving a sitemap full of `http://localhost:3000`.
 * It is also wrong in principle on a multi-tenant node: one build serves every
 * hostname, so the only thing that knows which site this is, is the Host header.
 */
export function originFromHeaderValues(
  host: string | null | undefined,
  proto?: string | null,
): string {
  const h = (host || '').trim()
  if (!h) return process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const scheme = proto || (h.startsWith('localhost') || h.startsWith('127.0.0.1') ? 'http' : 'https')
  return `${scheme}://${h}`
}

export async function originFromHeaders(): Promise<string> {
  const h = await headers()
  return originFromHeaderValues(
    h.get('x-forwarded-host') || h.get('host'),
    h.get('x-forwarded-proto'),
  )
}
