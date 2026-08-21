/**
 * runDemoSite — the whole "I'll build your website for free" pass, as a function.
 *
 * Lifted out of the endpoint so the LEO tool and the prospect pipeline can call
 * it directly instead of HTTP-ing back into our own process. The endpoint keeps
 * the auth and the JSON shape; everything below the input parse lives here.
 */
import type { Payload, PayloadRequest } from 'payload'
import { provisionPortal } from '@/utilities/provisionPortal'
import { inviteOwner, type OwnerInvite } from '@/utilities/inviteOwner'
import { provisionPagesFromSpec } from '@/utilities/provisionPagesFromSpec'
import { buildDemoSiteSpec, resolveTradePack } from '@/utilities/demoSiteTemplates'
import { setMediaField } from '@/utilities/setMediaField'
import { applyBrochureNav } from '@/utilities/applyBrochureNav'
import { seedDemoServices } from '@/utilities/seedDemoServices'
import { ensureTenantDefaultAvailability } from '@/utilities/ensureDefaultAvailability'
import { logError } from '@/utilities/logError'


export interface DemoSiteInput {
  businessName: string
  slug: string
  trade?: string
  city?: string
  phone?: string
  email?: string
  tagline?: string
  generateHero?: boolean
  invitedBy?: number | string
}

export async function runDemoSite(
  payload: Payload,
  input: DemoSiteInput,
  opts: { req?: PayloadRequest } = {},
) {
  const { businessName, slug, trade, city, phone, email, tagline, invitedBy } = input
  const generateHero = input.generateHero === true
  const req = opts.req
  const { key: tradeKey, pack } = resolveTradePack(trade)
  const log: string[] = []
  let ownerInvite: OwnerInvite | undefined

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

    // ...and give that owner a way IN. Until 260820 the funnel built a whole
    // portal and stored the buyer's email, but minted no membership and no
    // invite — so the customer we just sold a site to could not administer it,
    // upload a photo, or see a metric. tenant_admin invite, same record the
    // team page shows, accepted at /tenant-invite/<token>.
    // Email OR phone — a Craigslist ad usually gives a number and nothing else,
    // and the invitee signs in with a texted OTP either way. Pass BOTH when we
    // have them, or they end up with twin accounts.
    if (email || phone) {
      const invite = await inviteOwner(payload, {
        email,
        phone,
        tenantId,
        tenantDomain: `${slug}.spacesangels.com`,
        tenantName: businessName,
        invitedBy: invitedBy,
        message: `Your ${businessName} site is live — accept to manage it.`,
        req,
      })
      ownerInvite = invite
      log.push(
        invite.error
          ? `owner invite FAILED: ${invite.error}`
          : `owner invite ${invite.alreadyInvited ? 'already present' : 'created'} for ${email || phone}` +
            ` — emailSent=${invite.emailSent}${invite.emailSent ? '' : ', deliver the link yourself'}`,
      )
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

    // Hours, or the booking page can never actually be booked. Services + a
    // provider without availability yields "no open times" forever, which the
    // owner discovers by showing a customer.
    try {
      const avail = await ensureTenantDefaultAvailability(payload, tenantId)
      log.push(`booking hours: ${avail.note}`)
    } catch (e) {
      log.push(`booking hours failed: ${e instanceof Error ? e.message : String(e)}`)
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

    return {
      ok: true as const,
      url: `https://${slug}.spacesangels.com`,
      tenant: { id: tenantId, slug },
      trade: tradeKey,
      theme: pack.defaultTheme,
      heroMedia: heroMedia ?? null,
      pages,
      ...(ownerInvite ? { invite: ownerInvite } : {}),
      log,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await logError({ source: 'demo-site', message: `demo site for "${businessName}" failed: ${msg}`, statusCode: 500 })
    return { ok: false as const, error: msg, log }
  }
}
