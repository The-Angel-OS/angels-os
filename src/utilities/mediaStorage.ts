/**
 * Media storage backend — Cloudflare R2 when configured, else Vercel Blob.
 *
 * DORMANT until the R2_* env vars exist: with none set, `usingR2` is false and we
 * return the exact vercelBlobStorage plugin we've always used — zero behavior
 * change. Set all five R2_* vars (see below) and media flips to R2:
 *   - direct browser→R2 uploads (clientUploads) — bypasses Vercel's ~4.5 MB
 *     function body limit, so real video uploads work;
 *   - served straight from the R2 public URL (generateFileURL) — R2 has zero
 *     egress fees, the actual cost-killer for video.
 *
 * Required env to enable R2:
 *   R2_BUCKET             e.g. angel-os-media
 *   R2_ENDPOINT           https://<accountid>.r2.cloudflarestorage.com
 *   R2_ACCESS_KEY_ID      (R2 S3 API token — access key id)
 *   R2_SECRET_ACCESS_KEY  (R2 S3 API token — secret)
 *   R2_PUBLIC_URL         https://<bucket>.r2.dev  OR a bound custom domain
 *
 * ⚠️ Migration: existing media rows store RELATIVE urls (/api/media/file/<name>),
 * served from whatever adapter is active. Flipping to R2 without copying the bytes
 * would 404 old files — run the Blob→R2 migration (scripts/_local/migrate-blob-to-r2)
 * BEFORE flipping, or accept that only NEW uploads live on R2.
 */
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { s3Storage } from '@payloadcms/storage-s3'

export const usingR2 = Boolean(
  process.env.R2_BUCKET &&
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_PUBLIC_URL,
)

function r2Plugin() {
  const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')
  return s3Storage({
    enabled: true,
    collections: {
      media: {
        // Serve DIRECTLY from R2's public domain (zero Vercel egress). filename is
        // the stored object key; prefix is empty for our media collection.
        generateFileURL: ({ filename, prefix }) =>
          `${publicBase}/${prefix ? `${prefix}/` : ''}${filename}`,
      },
    },
    bucket: process.env.R2_BUCKET!,
    config: {
      endpoint: process.env.R2_ENDPOINT!,
      region: 'auto',
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true, // R2 wants path-style addressing
    },
    // Direct browser→R2 upload — the thing that removes the 4.5 MB wall.
    clientUploads: true,
  })
}

function blobPlugin() {
  return vercelBlobStorage({
    enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    collections: { media: true },
    token: process.env.BLOB_READ_WRITE_TOKEN!,
  })
}

/** The media storage plugin to register — R2 when fully configured, else Blob. */
export const mediaStoragePlugin = usingR2 ? r2Plugin() : blobPlugin()
