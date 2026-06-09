'use client'

import React, { useState, useMemo, useTransition, useCallback } from 'react'
import Link from 'next/link'
import {
  updateMember,
  suspendMember,
  revokeMember,
  reactivateMember,
  fetchMemberSpaces,
  addMemberToAllSpaces,
  removeMemberFromSpace,
  resendTenantInvitation,
  cleanupDuplicateMembers,
} from './actions'
import {
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_LABELS,
} from '@/constants/permissions'
import type { TenantPermission, TenantRole } from '@/constants/permissions'

// ─── Types ──────────────────────────────────────────────────────

interface MemberData {
  id: string
  userId: string
  userName: string
  userEmail: string
  role: string
  permissions: string[]
  status: string
  joinedAt: string | null
  invitationEmail: string | null
  createdAt: string | null
}

interface TeamManagerProps {
  members: MemberData[]
  totalMembers: number
  tenantName: string
}

// ─── Constants ──────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300' },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' },
  suspended: { label: 'Suspended', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  revoked: { label: 'Revoked', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

type FilterTab = 'all' | 'active' | 'pending' | 'suspended'

// ─── Component ──────────────────────────────────────────────────

export function TeamManager({ members: initialMembers, totalMembers, tenantName }: TeamManagerProps) {
  const [members, setMembers] = useState(initialMembers)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const [resendingId, setResendingId] = useState<string | null>(null)
  const handleResend = async (id: string) => {
    setResendingId(id)
    const res = await resendTenantInvitation(id)
    setResendingId(null)
    if (res.success) {
      showToast(res.emailSent ? 'Invitation re-sent' : 'Invitation refreshed (email not configured)', 'success')
    } else {
      showToast(res.error || 'Resend failed', 'error')
    }
  }

  // Detect duplicate memberships (same email appears more than once) — the
  // "active member + orphaned pending invite" bug. Drives the cleanup banner.
  const duplicateEmails = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of members) {
      const email = (m.userEmail || m.invitationEmail || '').trim().toLowerCase()
      if (email) counts.set(email, (counts.get(email) || 0) + 1)
    }
    return [...counts.entries()].filter(([, n]) => n > 1).map(([e]) => e)
  }, [members])

  const [isCleaning, setIsCleaning] = useState(false)
  const handleCleanup = async () => {
    setIsCleaning(true)
    const res = await cleanupDuplicateMembers()
    setIsCleaning(false)
    if (res.success) {
      const note = res.promotions ? ` (${res.promotions} role${res.promotions > 1 ? 's' : ''} reconciled to the higher invite)` : ''
      showToast(`Merged ${res.merged || 0} duplicate${(res.merged || 0) === 1 ? '' : 's'}, removed ${res.deleted || 0} stale row${(res.deleted || 0) === 1 ? '' : 's'}${note}`, 'success')
      setTimeout(() => window.location.reload(), 800)
    } else {
      showToast(res.error || 'Cleanup failed', 'error')
    }
  }

  const filtered = useMemo(
    () =>
      members.filter((m) => {
        if (filter === 'all') return true
        if (filter === 'suspended') return m.status === 'suspended' || m.status === 'revoked'
        return m.status === filter
      }),
    [members, filter],
  )

  const counts = useMemo(() => {
    let active = 0
    let pending = 0
    let suspended = 0
    for (const m of members) {
      if (m.status === 'active') active++
      else if (m.status === 'pending') pending++
      else if (m.status === 'suspended' || m.status === 'revoked') suspended++
    }
    return { all: members.length, active, pending, suspended }
  }, [members])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage members and permissions for {tenantName}
        </p>
      </div>

      {/* Inviting lives on the Invitations page (the invite funnel); Team is the
          roster. Link there instead of duplicating a send form. */}
      <Link
        href="/dashboard/admin/invitations"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted"
      >
        + Invite people
        <span aria-hidden className="text-muted-foreground">→</span>
      </Link>

      {/* Duplicate-membership warning — one person should have one membership */}
      {duplicateEmails.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-300">
              {duplicateEmails.length} duplicate membership{duplicateEmails.length > 1 ? 's' : ''} detected
            </p>
            <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-400/70">
              The same email has more than one row (e.g. an active member plus an orphaned pending invite).
              Resolving merges them into one membership with the higher role.
            </p>
          </div>
          <button
            onClick={handleCleanup}
            disabled={isCleaning}
            className="shrink-0 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {isCleaning ? 'Resolving…' : 'Resolve duplicates'}
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['all', 'active', 'pending', 'suspended'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}{' '}
            <span className="text-xs text-muted-foreground">({counts[tab]})</span>
          </button>
        ))}
      </div>

      {/* Member Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Member
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Role
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                Status
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                Joined
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No members found
                </td>
              </tr>
            )}
            {filtered.map((member) => (
              <React.Fragment key={member.id}>
                <tr className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{member.userName}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.userEmail || member.invitationEmail || '—'}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{ROLE_LABELS[member.role as TenantRole] || member.role}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <StatusBadge status={member.status} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {member.joinedAt
                        ? new Date(member.joinedAt).toLocaleDateString()
                        : member.createdAt
                          ? new Date(member.createdAt).toLocaleDateString()
                          : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {member.status === 'pending' && (
                      <button
                        onClick={() => handleResend(member.id)}
                        disabled={resendingId === member.id}
                        className="mr-3 text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50 dark:text-emerald-400"
                        title="Re-send the invitation email"
                      >
                        {resendingId === member.id ? 'Sending…' : 'Resend'}
                      </button>
                    )}
                    <button
                      onClick={() => setEditingId(editingId === member.id ? null : member.id)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {editingId === member.id ? 'Close' : 'Edit'}
                    </button>
                  </td>
                </tr>

                {/* Expandable editor */}
                {editingId === member.id && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 bg-muted/20">
                      <MemberEditor
                        member={member}
                        onUpdate={(updated) => {
                          setMembers((prev) =>
                            prev.map((m) => (m.id === updated.id ? updated : m)),
                          )
                          showToast('Member updated', 'success')
                        }}
                        onError={(msg) => showToast(msg, 'error')}
                        onRemove={(id) => {
                          setMembers((prev) => prev.filter((m) => m.id !== id))
                          setEditingId(null)
                          showToast('Member removed', 'success')
                        }}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

// ─── StatusBadge ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_LABELS[status] || { label: status, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${info.color}`}>
      {info.label}
    </span>
  )
}

