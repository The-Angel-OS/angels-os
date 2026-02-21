import { createLocalReq, getPayload } from 'payload'
import { seed } from '@/endpoints/seed'
import config from '@payload-config'
import { headers } from 'next/headers'

/**
 * Seed endpoint — increased maxDuration to handle 9-phase seed with
 * remote image fetches, tenant provisioning, and e-commerce data.
 * Vercel Pro/Enterprise allows up to 300s; Hobby allows 60s.
 * Setting to 300 ensures the seed completes on paid plans.
 */
export const maxDuration = 300

export async function POST(): Promise<Response> {
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
