import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidatePath } from 'next/cache'

export const revalidatePost: CollectionAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context?.disableRevalidate && doc?._status === 'published') {
    const path = doc?.slug ? `/posts/${doc.slug}` : '/posts'
    payload.logger?.info?.(`Revalidating post at path: ${path}`)
    try {
      revalidatePath(path)
    } catch {
      // Expected when running outside Next.js server (e.g. CLI seed)
    }
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook = ({ doc, req: { context } }) => {
  if (!context?.disableRevalidate) {
    const path = doc?.slug ? `/posts/${doc.slug}` : '/posts'
    try {
      revalidatePath(path)
    } catch {
      // Expected when running outside Next.js server (e.g. CLI seed)
    }
  }
  return doc
}
