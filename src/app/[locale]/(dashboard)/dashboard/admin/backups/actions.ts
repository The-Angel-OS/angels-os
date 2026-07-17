'use server'

/**
 * admin/backups server actions — the Core control surface for Merlin's Postgres
 * backup engine. Merlin runs on the IONOS box beside Postgres and owns the actual
 * pg_dump/pg_restore (see merlin/src/lib/db-backup.ts). These actions proxy to
 * Merlin's secured /api/backup over its tunnel — the ops key never leaves the server.
 *
 * Config (Core env):
 *   MERLIN_OPS_URL   — OPTIONAL explicit Merlin base URL override. By default the URL
 *                      is resolved dynamically from the platform node's live tunnelUrl
 *                      (the registry) — no hardcoded/named tunnel.
 *   BACKUP_OPS_KEY   — shared secret matching Merlin's BACKUP_OPS_KEY
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

export interface BackupInfo {
  name: string
  bytes: number
  createdAt: string
}
export interface BackupOpsResult {
  ok: boolean
  backups?: BackupInfo[]
  configured?: boolean
  error?: string
}

async function requireSuperAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) return { ok: false, error: 'Not signed in.' }
  if (!checkRole(ADMIN_ROLES, user)) return { ok: false, error: 'Backups are restricted to platform admins.' }
  return { ok: true }
}

/**
 * Resolve Merlin's base URL — the platform node's LIVE tunnelUrl from the registry
 * (config-free; a fresh *.trycloudflare.com each boot), or an explicit MERLIN_OPS_URL
 * override. Null when neither is available — never a hardcoded host.
 */
async function merlinBase(): Promise<string | null> {
  try {
    const payload = await getPayload({ config })
    const { resolveEndeavorNodeUrl } = await import('@/utilities/nodeBus')
    const plat = await payload.find({
      collection: 'tenants',
      where: { type: { equals: 'platform' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const slug = (plat.docs?.[0] as { slug?: string } | undefined)?.slug
    if (slug) {
      const dynamic = await resolveEndeavorNodeUrl(payload, slug)
      if (dynamic) return dynamic
    }
  } catch {
    /* fall through to the env override */
  }
  const env = process.env.MERLIN_OPS_URL
  return env ? env.replace(/\/+$/, '') : null
}

async function callMerlin(method: 'GET' | 'POST', body?: unknown): Promise<BackupOpsResult> {
  const key = process.env.BACKUP_OPS_KEY
  if (!key) return { ok: false, error: 'BACKUP_OPS_KEY is not configured on the server.' }
  const base = await merlinBase()
  if (!base) return { ok: false, configured: false, error: 'No Merlin node reachable — no registered platform node with a live tunnel, and no MERLIN_OPS_URL override.' }
  try {
    const res = await fetch(`${base}/api/backup`, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      // Merlin is on the tunnel; don't cache ops calls.
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => ({}))) as BackupOpsResult & { backup?: unknown }
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error || `Merlin ${res.status}` }
    return { ...data, ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `Could not reach Merlin: ${e.message}` : 'Could not reach Merlin.' }
  }
}

export async function listBackups(): Promise<BackupOpsResult> {
  const gate = await requireSuperAdmin()
  if (!gate.ok) return { ok: false, error: gate.error }
  return callMerlin('GET')
}

export async function runBackupNow(): Promise<BackupOpsResult> {
  const gate = await requireSuperAdmin()
  if (!gate.ok) return { ok: false, error: gate.error }
  return callMerlin('POST', { action: 'run' })
}

export async function restoreBackup(name: string): Promise<BackupOpsResult> {
  const gate = await requireSuperAdmin()
  if (!gate.ok) return { ok: false, error: gate.error }
  // Destructive — Merlin also requires the confirm token.
  return callMerlin('POST', { action: 'restore', name, confirm: 'RESTORE' })
}
