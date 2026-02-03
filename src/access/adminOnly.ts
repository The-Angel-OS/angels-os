import type { Access } from 'payload'

import { checkRole } from '@/access/utilities'

export const adminOnly: Access = ({ req: { user } }) => {
  if (user) return checkRole(['super_admin', 'admin'], user)
  return false
}
