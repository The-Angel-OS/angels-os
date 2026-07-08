/**
 * Channel media chooser — GET /api/media-ops/channel
 *
 * The images (and other media) already present in a channel, so a client can
 * RE-SELECT them without re-uploading — e.g. pick the shelf photos already in
 * the channel and hand them to combine_images. Derived from message attachments
 * (`messages.attachments[].media`), most-recent first, de-duplicated by media id.
 *
 * Params: `space` (id) + `channel` (slug), required. `imagesOnly=true` (default)
 * limits to analyzable images. Auth required; tenant from `x-tenant-id`/`?tenant`.
 *
 * Portal-WIDE media doesn't need this — the built-in `/api/media?where[tenant]…`
 * REST route already serves it, auth-scoped. This endpoint is the channel-scoped
 * view REST can't express (attachments live on messages, not on media).
 *
 * NB: `/media-ops/*`, not `/media/*` — the `media` collection would shadow it.
 */
import type { PayloadHandler } from 'payload'

async function resolveTenantId(req: Parameters<PayloadHandler>[0]): Promise<number | string | null> {
  const url = new URL(req.url || '', 'http://localhost')
  const slug = req.headers?.get('x-tenant-id') || url.searchParams.get('tenant') || ''
  if (!slug) return null
  const tenants = await req.payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const t = tenants.docs?.[0] as { id: number | string } | undefined
  return t?.id ?? null
}

interface MediaChoice {
  id: number | string
  url: string | null
  thumbnailUrl: string | null
  filename: string | null
  mimeType: string | null
  alt: string | null
  caption: string | null
  messageId: number | string
  createdAt: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function thumbOf(m: any): string | null {
  const sizes = m?.sizes
  if (sizes && typeof sizes === 'object') {
    for (const key of ['thumbnail', 'square', 'small', 'card']) {
      const u = sizes[key]?.url
      if (typeof u === 'string' && u) return u
    }
  }
  return typeof m?.url === 'string' ? m.url : null
}

export const channelMediaHandler: PayloadHandler = async (req) => {
  const user = req.user as { id?: number | string } | null
  if (!user?.id) return Response.json({ error: 'auth required' }, { status: 401 })

  const url = new URL(req.url || '', 'http://localhost')
  const space = url.searchParams.get('space')
  const channel = url.searchParams.get('channel')
  if (!space || !channel) {
    return Response.json({ error: 'space (id) and channel (slug) are required' }, { status: 400 })
  }
  const imagesOnly = url.searchParams.get('imagesOnly') !== 'false'
  const limitParam = Number(url.searchParams.get('limit'))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 60

  const tenantId = await resolveTenantId(req)

  const where: Record<string, unknown> = {
    and: [
      { space: { equals: Number(space) } },
      { channel: { equals: channel } },
      ...(tenantId ? [{ tenant: { equals: tenantId } }] : []),
    ],
  }

  // Scan recent messages in the channel; keep those carrying attachments.
  const msgs = await req.payload.find({
    collection: 'messages',
    where: where as never,
    sort: '-createdAt',
    limit: 300,
    depth: 2, // message → attachments[] → media doc
    overrideAccess: true,
  })

  const seen = new Set<string>()
  const items: MediaChoice[] = []

  for (const msg of msgs.docs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = msg as any
    const attachments: unknown[] = Array.isArray(m.attachments) ? m.attachments : []
    for (const att of attachments) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = att as any
      const media = a?.media
      if (!media || typeof media !== 'object') continue // unpopulated / missing
      const mid = String(media.id)
      if (seen.has(mid)) continue
      const mime = typeof media.mimeType === 'string' ? media.mimeType : null
      if (imagesOnly && !(mime || '').startsWith('image/')) continue
      seen.add(mid)
      items.push({
        id: media.id,
        url: typeof media.url === 'string' ? media.url : null,
        thumbnailUrl: thumbOf(media),
        filename: typeof media.filename === 'string' ? media.filename : null,
        mimeType: mime,
        alt: typeof media.alt === 'string' ? media.alt : null,
        caption: typeof a.caption === 'string' ? a.caption : null,
        messageId: m.id,
        createdAt: m.createdAt ? String(m.createdAt) : null,
      })
      if (items.length >= limit) break
    }
    if (items.length >= limit) break
  }

  return Response.json({ items, count: items.length })
}
