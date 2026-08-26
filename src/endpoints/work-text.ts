/**
 * Book text window — GET /api/works-ops/text?slug=&lang=&from=&to=
 *
 * The reader opens with a window of pages (see workTextWindow) and asks for more
 * as the reader flips or switches language. getWorkJson refuses a Work this portal
 * does not carry — and `works.access` is checked here too, because this endpoint is
 * a door into the same text the page renders. @see gateWork.ts
 */
import type { PayloadHandler } from 'payload'
import { getWorkJson } from '@/utilities/getWorkJson'
import { TEXT_WINDOW_MAX } from '@/utilities/workTextWindow'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { gateWorkBySlug } from '@/utilities/gateWork'

export const workTextHandler: PayloadHandler = async (req) => {
  const url = new URL(req.url || '', 'http://localhost')
  const slug = (url.searchParams.get('slug') || '').trim()
  const lang = (url.searchParams.get('lang') || '').trim()
  if (!slug || !lang) return Response.json({ error: 'slug and lang are required' }, { status: 400 })

  const from = Math.max(0, Number(url.searchParams.get('from')) || 0)
  const rawTo = Number(url.searchParams.get('to'))
  const to = Math.min(Number.isFinite(rawTo) ? rawTo : from + TEXT_WINDOW_MAX, from + TEXT_WINDOW_MAX)

  const gated = await gateWorkBySlug(req.payload, slug)
  if (gated && !gated.gate.allowed) {
    return Response.json({ error: 'Not available', reason: gated.gate.reason, productId: gated.gate.productId ?? null }, { status: 403 })
  }

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  const origin = host ? `${req.headers.get('x-forwarded-proto') || 'https'}://${host}` : ''

  let tenantSlug: string | null = null
  try {
    tenantSlug = (await resolveTenantFromHeaders()).tenant?.slug ?? null
  } catch {
    // Outside a Next request scope (a direct API call) — availability falls back
    // to the Work's own global/subscriber rules.
  }

  // Ranged: `order` is a column on work-chapters, so this reads the WINDOW, not
  // the whole book. Keyed by each page's own `order` (its absolute position),
  // never by its index in the window.
  const work = await getWorkJson({ payload: req.payload, soulId: slug, tenantSlug, origin, range: { from, to } })
  const pages = (work?.pages ?? []) as Array<{ order?: number; translations?: Record<string, unknown> }>
  if (!pages.length) return Response.json({ texts: {} })

  const texts: Record<string, unknown> = {}
  pages.forEach((p, i) => {
    const order = typeof p.order === 'number' ? p.order : from + i
    if (order < from || order >= to) return
    const t = p.translations?.[lang]
    if (t !== undefined) texts[String(order)] = t
  })

  return Response.json({ slug, lang, from, to, texts })
}
