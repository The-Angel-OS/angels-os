/**
 * Set Media — POST /api/provision-ops/set-media
 *
 * Generic factory primitive: assign an image to a single `upload` field on any
 * document. Built so "this Endeavor/Page/Tenant has no logo/cover/OG image" is a
 * one-call fix instead of a hand-written SQL poke against prod.
 *
 * Body:
 *   {
 *     "collection": "endeavors",       // any collection slug
 *     "id": 6,                          // doc id
 *     "field": "coverImage",            // dot-path to an upload field (meta.image, branding.logo, ...)
 *     "mediaId": 74,                    // ── one source ──
 *     "imageUrl": "https://...",        //    fetch + upload
 *     "generate": { "prompt": "..." },  //    AI-generate + upload
 *     "tenantId": 11,                   // scope for new uploads (optional)
 *     "alt": "Where Did Everyone Go"    // alt for new media (optional)
 *   }
 *
 * Auth: super_admin OR ?key=CRON_SECRET. Non-destructive — sets one FK column.
 */
import type { PayloadHandler } from 'payload'
import { setMediaField, type MediaSource } from '@/utilities/setMediaField'

export const setMediaHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(user && ((user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = ((await req.json?.()) as Record<string, unknown>) || {}
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const collection = body.collection as string | undefined
  const id = body.id as number | string | undefined
  const field = body.field as string | undefined
  if (!collection || id == null || !field) {
    return Response.json({ error: 'collection, id, and field are required' }, { status: 400 })
  }

  const source: MediaSource = {
    mediaId: body.mediaId != null ? Number(body.mediaId) : undefined,
    imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : undefined,
    generate:
      body.generate && typeof body.generate === 'object'
        ? (body.generate as MediaSource['generate'])
        : undefined,
  }
  if (source.mediaId == null && !source.imageUrl && !source.generate?.prompt) {
    return Response.json(
      { error: 'Provide one of: mediaId, imageUrl, or generate.prompt' },
      { status: 400 },
    )
  }

  try {
    const result = await setMediaField(payload, {
      collection,
      id,
      field,
      source,
      tenantId: body.tenantId != null ? Number(body.tenantId) : undefined,
      alt: typeof body.alt === 'string' ? body.alt : undefined,
    })
    if (!result.success) {
      return Response.json({ ok: false, ...result }, { status: 400 })
    }
    return Response.json({ ok: true, collection, id, field, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[set-media] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
