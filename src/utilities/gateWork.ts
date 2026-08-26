/**
 * One gate, every door into a Work.
 *
 * `works.access` was only ever enforced by the CoursePlayer block. The canonical
 * reader at `/learn/<slug>` and the windowed text endpoint the BookReader pages
 * through both read straight from storage — so the first Work ever put up for
 * sale served its entire 146 KB to a signed-out visitor at its own URL. A
 * paywall with a second door is not a paywall.
 *
 * Takes a slug, returns the Work row plus the viewer's standing on it.
 */
import type { Payload } from 'payload'
import { headers } from 'next/headers'
import { resolveTrainingAccess, type TrainingAccess } from '@/utilities/trainingAccess'

export interface GatedWork {
  /** The resolved viewer — callers need it for progress/resume, so resolve it once. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any
  work: { id: number; title?: string | null; access?: string | null; product?: number | null; owner?: string | null }
  gate: TrainingAccess
  /** The product that unlocks it, when the caller should offer a way in. */
  product: { slug?: string | null; title?: string | null; priceInUSD?: number | null } | null
}

export async function gateWorkBySlug(payload: Payload, slug: string): Promise<GatedWork | null> {
  const res = await payload.find({
    collection: 'works',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const work = res.docs?.[0] as unknown as GatedWork['work'] | undefined
  if (!work) return null

  // A public Work is the common case — the whole Library — and answering it costs
  // nothing. Resolving the session first would put an auth round-trip on every
  // Bible chapter view to learn something we already know.
  if ((work.access || 'public') === 'public') {
    return { user: null, work, gate: { allowed: true, reason: 'open' }, product: null }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let user: any = null
  let tenantId: number | string | null = null
  try {
    const h = await headers()
    user = (await payload.auth({ headers: h })).user
    const t = h.get('x-tenant-id')
    tenantId = t ? (/^\d+$/.test(t) ? Number(t) : t) : null
  } catch {
    /* signed out, or outside a request scope */
  }

  const gate = await resolveTrainingAccess(payload, user, work, tenantId)

  let product: GatedWork['product'] = null
  if (!gate.allowed && gate.productId) {
    try {
      product = (await payload.findByID({
        collection: 'products',
        id: gate.productId,
        depth: 0,
        overrideAccess: true,
      })) as never
    } catch {
      /* a product that has gone missing must not take the page down */
    }
  }

  return { user, work, gate, product }
}
