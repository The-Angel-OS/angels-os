'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Globe,
  Lock,
  Users,
  Loader2,
  Crown,
  Shield,
  Eye,
  X,
  Trash2,
  UserPlus,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ChatSpace } from './types'

// ── Types ──────────────────────────────────────────────────────────────────

type Visibility = 'public' | 'invite_only' | 'private'
type Tab = 'general' | 'applets' | 'members'

interface SpaceMember {
  id: number
  userId: number
  userName: string
  userEmail: string
  role: 'space_admin' | 'moderator' | 'member' | 'guest'
  status: 'active' | 'pending'
}

/** Mirrors the endpoint's plan — @see src/endpoints/space-delete.ts */
interface DeletePlan {
  space: { id: number; name: string }
  destination: { id: number; name: string } | null
  channels: Array<{
    channelId: number
    slug: string
    name: string
    messageCount: number
    action: 'move' | 'merge'
  }>
  looseMessages: number
  membersMoved: number
  membersAlreadyThere: number
}

interface SpaceSettingsDialogProps {
  open: boolean
  onClose: () => void
  space: ChatSpace
  onSpaceUpdated: (updated: Partial<ChatSpace>) => void
  onSpaceDeleted: () => void
}

// ── Constants ──────────────────────────────────────────────────────────────

const VISIBILITY_OPTIONS: { value: Visibility; label: string; Icon: React.ElementType }[] = [
  { value: 'public', label: 'Public', Icon: Globe },
  { value: 'invite_only', label: 'Invite-only', Icon: Users },
  { value: 'private', label: 'Private', Icon: Lock },
]

const ROLE_CONFIG = {
  space_admin: { label: 'Admin', Icon: Crown, color: 'text-amber-500' },
  moderator: { label: 'Mod', Icon: Shield, color: 'text-blue-500' },
  member: { label: 'Member', Icon: Users, color: 'text-muted-foreground' },
  guest: { label: 'Guest', Icon: Eye, color: 'text-muted-foreground/60' },
} as const

// ── Component ──────────────────────────────────────────────────────────────

