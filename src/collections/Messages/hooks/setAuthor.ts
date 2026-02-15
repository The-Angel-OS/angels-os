import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Auto-set the message author to the currently authenticated user.
 * This way the client doesn't need to send author ID explicitly.
 */
export const setAuthor: CollectionBeforeChangeHook = ({ data, req, operation }) => {
  if (operation === 'create' && req.user && !data?.author) {
    return {
      ...data,
      author: req.user.id,
    }
  }
  return data
}
