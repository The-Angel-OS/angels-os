'use client'

/**
 * Dashboard widget framework — the generic, mobile-friendly substrate.
 *
 * Wrap any dashboard card in <DashboardWidget id title>. Users can COLLAPSE it
 * (to just its header) or DISMISS it (hidden, but restorable from <DismissedWidgetsTray>).
 * Preferences persist per-user (server-synced via /api/dashboard-ops/prefs) so they
 * follow the user across devices + Nimue. Collapse/restore makes dismissing safe —
 * nothing is ever lost.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, X, LayoutGrid, RotateCcw } from 'lucide-react'

export interface DashboardPrefs {
  collapsed: string[]
  dismissed: string[]
  order: string[]
}
interface WidgetMeta {
  id: string
  title: string
}
interface Ctx {
  isCollapsed: (id: string) => boolean
  isDismissed: (id: string) => boolean
  toggleCollapse: (id: string) => void
  dismiss: (id: string) => void
  restore: (id: string) => void
  register: (meta: WidgetMeta) => void
  dismissedWidgets: WidgetMeta[]
}

const DashCtx = createContext<Ctx | null>(null)

export function useDashboardPrefs(): Ctx {
  const c = useContext(DashCtx)
  if (!c) throw new Error('useDashboardPrefs must be used within <DashboardWidgetProvider>')
  return c
}

type Prefs = { collapsed: string[]; dismissed: string[] }

export function DashboardWidgetProvider({
  initialPrefs,
  children,
}: {
  initialPrefs?: Partial<DashboardPrefs> | null
  children: React.ReactNode
}) {
  const [prefs, setPrefs] = useState<Prefs>({
    collapsed: initialPrefs?.collapsed ?? [],
    dismissed: initialPrefs?.dismissed ?? [],
  })
  const [registry, setRegistry] = useState<Record<string, WidgetMeta>>({})

  // Debounced server persistence (same-origin so the subdomain's cookie rides along).
  const persist = useCallback((p: Prefs) => {
    const t = setTimeout(() => {
      fetch('/api/dashboard-ops/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(p),
      }).catch(() => {})
    }, 500)
    return () => clearTimeout(t)
  }, [])

  const update = useCallback(
    (fn: (p: Prefs) => Prefs) =>
      setPrefs((prev) => {
        const next = fn(prev)
        persist(next)
        return next
      }),
    [persist],
  )

  const toggleCollapse = useCallback(
    (id: string) =>
      update((p) => ({
        ...p,
        collapsed: p.collapsed.includes(id) ? p.collapsed.filter((x) => x !== id) : [...p.collapsed, id],
      })),
    [update],
  )
  const dismiss = useCallback(
    (id: string) => update((p) => ({ ...p, dismissed: p.dismissed.includes(id) ? p.dismissed : [...p.dismissed, id] })),
    [update],
  )
  const restore = useCallback(
    (id: string) => update((p) => ({ ...p, dismissed: p.dismissed.filter((x) => x !== id) })),
    [update],
  )
  const register = useCallback(
    (meta: WidgetMeta) => setRegistry((prev) => (prev[meta.id]?.title === meta.title ? prev : { ...prev, [meta.id]: meta })),
    [],
  )

  const dismissedWidgets = useMemo(
    () => prefs.dismissed.map((id) => registry[id]).filter(Boolean) as WidgetMeta[],
    [prefs.dismissed, registry],
  )

  const value = useMemo<Ctx>(
    () => ({
      isCollapsed: (id) => prefs.collapsed.includes(id),
      isDismissed: (id) => prefs.dismissed.includes(id),
      toggleCollapse,
      dismiss,
      restore,
      register,
      dismissedWidgets,
    }),
    [prefs, toggleCollapse, dismiss, restore, register, dismissedWidgets],
  )

  return <DashCtx.Provider value={value}>{children}</DashCtx.Provider>
}

export function DashboardWidget({
  id,
  title,
  icon,
  canDismiss = true,
  className = '',
  headerRight,
  children,
}: {
  id: string
  title: string
  icon?: React.ReactNode
  canDismiss?: boolean
  className?: string
  headerRight?: React.ReactNode
  children: React.ReactNode
}) {
  const { isCollapsed, isDismissed, toggleCollapse, dismiss, register } = useDashboardPrefs()
  useEffect(() => {
    register({ id, title })
  }, [id, title, register])

  if (isDismissed(id)) return null
  const collapsed = isCollapsed(id)

  return (
    <section className={`overflow-hidden rounded-xl border border-border bg-card ${className}`}>
      <header className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
        <button
          onClick={() => toggleCollapse(id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!collapsed}
        >
          <span className="shrink-0 text-muted-foreground">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="truncate text-sm font-semibold">{title}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {headerRight}
          {canDismiss && (
            <button
              onClick={() => dismiss(id)}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Hide ${title}`}
              title="Hide — restore it from the tray below"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>
      {!collapsed && <div className="border-t border-border p-3 sm:p-4">{children}</div>}
    </section>
  )
}

/** A tray of hidden widgets, each one-tap restorable. Renders nothing when empty. */
export function DismissedWidgetsTray({ className = '' }: { className?: string }) {
  const { dismissedWidgets, restore } = useDashboardPrefs()
  if (!dismissedWidgets.length) return null
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-3 text-xs ${className}`}>
      <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
        <LayoutGrid className="h-3.5 w-3.5" /> Hidden cards:
      </span>
      {dismissedWidgets.map((w) => (
        <button
          key={w.id}
          onClick={() => restore(w.id)}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 transition-colors hover:border-primary/40 hover:text-primary"
        >
          <RotateCcw className="h-3 w-3" /> {w.title}
        </button>
      ))}
    </div>
  )
}
