/**
 * DB Repair: id sequences — GET /api/provision-ops/db-repair-sequences
 *
 * Prod restores/teleports/dev-push copy ROWS but leave each table's `id` serial
 * sequence pointing at its old (lower) value. The next INSERT then reuses an id
 * that already exists → Payload rejects it with "The following field is invalid:
 * id" / "Value must be unique". This is exactly what was breaking checkout: the
 * Stripe intent succeeded, then `transactions` insert collided on `id`.
 *
 * Resyncs every id sequence to MAX(id) (is_called=false when the table is empty
 * so the next id is 1). Idempotent — safe to run repeatedly. Optional
 * ?table=transactions to scope to one table. Auth: super_admin OR ?key=<CRON_SECRET>.
 */
import type { PayloadHandler } from 'payload'

export const dbRepairSequencesHandler: PayloadHandler = async (req) => {
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

  const onlyTable = url.searchParams.get('table')

  // Every serial sequence owned by an `id` column. pg_get_serial_sequence would
  // need names one-by-one; this catalog join finds them all in one pass.
  const seqRes = await pool.query(
    `SELECT t.relname AS table_name, quote_ident(n.nspname) || '.' || quote_ident(s.relname) AS seq
       FROM pg_class s
       JOIN pg_depend d ON d.objid = s.oid AND d.deptype = 'a'
       JOIN pg_class t ON d.refobjid = t.oid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
       JOIN pg_namespace n ON n.oid = s.relnamespace
      WHERE s.relkind = 'S' AND a.attname = 'id'
        ${onlyTable ? 'AND t.relname = $1' : ''}`,
    onlyTable ? [onlyTable] : [],
  )

  const repaired: Array<{ table: string; nextId: number }> = []
  const errors: Array<{ table: string; error: string }> = []
  for (const row of seqRes.rows as Array<{ table_name: string; seq: string }>) {
    try {
      // is_called = MAX IS NOT NULL: on an empty table setval(...,1,false) → next id 1;
      // otherwise setval(...,MAX,true) → next id MAX+1.
      const r = await pool.query(
        `SELECT setval($1,
                 COALESCE((SELECT MAX(id) FROM "${row.table_name}"), 1),
                 (SELECT MAX(id) FROM "${row.table_name}") IS NOT NULL) AS v`,
        [row.seq],
      )
      const cur = Number(r.rows?.[0]?.v ?? 0)
      repaired.push({ table: row.table_name, nextId: cur + 1 })
    } catch (e) {
      errors.push({ table: row.table_name, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return Response.json({ ok: errors.length === 0, repaired, errors })
}
