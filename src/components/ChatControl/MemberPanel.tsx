'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Users, X, UserPlus, Shield, Crown, Eye, MoreVertical } from 'lucide-react'
import { Backdrop } from '@/components/Backdrop'
import { usePresence } from '@/hooks/usePresence'

/**
 * MemberPanel — Slide-out member list for Space chat views.
 *
 * Shows all active members of the current space with their roles.
 * Admins/moderators can invite new members via inline form.
 * Supports role display, online status hints, and invite flow.
 */

interface SpaceMember {
  id: number
  userId: number
  userName: string
  userEmail: string
  role: 'space_admin' | 'moderator' | 'member' | 'guest'
  status: 'active' | 'pending' | 'suspended' | 'left' | 'banned'
  joinedAt?: string
}

interface MemberPanelProps {
  spaceId: number
  isOpen: boolean
  onClose: () => void
  currentUserRole?: 'space_admin' | 'moderator' | 'member' | 'guest'
}

const ROLE_CONFIG = {
  space_admin: { label: 'Admin', icon: Crown, color: 'text-amber-500' },
  moderator: { label: 'Mod', icon: Shield, color: 'text-blue-500' },
  member: { label: 'Member', icon: Users, color: 'text-muted-foreground' },
  guest: { label: 'Guest', icon: Eye, color: 'text-muted-foreground/60' },
} as const

