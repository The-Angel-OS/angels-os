/**
 * Federation Discovery Endpoint — /.well-known/angel-os.json
 *
 * Returns this diocese's federation identity, capabilities, and available endpoints.
 * Any Angel OS instance can discover another by fetching this URL.
 *
 * Public endpoint — no auth required. This is how the network finds you.
 *
 * Constitutional Reference: Article VII — "The Constitution IS the gate."
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getActiveConstitution } from '@/federation/constitution'
import { getTenantPublicKey } from '@/federation/keyStore'
import { headers } from 'next/headers'

export async function GET() {
  try {
    const payload = await getPayload({ config })
    const constitution = getActiveConstitution()

    // Find the primary tenant (the diocese running this instance)
    const tenants = await payload.find({
      collection: 'tenants',
      limit: 1,
      depth: 0,
      overrideAccess: true,
      sort: 'createdAt',
    })

    const tenant = tenants.docs[0] as unknown as Record<string, unknown> | undefined
    if (!tenant) {
      return NextResponse.json(
        { error: 'No tenant configured' },
        { status: 503, headers: { 'Cache-Control': 'no-cache' } },
      )
    }

    // Get federation identity from tenant setup
    const setup = tenant.setup as unknown as Record<string, unknown> | undefined
    const federationId = setup?.federationId as string | undefined
    const publicKey = await getTenantPublicKey(payload, tenant.id as number)

    // Find the primary endeavor for holon type info
    const endeavors = await payload.find({
      collection: 'endeavors',
      where: {
        'federation.networkVisible': { equals: true },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const endeavor = endeavors.docs[0] as unknown as Record<string, unknown> | undefined
    const federation = endeavor?.federation as unknown as Record<string, unknown> | undefined

    // Determine capabilities from tenant commerce config
    const commerce = tenant.commerce as unknown as Record<string, unknown> | undefined
    const capabilities: string[] = ['products'] // Everyone has products
    if (commerce?.bookingsEnabled) capabilities.push('bookings')
    if (commerce?.eventsEnabled) capabilities.push('events')
    if (commerce?.shippingEnabled) capabilities.push('shipping')
    if (commerce?.digitalProductsEnabled) capabilities.push('digital-products')

    // Determine holon types from endeavor type + business type
    const holonTypes: string[] = []
    const businessType = tenant.businessType as string | undefined
    const endeavorType = endeavor?.endeavorType as string | undefined
    if (businessType === 'retail') holonTypes.push('retailer')
    if (businessType === 'service') holonTypes.push('service-provider')
    if (businessType === 'content_creator') holonTypes.push('creator')
    if (businessType === 'nonprofit') holonTypes.push('community')
    if (endeavorType === 'creator-content') holonTypes.push('creator')
    if (endeavorType === 'retail-commerce') holonTypes.push('retailer')
    if (endeavorType === 'booking-based') holonTypes.push('service-provider')
    // Deduplicate
    const uniqueHolonTypes = [...new Set(holonTypes)]
    if (uniqueHolonTypes.length === 0) uniqueHolonTypes.push('general')

    // Resolve domain: prefer tenant config, then request host, then env
    const headersList = await headers()
    const requestHost = headersList.get('host') || headersList.get('x-forwarded-host')
    const domain =
      (tenant.domain as string) ||
      requestHost?.replace(/:\d+$/, '') || // Strip port
      process.env.NEXT_PUBLIC_SERVER_URL?.replace(/^https?:\/\//, '') ||
      'localhost'

    const serverUrl = `https://${domain}`

    return NextResponse.json(
      {
        federation: {
          version: '1.0',
          protocol: 'angel-os-federation',
          constitutionVersion: constitution.version,
          constitutionChecksum: constitution.checksum,
          federationId: federationId || federation?.federationId || null,
          publicKey: publicKey || null,
          ministryStatus: (federation?.ministryStatus as string) || 'applicant',
          domain,
          name: (tenant.name as string) || 'Angel OS Instance',
          holonTypes: uniqueHolonTypes,
          capabilities,
          region: endeavor?.region || null,
          // Federation endpoints
          catalogEndpoint: `${serverUrl}/api/federation/catalog`,
          skillsEndpoint: `${serverUrl}/api/federation/skills`,
          heartbeatEndpoint: `${serverUrl}/api/federation/heartbeat`,
          vouchEndpoint: `${serverUrl}/api/federation/vouch`,
          pingEndpoint: `${serverUrl}/api/federation/ping`,
          mcpEndpoint: `${serverUrl}/api/mcp`,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // 5 min cache — heartbeat frequency
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  } catch (err) {
    console.error('[Federation Discovery] Error:', err)
    return NextResponse.json(
      { error: 'Federation discovery temporarily unavailable' },
      { status: 500, headers: { 'Cache-Control': 'no-cache' } },
    )
  }
}

// Dynamic — reads from database
export const dynamic = 'force-dynamic'
