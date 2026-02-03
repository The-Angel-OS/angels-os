import { del } from '@vercel/blob'

/**
 * Deletes a media file from Vercel Blob storage by URL.
 * Use this when clearing media during seed to ensure hosted blobs are removed,
 * since payload.db.deleteMany bypasses storage adapter hooks.
 *
 * Safe to call even if blob no longer exists (del won't throw).
 */
export async function deleteMediaFromVercelBlob(
  url: string | null | undefined,
  token?: string,
): Promise<void> {
  if (!url || typeof url !== 'string') return
  if (!url.includes('blob.vercel-storage.com')) return

  await del(url, { token: token ?? process.env.BLOB_READ_WRITE_TOKEN ?? undefined })
}
