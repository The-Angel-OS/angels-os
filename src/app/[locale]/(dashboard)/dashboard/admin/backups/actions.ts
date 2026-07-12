'use server'

/**
 * admin/backups server actions — the Core control surface for Merlin's Postgres
 * backup engine. Merlin runs on the IONOS box beside Postgres and owns the actual
 * pg_dump/pg_restore (see merlin/src/lib/db-backup.ts). These actions proxy to
 * Merlin's secured /api/backup over its tunnel — the ops key never leaves the server.
 *
 * Config (Core env):
 *   MERLIN_OPS_URL   — Merlin base URL (default https://merlin.payloadnuke.com)
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

function merlin(path: string): string {
  const base = (process.env.MERLIN_OPS_URL || 'https://merlin.payloadnuke.com').replace(/\/+$/, '')
  return `${base}${path}`
}

async function callMerlin(method: 'GET' | 'POST', body?: unknown): Promise<BackupOpsResult> {
  const key = process.env.BACKUP_OPS_KEY
  if (!key) return { ok: false, error: 'BACKUP_OPS_KEY is not configured on the server.' }
  try {
    const res = await fetch(merlin('/api/backup'), {
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
