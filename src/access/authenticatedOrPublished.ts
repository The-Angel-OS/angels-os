import type { Access } from 'payload'

/**
 * Allow read if user is logged in, or if doc is published (_status === 'published').
 * For collections without drafts, effectively requires authentication.
 */
export const authenticatedOrPublished: Access = ({ req: { user } }) => {
  if (user) return true
  return {
    _status: {
      equals: 'published',
    },
  }
}
