import type { Access } from 'payload'

/** Allow access only when user is logged in. */
export const authenticated: Access = ({ req: { user } }) => Boolean(user)
