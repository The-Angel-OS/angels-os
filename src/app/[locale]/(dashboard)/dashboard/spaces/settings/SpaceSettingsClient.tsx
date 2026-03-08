'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Settings, Users, Hash, AlertTriangle, Save, Loader2, Trash2, UserPlus } from 'lucide-react'
import { useDashboard } from '@/providers/DashboardContext'
import type { SerializedSpace } from '@/utilities/fetchUserSpaces'

/**
 * SpaceSettingsClient — Tab-based settings UI for the active space.
 *
 * Tabs: General | Members | Channels | Danger Zone
 * Reads active space from DashboardContext.
 */

type SettingsTab = 'general' | 'members' | 'channels' | 'danger'

interface SpaceMember {
  id: number
  userId: number
  userName: string
  userEmail: string
  role: string
  status: string
}

interface SpaceChannel {
  id: string
  name: string
  slug: string
  type: string
  isDefault: boolean
}

const SERVER_URL = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_SERVER_URL || '') : ''

export function SpaceSettingsClient({
  spaces,
  tenantId,
  userId,
  isAdmin,
}: {
  spaces: SerializedSpace[]
  tenantId?: string
  userId?: string
  isAdmin: boolean
}) {
  const { activeSpaceId, activeSpace } = useDashboard()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  if (!activeSpaceId || !activeSpace) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Select a space from the header to configure its settings.</p>
      </div>
    )
  }

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <Settings size={14} /> },
    { id: 'members', label: 'Members', icon: <Users size={14} /> },
    { id: 'channels', label: 'Channels', icon: <Hash size={14} /> },
    { id: 'danger', label: 'Danger Zone', icon: <AlertTriangle size={14} /> },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Space Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure <strong>{activeSpace.name}</strong> — manage members, channels, and preferences.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'general' && <GeneralTab spaceId={activeSpaceId} space={activeSpace} />}
      {activeTab === 'members' && <MembersTab spaceId={activeSpaceId} isAdmin={isAdmin} tenantId={tenantId} />}
      {activeTab === 'channels' && <ChannelsTab spaceId={activeSpaceId} />}
      {activeTab === 'danger' && <DangerTab spaceId={activeSpaceId} spaceName={activeSpace.name} />}
    </div>
  )
}

// ─── General Tab ─────────────────────────────────────────────