// ─── MemberEditor ───────────────────────────────────────────────

function MemberEditor({
  member,
  onUpdate,
  onError,
  onRemove,
}: {
  member: MemberData
  onUpdate: (updated: MemberData) => void
  onError: (msg: string) => void
  onRemove: (id: string) => void
}) {
  const [editRole, setEditRole] = useState(member.role)
  const [editPerms, setEditPerms] = useState<string[]>(member.permissions)
  const [isPending, startTransition] = useTransition()
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  // Space memberships
  const [memberSpaces, setMemberSpaces] = useState<{ spaceId: string; spaceName: string; membershipId: string; role: string }[]>([])
  const [spacesLoading, setSpacesLoading] = useState(false)

  const loadSpaces = useCallback(async () => {
    setSpacesLoading(true)
    const result = await fetchMemberSpaces(member.userId)
    if (result.success && result.spaces) {
      setMemberSpaces(result.spaces)
    }
    setSpacesLoading(false)
  }, [member.userId])

  // Load spaces when editor opens or member changes
  React.useEffect(() => { loadSpaces() }, [loadSpaces])

  const roleDefaults = ROLE_DEFAULT_PERMISSIONS[editRole as TenantRole] || []

  const togglePerm = (key: string) => {
    setEditPerms((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]))
  }

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateMember(member.id, {
        role: editRole !== member.role ? editRole : undefined,
        permissions: editPerms,
      })
      if (!result.success) {
        onError(result.error || 'Failed to update member')
        return
      }
      onUpdate({ ...member, role: editRole, permissions: editPerms })
    })
  }

  const handleSuspend = () => {
    startTransition(async () => {
      const result =
        member.status === 'suspended'
          ? await reactivateMember(member.id)
          : await suspendMember(member.id)
      if (result.success) {
        onUpdate({
          ...member,
          status: member.status === 'suspended' ? 'active' : 'suspended',
        })
      } else {
        onError(result.error || 'Failed to update status')
      }
    })
  }

  const handleRevoke = () => {
    if (!confirmRevoke) {
      setConfirmRevoke(true)
      return
    }
    startTransition(async () => {
      const result = await revokeMember(member.id)
      if (result.success) {
        onRemove(member.id)
      } else {
        onError(result.error || 'Failed to revoke')
      }
    })
  }

  const handleAddToAllSpaces = () => {
    startTransition(async () => {
      const result = await addMemberToAllSpaces(member.userId)
      if (result.success) {
        // Direct re-fetch — avoids stale closure from ref guard
        setSpacesLoading(true)
        const fresh = await fetchMemberSpaces(member.userId)
        if (fresh.success && fresh.spaces) {
          setMemberSpaces(fresh.spaces)
        }
        setSpacesLoading(false)
      } else {
        onError(result.error || 'Failed to add to all spaces')
      }
    })
  }

  const handleRemoveFromSpace = (membershipId: string) => {
    startTransition(async () => {
      const result = await removeMemberFromSpace(membershipId)
      if (result.success) {
        setMemberSpaces((prev) => prev.filter((s) => s.membershipId !== membershipId))
      } else {
        onError(result.error || 'Failed to remove from space')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Role */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Role</label>
        <select
          value={editRole}
          onChange={(e) => setEditRole(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none"
        >
          <option value="tenant_member">Member</option>
          <option value="tenant_manager">Manager</option>
          <option value="tenant_admin">Admin</option>
        </select>
      </div>

      {/* Space Memberships */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-muted-foreground">Spaces</label>
          <button
            onClick={handleAddToAllSpaces}
            disabled={isPending}
            className="text-[10px] font-medium text-primary hover:underline disabled:opacity-50"
          >
            + Add to all spaces
          </button>
        </div>
        {spacesLoading ? (
          <div className="flex gap-2">
            {[1, 2].map((i) => <div key={i} className="h-6 w-24 animate-pulse rounded bg-muted" />)}
          </div>
        ) : memberSpaces.length === 0 ? (
          <p className="text-xs text-muted-foreground">Not in any spaces yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {memberSpaces.map((s) => (
              <span
                key={s.membershipId}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {s.spaceName}
                <button
                  onClick={() => handleRemoveFromSpace(s.membershipId)}
                  disabled={isPending}
                  className="ml-0.5 hover:text-red-500 disabled:opacity-50"
                  title={`Remove from ${s.spaceName}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Permissions */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">Permissions</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ALL_PERMISSIONS.map((perm) => {
            const isRoleDefault = roleDefaults.includes(perm.key)
            const isExplicit = editPerms.includes(perm.key)
            const isActive = isRoleDefault || isExplicit

            return (
              <label
                key={perm.key}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                  isActive
                    ? 'border-primary/30 bg-primary/5 text-foreground'
                    : 'border-border text-muted-foreground hover:border-border/80'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => togglePerm(perm.key)}
                  disabled={isRoleDefault}
                  className="h-3.5 w-3.5 rounded border-border"
                />
                <span>{perm.label}</span>
                {isRoleDefault && (
                  <span className="text-[9px] text-muted-foreground ml-auto">(role)</span>
                )}
              </label>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>

        {member.status !== 'pending' && (
          <button
            onClick={handleSuspend}
            disabled={isPending}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {member.status === 'suspended' ? 'Reactivate' : 'Suspend'}
          </button>
        )}

        <button
          onClick={handleRevoke}
          disabled={isPending}
          className={`ml-auto rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
            confirmRevoke
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
          }`}
        >
          {confirmRevoke ? 'Confirm Remove' : 'Remove'}
        </button>
      </div>
    </div>
  )
}
