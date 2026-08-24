import type { FieldAccess } from 'payload'

import { checkRole, ADMIN_ROLES } from '@/access/utilities'

/**
 * Field-level twin of `adminOrSelf`: the field is readable by an admin, or by
 * the user whose own row this is, and by nobody else.
 *
 * This exists because `users.read` was widened from `adminOrSelf` to
 * `signedInDirectoryRead` on 260824 so that chat can show WHO SAID SOMETHING.
 * Before that a non-admin could read exactly one user row — their own — so every
 * `depth: 1` author population returned a bare id and the UI rendered "Unknown"
 * for every other person on the portal. Widening the ROW gate is what makes
 * names resolve; this is what keeps email, phone, roles, tokens and order
 * history from riding along with them.
 *
 * See `usersFieldExposure.test.ts` — every field on Users must either be on the
 * approved-public list or carry a read gate. Payload gives you a blacklist, not
 * a whitelist, so a field added later is PUBLIC by default; that test is the
 * only thing standing between a new column and the directory.
 */
export const adminOrSelfFieldAccess: FieldAccess = ({ req: { user }, id, doc }) => {
  if (!user) return false
  if (checkRole(ADMIN_ROLES, user)) return true
  // `id` is set on update/delete; `doc` is what's present on a read.
  const target = (doc as { id?: number | string } | undefined)?.id ?? id
  return target != null && String(target) === String(user.id)
}
