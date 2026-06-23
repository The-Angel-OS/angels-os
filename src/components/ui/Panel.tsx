'use client'

/**
 * <Panel> — the universal layout shell. ("53 Prototype" control #1.)
 *
 * One canonical container for every card / section / widget surface in The Angel
 * OS: a header (icon, title, actions), an optional collapse affordance, and a body
 * that knows about loading + error states. Replaces the ad-hoc `rounded-xl border
 * bg-card` blocks scattered across MerlinControl, ChatControl panels, blocks, etc.
 *
 * Pony Tail ethos, baked into the primitive:
 *  - An `error` prop renders an inline failure state AND bubbles once to the
 *    pony-tail via logClientError (no per-page wiring).
 *  - <PanelErrorBoundary> catches render-time crashes in children, bubbles them,
 *    and shows a recoverable fallback instead of white-screening the page.
 *
 * Matches house idiom: cn(), semantic color tokens, lucide icons, the
 * DashboardWidget collapse pattern.
 *
 * @see project_community_dashboard — the generic role-aware widget service.
 */
import React from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { cn } from '@/utilities/cn'
import { logClientError } from '@/utilities/logClientError'

export type PanelError = string | Error | null | undefined

function errorText(error: PanelError): string | null {
  if (!error) return null
  return typeof error === 'string' ? error : error.message || 'Something went wrong.'
}

export interface PanelProps {
  /** Stable id — used as the logClientError source suffix and the collapse key. */
  id?: string
  title?: React.ReactNode
  icon?: React.ReactNode
  /** Right-aligned header slot for actions (buttons, badges, counts). */
  headerRight?: React.ReactNode
  /** Render the chevron + make the header toggle the body. */
  collapsible?: boolean
  /** Controlled collapse. Omit for uncontrolled (local state). */
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  /** Body shows a spinner overlay while true. */
  loading?: boolean
  /** Inline error state. Bubbles once to the pony-tail. */
  error?: PanelError
  /** Optional retry handler — shows a "Try again" button in the error state. */
  onRetry?: () => void
  /** Space the panel lives in — lets the pony-tail resolve the tenant for AI Bus routing. */
  spaceId?: string | number | null
  /** Drop the outer border/bg (when nesting inside another Panel). */
  bare?: boolean
  className?: string
  bodyClassName?: string
  children?: React.ReactNode
}

export function Panel({
  id,
  title,
  icon,
  headerRight,
  collapsible = false,
  collapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  loading = false,
  error,
  onRetry,
  spaceId,
  bare = false,
  className,
  bodyClassName,
  children,
}: PanelProps) {
  const [localCollapsed, setLocalCollapsed] = React.useState(defaultCollapsed)
  const isControlled = collapsed !== undefined
  const isCollapsed = collapsible && (isControlled ? collapsed : localCollapsed)

  const toggle = React.useCallback(() => {
    const next = !(isControlled ? collapsed : localCollapsed)
    if (!isControlled) setLocalCollapsed(next)
    onCollapsedChange?.(next)
  }, [isControlled, collapsed, localCollapsed, onCollapsedChange])

  const msg = errorText(error)

  // Bubble the error to the pony-tail exactly once per distinct message.
  const lastBubbled = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (msg && lastBubbled.current !== msg) {
      lastBubbled.current = msg
      logClientError({
        source: `Panel/${id || (typeof title === 'string' ? title : 'unnamed')}`,
        message: msg,
        details: typeof error === 'object' && error?.stack ? error.stack : undefined,
        spaceId: spaceId ?? undefined,
      })
    }
    if (!msg) lastBubbled.current = null
  }, [msg, id, title, error, spaceId])

  const hasHeader = title != null || icon != null || headerRight != null || collapsible

  return (
    <section
      data-slot="panel"
      className={cn(
        'overflow-hidden',
        !bare && 'rounded-xl border border-border bg-card',
        className,
      )}
    >
      {hasHeader && (
        <header
          data-slot="panel-header"
          className="flex items-center gap-2 px-3 py-2.5 sm:px-4"
        >
          {collapsible ? (
            <button
              type="button"
              onClick={toggle}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              aria-expanded={!isCollapsed}
            >
              <span className="shrink-0 text-muted-foreground">
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
              {icon && <span className="shrink-0">{icon}</span>}
              {title != null && <span className="truncate text-sm font-semibold">{title}</span>}
            </button>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {icon && <span className="shrink-0">{icon}</span>}
              {title != null && <span className="truncate text-sm font-semibold">{title}</span>}
            </div>
          )}
          {headerRight && <div className="flex shrink-0 items-center gap-1">{headerRight}</div>}
        </header>
      )}

      {!isCollapsed && (
        <div
          data-slot="panel-body"
          className={cn(
            'relative',
            hasHeader && !bare && 'border-t border-border',
            !bare && 'p-3 sm:p-4',
            bodyClassName,
          )}
        >
          {msg ? (
            <PanelErrorState message={msg} onRetry={onRetry} />
          ) : (
            children
          )}
          {loading && !msg && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/60 backdrop-blur-[1px]">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** The inline error surface — what the body shows when `error` is set. */
export function PanelErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <div className="flex items-center gap-2 font-medium text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        This was reported automatically. {onRetry ? 'You can try again.' : ''}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
        >
          <RotateCcw className="h-3 w-3" /> Try again
        </button>
      )}
    </div>
  )
}

/**
 * <PanelErrorBoundary> — catches render-time crashes in a Panel's children,
 * bubbles them to the pony-tail, and shows a recoverable fallback. Wrap any
 * subtree whose failure should not take down the surrounding page (e.g. each tab
 * body in <TabbedPanel>).
 */
interface BoundaryProps {
  source: string
  spaceId?: string | number | null
  children: React.ReactNode
}
interface BoundaryState {
  error: Error | null
}

export class PanelErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logClientError({
      source: `PanelErrorBoundary/${this.props.source}`,
      message: error.message || 'Render error',
      details: `${error.stack || ''}\n${info.componentStack || ''}`.trim(),
      spaceId: this.props.spaceId ?? undefined,
    })
  }

  render() {
    if (this.state.error) {
      return (
        <PanelErrorState
          message={this.state.error.message || 'This panel hit an error.'}
          onRetry={() => this.setState({ error: null })}
        />
      )
    }
    return this.props.children
  }
}
