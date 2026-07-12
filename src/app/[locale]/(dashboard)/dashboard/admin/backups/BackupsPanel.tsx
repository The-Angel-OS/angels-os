'use client'

import { useState, useTransition } from 'react'
import { runBackupNow, restoreBackup, listBackups, type BackupInfo } from './actions'

function fmtBytes(n: number): string {
  if (!n) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function BackupsPanel({
  initialBackups,
  configured,
  initialError,
}: {
  initialBackups: BackupInfo[]
  configured: boolean
  initialError?: string
}) {
  const [backups, setBackups] = useState<BackupInfo[]>(initialBackups)
  const [msg, setMsg] = useState<string | null>(initialError ?? null)
  const [pending, start] = useTransition()

  const refresh = () =>
    start(async () => {
      const r = await listBackups()
      if (r.ok && r.backups) setBackups(r.backups)
      else setMsg(r.error || 'Failed to refresh.')
    })

  const backup = () =>
    start(async () => {
      setMsg('Backing up…')
      const r = await runBackupNow()
      setMsg(r.ok ? '✅ Backup complete.' : `⛔ ${r.error}`)
      if (r.ok) await refresh()
    })

  const restore = (name: string) =>
    start(async () => {
      if (!window.confirm(`Restore "${name}"?\n\nThis OVERWRITES the live database with this backup. This cannot be undone. Are you absolutely sure?`)) return
      setMsg(`Restoring ${name}…`)
      const r = await restoreBackup(name)
      setMsg(r.ok ? `✅ Restored ${name}.` : `⛔ ${r.error}`)
    })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Backups</h1>
          <p className="text-sm text-muted-foreground">
            Postgres backups run by Merlin on the IONOS node{configured ? '' : ' — ⚠ ANGELS_DATABASE_URI not set on Merlin'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            disabled={pending}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={backup}
            disabled={pending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? 'Working…' : 'Back up now'}
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">{msg}</div>
      )}

      {backups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-12 text-center text-sm text-muted-foreground">
          No backups yet. Click “Back up now,” or wait for the daily scheduled run on Merlin.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Backup</th>
                <th className="px-4 py-2 font-medium">Size</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {backups.map((b, i) => (
                <tr key={b.name} className={i % 2 ? 'bg-muted/10' : ''}>
                  <td className="px-4 py-2 font-mono text-xs">{b.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{fmtBytes(b.bytes)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{new Date(b.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => restore(b.name)}
                      disabled={pending}
                      className="rounded border border-destructive/40 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground/70">
        Restore overwrites the live database and cannot be undone. Backups older than the retention window are pruned automatically on Merlin.
      </p>
    </div>
  )
}
