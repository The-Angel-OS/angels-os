/**
 * guardVideoUpload — bound direct video uploads to "small clips".
 *
 * Vercel serverless functions cap the request body at ~4.5 MB, and (Phase 1) we
 * upload straight through the Payload API, so a clip must fit under that. This
 * ALSO keeps storage/egress sane while direct upload is on Vercel Blob — larger
 * video is a deliberate Phase 2 (Cloudflare R2 direct-upload). Only affects
 * video/* uploads; images and documents are untouched.
 */
import type { CollectionBeforeValidateHook } from 'payload'
import { APIError } from 'payload'

/** ~4.3 MB — comfortably under Vercel's ~4.5 MB function body limit. */
export const MAX_VIDEO_BYTES = Math.floor(4.3 * 1024 * 1024)

export const guardVideoUpload: CollectionBeforeValidateHook = ({ req }) => {
  const file = (req as { file?: { mimetype?: string; size?: number } }).file
  if (
    file?.mimetype?.startsWith('video/') &&
    typeof file.size === 'number' &&
    file.size > MAX_VIDEO_BYTES
  ) {
    throw new APIError(
      `That clip is ${(file.size / 1_000_000).toFixed(1)} MB — direct video upload is capped at ~4 MB (a short clip) for now. For longer video, embed a YouTube link instead.`,
      413,
    )
  }
}
