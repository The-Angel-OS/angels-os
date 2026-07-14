/**
 * Resolve a tenant's public base URL — its OWN host, not the platform apex.
 * Prefers a real custom domain, else `{slug}.{apex}` derived from the server URL,
 * else the server URL. (Generalized from sendTenantInvitationEmail's private copy
 * so page-published directives and future absolute-link needs share one truth.)
 */
import type { Payload } from 'payload'
import { getServerSideURL } from '@/utilities/getURL'

export async function resolveTenantBaseUrl(payload: Payload, tenantId?: number | string | null): Promise<string> {
  const serverUrl = getServerSideURL()
  if (!tenantId) return serverUrl

  const stripWww = (d: string) => d.replace(/^www\./, '')
  const isReal = (d?: string | null) => !!d && !d.endsWith('.local') && !d.includes('localhost')
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'

  try {
    const tenant = (await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })) as { domain?: string | null; slug?: string | null }

    if (isReal(tenant?.domain)) return `${proto}://${stripWww(tenant!.domain as string)}`

    const slug = tenant?.slug
    if (slug && slug !== 'default' && slug !== 'platform') {
      const host = new URL(serverUrl).host.split(':')[0]
      if (host && !host.includes('localhost') && !host.endsWith('.local')) {
        const labels = stripWww(host).split('.')
        const apex = labels.length > 2 ? labels.slice(1).join('.') : labels.join('.')
        return `${proto}://${slug}.${apex}`
      }
    }
  } catch {
    /* fall back to the apex */
  }
  return serverUrl
}
