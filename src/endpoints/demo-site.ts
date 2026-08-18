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
import { provisionPortal } from '@/utilities/provisionPortal'
import { provisionPagesFromSpec } from '@/utilities/provisionPagesFromSpec'
import { buildDemoSiteSpec, resolveTradePack } from '@/utilities/demoSiteTemplates'
import { setMediaField } from '@/utilities/setMediaField'
import { applyBrochureNav } from '@/utilities/applyBrochureNav'
import { seedDemoServices } from '@/utilities/seedDemoServices'
import { logError } from '@/utilities/logError'

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

  const trade = str(body.trade)
  const city = str(body.city)
  const phone = str(body.phone)
  const email = str(body.email)
  const tagline = str(body.tagline)
  const generateHero = body.generateHero === true

  const { key: tradeKey, pack } = resolveTradePack(trade)
  const log: string[] = []

  try {
    const provisioned = await provisionPortal(payload, {
      name: businessName,
      slug,
      domain: `${slug}.spacesangels.com`,
      tagline: tagline || pack.tagline(city),
      primaryColor: pack.primaryColor,
      secondaryColor: pack.secondaryColor,
      defaultTheme: pack.defaultTheme,
      type: 'business',
      // A client's brochure site is not a federation node. This is also the
      // switch behind the Discovery link, which is FORCE-PRIMARY in the header
      // and therefore immune to the inline cap — the only way it stays out of
      // their bar is for the endeavor not to be network-visible in the first
      // place. Flip it on per endeavor if a portal should federate.
      networkVisible: false,
      description: `${businessName} — ${pack.label}${city ? ` in ${city}` : ''}.`,
    },
    // Join the caller's transaction — provisioning writes across tenants,
    // spaces and channels, and a hook that writes without `req` deadlocks.
    { req })
    const tenantId = provisioned.tenant.id
    log.push(...(provisioned.log || []))

    // Store the owner's contact details ON the tenant. Until 260818 these were
    // only rendered into page copy, so nothing in the system knew where a
    // business's leads should go — and ensureTenantContactForm had no address to
    // notify. A demo site whose contact form reaches nobody is worse than no
    // demo site, because we only find out when the prospect asks why we ignored
    // them.
    if (email || phone) {
      await payload.update({
        collection: 'tenants',
        id: tenantId,
        data: {
          storefront: {
            ...(((provisioned.tenant as { storefront?: object }).storefront as object) || {}),
            ...(email ? { contactEmail: email } : {}),
            ...(phone ? { contactPhone: phone } : {}),
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        overrideAccess: true,
        req,
      })
      log.push(`owner contact stored: ${email || phone}`)
    }

    // Real bookable rows, not just page copy. Without these `resolveServices`
    // finds nothing for the tenant and falls back to the static seed catalog,
    // so /book offered a DIFFERENT business's services on their site.
    try {
      const seeded = await seedDemoServices(payload, tenantId, pack, req)
      log.push(`bookable services: ${seeded.created} created, ${seeded.skipped} already present`)
    } catch (e) {
      // A brochure site without a booking catalog still sells; a 500 sells nothing.
      log.push(`bookable services failed: ${e instanceof Error ? e.message : String(e)}`)
    }

    // Hero first: the page spec needs the media id, and a site whose hero is
    // wired in the same pass looks finished rather than half-built.
    let heroMedia: number | undefined
    if (generateHero) {
      try {
        const res = await setMediaField(payload, {
          collection: 'tenants',
          id: tenantId,
          field: 'branding.logo',
          source: { generate: { prompt: pack.heroPrompt } },
          tenantId: Number(tenantId),
          alt: `${businessName} — ${pack.label}`,
        })
        if ('mediaId' in res && res.mediaId) {
          heroMedia = res.mediaId
          log.push(`hero image ${res.via} (#${res.mediaId})`)
        } else {
          log.push(`hero image skipped: ${'error' in res ? res.error : 'unavailable'}`)
        }
      } catch (e) {
        // A site with no hero still sells; a 500 here sells nothing.
        log.push(`hero image failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    const spec = buildDemoSiteSpec({ businessName, trade, city, phone, email, tagline, heroMedia })
    const pages = await provisionPagesFromSpec(payload, tenantId, spec, { overwrite: true })
    log.push(`pages created ${pages.created.length}, updated ${pages.updated.length}`)

    // Without this the bar fills with Discovery/Works/Learn and the business's
    // own pages collapse into "More" — the prospect opens their free site and
    // sees our product instead of theirs.
    const nav = await applyBrochureNav(payload, tenantId, spec)
    log.push(`nav: ${nav.navItems} items pinned, ${nav.hidden.length} platform routes hidden`)

    return Response.json({
      ok: true,
      url: `https://${slug}.spacesangels.com`,
      tenant: { id: tenantId, slug },
      trade: tradeKey,
      theme: pack.defaultTheme,
      heroMedia: heroMedia ?? null,
      pages,
      log,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await logError({ source: 'demo-site', message: `demo site for "${businessName}" failed: ${msg}`, statusCode: 500 })
    return Response.json({ error: msg, log }, { status: 500 })
  }
}
