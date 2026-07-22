/**
 * GET /api/media-library — the ONE tenant-scoped media-library query.
 * Mirrors /dashboard/media exactly: tenant scope comes from the request host
 * (resolveTenantFromHeaders), never from a client-supplied param — so the chat
 * MediaPicker can't leak other tenants' files. Requires a logged-in user.
 * Params: q (filename like), type (image|video|document|all), page, limit.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenantFilter } = await resolveTenantFromHeaders()
  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') || '').trim()
  const type = sp.get('type') || 'all'
  const page = Math.max(1, Number(sp.get('page')) || 1)
  const limit = Math.min(60, Math.max(1, Number(sp.get('limit')) || 24))

  // Same where clause as /dashboard/media — tenant scope + type + filename search
  const and: Where[] = [tenantFilter as Where]
  if (type === 'image') and.push({ mimeType: { like: 'image/' } })
  else if (type === 'video') and.push({ mimeType: { like: 'video/' } })
  else if (type === 'document')
    and.push({ mimeType: { not_like: 'image/' } }, { mimeType: { not_like: 'video/' } })
  if (q) and.push({ filename: { like: q } })

  const media = await payload.find({
    collection: 'media',
    where: { and },
    limit,
    page,
    depth: 0,
    sort: '-createdAt',
    overrideAccess: true,
  })

  return NextResponse.json({
    docs: media.docs,
    totalDocs: media.totalDocs,
    totalPages: media.totalPages,
    page: media.page,
  })
}
