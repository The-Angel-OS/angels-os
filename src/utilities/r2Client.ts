/**
 * R2 client helpers for the direct-upload endpoints (media-ops/r2-*).
 *
 * A large clip can't POST through a Vercel function (~4.5 MB body cap), so the
 * device uploads STRAIGHT to R2 via a presigned PUT, then registers the media
 * doc. This is the server side of that: mint the presigned URL + resolve the
 * public URL. Only meaningful when R2 is the active backend (usingR2).
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { usingR2 } from './mediaStorage'

let _client: S3Client | null = null

export function getR2Client(): S3Client | null {
  if (!usingR2) return null
  if (_client) return _client
  _client = new S3Client({
    endpoint: process.env.R2_ENDPOINT!,
    region: 'auto',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
  return _client
}

export function r2Bucket(): string {
  return process.env.R2_BUCKET || ''
}

/** The public (r2.dev / custom-domain) URL an object is served from. */
export function r2PublicUrl(key: string): string {
  const base = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')
  return `${base}/${key}`
}

/** A presigned PUT URL for `key` (expires in `expiresIn` seconds). */
export async function presignR2Put(key: string, contentType: string, expiresIn = 900): Promise<string | null> {
  const client = getR2Client()
  if (!client) return null
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: r2Bucket(), Key: key, ContentType: contentType }),
    { expiresIn },
  )
}
