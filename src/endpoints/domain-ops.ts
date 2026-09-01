/**
 * Domain bindings — GET/POST /api/domain-ops/bindings
 *
 * The Addresses box in Settings could only ever be READ. Binding a hostname was
 * super_admin work, so a portal owner who bought a domain had to file a ticket
 * with us to point it anywhere. This is the DotNetNuke "Site Aliases" panel:
 * the owner adds, removes, and picks the canonical one themselves.
 *
 * What the owner is NOT allowed to do is the reason the box was read-only —
 * claim a hostname that belongs to someone else. Two guards cover it:
 *   - a platform apex (*.spacesangels.com and friends) is minted from the SLUG
 *     and is never claimable here, or a portal could bind another's subdomain.
 *   - a hostname already bound to ANY tenant is refused, first-come-first-served.
 *
 * Auth: a manager of THIS portal (or a platform admin). The tenant comes from
 * the request host, never from a parameter — same rule as nav-ops.
 *
 * DNS is still the customer's job: this makes the node ANSWER for a hostname,
 * it does not make the hostname resolve here.
 */
import type { PayloadHandler } from 'payload'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { getUserTenantRoles } from '@/access/getUserTenantRoles'

const MANAGER_ROLES = new Set(['tenant_admin', 'tenant_manager'])

/**
 * Apexes whose subdomains this platform mints itself, from the tenant slug.
 * Binding one by hand would let a portal answer for another portal's address.
 */
const PLATFORM_APEXES = [
  'spacesangels.com',
  'payloadnuke.com',
  'kendev.co',
  'vercel.app',
  'railway.app',
  'up.railway.app',
  'localhost',
]

export type DomainBinding = { domain: string; isPrimary: boolean }

/**
 * Lowercase, strip a pasted scheme/path/port/trailing dot, and validate.
 * Returns the hostname, or an error string naming what is wrong with it.
 */
export function normalizeDomain(input: string): { domain: string } | { error: string } {
  let host = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '') // pasted https://
    .replace(/[/?#].*$/, '') // pasted path
    .replace(/:\d+$/, '') // :3000
    .replace(/\.$/, '') // fully-qualified trailing dot

  if (!host) return { error: 'Enter a domain.' }
  if (host.length > 253) return { error: 'That domain is too long.' }
  // Labels: alphanumeric + hyphen, not leading/trailing hyphen; at least two.
  if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(host)) {
    return { error: `"${host}" is not a valid domain name.` }
  }
  if (PLATFORM_APEXES.some((apex) => host === apex || host.endsWith(`.${apex}`))) {
    return {
      error: `${host} is a platform address — those are issued from your portal's slug, not bound by hand.`,
    }
  }
  return { domain: host }
}

async function authorize(req: Parameters<PayloadHandler>[0]) {
  const { user, payload } = req
  if (!user) return { error: Response.json({ error: 'Authentication required' }, { status: 401 }) }
  const { tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) return { error: Response.json({ error: 'No portal context' }, { status: 400 }) }
  if (checkRole(ADMIN_ROLES, user)) return { tenantId, payload }
  const roles = await getUserTenantRoles(user.id)
  const ok = roles.some((m) => {
    const t = m.tenant as unknown
    const id = t && typeof t === 'object' ? (t as { id: number | string }).id : t
    return (
      String(id) === String(tenantId) &&
      MANAGER_ROLES.has(String(m.role)) &&
      (m as { status?: string }).status === 'active'
    )
  })
  if (!ok) return { error: Response.json({ error: 'Not permitted for this portal' }, { status: 403 }) }
  return { tenantId, payload }
}

type TenantRow = { id: number | string; slug?: string; domain?: string; domains?: DomainBinding[] }

async function loadTenant(
  payload: NonNullable<Parameters<PayloadHandler>[0]['payload']>,
  tenantId: number | string,
  req: Parameters<PayloadHandler>[0],
): Promise<TenantRow> {
  const doc = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return doc as unknown as TenantRow
}

function shape(tenant: TenantRow) {
  const bindings = (tenant.domains || [])
    .filter((d) => Boolean(d?.domain))
    .map((d) => ({ domain: String(d.domain), isPrimary: Boolean(d.isPrimary) }))
  return {
    slug: tenant.slug || '',
    // The `domain` field is required on Tenants and is always bound; it is the
    // one row the owner cannot remove, so the UI renders it as locked.
    domain: tenant.domain || '',
    bindings,
    canonical: bindings.find((b) => b.isPrimary)?.domain || tenant.domain || '',
  }
}

export const domainBindingsGetHandler: PayloadHandler = async (req) => {
  const auth = await authorize(req)
  if (auth.error) return auth.error
  const tenant = await loadTenant(auth.payload!, auth.tenantId!, req)
  return Response.json(shape(tenant))
}

export const domainBindingsPostHandler: PayloadHandler = async (req) => {
  const auth = await authorize(req)
  if (auth.error) return auth.error
  const { tenantId, payload } = auth

  const body = (await (req.json?.() ?? Promise.resolve({}))) as {
    action?: string
    domain?: string
  }
  const action = String(body.action || '')
  const parsed = normalizeDomain(body.domain || '')
  if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 })
  const { domain } = parsed

  const tenant = await loadTenant(payload!, tenantId!, req)
  const current = (tenant.domains || []).filter((d) => Boolean(d?.domain))
  let next: DomainBinding[]

  if (action === 'add') {
    if (domain === tenant.domain || current.some((d) => d.domain.toLowerCase() === domain)) {
      return Response.json({ error: `${domain} is already bound to this portal.` }, { status: 409 })
    }
    // First come, first served across the whole platform.
    const taken = await payload!.find({
      collection: 'tenants',
      where: { or: [{ domain: { equals: domain } }, { 'domains.domain': { equals: domain } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (taken.docs.length > 0) {
      return Response.json({ error: `${domain} is already bound to another portal.` }, { status: 409 })
    }
    next = [...current, { domain, isPrimary: false }]
  } else if (action === 'remove') {
    if (!current.some((d) => d.domain.toLowerCase() === domain)) {
      return Response.json({ error: `${domain} is not bound to this portal.` }, { status: 404 })
    }
    next = current.filter((d) => d.domain.toLowerCase() !== domain)
  } else if (action === 'set-primary') {
    // The tenant's own `domain` is the canonical when NO alias is primary, so
    // choosing it means clearing every isPrimary rather than setting one.
    if (domain === tenant.domain) {
      next = current.map((d) => ({ ...d, isPrimary: false }))
    } else {
      if (!current.some((d) => d.domain.toLowerCase() === domain)) {
        return Response.json({ error: `${domain} is not bound to this portal.` }, { status: 404 })
      }
      next = current.map((d) => ({ ...d, isPrimary: d.domain.toLowerCase() === domain }))
    }
  } else {
    return Response.json({ error: 'action must be add, remove or set-primary' }, { status: 400 })
  }

  await payload!.update({
    collection: 'tenants',
    id: tenantId!,
    data: { domains: next },
    depth: 0,
    overrideAccess: true,
    req,
  })

  // Re-query rather than trusting the update's return — the host resolver caches
  // off this row and a silently-failed write would leave the UI lying.
  const saved = await loadTenant(payload!, tenantId!, req)
  return Response.json(shape(saved))
}
