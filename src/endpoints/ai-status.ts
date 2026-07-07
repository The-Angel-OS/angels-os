/**
 * AI status probe — GET /api/provision-ops/ai-status
 *
 * The callable half of the switchboard: probes every provider's live reachability
 * + Vercel Blob storage and returns the OpsStatus JSON. This is the "probe utility
 * you can call" — for the dashboard switchboard (admin session), for curl, and for
 * LEO to fold into its operations evaluation loop.
 *
 * Auth: admin/super_admin session (dashboard) OR ?key=CRON_SECRET (curl/LEO/cron).
 * Read-only; the output carries statuses + latencies, never secrets.
 */
import type { PayloadHandler } from 'payload'
import { getProviderStatus } from '@/utilities/providerStatus'

export const aiStatusHandler: PayloadHandler = async (req) => {
  const { user } = req
  const url = new URL(req.url || 'http://localhost', 'http://localhost')
  const key = url.searchParams.get('key')
  const roles = (user as { roles?: string[] } | undefined)?.roles || []
  const isAdmin = roles.includes('admin') || roles.includes('super_admin') || roles.includes('platform_admin')
  const keyValid = Boolean(key && process.env.CRON_SECRET && key === process.env.CRON_SECRET)
  if (!isAdmin && !keyValid) {
    return Response.json({ error: 'admin session or ?key=CRON_SECRET required' }, { status: 403 })
  }

  try {
    const status = await getProviderStatus()
    return Response.json(status)
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'probe failed' }, { status: 500 })
  }
}
