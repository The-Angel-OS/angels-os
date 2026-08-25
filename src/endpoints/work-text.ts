/**
 * Book text window — GET /api/works-ops/text?slug=&lang=&from=&to=
 *
 * The reader opens with a window of pages (see workTextWindow) and asks for more
 * as the reader flips or switches language. Public, like the Work it serves:
 * getWorkJson already refuses a Work this portal does not carry.
 */
import type { PayloadHandler } from 'payload'
import { getWorkJson } from '@/utilities/getWorkJson'
import { TEXT_WINDOW_MAX } from '@/utilities/workTextWindow'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'

export const workTextHandler: PayloadHandler = async (req) => {
  const url = new URL(req.url || '', 'http://localhost')
  const slug = (url.searchParams.get('slug') || '').trim()
  const lang = (url.searchParams.get('lang') || '').trim()
  if (!slug || !lang) return Response.json({ error: 'slug and lang are required' }, { status: 400 })

  const from = Math.max(0, Number(url.searchParams.get('from')) || 0)
  const rawTo = Number(url.searchParams.get('to'))
  const to = Math.min(Number.isFinite(rawTo) ? rawTo : from + TEXT_WINDOW_MAX, from + TEXT_WINDOW_MAX)

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  const origin = host ? `${req.headers.get('x-forwarded-proto') || 'https'}://${host}` : ''

  let tenantSlug: string | null = null
  try {
    tenantSlug = (await resolveTenantFromHeaders()).tenant?.slug ?? null
  } catch {
    // Outside a Next request scope (a direct API call) — availability falls back
    // to the Work's own global/subscriber rules.
  }

  const work = await getWorkJson({ payload: req.payload, soulId: slug, tenantSlug, origin })
  const pages = (work?.pages ?? []) as Array<{ translations?: Record<string, unknown> }>
  if (!pages.length) return Response.json({ texts: {} })

  const texts: Record<string, unknown> = {}
  for (let i = from; i < Math.min(to, pages.length); i++) {
    const t = pages[i]?.translations?.[lang]
    if (t !== undefined) texts[String(i)] = t
  }

  return Response.json({ slug, lang, from, to, texts })
}
