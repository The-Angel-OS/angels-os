import type { Access } from 'payload'

import { checkRole, ADMIN_ROLES } from '@/access/utilities'

export const adminOrCustomerOwner: Access = ({ req: { user } }) => {
  if (user && checkRole(ADMIN_ROLES, user)) {
    return true
  }

  if (user?.id) {
    return {
      customer: {
        equals: user.id,
      },
    }
  }

  return false
}
