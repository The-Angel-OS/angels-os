'use client'

/**
 * CommandMenu — ⌘K / Ctrl+K command palette.
 *
 * Driven ENTIRELY by NAV_SECTIONS (the same source the sidebar renders), so it
 * can never drift: the sidebar and the palette are two views of one nav config.
 * Adds dynamic groups — your Spaces, and a few curated Actions. Respects the same
 * per-item role visibility (visCtx) as the sidebar.
 *
 * Zero dependencies: hand-rolled overlay + fuzzy filter + keyboard nav.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { NAV_SECTIONS, type NavVisibilityContext } from './nav-config'
import { NAV_ICONS } from './nav-icons'

type CommandGroup = 'Actions' | 'Spaces' | 'Navigate'

interface CommandItem {
  id: string
  label: string
  hint?: string
  group: CommandGroup
  href: string
  icon?: React.ComponentType
  keywords?: string
}

const GROUP_ORDER: CommandGroup[] = ['Actions', 'Spaces', 'Navigate']

export function CommandMenu({
  prefix,
  visCtx,
  spaces,
}: {
  prefix: string
  visCtx: NavVisibilityContext
  spaces?: Array<{ id: string | number; name: string; slug?: string }>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Build the command index (same visibility rules as the sidebar) ──────────
  const commands = useMemo<CommandItem[]>(() => {
    const out: CommandItem[] = []

    if (visCtx.isAdmin) {
      out.push({
        id: 'act-resolve-dupes',
        label: 'Resolve duplicate members',
        hint: 'Team',
        group: 'Actions',
        href: `${prefix}/dashboard/admin/team`,
        keywords: 'duplicate cleanup merge membership',
      })
      out.push({
        id: 'act-invite',
        label: 'Invite people',
        hint: 'Invitations',
        group: 'Actions',
        href: `${prefix}/dashboard/admin/invitations`,
        keywords: 'invite add member',
      })
    }
    out.push({
      id: 'act-spaces',
      label: 'Open Spaces',
      hint: 'Chat',
      group: 'Actions',
      href: `${prefix}/dashboard/spaces`,
      keywords: 'chat channel message leo',
    })

    for (const s of spaces || []) {
      out.push({
        id: `space-${s.id}`,
        label: s.name,
        hint: 'Space',
        group: 'Spaces',
        href: `${prefix}/dashboard/spaces`,
        keywords: s.slug || '',
      })
    }

    for (const section of NAV_SECTIONS) {
      if (!section.visible(visCtx)) continue
      for (const item of section.items) {
        if (!item.visible(visCtx)) continue
        out.push({
          id: `nav-${item.key}`,
          label: item.label,
          hint: section.label,
          group: 'Navigate',
          href: item.href(prefix),
          icon: NAV_ICONS[item.icon],
        })
      }
    }

    return out
  }, [prefix, visCtx, spaces])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) =>
      `${c.label} ${c.hint || ''} ${c.keywords || ''}`.toLowerCase().includes(q),
    )
  }, [commands, query])

  const groups = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({ group, items: filtered.filter((c) => c.group === group) })).filter(
        (g) => g.items.length > 0,
      ),
    [filtered],
  )

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])

  // ── Global ⌘K / Ctrl+K + Escape ─────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    // A visible "Search" button (or anything) can open the palette by dispatching
    // this event — discoverability without lifting open-state out of here.
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('commandmenu:open', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('commandmenu:open', onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      const t = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => setActive(0), [query])

  const select = useCallback(
    (cmd?: CommandItem) => {
      const target = cmd || flat[active]
      if (!target) return
      setOpen(false)
      router.push(target.href)
    },
    [flat, active, router],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="mx-4 w-full max-w-lg overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, flat.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              select()
            }
          }}
          placeholder="Search pages, spaces, actions…"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />

        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          {flat.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches for &ldquo;{query}&rdquo;
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.group} className="mb-1">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.group}
                </p>
                {group.items.map((cmd) => {
                  const idx = flat.indexOf(cmd)
                  const Icon = cmd.icon
                  return (
                    <button
                      key={cmd.id}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => select(cmd)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                        idx === active ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <span className="shrink-0 opacity-70">
                        {Icon ? <Icon /> : <span className="inline-block h-4 w-4" />}
                      </span>
                      <span className="flex-1 truncate">{cmd.label}</span>
                      {cmd.hint && <span className="text-[10px] text-muted-foreground/50">{cmd.hint}</span>}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground/60">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
