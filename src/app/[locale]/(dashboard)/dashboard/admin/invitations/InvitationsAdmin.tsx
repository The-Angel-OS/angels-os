'use client'

import React, { useState, useCallback } from 'react'
import { sendQuickInvite, type QuickInviteResult } from './actions'
import { resendTenantInvitation } from '../team/actions'

/**
 * InvitationsAdmin — Quick Invite form + manage sent invitations.
 *
 * Shows Quick Invite at the top for sending tenant-level invites,
 * followed by the list of existing invitations with stats and resend.
 */

interface Invitation {
  id: number | string
  email: string
  status: string
  role: string
  spaceName: string
  inviterName: string
  expiresAt: string | null
  createdAt: string
}

interface InvitationsAdminProps {
  invitations: Invitation[]
  totalInvitations: number
}

export function InvitationsAdmin({ invitations, totalInvitations }: InvitationsAdminProps) {
  const pending = invitations.filter((i) => i.status === 'pending')
  const accepted = invitations.filter((i) => i.status === 'active')

  const [resendingId, setResendingId] = useState<string | number | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Quick Invite form state
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteLastName, setInviteLastName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('tenant_member')
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteResult, setInviteResult] = useState<QuickInviteResult | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const handleQuickInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return
    setInviteSending(true)
    setInviteResult(null)
    setToast(null)

    const result = await sendQuickInvite({
      email: inviteEmail.trim(),
      role: inviteRole,
      message: inviteMessage.trim() || undefined,
      firstName: inviteFirstName.trim() || undefined,
      lastName: inviteLastName.trim() || undefined,
    })

    setInviteResult(result)
    setInviteSending(false)

    if (result.success) {
      setToast({
        message: result.emailSent
          ? `Invitation sent to ${inviteEmail}!`
          : `Invitation created for ${inviteEmail} (email transport not configured — share the link manually).`,
        type: 'success',
      })
      setInviteEmail('')
      setInviteMessage('')
      setInviteFirstName('')
      setInviteLastName('')
    } else {
      setToast({ message: result.error || 'Failed to send invitation.', type: 'error' })
    }
  }, [inviteEmail, inviteRole, inviteMessage, inviteFirstName, inviteLastName])

  const handleCopyUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch {
      // Fallback
    }
  }, [])

  const handleResend = useCallback(async (membershipId: string | number) => {
    setResendingId(membershipId)
    setToast(null)
    // Tenant-invite resend (extends expiry + re-sends to the tenant subdomain).
    // Was wrongly hitting /api/space-ops/invite/resend (the SPACE flow).
    const res = await resendTenantInvitation(membershipId)
    if (res.success) {
      setToast({
        message: res.emailSent
          ? 'Invitation resent successfully!'
          : 'Invitation extended (email transport not configured).',
        type: 'success',
      })
    } else {
      setToast({ message: res.error || 'Failed to resend invitation.', type: 'error' })
    }
    setResendingId(null)
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Invitations</h1>
        <p className="text-muted-foreground mt-1">
          Invite people to your Enterprise and manage existing invitations.
        </p>
      </div>

      {/* Quick Invite Form */}
      <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5">
        <h2 className="mb-3 text-lg font-semibold">Quick Invite</h2>
        {/* Name row — personalizes the invitation greeting */}
        <div className="mb-3 grid gap-3 md:grid-cols-2">
          <input
            type="text"
            value={inviteFirstName}
            onChange={(e) => setInviteFirstName(e.target.value)}
            placeholder="First name (optional)"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            type="text"
            value={inviteLastName}
            onChange={(e) => setInviteLastName(e.target.value)}
            placeholder="Last name (optional)"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Email Address</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              onKeyDown={(e) => e.key === 'Enter' && handleQuickInvite()}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="tenant_member">Member</option>
              <option value="tenant_manager">Manager</option>
              <option value="tenant_admin">Admin</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleQuickInvite}
              disabled={inviteSending || !inviteEmail.trim()}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {inviteSending ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </div>
        <div className="mt-2">
          <input
            type="text"
            value={inviteMessage}
            onChange={(e) => setInviteMessage(e.target.value)}
            placeholder="Personal message (optional)"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Invite URL result */}
        {inviteResult?.success && inviteResult.inviteUrl && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
            <span className="flex-1 truncate text-xs text-muted-foreground">
              {inviteResult.inviteUrl}
            </span>
            <button
              onClick={() => handleCopyUrl(inviteResult.inviteUrl!)}
              className="shrink-0 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-muted"
            >
              {copiedUrl ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Sent</p>
          <p className="text-2xl font-bold">{totalInvitations}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Accepted</p>
          <p className="text-2xl font-bold text-emerald-600">{accepted.length}</p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Invitation List */}
      {invitations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-1">No invitations yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Use the Quick Invite form above to send your first invitation.
          </p>
          <p className="text-xs text-muted-foreground">
            You can also ask LEO: &quot;Invite john@example.com to our General space&quot;
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Space</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sent</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Expires</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => {
                const isExpired =
                  inv.expiresAt && inv.status === 'pending' && new Date(inv.expiresAt) < new Date()

                return (
                  <tr key={inv.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{inv.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.spaceName}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{inv.role}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          inv.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : isExpired
                              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {inv.status === 'active'
                          ? 'Accepted'
                          : isExpired
                            ? 'Expired'
                            : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {inv.expiresAt
                        ? new Date(inv.expiresAt).toLocaleDateString()
                        : '\u2014'}
                    </td>
                    <td className="px-4 py-3">
                      {(inv.status === 'pending') && (
                        <button
                          onClick={() => handleResend(inv.id)}
                          disabled={resendingId === inv.id}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                          {resendingId === inv.id ? (
                            <>
                              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Sending...
                            </>
                          ) : (
                            'Resend'
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
