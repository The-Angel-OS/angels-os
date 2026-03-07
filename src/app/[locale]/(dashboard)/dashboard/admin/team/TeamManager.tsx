'use client'

import React, { useState, useTransition } from 'react'
import {
  sendQuickInvite,
  updateMemberRole,
  updateMemberPermissions,
  suspendMember,
  revokeMember,
  reactivateMember,
} from './actions'

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

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: 'Admin',
  tenant_manager: 'Manager',
  tenant_member: 'Member',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300' },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' },
  suspended: { label: 'Suspended', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  revoked: { label: 'Revoked', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

const ALL_PERMISSIONS = [
  { key: 'manage_users', label: 'Manage Users' },
  { key: 'manage_spaces', label: 'Manage Spaces' },
  { key: 'manage_content', label: 'Manage Content' },
  { key: 'manage_products', label: 'Manage Products' },
  { key: 'manage_orders', label: 'Manage Orders' },
  { key: 'view_analytics', label: 'View Analytics' },
  { key: 'manage_settings', label: 'Manage Settings' },
  { key: 'manage_billing', label: 'Manage Billing' },
  { key: 'export_data', label: 'Export Data' },
]

const ROLE_DEFAULT_PERMS: Record<string, string[]> = {
  tenant_admin: ALL_PERMISSIONS.map((p) => p.key),
  tenant_manager: ['manage_spaces', 'manage_content', 'manage_products', 'manage_orders', 'view_analytics'],
  tenant_member: ['view_analytics'],
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

  const filtered = members.filter((m) => {
    if (filter === 'all') return true
    if (filter === 'suspended') return m.status === 'suspended' || m.status === 'revoked'
    return m.status === filter
  })

  const counts = {
    all: members.length,
    active: members.filter((m) => m.status === 'active').length,
    pending: members.filter((m) => m.status === 'pending').length,
    suspended: members.filter((m) => m.status === 'suspended' || m.status === 'revoked').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage members and permissions for {tenantName}
        </p>
      </div>

      {/* Quick Invite */}
      <InviteSection onInviteSent={() => showToast('Invitation sent', 'success')} />

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
                    <span className="text-sm">{ROLE_LABELS[member.role] || member.role}</span>
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

// ─── InviteSection ──────────────────────────────────────────────

function InviteSection({ onInviteSent }: { onInviteSent: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('tenant_member')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const handleInvite = () => {
    if (!email.trim()) return
    setError('')
    startTransition(async () => {
      const result = await sendQuickInvite({ email: email.trim(), role })
      if (result.success) {
        setEmail('')
        setRole('tenant_member')
        onInviteSent()
      } else {
        setError(result.error || 'Failed to send invite')
      }
    })
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <h2 className="text-sm font-semibold mb-3">Invite a team member</h2>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
          onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
        >
          <option value="tenant_member">Member</option>
          <option value="tenant_manager">Manager</option>
          <option value="tenant_admin">Admin</option>
        </select>
        <button
          onClick={handleInvite}
          disabled={isPending || !email.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Sending...' : 'Send Invite'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
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

  const roleDefaults = ROLE_DEFAULT_PERMS[editRole] || []

  const togglePerm = (key: string) => {
    setEditPerms((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]))
  }

  const handleSave = () => {
    startTransition(async () => {
      // Update role if changed
      if (editRole !== member.role) {
        const roleResult = await updateMemberRole(member.id, editRole)
        if (!roleResult.success) {
          onError(roleResult.error || 'Failed to update role')
          return
        }
      }

      // Update permissions
      const permResult = await updateMemberPermissions(member.id, editPerms)
      if (!permResult.success) {
        onError(permResult.error || 'Failed to update permissions')
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
