import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Health check endpoint — GET /api/health
 *
 * Returns basic application health status including database connectivity.
 * Used by monitoring, load balancers, and Cloudflare health checks.
 */
export async function GET() {
  const start = Date.now()

  try {
    const payload = await getPayload({ config })

    // Quick DB check — count tenants (lightweight query)
    await payload.count({
      collection: 'tenants',
      overrideAccess: true,
    })

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        latencyMs: Date.now() - start,
      },
      { status: 200 },
    )
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed',
        latencyMs: Date.now() - start,
      },
      { status: 503 },
    )
  }
}
