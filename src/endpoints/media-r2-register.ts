/**
 * POST /api/media-ops/r2-register
 *
 * Step 2 of device direct-upload: the bytes are already in R2 (client PUT to the
 * presigned URL from /api/media-ops/r2-upload-url) — create the media doc that
 * REFERENCES them. We create WITHOUT a file: with no req.file, the cloud-storage
 * plugin's getIncomingFiles returns [] so handleUpload never runs (no re-upload /
 * overwrite), and its beforeChange derives `url` from data.filename via
 * generateFileURL → the r2.dev public URL. Verifies the object exists first.
 *
 * Body: { key, mimeType, filesize, alt?, tenant?, width?, height? }
 * Response: { doc: { id, url, filename, mimeType } }
 */
import type { PayloadHandler } from 'payload'
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, r2Bucket, r2PublicUrl } from '@/utilities/r2Client'
import { usingR2 } from '@/utilities/mediaStorage'
import { applyRateLimit } from '@/utilities/apiRateLimiter'

export const mediaR2RegisterHandler: PayloadHandler = async (req) => {
  const { payload, headers } = req
  if ((req.method || (req as unknown as Request).method)?.toUpperCase() !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  if (!usingR2) {
    return Response.json({ error: 'R2 is not the active media backend.' }, { status: 400 })
  }

  const { user } = await payload.auth({ headers })
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const rateLimited = applyRateLimit(req, 'default')
  if (rateLimited) return rateLimited

  let body: Record<string, unknown>
  try {
    body = (req.data as Record<string, unknown>) ?? (await (req as unknown as Request).json())
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const key = typeof body.key === 'string' ? body.key : ''
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''
  const filesize = Number(body.filesize) || 0
  const alt = typeof body.alt === 'string' && body.alt.trim() ? body.alt.trim() : key
  const tenantId = body.tenant != null ? Number(body.tenant) : undefined
  const width = body.width != null ? Number(body.width) : undefined
  const height = body.height != null ? Number(body.height) : undefined

  if (!key || !mimeType || filesize <= 0) {
    return Response.json({ error: 'key, mimeType, and filesize are required' }, { status: 400 })
  }

  // Confirm the client actually uploaded the object before we mint a doc for it.
  const client = getR2Client()
  if (!client) return Response.json({ error: 'R2 client unavailable' }, { status: 500 })
  try {
    await client.send(new HeadObjectCommand({ Bucket: r2Bucket(), Key: key }))
  } catch {
    return Response.json({ error: 'That object is not in storage — upload it first.' }, { status: 409 })
  }

  try {
    const doc = await payload.create({
      collection: 'media',
      data: {
        alt,
        filename: key,
        mimeType,
        filesize,
        url: r2PublicUrl(key),
        ...(width && height ? { width, height } : {}),
        ...(tenantId != null ? { tenant: tenantId } : {}),
      } as never,
      overrideAccess: true,
    })
    return Response.json({
      doc: {
        id: (doc as { id: number | string }).id,
        url: (doc as { url?: string }).url ?? r2PublicUrl(key),
        filename: key,
        mimeType,
      },
    })
  } catch (err) {
    payload.logger?.error?.(`[r2-register] create failed: ${err instanceof Error ? err.message : String(err)}`)
    return Response.json({ error: err instanceof Error ? err.message : 'Register failed' }, { status: 500 })
  }
}
