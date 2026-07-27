'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { ChevronDown, LayoutDashboard, LogOut, UserRound } from 'lucide-react'
import { ThemeToggle } from '@/providers/Theme/ThemeToggle'
import { PortalSwitcher, type PortalInfo } from '@/components/PortalSwitcher'

import { cn } from '@/utilities/cn'
import { useClickOutside } from '@/hooks/useClickOutside'

/** Two-letter initials from a name (preferred) or email. */
function getInitials(name?: string | null, email?: string | null): string {
  const source = (name?.trim() || email?.split('@')[0] || '').trim()
  if (!source) return '?'
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

/**
 * Compact logged-in account menu — an avatar chip that opens a dropdown with
 * Dashboard / Account / Logout. Replaces the loose "Account" + "Logout" text
 * links in the header for a tighter, identity-forward right rail.
 */
export function AccountMenu({
  name,
  email,
  online = false,
  portals = [],
  currentTenantId,
  canEditContent = false,
}: {
  name?: string | null
  email?: string | null
  /** Presence — shows a green status dot on the avatar when true. */
  online?: boolean
  /**
   * Portal switching and the "edit this page" shortcut live IN here rather than
   * as separate header controls. Three controls competing for the right rail is
   * what cut "MORE" off the nav, the chooser is something ordinary members need
   * (not just admins, who get the top bar), and nesting it here is what finally
   * gives it a home on mobile.
   */
  portals?: PortalInfo[]
  currentTenantId?: number | string
  canEditContent?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)

  const initials = getInitials(name, email)
  const displayName = name?.trim() || email?.split('@')[0] || 'Account'

  const itemClass =
    'flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="relative">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </span>
          {online && (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500"
              title="Online"
              aria-label="Online"
            />
          )}
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 max-h-[80vh] w-64 overflow-y-auto rounded-lg border border-border bg-background py-1 shadow-lg"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
            {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
          </div>
          <Link href="/dashboard" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/account"
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <UserRound className="h-4 w-4" />
            Account
          </Link>
          {(portals.length > 1 || canEditContent) && (
            <>
              <div className="my-1 border-t border-border" />
              <PortalSwitcher
                portals={portals}
                currentTenantId={currentTenantId}
                targetPath="/"
                showEditLink={canEditContent}
                inline
              />
            </>
          )}
          <div className="my-1 border-t border-border" />
          <ThemeToggle />
          <div className="my-1 border-t border-border" />
          <Link href="/logout" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            <LogOut className="h-4 w-4" />
            Logout
          </Link>
        </div>
      )}
    </div>
  )
}
