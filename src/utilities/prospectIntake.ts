/**
 * prospectIntake — paste an ad, get a live site, an invite link, a CRM record
 * and the message to send. One call.
 *
 * The conversion mechanic is that the work happens BEFORE the ask, so the
 * bottleneck was never the build (runDemoSite is a minute) — it was the four
 * manual steps around it. This is those four steps.
 *
 * PARSING IS THE CALLER'S JOB. LEO already read the ad in order to call this,
 * so asking it for the fields costs nothing; a regex parser for Craigslist ad
 * prose would be a permanent maintenance tax for the same answer.
 *
 * ponytail: the prospect record is a Contact tagged `prospect` on the platform
 * tenant, not a new collection and not a new enum value — no schema, no
 * migration, and the CRM sequences already know how to read it.
 */
import type { Payload, PayloadRequest, Where } from 'payload'
import { runDemoSite } from '@/utilities/runDemoSite'
import { slugifyBusinessName } from '@/endpoints/demo-site'
import { findPlace, samePhone, checkWebsite, type PlaceMatch, type WebsiteCheck } from '@/utilities/googlePlaceLookup'

export interface ProspectInput {
  businessName: string
  trade?: string
  city?: string
  phone?: string
  email?: string
  contactName?: string
  /** The ad, verbatim. Stored on the record so the next touch has the context. */
  adText?: string
  adUrl?: string
  slug?: string
  generateHero?: boolean
  invitedBy?: number | string
}

/** The platform tenant owns prospect records — a ministry's CRM is its members. */
async function platformTenantId(payload: Payload, req?: PayloadRequest) {
  const res = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: 'platform' } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return res.docs?.[0]?.id
}

/** Outreach drafts. Plain trade language — never our product vocabulary. */
export function draftOutreach(o: {
  businessName: string
  contactName?: string
  url: string
  inviteUrl?: string
  city?: string
}) {
  const who = o.contactName ? o.contactName.split(' ')[0] : 'there'
  const sms =
    `Hi ${who} — I saw your ad and built ${o.businessName} a website, no charge: ${o.url}. ` +
    `It's live now. If you want it, this link makes it yours to edit${o.inviteUrl ? `: ${o.inviteUrl}` : ''}. ` +
    `If not, no hard feelings and I'll take it down.`
  const subject = `I built ${o.businessName} a website — it's live, no charge`
  const email =
    `Hi ${who},\n\n` +
    `I came across your ad and put together a website for ${o.businessName}${o.city ? ` in ${o.city}` : ''}. ` +
    `It's already live: ${o.url}\n\n` +
    `There's nothing to sign up for and no bill. I build these to show what I can do, and you're welcome to it either way.\n\n` +
    (o.inviteUrl
      ? `If you'd like to take it over — change the photos, the wording, your hours — this link makes you the owner of it:\n${o.inviteUrl}\n\n`
      : '') +
    `If it's not for you, say the word and I'll take it down same day.\n\nKenneth`
  return { sms, subject, email }
}

