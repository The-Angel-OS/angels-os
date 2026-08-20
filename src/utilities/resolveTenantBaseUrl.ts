/**
 * resolveTenantBaseUrl — the public web address of a portal.
 *
 * A tenant's own host, not the platform apex: Clearwater Cruisin is
 * `clearwater-cruisin.spacesangels.com`, not `spacesangels.com`. Anything that
 * links a visitor or an invitee AT a portal needs this — an invitation must land
 * on the subdomain where the person signs in, and a catalog card must open the
 * business's actual site.
 *
 * Order: a real custom domain, else `{slug}.{apex}` derived from the server URL,
 * else the server URL itself. `.local` and localhost hosts are treated as unreal,
 * because dev has no subdomains and a link to `hays-cactus.angelos.local` helps
 * nobody.
 *
 * Extracted from sendTenantInvitationEmail once the Featured Endeavors cards
 * needed the same answer — two call sites deriving a portal's address separately
 * is how they end up disagreeing.
 */
import type { Payload } from 'payload'
import { getServerSideURL } from '@/utilities/getURL'

const stripWww = (d: string) => d.replace(/^www\./, '')

/** A host we can actually send someone to. */
const isReal = (d?: string | null): boolean =>
  !!d && !d.endsWith('.local') && !d.includes('localhost')

export interface TenantAddress {
  domain?: string | null
  slug?: string | null
}

/** The synchronous half — usable when the caller already has the tenant doc. */
export function tenantBaseUrlFrom(tenant: TenantAddress | null | undefined): string {
  const serverUrl = getServerSideURL()
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'

  if (isReal(tenant?.domain)) return `${proto}://${stripWww(tenant!.domain as string)}`

  const slug = tenant?.slug
  if (slug && slug !== 'default' && slug !== 'platform') {
    const host = new URL(serverUrl).host.split(':')[0]
    if (host && isReal(host)) {
      // Drop a leading subdomain to get the registrable apex:
      // platform.spacesangels.com → spacesangels.com
      const labels = stripWww(host).split('.')
      const apex = labels.length > 2 ? labels.slice(1).join('.') : labels.join('.')
      return `${proto}://${slug}.${apex}`
    }
  }

  return serverUrl
}

/** Look the tenant up, then resolve. Never throws — falls back to the apex. */
export async function resolveTenantBaseUrl(
  payload: Payload,
  tenantId?: number | string | null,
): Promise<string> {
  if (!tenantId) return getServerSideURL()
  try {
    const tenant = (await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })) as TenantAddress
    return tenantBaseUrlFrom(tenant)
  } catch {
    return getServerSideURL()
  }
}
