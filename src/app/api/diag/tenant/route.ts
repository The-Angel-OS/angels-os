import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * Diagnostic endpoint — DELETE AFTER DEBUGGING
 * GET /api/diag/tenant?slug=clearwater-cruisin
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const slug = url.searchParams.get('slug') || 'clearwater-cruisin'

  const steps: Record<string, unknown> = { slug, timestamp: new Date().toISOString() }

  try {
    steps.step1 = 'getPayload...'
    const payload = await getPayload({ config: configPromise })
    steps.step1 = 'OK'

    steps.step2 = 'find tenant depth=0...'
    const r0 = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    steps.step2 = r0.docs.length > 0 ? `OK id=${r0.docs[0].id}` : 'NOT FOUND'

    steps.step3 = 'find tenant depth=2...'
    const r2 = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
      overrideAccess: true,
    })
    steps.step3 = r2.docs.length > 0 ? `OK id=${r2.docs[0].id} name=${r2.docs[0].name}` : 'NOT FOUND'

    // Check if home page exists for this tenant
    if (r0.docs[0]) {
      steps.step4 = 'find home page...'
      const pages = await payload.find({
        collection: 'pages',
        where: {
          and: [
            { slug: { equals: 'home' } },
            { tenant: { equals: r0.docs[0].id } },
            { _status: { equals: 'published' } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      steps.step4 = pages.docs.length > 0 ? `OK id=${pages.docs[0].id} title=${(pages.docs[0] as any).title}` : 'NO HOME PAGE'
    }

    return NextResponse.json(steps)
  } catch (err) {
    steps.error = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack?.split('\n').slice(0, 5) } : String(err)
    return NextResponse.json(steps, { status: 500 })
  }
}
