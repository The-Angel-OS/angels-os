/**
 * Site Log reports — GET /api/site-log/report
 *
 * The reporting half of the DNN Site Log module, rebuilt on `site-visits`. One
 * endpoint with a `type` parameter, because every one of these is the same query
 * with a different GROUP BY — a dozen endpoints would be a dozen places to fix a
 * tenant-scoping bug.
 *
 *   detail        the raw log, newest first (DNN "Detailed Site Log")
 *   pages         page popularity
 *   referrers     where visitors came from (DNN "Site Referrals")
 *   agents        browser / OS / device breakdown (DNN "User Agents")
 *   by-day        page views and unique visitors per calendar day
 *   by-weekday    which days of the week are busy
 *   by-hour       which hours of the day are busy
 *   visitors      most frequent returning visitors (DNN "User Frequency")
 *
 * Scoping is not negotiable: an owner sees THEIR portal and nothing else. The
 * tenant comes from the request host, never from a parameter, and the caller must
 * be a manager of it (or a platform admin). Reports exclude crawlers unless
 * `?bots=true`, because "we had 400 visitors" should not mean Googlebot.
 *
 * ponytail: computed live with GROUP BY, no rollup tables. These scan one tenant's
 * rows inside a bounded window and the indexes on path/referrer_host/browser carry
 * it. Add rollups when one portal's window stops fitting in a fast query.
 */
import type { PayloadHandler } from 'payload'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

const MANAGER_ROLES = new Set(['tenant_admin', 'tenant_manager'])

export const REPORT_TYPES = [
  'detail',
  'pages',
  'referrers',
  'agents',
  'by-day',
  'by-weekday',
  'by-hour',
  'visitors',
] as const
export type ReportType = (typeof REPORT_TYPES)[number]

/** Days of history, clamped to something a live query can answer. */
export function clampDays(raw: string | null, fallback = 30): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(365, Math.max(1, Math.floor(n)))
}

/**
 * The GROUP BY half. Raw SQL because these are aggregates Payload's query layer
 * does not express. Every value is parameterised — the only interpolated text is
 * the fixed SQL chosen by the `type` switch, never anything the caller typed.
 */
export function buildAggregateSql(
  type: Exclude<ReportType, 'detail'>,
  includeBots: boolean,
  /**
   * Platform scope drops the tenant filter — the whole node in one report.
   * super_admin ONLY, checked by the handler before this is ever called. The
   * tenant id is still bound as $1 and simply unused, so the parameter list
   * never changes shape.
   */
  platformScope = false,
): string {
  const botClause = includeBots ? '' : 'AND (is_bot IS NOT TRUE)'
  const tenantClause = platformScope ? 'tenant_id IS NOT NULL AND $1::int IS NOT NULL' : 'tenant_id = $1'
  const base = `FROM site_visits WHERE ${tenantClause} AND created_at >= $2 ${botClause}`

  const queries: Record<Exclude<ReportType, 'detail'>, string> = {
    pages: `SELECT path AS label, COUNT(*)::int AS views,
              COUNT(DISTINCT visitor_hash)::int AS visitors
            ${base} GROUP BY path ORDER BY views DESC LIMIT $3`,

    referrers: `SELECT COALESCE(referrer_host, '(direct)') AS label, COUNT(*)::int AS views,
                  COUNT(DISTINCT visitor_hash)::int AS visitors
                ${base} GROUP BY 1 ORDER BY views DESC LIMIT $3`,

    agents: `SELECT browser || ' on ' || os AS label, device, COUNT(*)::int AS views,
               COUNT(DISTINCT visitor_hash)::int AS visitors
             ${base} GROUP BY browser, os, device ORDER BY views DESC LIMIT $3`,

    'by-day': `SELECT to_char(created_at, 'YYYY-MM-DD') AS label, COUNT(*)::int AS views,
                 COUNT(DISTINCT visitor_hash)::int AS visitors
               ${base} GROUP BY 1 ORDER BY 1 ASC LIMIT $3`,

    'by-weekday': `SELECT trim(to_char(created_at, 'Day')) AS label,
                     EXTRACT(DOW FROM created_at)::int AS sort,
                     COUNT(*)::int AS views, COUNT(DISTINCT visitor_hash)::int AS visitors
                   ${base} GROUP BY 1, 2 ORDER BY 2 ASC LIMIT $3`,

    'by-hour': `SELECT lpad(EXTRACT(HOUR FROM created_at)::text, 2, '0') || ':00' AS label,
                  EXTRACT(HOUR FROM created_at)::int AS sort,
                  COUNT(*)::int AS views, COUNT(DISTINCT visitor_hash)::int AS visitors
                ${base} GROUP BY 1, 2 ORDER BY 2 ASC LIMIT $3`,

    visitors: `SELECT visitor_hash AS label, COUNT(*)::int AS views,
                 COUNT(DISTINCT path)::int AS pages,
                 MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
               ${base} AND visitor_hash IS NOT NULL
               GROUP BY visitor_hash ORDER BY views DESC LIMIT $3`,
  }

  return queries[type]
}

