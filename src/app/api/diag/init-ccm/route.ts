import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * One-shot initializer for Clearwater Cruisin Ministries endeavor.
 * Applies seed values to the existing empty endeavor record.
 * DELETE AFTER RUNNING ONCE.
 * GET /api/diag/init-ccm?key=angel-init-ccm
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('key') !== 'angel-init-ccm') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayload({ config: configPromise })

    // Find CCM tenant
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'clearwater-cruisin' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const tenant = tenants.docs[0]
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Find existing endeavor
    const endeavors = await payload.find({
      collection: 'endeavors',
      where: { tenant: { equals: tenant.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const existing = endeavors.docs[0]
    if (!existing) {
      return NextResponse.json({ error: 'No endeavor record found' }, { status: 404 })
    }

    // Apply CCM seed values
    const updated = await payload.update({
      collection: 'endeavors',
      id: existing.id,
      data: {
        name: 'Clearwater Cruisin\' Ministries',
        tagline: 'Soul Questing in the Ready Player Everyone Universe',
        description: 'CNC signs, woodworking, ministry, and soul questing from Clearwater, Florida. Dogs welcome.',
        endeavorType: 'creator-content',
        holonTypes: ['creator', 'community'] as any,
        missionStatement: 'To serve others through creative expression, community fellowship, and the open road — proving that faith, craftsmanship, and genuine connection can change lives one conversation at a time.',
        status: 'active',
        operator: {
          name: 'Kenneth Courtney',
          email: 'kenneth@clearwatercruisin.com',
          role: 'Ministry Lead',
        },
        capabilities: [
          { skill: 'CNC woodworking', description: 'Custom signs, plaques, and furniture using CNC router and traditional woodcraft.' },
          { skill: 'Community ministry', description: 'Street ministry, food pantry volunteering, homeless outreach, dog park fellowship.' },
          { skill: 'Content creation', description: 'YouTube ministry content, UHD dashcam footage, live reflections, Soul Quest documentation.' },
          { skill: 'Event coordination', description: 'Community events, baptism celebrations, concert attendance, park meetups.' },
        ],
        region: {
          city: 'Clearwater',
          state: 'FL',
          country: 'US',
        },
        federation: {
          ...(existing as any).federation,
          networkVisible: true,
        },
      } as any,
      overrideAccess: true,
    })

    return NextResponse.json({
      success: true,
      endeavorId: updated.id,
      name: (updated as any).name,
      status: (updated as any).status,
    })
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
