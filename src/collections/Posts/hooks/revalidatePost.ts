import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidatePath } from 'next/cache'

export const revalidatePost: CollectionAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context?.disableRevalidate && doc?._status === 'published') {
    const path = doc?.slug ? `/posts/${doc.slug}` : '/posts'
    payload.logger?.info?.(`Revalidating post at path: ${path}`)
    revalidatePath(path)
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook = ({ doc, req: { context } }) => {
  if (!context?.disableRevalidate) {
    const path = doc?.slug ? `/posts/${doc.slug}` : '/posts'
    revalidatePath(path)
  }
  return doc
}
