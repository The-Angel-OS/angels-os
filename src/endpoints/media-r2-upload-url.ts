/**
 * POST /api/media-ops/r2-upload-url
 *
 * Step 1 of device direct-upload (large clips past Vercel's ~4.5 MB body cap):
 * mint a presigned R2 PUT URL. The client PUTs the bytes straight to R2, then
 * calls /api/media-ops/r2-register to create the media doc.
 *
 * Body: { filename, mimeType, filesize }
 * Response: { url (presigned PUT), key (== media filename), publicUrl }
 */
import type { PayloadHandler } from 'payload'
import crypto from 'crypto'
import { presignR2Put, r2PublicUrl } from '@/utilities/r2Client'
import { usingR2 } from '@/utilities/mediaStorage'
import { applyRateLimit } from '@/utilities/apiRateLimiter'

const MAX_BYTES = 300 * 1024 * 1024 // 300 MB ceiling for a direct clip upload

/** A safe, unique object key that doubles as the media filename. */
function safeKey(filename: string, mimeType: string): string {
  const raw = String(filename || 'upload').trim()
  const dot = raw.lastIndexOf('.')
  const base =
    (dot > 0 ? raw.slice(0, dot) : raw)
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'clip'
  let ext = (dot > 0 ? raw.slice(dot + 1) : '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  if (!ext) ext = (mimeType.split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '')
  return `${base}-${crypto.randomUUID().slice(0, 8)}.${ext}`
}

export const mediaR2UploadUrlHandler: PayloadHandler = async (req) => {
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

  const filename = typeof body.filename === 'string' ? body.filename : ''
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''
  const filesize = Number(body.filesize) || 0
  if (!mimeType) return Response.json({ error: 'mimeType is required' }, { status: 400 })
  if (filesize <= 0) return Response.json({ error: 'filesize is required' }, { status: 400 })
  if (filesize > MAX_BYTES) {
    return Response.json({ error: `Too large — the direct-upload ceiling is ${Math.round(MAX_BYTES / 1024 / 1024)} MB.` }, { status: 413 })
  }

  const key = safeKey(filename, mimeType)
  try {
    const url = await presignR2Put(key, mimeType)
    if (!url) return Response.json({ error: 'Could not mint an upload URL.' }, { status: 500 })
    return Response.json({ url, key, publicUrl: r2PublicUrl(key) })
  } catch (err) {
    payload.logger?.error?.(`[r2-upload-url] ${err instanceof Error ? err.message : String(err)}`)
    return Response.json({ error: 'Could not mint an upload URL.' }, { status: 500 })
  }
}
