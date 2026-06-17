/**
 * Market linkage — POST /api/provision-ops/link-market
 *
 * Group a merchant endeavor under a market parent so the market has a front door and
 * its merchants interlink on Discovery (`/federation/discover?market=<parent>`).
 *
 * POST body: { child: <merchantSlug>, parent: <marketSlug>, unlink?: boolean }
 * GET  ?parent=<marketSlug> → list a market's merchant slugs.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Idempotent. Uses the settings bag (no
 * schema change) — see src/utilities/marketMembership.ts.
 */
import type { PayloadHandler } from 'payload'
import { linkEndeavorToMarket, unlinkEndeavorFromMarket, getMarketChildren } from '@/utilities/marketMembership'

export const linkMarketHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(user && ((user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })

  // GET → read a market's children.
  if ((req.method || 'GET').toUpperCase() === 'GET') {
    const parent = url.searchParams.get('parent') || ''
    if (!parent) return Response.json({ error: 'parent is required' }, { status: 400 })
    const children = await getMarketChildren(payload, parent)
    return Response.json({ ok: true, parent, children })
  }

  let body: Record<string, unknown> = {}
  try { body = (await (req as unknown as Request).json()) as Record<string, unknown> } catch { /* empty */ }

  const child = typeof body.child === 'string' ? body.child.trim() : ''
  const parent = typeof body.parent === 'string' ? body.parent.trim() : ''
  if (!child || !parent) return Response.json({ error: 'child and parent slugs are required' }, { status: 400 })

  try {
    const res = body.unlink === true
      ? await unlinkEndeavorFromMarket(payload, child, parent)
      : await linkEndeavorToMarket(payload, child, parent)
    return Response.json({ ok: true, parent, child, linked: body.unlink !== true, children: res.children })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[link-market] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
