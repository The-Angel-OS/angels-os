import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { scrubObjectPrototype } from '@/utilities/deepMerge'

/**
 * Health check endpoint — GET /api/health
 *
 * Returns basic application health status including database connectivity.
 * Also self-heals any enumerable Object.prototype pollution before running
 * a filtered Payload count check.
 * Used by monitoring, load balancers, and Cloudflare health checks.
 */
export async function GET() {
  const start = Date.now()
  const scrubbedPrototypeKeys = scrubObjectPrototype()

  try {
    const payload = await getPayload({ config })

    // Quick DB + query-validator check — count tenants with a trivial where clause
    // so validateQueryPaths exercises the same path real requests use.
    await payload.count({
      collection: 'tenants',
      where: { id: { exists: true } },
      overrideAccess: true,
    })

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        latencyMs: Date.now() - start,
        ...(scrubbedPrototypeKeys.length > 0 ? { scrubbedPrototypeKeys } : {}),
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
