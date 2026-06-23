'use client'

/**
 * <TabbedPanel> — the universal tabbed container. ("53 Prototype" control #2.)
 *
 * Built ON TOP of <Panel>: same shell, same header, plus a canonical tab bar and
 * per-tab body. Replaces the three hand-rolled tab bars in the codebase
 * (MerlinControl, ChannelTabs, MerlinConsole) with one control.
 *
 * Two ethos features come for free:
 *  - Deep-linkable: when `urlParam` is set, the active tab reads from / writes to a
 *    URL query param (?tab=stats), so a tab is a shareable surface — consistent
 *    with the deep-link-EVERYTHING rule.
 *  - Per-tab error isolation: each tab body is wrapped in <PanelErrorBoundary>, so
 *    one crashing tab bubbles to the pony-tail and stays recoverable without
 *    taking down its neighbours or the page.
 *
 * @see project_deep_link_navigation — URL changes preserve the experience.
 */
import React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/utilities/cn'
import { Panel, PanelErrorBoundary, type PanelProps } from './Panel'

export interface PanelTab {
  id: string
  label: React.ReactNode
  icon?: React.ReactNode
  /** Body for this tab — function form is lazy (only the active tab renders). */
  content: React.ReactNode | (() => React.ReactNode)
  disabled?: boolean
}

export interface TabbedPanelProps
  extends Omit<PanelProps, 'children' | 'collapsible' | 'collapsed' | 'defaultCollapsed' | 'onCollapsedChange'> {
  tabs: PanelTab[]
  /** Controlled active tab id. Omit for uncontrolled (local / URL state). */
  activeTab?: string
  defaultTab?: string
  onTabChange?: (tabId: string) => void
  /** When set, the active tab syncs to this URL query param (deep-linkable). */
  urlParam?: string
  /** Extra classes for the tab-bar row. */
  tabBarClassName?: string
}

export function TabbedPanel({
  tabs,
  activeTab,
  defaultTab,
  onTabChange,
  urlParam,
  tabBarClassName,
  spaceId,
  bodyClassName,
  fill,
  ...panelProps
}: TabbedPanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const firstTab = tabs[0]?.id ?? ''
  const urlValue = urlParam ? searchParams?.get(urlParam) ?? undefined : undefined
  const [localTab, setLocalTab] = React.useState(defaultTab ?? urlValue ?? firstTab)

  const isControlled = activeTab !== undefined
  const requested = isControlled ? activeTab : (urlParam ? urlValue ?? localTab : localTab)
  // Always resolve to a tab that actually exists (capabilities can change).
  const current = tabs.some((t) => t.id === requested && !t.disabled) ? requested! : firstTab

  const selectTab = React.useCallback(
    (tabId: string) => {
      if (!isControlled) setLocalTab(tabId)
      if (urlParam) {
        const params = new URLSearchParams(searchParams?.toString() ?? '')
        params.set(urlParam, tabId)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      }
      onTabChange?.(tabId)
    },
    [isControlled, urlParam, searchParams, router, pathname, onTabChange],
  )

  const active = tabs.find((t) => t.id === current)
  const body = active ? (typeof active.content === 'function' ? active.content() : active.content) : null

  return (
    <Panel
      {...panelProps}
      fill={fill}
      spaceId={spaceId}
      // In fill mode the body is a flex column (no scroll) so the tab bar pins and
      // only the tab content scrolls.
      bodyClassName={cn('p-0 sm:p-0', fill && 'flex flex-col overflow-hidden', bodyClassName)}
    >
      <div
        role="tablist"
        className={cn('flex flex-wrap items-center gap-1 border-b border-border bg-muted/20 px-3', fill && 'shrink-0', tabBarClassName)}
      >
        {tabs.map((tab) => {
          const selected = tab.id === current
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={tab.disabled}
              onClick={() => selectTab(tab.id)}
              className={cn(
                'relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                tab.disabled
                  ? 'cursor-not-allowed text-muted-foreground/40'
                  : selected
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.icon}
              {tab.label}
              {selected && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" className={cn('p-3 sm:p-4', fill && 'min-h-0 flex-1 overflow-auto')}>
        <PanelErrorBoundary source={`TabbedPanel/${current}`} spaceId={spaceId}>
          {body}
        </PanelErrorBoundary>
      </div>
    </Panel>
  )
}