export function SpaceSettingsDialog({
  open,
  onClose,
  space,
  onSpaceUpdated,
  onSpaceDeleted,
}: SpaceSettingsDialogProps) {
  const [tab, setTab] = useState<Tab>('general')

  // ── General tab state ──────────────────────────────────────────────────
  const [name, setName] = useState(space.name)
  const [description, setDescription] = useState(space.description || '')
  const [visibility, setVisibility] = useState<Visibility>((space.visibility as Visibility) || 'invite_only')
  const [isSavingGeneral, setIsSavingGeneral] = useState(false)
  const [generalMsg, setGeneralMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── Applets tab state ──────────────────────────────────────────────────
  const [enabledApplets, setEnabledApplets] = useState<string[]>(
    space.enabledApplets || ['chat', 'files', 'tasks'],
  )
  const [isSavingApplets, setIsSavingApplets] = useState(false)
  const [appletsMsg, setAppletsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── Members tab state ──────────────────────────────────────────────────
  const [members, setMembers] = useState<SpaceMember[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'moderator' | 'guest'>('member')
  const [isInviting, setIsInviting] = useState(false)
  const [membersMsg, setMembersMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── Danger zone state ──────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState('')
  /** Sibling spaces this one's contents can be moved into. */
  const [siblings, setSiblings] = useState<Array<{ id: number; name: string }>>([])
  const [reassignTo, setReassignTo] = useState<number | ''>('')
  const [plan, setPlan] = useState<DeletePlan | null>(null)

  // Sync from prop changes
  useEffect(() => {
    setName(space.name)
    setDescription(space.description || '')
    setVisibility((space.visibility as Visibility) || 'invite_only')
    setEnabledApplets(space.enabledApplets || ['chat', 'files', 'tasks'])
  }, [space])

  // Candidate destinations — every other space IN THIS SPACE'S TENANT. Loaded
  // when the danger zone opens, not on mount: most sessions never delete
  // anything.
  //
  // Scoped by tenant because a super_admin reads every tenant's spaces, so the
  // chooser listed the whole server: fourteen rows all named "Community", and
  // picking the wrong one moves a portal's channels and messages into a
  // DIFFERENT endeavor. Cross-tenant is never a legitimate destination here.
  // One request: `tenant` comes back in the same list, and this space is in it.
  useEffect(() => {
    if (!confirmDelete) return
    let cancelled = false
    const qs = 'limit=500&depth=0&sort=name&select[name]=true&select[tenant]=true'
    fetch(`/api/spaces?${qs}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .then((d: { docs?: Array<{ id: number; name: string; tenant?: number | null }> }) => {
        if (cancelled) return
        const docs = d.docs || []
        // ChatSpace.id is a string, the REST doc's is a number — compare as text.
        const isSelf = (s: { id: number }) => String(s.id) === String(space.id)
        const myTenant = docs.find(isSelf)?.tenant ?? null
        setSiblings(
          docs.filter(
            // If this space somehow isn't in the page, don't silently fall back
            // to "every tenant" — show nothing and let delete-contents handle it.
            (s) => !isSelf(s) && myTenant != null && String(s.tenant) === String(myTenant),
          ),
        )
      })
      .catch(() => {
        /* the chooser just stays empty — delete-contents is still available */
      })
    return () => {
      cancelled = true
    }
  }, [confirmDelete, space.id])

  // The preview comes from the SAME code that performs the delete, so what you
  // read here is what happens. Re-fetched whenever the destination changes.
  useEffect(() => {
    if (!confirmDelete) {
      setPlan(null)
      return
    }
    let cancelled = false
    const qs = `spaceId=${space.id}${reassignTo ? `&reassignTo=${reassignTo}` : ''}`
    fetch(`/api/space-ops/delete?${qs}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { plan?: DeletePlan } | null) => {
        if (!cancelled) setPlan(d?.plan ?? null)
      })
      .catch(() => {
        if (!cancelled) setPlan(null)
      })
    return () => {
      cancelled = true
    }
  }, [confirmDelete, reassignTo, space.id])

  const fetchMembers = useCallback(async () => {
    if (!space.id) return
    setIsLoadingMembers(true)
    try {
      const res = await fetch(
        `/api/space-memberships?where[space][equals]=${space.id}&where[status][in]=active,pending&depth=1&limit=100`,
        { credentials: 'include' },
      )
      if (res.ok) {
        const data = await res.json()
        const mapped: SpaceMember[] = (data.docs || []).map((doc: Record<string, unknown>) => {
          const u = doc.user as Record<string, unknown> | null
          return {
            id: doc.id as number,
            userId: (u?.id as number) || 0,
            userName: (u?.name as string) || (u?.email as string) || 'Unknown',
            userEmail: (u?.email as string) || '',
            role: doc.role as SpaceMember['role'],
            status: doc.status as SpaceMember['status'],
          }
        })
        setMembers(mapped)
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingMembers(false)
    }
  }, [space.id])

  useEffect(() => {
    if (open && tab === 'members') fetchMembers()
  }, [open, tab, fetchMembers])

  // ── Handlers ───────────────────────────────────────────────────────────

  const saveGeneral = async () => {
    if (!name.trim()) return
    setIsSavingGeneral(true)
    setGeneralMsg(null)
    try {
      const res = await fetch(`/api/spaces/${space.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          visibility,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const updated = data.doc || data
        setGeneralMsg({ type: 'success', text: 'Saved.' })
        onSpaceUpdated({ name: updated.name, description: updated.description, visibility: updated.visibility })
      } else {
        const data = await res.json().catch(() => ({}))
        setGeneralMsg({ type: 'error', text: data.errors?.[0]?.message || 'Save failed' })
      }
    } catch {
      setGeneralMsg({ type: 'error', text: 'Network error' })
    } finally {
      setIsSavingGeneral(false)
    }
  }

  const saveApplets = async () => {
    setIsSavingApplets(true)
    setAppletsMsg(null)
    try {
      const res = await fetch(`/api/spaces/${space.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabledApplets }),
      })
      if (res.ok) {
        setAppletsMsg({ type: 'success', text: 'Saved.' })
        onSpaceUpdated({ enabledApplets })
      } else {
        setAppletsMsg({ type: 'error', text: 'Save failed' })
      }
    } catch {
      setAppletsMsg({ type: 'error', text: 'Network error' })
    } finally {
      setIsSavingApplets(false)
    }
  }

  const toggleApplet = (id: string) => {
    if (id === 'chat') return // Chat is always on
    setEnabledApplets((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    )
  }

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return
    setIsInviting(true)
    setMembersMsg(null)
    try {
      const res = await fetch('/api/space-ops/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: inviteEmail.trim(), spaceId: space.id, role: inviteRole }),
      })
      const data = await res.json()
      if (res.ok) {
        setMembersMsg({ type: 'success', text: `Invite sent to ${inviteEmail}` })
        setInviteEmail('')
        fetchMembers()
      } else {
        setMembersMsg({ type: 'error', text: data.error || 'Invite failed' })
      }
    } catch {
      setMembersMsg({ type: 'error', text: 'Network error' })
    } finally {
      setIsInviting(false)
    }
  }

  const removeMember = async (membershipId: number) => {
    try {
      const res = await fetch('/api/space-ops/members/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ membershipId, spaceId: space.id }),
      })
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== membershipId))
      }
    } catch {
      // ignore
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteMsg('')
    try {
      const res = await fetch('/api/space-ops/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          spaceId: space.id,
          ...(reassignTo ? { reassignTo } : {}),
          // No destination chosen: say out loud that the contents go too. The
          // endpoint refuses a populated space otherwise, on purpose.
          ...(reassignTo ? {} : { deleteContents: true }),
        }),
      })
      if (res.ok) {
        onClose()
        onSpaceDeleted()
      } else {
        const data = await res.json().catch(() => ({}))
        setDeleteMsg(data.error || data.errors?.[0]?.message || 'Delete failed')
      }
    } catch {
      setDeleteMsg('Network error')
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const isSystem = space.isSystem

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Space Settings — {space.name}</DialogTitle>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(['general', 'applets', 'members'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── General ── */}
        {tab === 'general' && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSystem}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSystem}
                rows={2}
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium">Visibility</label>
              <div className="grid grid-cols-3 gap-2">
                {VISIBILITY_OPTIONS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => !isSystem && setVisibility(value)}
                    disabled={isSystem}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs transition-colors disabled:opacity-50 ${
                      visibility === value
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {generalMsg && (
              <p className={`text-xs ${generalMsg.type === 'success' ? 'text-emerald-600' : 'text-destructive'}`}>
                {generalMsg.text}
              </p>
            )}
            <div className="flex justify-end">
              <button
                onClick={saveGeneral}
                disabled={isSavingGeneral || isSystem || !name.trim()}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                {isSavingGeneral && <Loader2 size={13} className="animate-spin" />}
                Save
              </button>
            </div>

            {/* Danger Zone */}
            {!isSystem && (
              <div className="rounded-lg border border-destructive/30 p-3">
                <p className="mb-2 text-xs font-semibold text-destructive">Danger Zone</p>
                {confirmDelete ? (
                  <div className="space-y-2">
                    <label className="block text-xs text-muted-foreground">
                      Move this space&apos;s channels and members to:
                      <select
                        value={reassignTo}
                        onChange={(e) => setReassignTo(e.target.value ? Number(e.target.value) : '')}
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                      >
                        <option value="">Nowhere — delete them too</option>
                        {siblings.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* What will actually happen, straight from the endpoint. */}
                    {plan && (
                      <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                        {plan.channels.length === 0 && plan.looseMessages === 0 ? (
                          <p>This space is empty — nothing to move.</p>
                        ) : (
                          <ul className="space-y-0.5">
                            {plan.channels.map((c) => (
                              <li key={c.channelId}>
                                <strong>#{c.slug}</strong>
                                {c.messageCount > 0 && ` (${c.messageCount} message${c.messageCount === 1 ? '' : 's'})`}
                                {plan.destination
                                  ? c.action === 'merge'
                                    ? ` → merges into #${c.slug} in ${plan.destination.name}`
                                    : ` → moves to ${plan.destination.name}`
                                  : ' → deleted'}
                              </li>
                            ))}
                            {plan.looseMessages > 0 && (
                              <li>
                                {plan.looseMessages} message{plan.looseMessages === 1 ? '' : 's'} outside any channel
                                {plan.destination ? ` → ${plan.destination.name}` : ' → deleted'}
                              </li>
                            )}
                            {plan.destination && plan.membersMoved > 0 && (
                              <li>
                                {plan.membersMoved} member{plan.membersMoved === 1 ? '' : 's'} carried over
                                {plan.membersAlreadyThere > 0 &&
                                  ` (${plan.membersAlreadyThere} already there)`}
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      <strong>{space.name}</strong> will be deleted.
                    </p>
                    {deleteMsg && <p className="text-xs text-destructive">{deleteMsg}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground disabled:opacity-50"
                      >
                        {isDeleting && <Loader2 size={12} className="animate-spin" />}
                        Yes, delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={13} />
                    Delete space
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Applets ── */}
        {tab === 'applets' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Choose which tools are available in this space&apos;s channel header.
            </p>
            {[
              { id: 'chat', label: 'Chat', description: 'Messaging — always on', locked: true },
              { id: 'files', label: 'Files', description: 'File browser and uploads' },
              { id: 'tasks', label: 'Tasks', description: 'Task board (coming soon)' },
            ].map(({ id, label, description: desc, locked }) => (
              <div
                key={id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
                <button
                  onClick={() => toggleApplet(id)}
                  disabled={locked}
                  className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${
                    enabledApplets.includes(id) ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      enabledApplets.includes(id) ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
            {appletsMsg && (
              <p className={`text-xs ${appletsMsg.type === 'success' ? 'text-emerald-600' : 'text-destructive'}`}>
                {appletsMsg.text}
              </p>
            )}
            <div className="flex justify-end">
              <button
                onClick={saveApplets}
                disabled={isSavingApplets}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                {isSavingApplets && <Loader2 size={13} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        )}

        {/* ── Members ── */}
        {tab === 'members' && (
          <div className="space-y-3">
            {/* Invite form */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <UserPlus size={13} />
                Invite by email
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
                  placeholder="email@example.com"
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="member">Member</option>
                  <option value="moderator">Moderator</option>
                  <option value="guest">Guest</option>
                </select>
                <button
                  onClick={sendInvite}
                  disabled={isInviting || !inviteEmail.trim()}
                  className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
                >
                  {isInviting ? <Loader2 size={12} className="animate-spin" /> : 'Invite'}
                </button>
              </div>
              {membersMsg && (
                <p className={`text-xs ${membersMsg.type === 'success' ? 'text-emerald-600' : 'text-destructive'}`}>
                  {membersMsg.text}
                </p>
              )}
            </div>

            {/* Member list */}
            <div className="max-h-56 overflow-y-auto space-y-1">
              {isLoadingMembers ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              ) : members.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No members yet</p>
              ) : (
                members.map((m) => {
                  const cfg = ROLE_CONFIG[m.role]
                  const RoleIcon = cfg.Icon
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {m.userName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{m.userName}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{m.userEmail}</div>
                      </div>
                      <div className={`flex items-center gap-1 text-[10px] ${cfg.color}`}>
                        <RoleIcon size={11} />
                        {cfg.label}
                      </div>
                      {m.status === 'pending' && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Pending
                        </span>
                      )}
                      {m.role !== 'space_admin' && (
                        <button
                          onClick={() => removeMember(m.id)}
                          className="rounded-md p-1 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                          title="Remove"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
