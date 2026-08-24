import type { Access } from 'payload'

/**
 * Users are readable by any signed-in person — deliberately, and only in
 * redacted form.
 *
 * A chat where you cannot see who anyone is, is not a chat. Payload decides row
 * visibility BEFORE field visibility, so there is no way to show a peer's name
 * without letting the row through; the protection is field-level
 * (`adminOrSelfFieldAccess`) on everything that is not name/avatar. Ken's call,
 * 260824: global name visibility, yes.
 *
 * The alternative — scoping this to people who share a tenant — cannot be
 * expressed as a `where` (Payload access has no join), so it would cost a peer
 * lookup on every read of every user row. Not worth it: DMs are already global
 * by design.
 *
 * Named rather than `authenticated` on purpose: this is the same shape as
 * Presence, where a platform-wide signed-in read is the design and not an
 * oversight. See `noBareAuthenticated.test.ts`.
 */
export const signedInDirectoryRead: Access = ({ req: { user } }) => Boolean(user)
