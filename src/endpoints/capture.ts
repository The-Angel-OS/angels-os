/**
 * POST /api/capture — public lead capture from a site we do NOT host.
 *
 * The Kessela case: their store stays on WordPress and keeps taking payments,
 * but everyone who isn't ready to buy today leaves and is gone forever. This is
 * the one script tag that stops that, without touching their checkout.
 *
 * Paired with `public/embed.js`, which renders the form and posts here.
 *
 * Deliberately NOT authenticated — the whole point is that a stranger on someone
 * else's website can use it. The defences are therefore: a required tenant slug,
 * per-IP rate limiting, a honeypot, and a hard cap on what any field can carry.
 * It writes ONE row type (a contact) and reads nothing back, so the blast radius
 * of abuse is junk contacts, not disclosure.
 */
import type { PayloadHandler } from 'payload'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'
import { logError } from '@/utilities/logError'

const MAX_LEN = 200
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Third-party pages call this cross-origin. No cookies are involved (and none
 *  are sent — the request is explicitly credential-less), so `*` is safe here in
 *  a way it would never be on an authenticated endpoint. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: CORS })

const clean = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v.trim().slice(0, MAX_LEN)
  return t.length ? t : undefined
}

export const captureOptionsHandler: PayloadHandler = async () =>
  new Response(null, { status: 204, headers: CORS })

export const captureHandler: PayloadHandler = async (req) => {
  const limited = applyRateLimit(req, 'default')
  if (limited) return limited

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  // Honeypot: a real person never fills a hidden field. Answer 200 so a bot
  // learns nothing from the response.
  if (clean(body.company)) return json({ ok: true })

  const tenantSlug = clean(body.tenant)
  const email = clean(body.email)?.toLowerCase()
  const phone = clean(body.phone)
  const name = clean(body.name)
  const campaign = clean(body.campaign)

  if (!tenantSlug) return json({ error: 'Missing tenant.' }, 400)
  if (!email && !phone) return json({ error: 'An email or phone is required.' }, 400)
  if (email && !EMAIL_RE.test(email)) return json({ error: 'That email looks wrong.' }, 400)

  const tenant = await fetchTenantBySlug(tenantSlug)
  if (!tenant?.id) return json({ error: 'Unknown tenant.' }, 404)

  try {
    // Idempotent by email within the tenant — the same person filling the form
    // on three pages is one contact, not three. Matches save_contact's upsert.
    const existing = email
      ? await req.payload.find({
          collection: 'contacts',
          where: { and: [{ tenant: { equals: tenant.id } }, { email: { equals: email } }] },
          limit: 1,
          depth: 0,
          overrideAccess: true,
          req,
        })
      : { docs: [] }

    const tags = ['web-capture', ...(campaign ? [`campaign:${campaign}`] : [])]

    if (existing.docs?.[0]) {
      const doc = existing.docs[0] as { id: number | string; tags?: string[] | null }
      await req.payload.update({
        collection: 'contacts',
        id: doc.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          ...(phone ? { phone } : {}),
          ...(name ? { name } : {}),
          tags: Array.from(new Set([...(doc.tags || []), ...tags])),
        } as any,
        depth: 0,
        overrideAccess: true,
        req,
      })
      return json({ ok: true, existing: true })
    }

    await req.payload.create({
      collection: 'contacts',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        tenant: tenant.id,
        email,
        phone,
        name,
        source: 'web-form',
        sourceId: campaign,
        tags,
        contactStatus: 'active',
      } as any,
      depth: 0,
      overrideAccess: true,
      req,
    })

    return json({ ok: true })
  } catch (err) {
    // A capture failure is a lead on the floor — escalate it rather than
    // swallowing, but never show the visitor a stack trace.
    void logError({
      level: 'warning',
      source: 'capture',
      message: `Lead capture failed for tenant "${tenantSlug}": ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
      tenantId: typeof tenant.id === 'number' ? tenant.id : undefined,
    })
    return json({ error: 'Could not save that. Please try again.' }, 500)
  }
}
