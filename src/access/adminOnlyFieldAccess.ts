import type { FieldAccess } from 'payload'

import { checkRole } from '@/access/utilities'

export const adminOnlyFieldAccess: FieldAccess = ({ req: { user } }) => {
  if (user) return checkRole(['super_admin', 'admin', 'archangel'], user)

  return false
}
