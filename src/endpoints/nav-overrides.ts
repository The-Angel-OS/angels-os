/**
 * Nav overrides — GET/POST /api/nav-ops/overrides
 *
 * The menu derives itself from what the endeavor has; these three fields are
 * the owner's intent on top of it (hide, pin, how many ride the bar). They were
 * editable by LEO and by nothing else, so the only way to reorder your own top
 * nav was to ask the assistant for it.
 *
 * GET also returns the CANDIDATE urls — the tenant's published pages plus the
 * platform routes — so the editor can offer real checkboxes instead of asking
 * an owner to type "/shop" correctly.
 *
 * Auth: a manager of THIS portal (or a platform admin). The tenant comes from
 * the request host, never from a parameter.
 */
import type { PayloadHandler } from 'payload'
import { getNavOverrides, setNavOverrides, normalizeNavOverrides } from '@/utilities/navOverrides'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { getUserTenantRoles } from '@/access/getUserTenantRoles'
import { PLATFORM_ROUTES } from '@/utilities/applyBrochureNav'

const MANAGER_ROLES = new Set(['tenant_admin', 'tenant_manager'])

/** Routes the menu can derive but which have no Page row behind them. */
const DERIVED_ROUTES = [
  { url: '/shop', label: 'Shop' },
  { url: '/posts', label: 'Posts' },
  { url: '/events', label: 'Events' },
  { url: '/book', label: 'Book' },
  { url: '/donate', label: 'Donate' },
  ...PLATFORM_ROUTES.map((url) => ({ url, label: url.replace(/^\//, '') })),
]

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

export const navOverridesGetHandler: PayloadHandler = async (req) => {
  const auth = await authorize(req)
  if (auth.error) return auth.error
  const { tenantId, payload } = auth

  const overrides = await getNavOverrides(payload!, tenantId!)

  let pages: { url: string; label: string }[] = []
  try {
    const res = await payload!.find({
      collection: 'pages',
      where: { and: [{ tenant: { equals: tenantId } }, { _status: { equals: 'published' } }] },
      limit: 100,
      depth: 0,
      sort: 'title',
      overrideAccess: true,
      req,
    })
    pages = (res.docs as Array<{ slug?: string; title?: string; navLabel?: string }>)
      .filter((p) => p.slug && p.slug !== 'home')
      .map((p) => ({ url: `/${p.slug}`, label: p.navLabel || p.title || `/${p.slug}` }))
  } catch {
    /* candidates are a convenience — the editor still works without them */
  }

  // Anything already hidden or pinned stays offerable even if its source is
  // gone, or an owner could never un-hide a page they since unpublished.
  const known = new Set([...pages, ...DERIVED_ROUTES].map((c) => c.url))
  const orphans = [...overrides.hidden, ...overrides.pinned]
    .filter((u) => !known.has(u))
    .map((url) => ({ url, label: url }))

  return Response.json({
    overrides,
    candidates: [...pages, ...DERIVED_ROUTES, ...orphans],
  })
}

export const navOverridesPostHandler: PayloadHandler = async (req) => {
  const auth = await authorize(req)
  if (auth.error) return auth.error
  const { tenantId, payload } = auth

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // normalize before writing — a hand-rolled POST should not be able to put a
  // shape in the bag that the nav renderer then trips over.
  const next = normalizeNavOverrides(body)
  const saved = await setNavOverrides(payload!, tenantId!, next)
  return Response.json({ ok: true, overrides: saved })
}
