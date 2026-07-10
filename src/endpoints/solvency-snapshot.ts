/**
 * Solvency Snapshot — GET /api/solvency-ops/snapshot
 *
 * The one machine-readable line the whole organism reports up: is the platform
 * money-positive right now? super_admin only (revenue + cost totals are
 * platform-sensitive). Feeds the /dashboard/solvency tile, external monitoring
 * (curl + CRON_SECRET future), and the future self-heal loop that nudges portals
 * toward earning when this goes red.
 *
 * ?days=N sets the rolling window (default 30). Returns the full SolvencySnapshot.
 *
 * @see src/utilities/solvency.ts  @see src/utilities/leo-data-tools.ts (check_solvency)
 */
import type { PayloadHandler } from 'payload'
import { getSolvencySnapshot } from '@/utilities/solvency'
import { checkRole } from '@/access/utilities'

export const solvencySnapshotHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'sign-in required' }, { status: 401 })
  if (!checkRole(['super_admin'], user as any)) {
    return Response.json({ error: 'super_admin required' }, { status: 403 })
  }

  const url = new URL(req.url || 'http://localhost')
  const daysParam = url.searchParams.get('days')
  const days = daysParam ? Number(daysParam) : 30

  try {
    const snapshot = await getSolvencySnapshot(payload, {
      windowDays: Number.isFinite(days) ? days : 30,
    })
    return Response.json({ ok: true, snapshot })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
