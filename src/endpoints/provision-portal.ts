/**
 * Provision Portal — POST /api/provision-ops/portal
 *
 * Stands up a single "portal enterprise" (tenant + endeavor + default nav/pages +
 * super_admin membership) on the node it's called on — parameterized, so it works
 * for any node as it comes online (kendev today, the next one tomorrow). A
 * generalization of provision-wdeg-portal, reusing the same canonical helpers the
 * Provision Wizard uses, so it exercises the real multi-tenancy path.
 *
 * Idempotent (find-or-create). super_admin only. Runs on the live Payload (no
 * local boot). Body:
 *   { name, slug, domain, tagline?, primaryColor?, secondaryColor?,
 *     endeavorType?, missionStatement?, description? }
 */
import type { PayloadHandler } from 'payload'
import { provisionPortal } from '@/utilities/provisionPortal'
import { generateInvitationToken, calculateExpiration } from '@/utilities/invitationSystem'
import { sendTenantInvitationEmail } from '@/utilities/sendTenantInvitationEmail'
import { logError } from '@/utilities/logError'

export const provisionPortalHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  // Auth: a super_admin session, OR ?key=CRON_SECRET (so provisioning is
  // scriptable for the factory — LEO/cron/CLI can stand up a vertical without an
  // interactive session). Same pattern as db-repair-locks / ensure-founders.
  const url = new URL(req.url || 'http://localhost', 'http://localhost')
  const key = url.searchParams.get('key')
  const isSuperAdmin = Boolean(((user as { roles?: string[] } | undefined)?.roles)?.includes('super_admin'))
  const keyValid = Boolean(key && process.env.CRON_SECRET && key === process.env.CRON_SECRET)
  if (!isSuperAdmin && !keyValid) {
    return Response.json({ error: 'super_admin or ?key=CRON_SECRET required' }, { status: 403 })
  }

  // Who owns the new portal as tenant_admin: the session user, or — on the key
  // path — the first super_admin found (so a scripted provision still gets an
  // admin linked). Null is fine: provisionPortal just skips the admin link.
  let actingUserId: number | string | undefined = user?.id
  if (actingUserId == null && keyValid) {
    try {
      const admins = await payload.find({
        collection: 'users',
        where: { roles: { contains: 'super_admin' } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      actingUserId = admins.docs?.[0]?.id
    } catch {
      /* no admin resolvable — portal still provisions, just unlinked */
    }
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* allow empty body for GET-style probes */
  }

  const domain = typeof body.domain === 'string' ? body.domain.trim() : ''
  if (!domain) return Response.json({ error: 'domain is required' }, { status: 400 })

  // Accept domain aliases either as a string[] or as the Tenants-shaped [{ domain }].
  const rawAliases = Array.isArray(body.domains) ? body.domains : Array.isArray(body.domainAliases) ? body.domainAliases : []
  const domainAliases = rawAliases
    .map((d) => (typeof d === 'string' ? d : typeof d === 'object' && d && typeof (d as { domain?: unknown }).domain === 'string' ? (d as { domain: string }).domain : ''))
    .filter(Boolean)

  try {
    const result = await provisionPortal(
      payload,
      {
        name: typeof body.name === 'string' ? body.name : 'New Portal',
        slug: typeof body.slug === 'string' ? body.slug : undefined,
        domain,
        domainAliases,
        tagline: typeof body.tagline === 'string' ? body.tagline : undefined,
        primaryColor: typeof body.primaryColor === 'string' ? body.primaryColor : undefined,
        secondaryColor: typeof body.secondaryColor === 'string' ? body.secondaryColor : undefined,
        defaultTheme:
          body.defaultTheme === 'dark' || body.defaultTheme === 'light' || body.defaultTheme === 'auto'
            ? body.defaultTheme
            : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        missionStatement: typeof body.missionStatement === 'string' ? body.missionStatement : undefined,
        endeavorType: typeof body.endeavorType === 'string' ? body.endeavorType : undefined,
        // Tenant flavor was accepted by provisionPortal but never parsed here, so
        // every portal stood up through the endpoint landed as legacy 'tenant'.
        type:
          body.type === 'business' ||
          body.type === 'circle' ||
          body.type === 'guardian_angel' ||
          body.type === 'personal_portal'
            ? body.type
            : undefined,
      },
      { req, actingUserId },
    )

    // Optional owner invite — the factory primitive: provisioning a portal FOR
    // someone should be able to invite + EMAIL them in the same call. We mint the
    // SAME kind of invite the team-admin "Quick Invite" button does — a pending
    // tenant-membership carrying invitationDetails, accepted at /tenant-invite/
    // <token>. That's the canonical Enterprise path, so the invite (a) shows up on
    // the portal's /dashboard/admin/team page and (b) uses the exact accept-URL
    // shape Ken already sends by hand. (The old space-scoped createInvitation path
    // wrote a /invite/<token> record that was invisible on the team page.)
    const ownerEmail = typeof body.ownerEmail === 'string' ? body.ownerEmail.trim().toLowerCase() : ''
    let invite: Record<string, unknown> | undefined
    if (ownerEmail && (result as { ok?: boolean })?.ok) {
      try {
        const tenantRes = (result as { tenant?: { id?: number | string; slug?: string; domain?: string } }).tenant
        const tenantId = tenantRes?.id
        if (tenantId == null) throw new Error('no tenant id from provision result')

        // invitedBy must be a real user (FK). Fall back to any user on the node
        // when the CRON path couldn't resolve a super_admin.
        let inviterId: number | string | undefined = actingUserId
        if (inviterId == null) {
          const anyUser = await payload.find({ collection: 'users', limit: 1, depth: 0, overrideAccess: true })
          inviterId = anyUser.docs?.[0]?.id
        }
        if (inviterId == null) throw new Error('no user available to attribute the invite')

        // Idempotency: if this email already has an active/pending membership on
        // this tenant, don't mint a duplicate (provision is re-runnable).
        const existingMembership = await payload.find({
          collection: 'tenant-memberships',
          where: {
            and: [
              { tenant: { equals: tenantId } },
              { 'invitationDetails.invitationEmail': { equals: ownerEmail } },
              { status: { in: ['active', 'pending'] } },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (existingMembership.totalDocs > 0) {
          const existingDoc = existingMembership.docs[0] as {
            status?: string
            invitationDetails?: { invitationToken?: string; invitationExpiresAt?: string }
          }
          const existingToken = existingDoc.invitationDetails?.invitationToken
          const existingUrl = existingToken
            ? tenantRes?.domain
              ? `https://${tenantRes.domain}/tenant-invite/${existingToken}`
              : `/tenant-invite/${existingToken}`
            : undefined
          invite = {
            email: ownerEmail,
            emailSent: false,
            alreadyInvited: true,
            status: existingDoc.status,
            inviteUrl: existingUrl,
            expiresAt: existingDoc.invitationDetails?.invitationExpiresAt,
          }
          return Response.json({ ...result, invite })
        }

        const token = generateInvitationToken()
        const expiresAt = calculateExpiration(7)

        // Portal owner → tenant_admin (they run their own portal). A pending email
        // invite intentionally has NO `user` — it's linked on accept.
        await payload.create({
          collection: 'tenant-memberships',
          data: {
            tenant: tenantId,
            role: 'tenant_admin',
            status: 'pending',
            invitedBy: inviterId,
            invitationDetails: {
              invitationEmail: ownerEmail,
              invitationToken: token,
              invitationExpiresAt: expiresAt.toISOString(),
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          overrideAccess: true,
        })

        // sendTenantInvitationEmail rewrites the accept link to the tenant's own
        // subdomain. Return a fully-qualified URL on the portal's domain so the
        // copy-paste companion message points at the right host.
        const inviteUrl = `/tenant-invite/${token}`
        const returnedUrl = tenantRes?.domain
          ? `https://${tenantRes.domain}/tenant-invite/${token}`
          : inviteUrl

        const emailSent = await sendTenantInvitationEmail({
          payload,
          tenantId,
          recipientEmail: ownerEmail,
          inviterName: typeof body.inviterName === 'string' ? body.inviterName : 'Kenneth Courtney',
          enterpriseName: typeof body.name === 'string' ? body.name : (tenantRes?.slug || 'your portal'),
          inviteUrl,
          role: 'tenant_admin',
          message: typeof body.ownerMessage === 'string' ? body.ownerMessage : undefined,
        })

        invite = { email: ownerEmail, emailSent, inviteUrl: returnedUrl, expiresAt: expiresAt.toISOString() }
      } catch (invErr) {
        invite = { email: ownerEmail, emailSent: false, error: invErr instanceof Error ? invErr.message : String(invErr) }
      }
    }

    return Response.json({ ...result, ...(invite ? { invite } : {}) })
  } catch (e) {
    payload.logger.error(`[provision-portal] ${e instanceof Error ? e.message : e}`)
    await logError({
      source: 'provision-portal',
      message: `Portal provisioning failed: ${e instanceof Error ? e.message : String(e)}`,
      details: e instanceof Error ? e.stack : String(e),
      statusCode: 500,
      userId: actingUserId,
    })
    return Response.json({ error: e instanceof Error ? e.message : 'provision failed' }, { status: 500 })
  }
}
