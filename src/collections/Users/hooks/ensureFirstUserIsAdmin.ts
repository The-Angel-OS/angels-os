import type { FieldHook } from 'payload'

import type { User } from '@/payload-types'

// ensure the first user created is a super_admin (platform admin)
// 1. lookup a single user on create as succinctly as possible
// 2. if there are no users found, append `super_admin` to the roles array
// access control is already handled by this fields `access` property
// it ensures that only admins can create and update the `roles` field
export const ensureFirstUserIsAdmin: FieldHook<User> = async ({
  operation,
  req,
  value,
  siblingData,
}) => {
  if (operation === 'create' && !siblingData?.isSystemUser) {
    const users = await req.payload.find({
      collection: 'users',
      where: { isSystemUser: { not_equals: true } },
      depth: 0,
      limit: 0,
    })
    if (users.totalDocs === 0) {
      if (!(value || []).includes('super_admin')) {
        return [...(value || []), 'super_admin']
      }
    }
  }

  return value
}