function GeneralTab({ spaceId, space }: { spaceId: string; space: { name: string; description?: string; visibility?: string } }) {
  const [name, setName] = useState(space.name)
  const [description, setDescription] = useState(space.description || '')
  const [visibility, setVisibility] = useState(space.visibility || 'invite_only')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setName(space.name)
    setDescription(space.description || '')
    setVisibility(space.visibility || 'invite_only')
  }, [space])

  const handleSave = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const res = await fetch(`${SERVER_URL}/api/spaces/${spaceId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, visibility }),
      })
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Space settings saved successfully.' })
      } else {
        const err = await res.json().catch(() => ({}))
        setFeedback({ type: 'error', text: err.errors?.[0]?.message || 'Failed to save settings.' })
      }
    } catch {
      setFeedback({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Space Name" description="The display name for this space.">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          placeholder="Space name"
        />
      </Card>

      <Card title="Description" description="A short description visible to members.">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
          placeholder="What is this space about?"
        />
      </Card>

      <Card title="Visibility" description="Controls who can see and join this space.">
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="public">Public — Anyone can view and join</option>
          <option value="invite_only">Invite Only — Requires invitation to join</option>
          <option value="private">Private — Hidden, admin access only</option>
        </select>
      </Card>

      {feedback && (
        <div
          className={`rounded-md p-3 text-sm ${
            feedback.type === 'success'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ─── Members Tab ─────────────────────────────────────────────

interface TenantMember {
  userId: number
  userName: string
  userEmail: string
}

function MembersTab({ spaceId, isAdmin, tenantId }: { spaceId: string; isAdmin: boolean; tenantId?: string }) {
  const [members, setMembers] = useState<SpaceMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // "Add from Endeavor" state
  const [eligibleMembers, setEligibleMembers] = useState<TenantMember[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [addRole, setAddRole] = useState<string>('member')
  const [isAdding, setIsAdding] = useState(false)
  const [loadingEligible, setLoadingEligible] = useState(false)

  // "Invite by email" state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('member')
  const [inviteMessage, setInviteMessage] = useState('')
  const [isInviting, setIsInviting] = useState(false)

  // Remove confirmation
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  const fetchMembers = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(
        `${SERVER_URL}/api/space-memberships?where[space][equals]=${spaceId}&where[status][equals]=active&depth=1&limit=100`,
        { credentials: 'include' },
      )
      if (res.ok) {
        const data = await res.json()
        const mapped: SpaceMember[] = (data.docs || []).map((doc: Record<string, unknown>) => {
          const user = typeof doc.user === 'object' && doc.user !== null ? (doc.user as Record<string, unknown>) : null
          return {
            id: doc.id as number,
            userId: (user?.id as number) || 0,
            userName: (user?.name as string) || (user?.email as string) || 'Unknown',
            userEmail: (user?.email as string) || '',
            role: (doc.role as string) || 'member',
            status: (doc.status as string) || 'active',
          }
        })
        const roleOrder: Record<string, number> = { space_admin: 0, moderator: 1, member: 2, guest: 3 }
        mapped.sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9))
        setMembers(mapped)
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }, [spaceId])

  // Fetch eligible tenant members (not already in this space)
  const fetchEligible = useCallback(async () => {
    if (!tenantId || !isAdmin) return
    setLoadingEligible(true)
    try {
      const res = await fetch(
        `${SERVER_URL}/api/tenant-memberships?where[tenant][equals]=${tenantId}&where[status][equals]=active&depth=1&limit=200`,
        { credentials: 'include' },
      )
      if (res.ok) {
        const data = await res.json()
        const allTenantMembers: TenantMember[] = (data.docs || []).map((doc: Record<string, unknown>) => {
          const user = typeof doc.user === 'object' && doc.user !== null ? (doc.user as Record<string, unknown>) : null
          return {
            userId: (user?.id as number) || 0,
            userName: (user?.name as string) || (user?.email as string) || 'Unknown',
            userEmail: (user?.email as string) || '',
          }
        }).filter((m: TenantMember) => m.userId > 0)
        setEligibleMembers(allTenantMembers)
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingEligible(false)
    }
  }, [tenantId, isAdmin])

  useEffect(() => { fetchMembers() }, [fetchMembers])
  useEffect(() => { fetchEligible() }, [fetchEligible])

  // Filter out members already in the space (dedup by userId, not email)
  const memberUserIds = new Set(members.map((m) => m.userId).filter(Boolean))
  const addableMembers = eligibleMembers.filter((m) => !memberUserIds.has(m.userId))

  const handleAddMember = async () => {
    if (!selectedUserId || !tenantId) return
    setIsAdding(true)
    setFeedback(null)
    try {
      const res = await fetch(`${SERVER_URL}/api/space-memberships`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: Number(selectedUserId),
          space: Number(spaceId),
          role: addRole,
          status: 'active',
          joinedAt: new Date().toISOString(),
          tenant: Number(tenantId),
        }),
      })
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Member added successfully.' })
        setSelectedUserId('')
        setAddRole('member')
        fetchMembers()
        fetchEligible()
      } else {
        const err = await res.json().catch(() => ({}))
        setFeedback({ type: 'error', text: err.errors?.[0]?.message || 'Failed to add member.' })
      }
    } catch {
      setFeedback({ type: 'error', text: 'Network error.' })
    } finally {
      setIsAdding(false)
    }
  }

  const handleRoleChange = async (membershipId: number, newRole: string) => {
    setFeedback(null)
    try {
      const res = await fetch(`${SERVER_URL}/api/space-memberships/${membershipId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Role updated.' })
        fetchMembers()
      } else {
        setFeedback({ type: 'error', text: 'Failed to update role.' })
      }
    } catch {
      setFeedback({ type: 'error', text: 'Network error.' })
    }
  }

  const handleRemoveMember = async (membershipId: number) => {
    setIsRemoving(true)
    setFeedback(null)
    try {
      const res = await fetch(`${SERVER_URL}/api/spaces/members/remove`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId, spaceId }),
      })
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Member removed.' })
        setConfirmRemoveId(null)
        fetchMembers()
        fetchEligible()
      } else {
        const err = await res.json().catch(() => ({}))
        setFeedback({ type: 'error', text: err.error || 'Failed to remove member.' })
      }
    } catch {
      setFeedback({ type: 'error', text: 'Network error.' })
    } finally {
      setIsRemoving(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail) return
    setIsInviting(true)
    setFeedback(null)
    try {
      const res = await fetch(`${SERVER_URL}/api/spaces/${spaceId}/invite`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          spaceId,
          role: inviteRole,
          message: inviteMessage || undefined,
        }),
      })
      if (res.ok) {
        setFeedback({ type: 'success', text: `Invitation sent to ${inviteEmail}.` })
        setInviteEmail('')
        setInviteMessage('')
      } else {
        const err = await res.json().catch(() => ({}))
        setFeedback({ type: 'error', text: err.error || 'Failed to send invitation.' })
      }
    } catch {
      setFeedback({ type: 'error', text: 'Network error.' })
    } finally {
      setIsInviting(false)
    }
  }

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      space_admin: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
      moderator: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      member: 'bg-muted text-muted-foreground',
      guest: 'bg-muted text-muted-foreground/60',
    }
    const labels: Record<string, string> = { space_admin: 'Admin', moderator: 'Mod', member: 'Member', guest: 'Guest' }
    return (
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[role] || colors.member}`}>
        {labels[role] || role}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div className={`rounded-md p-3 text-sm ${
          feedback.type === 'success'
            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Add from Endeavor — admin only */}
      {isAdmin && (
        <Card title="Add from Endeavor" description="Add existing team members to this space.">
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              disabled={loadingEligible}
            >
              <option value="">
                {loadingEligible ? 'Loading members...' : addableMembers.length === 0 ? 'All members already added' : 'Select a member...'}
              </option>
              {addableMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userName} ({m.userEmail})
                </option>
              ))}
            </select>
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value)}
              className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="member">Member</option>
              <option value="moderator">Moderator</option>
              <option value="guest">Guest</option>
            </select>
            <button
              onClick={handleAddMember}
              disabled={!selectedUserId || isAdding}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
            >
              {isAdding ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Add
            </button>
          </div>
        </Card>
      )}

      {/* Members list */}
      <Card title="Members" description={`${members.length} member${members.length !== 1 ? 's' : ''} in this space.`}>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-2 w-20 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members found.</p>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {m.userName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{m.userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.userEmail}</p>
                </div>
                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      className="rounded border border-border bg-background px-2 py-1 text-xs"
                    >
                      <option value="space_admin">Admin</option>
                      <option value="moderator">Mod</option>
                      <option value="member">Member</option>
                      <option value="guest">Guest</option>
                    </select>
                    {confirmRemoveId === m.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRemoveMember(m.id)}
                          disabled={isRemoving}
                          className="rounded bg-red-600 px-2 py-1 text-[10px] text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {isRemoving ? '...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/80"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemoveId(m.id)}
                        className="rounded p-1 text-muted-foreground hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20"
                        title="Remove member"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ) : (
                  roleBadge(m.role)
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Invite by email — admin only */}
      {isAdmin && (
        <Card title="Invite by Email" description="Send an invitation to someone outside your current team.">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="member">Member</option>
                <option value="moderator">Moderator</option>
                <option value="guest">Guest</option>
              </select>
            </div>
            <textarea
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              rows={2}
              placeholder="Optional personal message..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
            />
            <div className="flex justify-end">
              <button
                onClick={handleInvite}
                disabled={!inviteEmail || isInviting}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isInviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                {isInviting ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Channels Tab ────────────────────────────────────────────

function ChannelsTab({ spaceId }: { spaceId: string }) {
  const [channels, setChannels] = useState<SpaceChannel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchChannels = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(
        `${SERVER_URL}/api/channels?where[space][equals]=${spaceId}&depth=0&limit=100`,
        { credentials: 'include' },
      )
      if (res.ok) {
        const data = await res.json()
        const mapped: SpaceChannel[] = (data.docs || []).map((ch: Record<string, unknown>) => ({
          id: String(ch.id),
          name: String(ch.name || ''),
          slug: String(ch.slug || ''),
          type: String(ch.type || 'general'),
          isDefault: Boolean(ch.isDefault),
        }))
        setChannels(mapped)
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }, [spaceId])

  useEffect(() => { fetchChannels() }, [fetchChannels])

  const CHANNEL_TYPE_LABELS: Record<string, string> = {
    general: 'General',
    announcements: 'Announcements',
    support: 'Support',
    sales: 'Sales',
    inventory: 'Inventory',
    pdf: 'PDF',
    video: 'Video',
    team: 'Team',
    social: 'Social',
  }

  return (
    <div className="space-y-4">
      <Card title="Channels" description={`${channels.length} channel${channels.length !== 1 ? 's' : ''} in this space.`}>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">No channels yet. Create one from the chat view.</p>
        ) : (
          <div className="divide-y divide-border">
            {channels.map((ch) => (
              <div key={ch.id} className="flex items-center gap-3 py-2.5">
                <Hash size={14} className="text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{ch.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {CHANNEL_TYPE_LABELS[ch.type] || ch.type}
                    {ch.isDefault && ' · Default'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Danger Tab ──────────────────────────────────────────────

function DangerTab({ spaceId, spaceName }: { spaceId: string; spaceName: string }) {
  const [confirmName, setConfirmName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border-2 border-red-200 dark:border-red-900/40 p-4 space-y-4">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle size={16} />
          <h3 className="text-sm font-semibold">Delete Space</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Permanently delete <strong>{spaceName}</strong> and all its channels and messages.
          This action cannot be undone.
        </p>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Type <strong>{spaceName}</strong> to confirm
          </label>
          <input
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-red-500 focus:outline-none"
            placeholder={spaceName}
          />
        </div>
        <button
          disabled={confirmName !== spaceName || isDeleting}
          className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 size={14} />
          {isDeleting ? 'Deleting...' : 'Delete Space'}
        </button>
      </div>
    </div>
  )
}

// ─── Card Component ──────────────────────────────────────────

function Card({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}
