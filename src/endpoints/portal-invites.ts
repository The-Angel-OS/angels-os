/**
 * Portal Invites — GET /api/provision-ops/invites?slug=<tenant-slug>
 *
 * "What link do I text them?" Minting an invite returns its URL exactly once;
 * this hands it back afterwards without minting a duplicate, using the same
 * builder the accept page resolves. super_admin or ?key=CRON_SECRET.
 *
 * ?includeAccepted=true also lists already-active memberships, for checking
 * whether a prospect ever walked through the door.
 *
 * @see src/utilities/inviteOwner.ts
 */
import type { PayloadHandler } from 'payload'
import { listPortalInvites } from '@/utilities/inviteOwner'

export const portalInvitesHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  const url = new URL(req.url || 'http://localhost', 'http://localhost')
  const key = url.searchParams.get('key')
  const isSuperAdmin = Boolean(((user as { roles?: string[] } | undefined)?.roles)?.includes('super_admin'))
  const keyValid = Boolean(key && process.env.CRON_SECRET && key === process.env.CRON_SECRET)
  if (!isSuperAdmin && !keyValid) {
    return Response.json({ error: 'super_admin or ?key=CRON_SECRET required' }, { status: 403 })
  }

  const slug = url.searchParams.get('slug')?.trim()
  if (!slug) return Response.json({ error: 'slug is required' }, { status: 400 })

  try {
    const res = await listPortalInvites(payload, {
      slug,
      includeAccepted: url.searchParams.get('includeAccepted') === 'true',
    })
    if (!res.found) return Response.json({ error: `No tenant with slug "${slug}" on this node.` }, { status: 404 })
    return Response.json(res)
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'lookup failed' }, { status: 500 })
  }
}
