/**
 * Self-Serve Creator Portal Provisioning — POST /api/portal-ops/self-provision
 *
 * Powers the public `/start` creator onboarding funnel. Requires an authenticated
 * user (`req.user`), validates handle format and reserved subdomains, rejects
 * slug collisions (HTTP 409) so one user cannot overwrite another's portal,
 * enforces per-user portal quota via canonical `provisionPortal()`, and stands up
 * the new creator site on `<handle>.spacesangels.com` under the Starter Preview
 * (`portalPlan: 'free'`) tier.
 */
import type { PayloadHandler } from 'payload'
import { provisionPortal } from '@/utilities/provisionPortal'

const RESERVED_HANDLES = new Set([
  'www',
  'api',
  'admin',
  'core',
  'mail',
  'app',
  'platform',
  'default',
  'help',
  'support',
  'start',
  'login',
  'dashboard',
  'shop',
  'posts',
  'spaces',
  'cdn',
  'static',
  'assets',
  'billing',
  'pay',
  'auth',
  'oauth',
  'mcp',
  'docs',
])

const HANDLE_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/

export const selfProvisionPortalHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user?.id) {
    return Response.json(
      { ok: false, error: 'Please sign in or create a free account to launch your portal.' },
      { status: 401 },
    )
  }

  let body: Record<string, unknown> = {}
  try {
    body = ((await req.json?.()) as Record<string, unknown>) || {}
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const rawHandle = typeof body.handle === 'string' ? body.handle.trim().toLowerCase() : ''
  const handle = rawHandle.replace(/^@/, '').replace(/[^a-z0-9-]/g, '')

  if (!HANDLE_REGEX.test(handle)) {
    return Response.json(
      {
        ok: false,
        error:
          'Handle must be 3–32 characters using lowercase letters, numbers, or hyphens (cannot start or end with a hyphen).',
      },
      { status: 400 },
    )
  }

  if (RESERVED_HANDLES.has(handle)) {
    return Response.json(
      { ok: false, error: `"${handle}" is a reserved system handle. Please choose another.` },
      { status: 400 },
    )
  }

  // Prevent slug hijack: reject if another tenant already holds this slug
  const existing = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: handle } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (existing.docs?.length) {
    return Response.json(
      {
        ok: false,
        error: `"${handle}.spacesangels.com" is already claimed. Pick a slightly different handle.`,
      },
      { status: 409 },
    )
  }

  const rawName = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
  const name = rawName || `${handle.charAt(0).toUpperCase() + handle.slice(1)} Universe`
  const rawTagline = typeof body.tagline === 'string' ? body.tagline.trim().slice(0, 140) : ''
  const tagline = rawTagline || 'Official Creator Storefront, Memberships & Community'
  const youtubeChannel =
    typeof body.youtubeChannel === 'string' ? body.youtubeChannel.trim().slice(0, 200) : ''
  const focus = Array.isArray(body.focus)
    ? body.focus.filter((f): f is string => typeof f === 'string').slice(0, 6)
    : []

  const domain = `${handle}.spacesangels.com`
  const descriptionParts = [
    `${name} — built on Angel OS.`,
    focus.length ? `Enabled surfaces: ${focus.join(', ')}.` : '',
    youtubeChannel ? `Source channel: ${youtubeChannel}` : '',
  ].filter(Boolean)

  try {
    const result = await provisionPortal(
      payload,
      {
        name,
        slug: handle,
        domain,
        tagline,
        description: descriptionParts.join(' '),
        endeavorType: 'creator-content',
        portalPlan: 'free',
        networkVisible: false,
      },
      {
        req,
        actingUserId: user.id,
      },
    )

    const requestedPlan = typeof body.plan === 'string' ? body.plan : 'starter'
    return Response.json({
      ok: true,
      slug: result.tenant.slug,
      tenantId: result.tenant.id,
      domain: result.tenant.domain,
      url: result.url,
      dashboardUrl: `${result.url}/dashboard`,
      upgradeHint:
        requestedPlan !== 'starter'
          ? `${result.url}/dashboard/admin/settings?tab=plan`
          : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isQuota = /already have \d+ of \d+/i.test(message)
    return Response.json(
      { ok: false, error: message },
      { status: isQuota ? 403 : 500 },
    )
  }
}
