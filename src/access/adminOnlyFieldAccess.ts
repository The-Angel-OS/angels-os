import type { FieldAccess } from 'payload'

import { checkRole, ADMIN_ROLES } from '@/access/utilities'

export const adminOnlyFieldAccess: FieldAccess = ({ req: { user } }) => {
  if (user) return checkRole(ADMIN_ROLES, user)

  return false
}
