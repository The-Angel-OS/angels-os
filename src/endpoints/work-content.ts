/**
 * Course content — /api/works-ops/content
 *
 * GET  ?slug=…  → the Work's course JSON (normalized).
 * POST { slug, content } → replaces it. The Course Studio's save button.
 *
 * Write gate: platform admin, or a tenant_admin/tenant_manager of the endeavor
 * that OWNS the Work (works.owner is a tenant slug, federation-stable).
 */
import type { PayloadHandler } from 'payload'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { normalizeCourse } from '@/utilities/courseContent'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findWork(payload: any, slug: string) {
  const res = await payload.find({
    collection: 'works',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs?.[0] as { id: number | string; owner?: string; content?: unknown } | undefined
}

export const workContentHandler: PayloadHandler = async (req) => {
  const method = (req as Request).method?.toUpperCase()

  if (method === 'GET') {
    const url = new URL(req.url || '', 'http://localhost')
    const slug = (url.searchParams.get('slug') || '').trim()
    if (!slug) return Response.json({ error: 'slug is required' }, { status: 400 })
    const work = await findWork(req.payload, slug)
    if (!work) return Response.json({ error: 'not found' }, { status: 404 })
    return Response.json({ ok: true, slug, content: normalizeCourse(work.content) })
  }

  if (method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })

  const user = req.user as { id?: number | string; roles?: unknown } | null
  if (!user?.id) return Response.json({ error: 'auth required' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* validated below */
  }
  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  if (!slug) return Response.json({ error: 'slug is required' }, { status: 400 })

  const work = await findWork(req.payload, slug)
  if (!work) return Response.json({ error: 'not found' }, { status: 404 })

  if (!checkRole(ADMIN_ROLES, user as never)) {
    const ownerSlug = String(work.owner || '')
    const tenants = await req.payload.find({
      collection: 'tenants',
      where: { slug: { equals: ownerSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const ownerId = tenants.docs?.[0]?.id
    const m = ownerId
      ? await req.payload.find({
          collection: 'tenant-memberships',
          where: {
            and: [
              { user: { equals: user.id } },
              { tenant: { equals: ownerId } },
              { status: { equals: 'active' } },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
      : { docs: [] }
    const role = (m.docs?.[0] as { role?: string } | undefined)?.role
    if (role !== 'tenant_admin' && role !== 'tenant_manager') {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  // Normalize on the way IN — the studio is the only writer today, but a course
  // that half-parses is worse than one that saves a clean empty module.
  const content = normalizeCourse(body.content)

  await req.payload.update({
    collection: 'works',
    id: work.id,
    data: { content } as never,
    overrideAccess: true,
    req,
  })

  return Response.json({ ok: true, slug, content })
}
