import type { Access } from 'payload'

import { checkRole } from '@/access/utilities'

export const adminOrCustomerOwner: Access = ({ req: { user } }) => {
  if (user && checkRole(['super_admin', 'admin', 'archangel'], user)) {
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