export function MemberPanel({ spaceId, isOpen, onClose, currentUserRole }: MemberPanelProps) {
  // Presence (read-only — the global pinger owns writes): who's online right now.
  const { online } = usePresence({ enabled: isOpen, ping: false })
  const onlineIds = new Set(online.map((o) => String(o.userId)))
  const [members, setMembers] = useState<SpaceMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'moderator' | 'guest'>('member')
  const [inviteMessage, setInviteMessage] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  // Add-existing-member browser (search portal/workspace members not in the space)
  const [addQuery, setAddQuery] = useState('')
  const [candidates, setCandidates] = useState<Array<{ userId: string; name: string; email: string }>>([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  const canInvite = currentUserRole === 'space_admin' || currentUserRole === 'moderator'

  const fetchMembers = useCallback(async () => {
    if (!spaceId) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/space-memberships?where[space][equals]=${spaceId}&where[status][equals]=active&depth=1&limit=100`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        const mapped: SpaceMember[] = (data.docs || []).map((doc: Record<string, unknown>) => {
          const user = typeof doc.user === 'object' && doc.user !== null ? doc.user as Record<string, unknown> : null
          return {
            id: doc.id,
            userId: user?.id || doc.user,
            userName: user?.name || user?.email || 'Unknown',
            userEmail: user?.email || '',
            role: doc.role || 'member',
            status: doc.status || 'active',
            joinedAt: doc.joinedAt as string | undefined,
          }
        })
        // Sort: admins first, then mods, then members, then guests
        const roleOrder = { space_admin: 0, moderator: 1, member: 2, guest: 3 }
        mapped.sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9))
        setMembers(mapped)
      }
    } catch {
      // Silently fail — members panel is supplementary
    } finally {
      setIsLoading(false)
    }
  }, [spaceId])

  useEffect(() => {
    if (isOpen) fetchMembers()
  }, [isOpen, fetchMembers])

  // Debounced search of portal members not already in the space.
  useEffect(() => {
    if (!canInvite || !isOpen) return
    let cancelled = false
    const handle = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `/api/space-ops/members/candidates?spaceId=${spaceId}&q=${encodeURIComponent(addQuery.trim())}`,
          { credentials: 'include' },
        )
        if (res.ok && !cancelled) {
          const data = await res.json()
          setCandidates(Array.isArray(data.candidates) ? data.candidates : [])
        }
      } catch {
        /* non-critical */
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(handle) }
  }, [addQuery, spaceId, canInvite, isOpen])

  const addMember = useCallback(async (userId: string) => {
    setAddingId(userId)
    setFeedback(null)
    try {
      const res = await fetch('/api/space-ops/members/add', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, userId, role: 'member' }),
      })
      if (res.ok) {
        setCandidates((prev) => prev.filter((c) => c.userId !== userId))
        await fetchMembers()
      } else {
        const err = await res.json().catch(() => ({}))
        setFeedback({ type: 'error', text: err.error || 'Failed to add member.' })
      }
    } catch {
      setFeedback({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setAddingId(null)
    }
  }, [spaceId, fetchMembers])

  const handleInvite = async () => {
    if (!inviteEmail.trim() || isInviting) return
    setIsInviting(true)
    setFeedback(null)

    try {
      const res = await fetch('/api/space-ops/invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          spaceId,
          role: inviteRole,
          message: inviteMessage.trim() || undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setFeedback({
          type: 'success',
          text: `Invitation sent! Link: ${data.invitation?.inviteUrl || 'Generated'}`,
        })
        setInviteEmail('')
        setInviteMessage('')
        setShowInviteForm(false)
      } else {
        const err = await res.json().catch(() => ({}))
        setFeedback({ type: 'error', text: err.error || 'Failed to send invitation.' })
      }
    } catch {
      setFeedback({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setIsInviting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <Backdrop isOpen onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-72 flex-col border-l border-border bg-background shadow-xl transition-transform duration-200 ease-out">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              Members {!isLoading && `(${members.length})`}
            </h3>
            {(() => {
              const n = members.filter((m) => onlineIds.has(String(m.userId))).length
              return n > 0 ? (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400" title={`${n} online now`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {n} online
                </span>
              ) : null
            })()}
          </div>
          <div className="flex items-center gap-1">
            {canInvite && (
              <button
                onClick={() => setShowInviteForm(!showInviteForm)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Invite member"
              >
                <UserPlus size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close member panel"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Invite form */}
        {showInviteForm && canInvite && (
          <div className="border-b border-border p-3 space-y-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              autoFocus
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'member' | 'moderator' | 'guest')}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              <option value="member">Member</option>
              <option value="moderator">Moderator</option>
              <option value="guest">Guest</option>
            </select>
            <input
              type="text"
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              placeholder="Optional message..."
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || isInviting}
                className="flex-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
              >
                {isInviting ? 'Sending...' : 'Send Invite'}
              </button>
              <button
                onClick={() => { setShowInviteForm(false); setInviteEmail(''); setInviteMessage('') }}
                className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Feedback message */}
        {feedback && (
          <div
            className={`mx-3 mt-2 rounded-md p-2 text-xs ${
              feedback.type === 'success'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}
          >
            {feedback.text}
            <button
              onClick={() => setFeedback(null)}
              className="ml-2 text-xs opacity-60 hover:opacity-100"
            >
              dismiss
            </button>
          </div>
        )}

        {/* Add existing portal members (search workspace members) */}
        {canInvite && (
          <div className="border-b border-border p-3">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Add members</label>
            <input
              type="text"
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              placeholder="Search workspace members…"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            {(searching || candidates.length > 0) && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border">
                {searching && candidates.length === 0 ? (
                  <div className="px-2.5 py-2 text-xs text-muted-foreground">Searching…</div>
                ) : candidates.length === 0 ? (
                  <div className="px-2.5 py-2 text-xs text-muted-foreground">No matching members</div>
                ) : (
                  candidates.map((c) => (
                    <button
                      key={c.userId}
                      onClick={() => addMember(c.userId)}
                      disabled={addingId === c.userId}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-muted/60 disabled:opacity-50"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                        {(c.name || '?').charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{c.name}</span>
                        {c.email && <span className="block truncate text-xs text-muted-foreground">{c.email}</span>}
                      </span>
                      <UserPlus size={13} className="shrink-0 text-muted-foreground" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Member list */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-2 w-16 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No members found
            </div>
          ) : (
            <div className="space-y-0.5">
              {members.map((member) => {
                const config = ROLE_CONFIG[member.role] || ROLE_CONFIG.member
                const RoleIcon = config.icon
                return (
                  <div
                    key={member.id}
                    className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                  >
                    {/* Avatar + presence dot */}
                    <div className="relative shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">
                        {member.userName.charAt(0).toUpperCase()}
                      </div>
                      {onlineIds.has(String(member.userId)) && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500"
                          title="Online"
                          aria-label="Online"
                        />
                      )}
                    </div>

                    {/* Name + role */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{member.userName}</span>
                        <RoleIcon size={12} className={`shrink-0 ${config.color}`} />
                      </div>
                      <span className="block truncate text-xs text-muted-foreground">
                        {config.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/**
 * MemberPanelTrigger — Small button to open the member panel.
 * Drop this into any chat header bar.
 */
export function MemberPanelTrigger({ onClick, memberCount }: { onClick: () => void; memberCount?: number }) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:bg-muted hover:text-foreground transition-colors"
      title="View members"
    >
      <Users size={14} />
      {memberCount !== undefined && <span>{memberCount}</span>}
    </button>
  )
}
