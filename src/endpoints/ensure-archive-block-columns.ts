/**
 * DB setup: Archive block columns — GET/POST /api/provision-ops/ensure-archive-block-columns
 *
 * Adds optional UI/filter fields (`enable_search`, `enable_category_tabs`,
 * `enable_pagination`) to all Archive block tables across `pages`, `posts`,
 * and `products` (live + versioned `_*_v` twins).
 *
 * ⚠️ 2-DEPLOY RULE: Deploy and execute this endpoint on prod BEFORE adding these
 * fields to `src/blocks/ArchiveBlock/config.ts`.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET> OR Authorization: Bearer <CRON_SECRET>.
 * Idempotent.
 */
import type { PayloadHandler } from 'payload'

const EXPECTED_ARCHIVE_TABLES = [
  'pages_blocks_archive',
  '_pages_v_blocks_archive',
  'posts_blocks_archive',
  '_posts_v_blocks_archive',
  'products_blocks_archive',
  '_products_v_blocks_archive',
] as const

const ARCHIVE_COLUMNS = [
  { name: 'enable_search', ddl: 'boolean DEFAULT false' },
  { name: 'enable_category_tabs', ddl: 'boolean DEFAULT false' },
  { name: 'enable_pagination', ddl: 'boolean DEFAULT false' },
] as const

const SAFE_TABLE_RE = /^_?[a-z0-9_]+_blocks_archive$/

export const ensureArchiveBlockColumnsHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')
  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(
    user && ((user as { roles?: string[] }).roles || []).includes('super_admin'),
  )
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = (payload.db as any)?.pool
  if (!pool?.query) {
    return Response.json({ error: 'no pg pool on payload.db' }, { status: 500 })
  }

  // Discover all existing *_blocks_archive tables in public schema and merge with expected list
  const discoveredRes = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name LIKE '%\\_blocks\\_archive' ESCAPE '\\'
     ORDER BY table_name`,
  )
  const existingSet = new Set<string>(
    (discoveredRes.rows || [])
      .map((r: { table_name: string }) => String(r.table_name || ''))
      .filter((name: string) => SAFE_TABLE_RE.test(name)),
  )

  const targetTables = Array.from(new Set([...EXPECTED_ARCHIVE_TABLES, ...existingSet]))
  const tablesChecked: string[] = []
  const missingTables: string[] = []
  let ran = 0
  const errors: Array<{ table: string; column?: string; error: string }> = []

  for (const table of targetTables) {
    if (!existingSet.has(table)) {
      missingTables.push(table)
      continue
    }
    tablesChecked.push(table)
    for (const col of ARCHIVE_COLUMNS) {
      try {
        await pool.query(
          `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.ddl};`,
        )
        ran++
      } catch (e) {
        errors.push({
          table,
          column: col.name,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  const columnsVerified: Record<string, string[]> = {}
  let allColumnsVerified = missingTables.length === 0 && tablesChecked.length > 0
  if (tablesChecked.length > 0) {
    try {
      const colNames = ARCHIVE_COLUMNS.map((c) => c.name)
      const colRes = await pool.query(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = ANY($1)
           AND column_name = ANY($2)
         ORDER BY table_name, column_name`,
        [tablesChecked, colNames],
      )
      for (const row of (colRes.rows || []) as Array<{ table_name: string; column_name: string }>) {
        if (!columnsVerified[row.table_name]) columnsVerified[row.table_name] = []
        columnsVerified[row.table_name].push(row.column_name)
      }
      for (const tbl of tablesChecked) {
        if ((columnsVerified[tbl]?.length ?? 0) !== colNames.length) {
          allColumnsVerified = false
        }
      }
    } catch (e) {
      allColumnsVerified = false
      errors.push({
        table: 'information_schema.columns',
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return Response.json({
    ok: errors.length === 0 && allColumnsVerified,
    tablesChecked,
    missingTables,
    columnsVerified,
    allColumnsVerified,
    ran,
    errors,
  })
}
