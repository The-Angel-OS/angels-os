'use client'

import React, { useState, useCallback } from 'react'

/**
 * InvitationsAdmin — Manage sent invitations.
 *
 * Shows list of all invitations with status, resend capability,
 * and invitation statistics.
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

  const handleResend = useCallback(async (membershipId: string | number) => {
    setResendingId(membershipId)
    setToast(null)
    try {
      const res = await fetch('/api/spaces/invite/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setToast({
          message: data.emailSent
            ? 'Invitation resent successfully!'
            : 'Invitation extended (email transport not configured).',
          type: 'success',
        })
      } else {
        setToast({ message: data.error || 'Failed to resend invitation.', type: 'error' })
      }
    } catch {
      setToast({ message: 'Network error — could not resend invitation.', type: 'error' })
    } finally {
      setResendingId(null)
    }
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Invitations</h1>
        <p className="text-muted-foreground mt-1">
          Track and manage team invitations.
        </p>
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
            Invite your team members through LEO or the Spaces dashboard. They'll receive an email with a link to join.
          </p>
          <p className="text-xs text-muted-foreground">
            Try saying to LEO: "Invite john@example.com to our General space"
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
                        : '—'}
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
