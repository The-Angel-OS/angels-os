import type { Access } from 'payload'

import { checkRole } from '@/access/utilities'

/**
 * The ID of the document matches that of the user or the user is an admin.
 *
 * Useful to allow users to manage their own account, but not others.
 * super_admin and archangel receive unrestricted access (same as admin).
 */
export const adminOrSelf: Access = ({ req: { user } }) => {
  if (user) {
    if (checkRole(['super_admin', 'admin', 'archangel'], user)) {
      return true
    }

    return {
      id: {
        equals: user.id,
      },
    }
  }

  return false
}
