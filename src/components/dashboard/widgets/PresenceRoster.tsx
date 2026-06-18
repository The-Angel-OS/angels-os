'use client'

/**
 * PresenceRoster — "who's online" right now. The dashboard-as-MMORPG-hub roster:
 * live status rings + "N online". Read-only consumer (the global pinger owns the
 * write), framework-managed (collapse/hide). Backend: usePresence → presence-ops.
 */
import { Users } from 'lucide-react'
import { usePresence, type OnlineUser } from '@/hooks/usePresence'
import { DashboardWidget } from '@/components/dashboard/widgets'

const ring = (status: string) => {
  if (status === 'online') return 'bg-emerald-500'
  if (status === 'away' || status === 'idle') return 'bg-amber-500'
  return 'bg-muted-foreground/40'
}

const initials = (u: OnlineUser) =>
  (u.name || u.email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?'

export function PresenceRoster() {
  const { online, count } = usePresence({ ping: false })

  return (
    <DashboardWidget
      id="presence-roster"
      title="Crew Online"
      icon={<Users className="h-4 w-4 text-emerald-500" />}
      headerRight={
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          {count} online
        </span>
      }
    >
      {online.length === 0 ? (
        <p className="text-xs text-muted-foreground">No one else is online right now.</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {online.map((u) => (
            <li
              key={String(u.userId)}
              className="flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1"
              title={`${u.name || u.email || 'Crew'} — ${u.status}`}
            >
              <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                {initials(u)}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${ring(u.status)}`}
                />
              </span>
              <span className="max-w-[8rem] truncate text-xs">{u.name || u.email || 'Crew'}</span>
            </li>
          ))}
        </ul>
      )}
    </DashboardWidget>
  )
}