export const siteLogReportHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const url = new URL(req.url || '', 'http://localhost')
  const type = (url.searchParams.get('type') || 'detail') as ReportType
  if (!REPORT_TYPES.includes(type)) {
    return Response.json({ error: `Unknown report "${type}"` }, { status: 400 })
  }
  const days = clampDays(url.searchParams.get('days'))
  const includeBots = url.searchParams.get('bots') === 'true'
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50))
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)
  // The whole node rather than one portal. Gated to platform admins below —
  // a tenant manager asking for it gets their own portal, not an error, so a
  // stale bookmark never reveals that the wider view exists.
  const wantsPlatform = url.searchParams.get('scope') === 'platform'

  const { tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) return Response.json({ error: 'No portal context' }, { status: 400 })

  const isPlatformAdmin = checkRole(ADMIN_ROLES, user)
  const platformScope = wantsPlatform && Boolean(isPlatformAdmin)

  if (!isPlatformAdmin) {
    const m = await payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [
          { user: { equals: user.id } },
          { tenant: { equals: tenantId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const role = (m.docs?.[0] as { role?: string } | undefined)?.role
    if (!role || !MANAGER_ROLES.has(role)) {
      return Response.json({ error: 'Not permitted for this portal' }, { status: 403 })
    }
  }

  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  try {
    // The detail view is a plain paginated read — no aggregation needed.
    if (type === 'detail') {
      const where = {
        and: [
          ...(platformScope ? [] : [{ tenant: { equals: tenantId } }]),
          { createdAt: { greater_than_equal: since } },
          ...(includeBots ? [] : [{ isBot: { not_equals: true } }]),
        ],
      }
      const res = await payload.find({
        collection: 'site-visits',
        where: where as never,
        limit,
        // Payload pages from 1; the viewer thinks in offsets because the
        // aggregate reports do too.
        page: Math.floor(offset / limit) + 1,
        sort: '-createdAt',
        // Depth 1 so a platform-scoped log can name the portal each hit landed
        // on — a node-wide list of bare paths says nothing about whose site it is.
        depth: platformScope ? 1 : 0,
        overrideAccess: true,
        req,
      })
      return Response.json({
        type,
        days,
        scope: platformScope ? 'platform' : 'tenant',
        totalDocs: res.totalDocs,
        limit,
        offset,
        hasMore: offset + res.docs.length < res.totalDocs,
        rows: (res.docs as unknown as Array<Record<string, unknown>>).map((d) => ({
          at: d.createdAt,
          path: d.path,
          // A stable label per visitor per day, derived from the existing
          // salted hash. Distinguishes one visitor from another without
          // storing — or being able to recover — an address.
          visitor: typeof d.visitorHash === 'string' ? d.visitorHash.slice(0, 8) : null,
          ...(platformScope
            ? {
                portal:
                  d.tenant && typeof d.tenant === 'object'
                    ? (d.tenant as { name?: string; slug?: string }).name ||
                      (d.tenant as { slug?: string }).slug ||
                      null
                    : null,
              }
            : {}),
          referrerHost: d.referrerHost || null,
          browser: d.browser,
          os: d.os,
          device: d.device,
          isBot: d.isBot,
        })),
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = (payload.db as any)?.pool
    if (!pool) throw new Error('No database pool available for reporting.')
    const result = await pool.query(
      buildAggregateSql(type as Exclude<ReportType, 'detail'>, includeBots, platformScope),
      [Number(tenantId), since, limit],
    )
    return Response.json({
      type,
      days,
      scope: platformScope ? 'platform' : 'tenant',
      rows: result.rows ?? [],
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[site-log-report] ${msg}`)
    // A node that has not run the migration yet has no table — say so plainly
    // rather than showing the owner a broken page.
    if (/site_visits/i.test(msg) && /exist/i.test(msg)) {
      return Response.json({ type, days, rows: [], pending: true })
    }
    return Response.json({ error: 'Could not build that report.' }, { status: 500 })
  }
}
