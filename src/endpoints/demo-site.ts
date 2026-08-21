/**
 * Demo Site — POST /api/provision-ops/demo-site
 *
 * "I'll build your website for free." One call turns a prospect into a live
 * five-page site on <slug>.spacesangels.com: portal, branding, theme, starter
 * content, contact form, and optionally an AI-generated hero.
 *
 * The whole conversion mechanic of the offer we're replicating is that the work
 * happens BEFORE the ask. Doing that by hand takes days, which is why nobody
 * does it at volume. Doing it in one call takes about a minute, which is the
 * entire advantage — so this is a single endpoint, not a checklist.
 *
 * Idempotent: re-running for the same slug updates the site rather than minting
 * a second portal (provisionPortal is find-or-create; pages overwrite by slug).
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Deliberately NOT public — each call
 * creates a tenant with spaces, channels and an endeavor, which is far too much
 * to hand an anonymous caller. Wire a public form to this server-side.
 *
 * Body:
 *   {
 *     "businessName": "Shine & Clean Solutions",   // required
 *     "trade": "house cleaning",                    // free text, matched to a pack
 *     "slug": "shineandclean",                      // optional, derived from name
 *     "city": "Gainesville, FL",
 *     "phone": "352-555-0100",
 *     "email": "owner@example.com",
 *     "tagline": "...",                             // optional override
 *     "generateHero": true                          // AI hero image (slower)
 *   }
 *
 * @see src/utilities/demoSiteTemplates.ts
 * @see src/utilities/provisionPortal.ts
 */
import type { PayloadHandler } from 'payload'
import { runDemoSite } from '@/utilities/runDemoSite'

/** Business name → subdomain label. Lowercase, alphanumeric, no leading digit. */
export function slugifyBusinessName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40)
  // A label that starts with a digit is legal DNS but reads like a typo, and
  // some older resolvers still object — prefix rather than reject the business.
  return /^[0-9]/.test(base) ? `x${base}`.slice(0, 40) : base
}

export const demoSiteHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(user && ((user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const str = (v: unknown): string | undefined => {
    const t = typeof v === 'string' ? v.trim() : ''
    return t ? t.slice(0, 200) : undefined
  }

  const businessName = str(body.businessName)
  if (!businessName) return Response.json({ error: 'businessName is required' }, { status: 400 })

  const slug = str(body.slug)?.toLowerCase() || slugifyBusinessName(businessName)
  if (!slug) {
    return Response.json({ error: 'Could not derive a slug — pass one explicitly' }, { status: 400 })
  }

  const result = await runDemoSite(
    payload,
    {
      businessName,
      slug,
      trade: str(body.trade),
      city: str(body.city),
      phone: str(body.phone),
      email: str(body.email),
      tagline: str(body.tagline),
      generateHero: body.generateHero === true,
      invitedBy: user?.id,
    },
    // Join the caller's transaction — provisioning writes across tenants,
    // spaces and channels, and a hook that writes without `req` deadlocks.
    { req },
  )

  return result.ok ? Response.json(result) : Response.json(result, { status: 500 })
}
