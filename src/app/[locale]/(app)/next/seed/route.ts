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
  const payload = await getPayload({ config })
  const requestHeaders = await headers()

  // Authenticate by passing request headers
  const { user } = await payload.auth({ headers: requestHeaders })

  if (!user) {
    return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Create a Payload request object to pass to the Local API for transactions
    const payloadReq = await createLocalReq({ user }, payload)

    await seed({ payload, req: payloadReq })

    return Response.json({ success: true, message: 'Database seeded successfully' })
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error during seeding'
    payload.logger.error({ err: e, message: 'Error seeding data' })
    return Response.json(
      { success: false, error: errorMessage },
      { status: 500 },
    )
  }
}