export async function prospectIntake(
  payload: Payload,
  input: ProspectInput,
  opts: { req?: PayloadRequest } = {},
) {
  const req = opts.req
  const log: string[] = []
  const slug = (input.slug || slugifyBusinessName(input.businessName)).toLowerCase()

  const site = await runDemoSite(
    payload,
    {
      businessName: input.businessName,
      slug,
      trade: input.trade,
      city: input.city,
      phone: input.phone,
      email: input.email,
      generateHero: input.generateHero,
      invitedBy: input.invitedBy,
    },
    { req },
  )
  if (!site.ok) return { ok: false as const, error: site.error, log: site.log }
  log.push(...site.log)

  const url = site.url
  const inviteUrl = site.invite?.inviteUrl

  // What Google already knows about them. Finding a Place ID by hand is the
  // most annoying minute of standing a prospect up, and the rating/review count
  // is the thing that decides the pitch: a business with proof already does not
  // need a website, it needs whatever it is actually short of.
  let place: PlaceMatch | undefined
  try {
    const q = [input.businessName, input.city].filter(Boolean).join(' ')
    const found = await findPlace(q, { maxResults: 5 })
    // Prefer the listing whose phone matches the ad — a trade name alone
    // matches the wrong business in the right town often enough to matter.
    place =
      found.matches.find((m) => samePhone(m.phone, input.phone)) || found.matches[0]
    log.push(
      found.ok
        ? place
          ? `google listing: ${place.name} (${place.placeId})` +
            (place.rating ? `, ${place.rating}★ from ${place.reviewCount ?? 0}` : ', no rating')
          : 'google listing: no match'
        : `google listing lookup failed: ${found.error}`,
    )
  } catch (e) {
    log.push(`google listing lookup failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  // "They have a website" and "their website works" are different facts.
  let website: WebsiteCheck | undefined
  if (place?.website) {
    website = await checkWebsite(place.website)
    log.push(`their website: ${website.note}`)
  }

  // The CRM record. Idempotent on (tenant, phone|email) so re-running an ad
  // updates the prospect instead of growing a second one.
  let contactId: number | string | undefined
  try {
    const tenantId = await platformTenantId(payload, req)
    if (!tenantId) throw new Error('no platform tenant on this node')
    const match: Where | null = input.email
      ? { email: { equals: input.email } }
      : input.phone
        ? { phone: { equals: input.phone } }
        : null
    const existing = match
      ? await payload.find({
          collection: 'contacts',
          where: { and: [{ tenant: { equals: tenantId } }, match] },
          limit: 1,
          depth: 0,
          overrideAccess: true,
          req,
        })
      : { docs: [] as { id: number | string }[] }

    const notes = [
      `Prospect for ${input.businessName}${input.city ? ` — ${input.city}` : ''}.`,
      `Site built: ${url}`,
      inviteUrl ? `Owner invite: ${inviteUrl}` : 'No invite — no email or phone in the ad.',
      input.adUrl ? `Ad: ${input.adUrl}` : '',
      place ? `Google: ${place.name} — ${place.placeId}` : '',
      place?.rating != null ? `Google rating: ${place.rating} from ${place.reviewCount ?? 0} reviews` : '',
      place?.website ? `Existing website: ${place.website} — ${website?.note || 'not checked'}` : '',
      place?.address ? `Address: ${place.address}` : '',
      input.adText ? `\n--- ad as posted ---\n${input.adText.slice(0, 4000)}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const data = {
      tenant: tenantId,
      email: input.email,
      phone: input.phone,
      name: input.contactName || input.businessName,
      source: 'manual' as const,
      sourceId: `prospect:${slug}`,
      tags: ['prospect', ...(input.trade ? [input.trade] : [])],
      contactStatus: inviteUrl ? ('invited' as const) : ('lead' as const),
      inviteStatus: inviteUrl ? ('pending' as const) : ('not-invited' as const),
      ...(inviteUrl ? { lastInvitedAt: new Date().toISOString() } : {}),
      notes,
    }

    if (existing.docs[0]) {
      contactId = existing.docs[0].id
      await payload.update({
        collection: 'contacts',
        id: contactId,
        data: data as never,
        overrideAccess: true,
        req,
      })
      log.push(`prospect record updated (#${contactId})`)
    } else {
      const created = await payload.create({
        collection: 'contacts',
        data: data as never,
        overrideAccess: true,
        req,
      })
      contactId = created.id
      log.push(`prospect record created (#${contactId})`)
    }
  } catch (e) {
    // A prospect with a live site and no CRM row is still a prospect. Never
    // fail the whole intake over the filing.
    log.push(`prospect record failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  return {
    ok: true as const,
    url,
    inviteUrl,
    tenant: site.tenant,
    trade: site.trade,
    contactId,
    place,
    website,
    outreach: draftOutreach({
      businessName: input.businessName,
      contactName: input.contactName,
      url,
      inviteUrl,
      city: input.city,
    }),
    log,
  }
}
