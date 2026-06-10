import { createLocalReq, getPayload } from 'payload'
import { seed } from '@/endpoints/seed'
import config from '@payload-config'
import { headers } from 'next/headers'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

/**
 * Seed endpoint — increased maxDuration to handle 9-phase seed with
 * remote image fetches, tenant provisioning, and e-commerce data.
 * Vercel Pro/Enterprise allows up to 300s; Hobby allows 60s.
 * Setting to 300 ensures the seed completes on paid plans.
 */
export const maxDuration = 300

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = await getPayload({ config })
    const requestHeaders = await headers()

    // Authenticate by passing request headers
    const { user } = await payload.auth({ headers: requestHeaders })

    if (!user) {
      // Allow unauthenticated seeding when the database has no seeded content yet.
      // Check for pages as a proxy — if pages exist, the seed has already run.
      let hasContent = false
      try {
        const pages = await payload.find({
          collection: 'pages',
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })
        hasContent = pages.totalDocs > 0
      } catch {
        // If the query fails, allow seeding (fresh DB)
      }

      if (hasContent) {
        return Response.json({ success: false, error: 'Not authenticated' }, { status: 403 })
      }
      payload.logger.info('Bootstrap mode: seeding without auth (no pages exist)')
    } else {
      // Authenticated user: only platform admins can seed
      if (!checkRole(ADMIN_ROLES, user)) {
        return Response.json(
          { success: false, error: 'Insufficient permissions — only admins can seed the database' },
          { status: 403 },
        )
      }
    }

    // ── Destructive-seed guard (defense in depth) ──────────────────────────
    // seed() runs deleteMany({ where: {} }) across spaces/channels/messages/
    // tenant-memberships/products/pages/... GLOBALLY before reseeding the sample
    // 'default' tenant. On a provisioned node that erases real client data (e.g.
    // the Harpazo portal + its owner's membership). So: refuse to seed when ANY
    // real (non-platform, non-default) tenant exists. A super_admin can still
    // force it with ?force=true after reading the error — an explicit, eyes-open act.
    // Multiple independent signals — so a partial delete of any ONE collection
    // (e.g. all pages removed) can't trick the guard into thinking the DB is fresh.
    // Real tenants OR any real content/memberships ⇒ this is a live node, refuse.
    let dataSignal = -1 // -1 = couldn't verify (fail safe → treat as populated)
    try {
      const [realTenants, spaces, products, memberships] = await Promise.all([
        payload.count({
          collection: 'tenants',
          where: { and: [{ slug: { not_equals: 'default' } }, { type: { not_equals: 'platform' } }] },
          overrideAccess: true,
        }),
        payload.count({ collection: 'spaces', overrideAccess: true }),
        payload.count({ collection: 'products', overrideAccess: true }),
        payload.count({ collection: 'tenant-memberships', overrideAccess: true }),
      ])
      dataSignal = realTenants.totalDocs + spaces.totalDocs + products.totalDocs + memberships.totalDocs
    } catch {
      dataSignal = -1
    }
    const force = new URL(request.url).searchParams.get('force') === 'true'
    const isSuperAdmin = Boolean(user && checkRole(['super_admin'], user))
    if (dataSignal !== 0 && !(force && isSuperAdmin)) {
      return Response.json(
        {
          success: false,
          error:
            dataSignal < 0
              ? 'Refusing to seed: could not verify the database is empty. Seeding wipes spaces, channels, memberships, and products across ALL tenants.'
              : 'Refusing to seed: this node already has real data (tenants, spaces, products, or memberships). Seeding wipes spaces, channels, memberships, posts, and products across ALL tenants. Use Provision for per-tenant setup. A super_admin may override with ?force=true.',
        },
        { status: 409 },
      )
    }

    // Create a system-level request (no user context) so seed operations
    // aren't constrained by the requesting user's tenant assignments.
    // Individual seed functions use overrideAccess: true for all operations.
    const payloadReq = await createLocalReq({}, payload)

    await seed({ payload, req: payloadReq })

    return Response.json({ success: true, message: 'Database seeded successfully' })
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error during seeding'
    console.error('Seed error:', e)
    return Response.json(
      { success: false, error: errorMessage },
      { status: 500 },
    )
  }
}
