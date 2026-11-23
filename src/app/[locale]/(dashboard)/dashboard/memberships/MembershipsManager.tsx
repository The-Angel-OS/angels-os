'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import type { MembershipPlan } from '@/utilities/membershipPlans'

export interface SubscriberRow {
  id: string
  memberName: string
  memberEmail: string
  planName: string
  amountCents: number
  interval: 'month' | 'year'
  status: string
  startedAt: string | null
  currentPeriodEnd: string | null
}

interface MembershipsManagerProps {
  initialPlans: MembershipPlan[]
  subscribers: SubscriberRow[]
  tenantName: string
  tenantSlug: string
  supportPath: string
}

export function MembershipsManager({
  initialPlans,
  subscribers,
  tenantName,
  tenantSlug,
  supportPath,
}: MembershipsManagerProps) {
  const [plans, setPlans] = useState<MembershipPlan[]>(initialPlans)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [amountUsd, setAmountUsd] = useState('5.00')
  const [interval, setInterval] = useState<'month' | 'year'>('month')
  const [description, setDescription] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  const formatMoney = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

  const openCreateForm = () => {
    setEditingId(null)
    setName('')
    setAmountUsd('5.00')
    setInterval('month')
    setDescription('')
    setMessage(null)
    setShowForm(true)
  }

  const openEditForm = (plan: MembershipPlan) => {
    setEditingId(plan.id)
    setName(plan.name)
    setAmountUsd((plan.amountCents / 100).toFixed(2))
    setInterval(plan.interval)
    setDescription(plan.description || '')
    setMessage(null)
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const cents = Math.round((parseFloat(amountUsd) || 0) * 100)
    if (!trimmedName) {
      setMessage({ type: 'error', text: 'Enter a tier name.' })
      return
    }
    if (cents < 100) {
      setMessage({ type: 'error', text: 'Minimum membership amount is $1.00.' })
      return
    }

    const id =
      editingId ||
      trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') ||
      `tier-${Date.now()}`

    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/membership-ops/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantSlug: tenantSlug || undefined,
          plan: {
            id,
            name: trimmedName,
            amountCents: cents,
            interval,
            description: description.trim() || undefined,
            active: true,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: 'error', text: data?.error || 'Could not save membership tier.' })
        return
      }
      setPlans(data.plans || [])
      setShowForm(false)
      setEditingId(null)
      setMessage({ type: 'success', text: `Saved "${trimmedName}".` })
    } catch {
      setMessage({ type: 'error', text: 'Could not reach server.' })
    } finally {
      setBusy(false)
    }
  }

  const handleToggleActive = async (plan: MembershipPlan) => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/membership-ops/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantSlug: tenantSlug || undefined,
          plan: {
            ...plan,
            active: plan.active === false,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data.plans)) {
        setPlans(data.plans)
      } else {
        setMessage({ type: 'error', text: data?.error || 'Could not update tier status.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not reach server.' })
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (planId: string) => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/membership-ops/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantSlug: tenantSlug || undefined,
          delete: planId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data.plans)) {
        setPlans(data.plans)
        setMessage({ type: 'success', text: 'Membership tier deleted.' })
      } else {
        setMessage({ type: 'error', text: data?.error || 'Could not delete tier.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not reach server.' })
    } finally {
      setBusy(false)
    }
  }

  const copyJoinUrl = async () => {
    const url = `${window.location.origin}${supportPath}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      // non-fatal
    }
  }

  const activeSubscribers = subscribers.filter(
    (s) => s.status === 'active' || s.status === 'trialing',
  )
  const mrrCents = activeSubscribers.reduce(
    (sum, s) => sum + (s.interval === 'year' ? Math.round(s.amountCents / 12) : s.amountCents),
    0,
  )

  const statusTone: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    past_due: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    canceled: 'bg-muted text-muted-foreground',
    incomplete: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Memberships</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create recurring supporter tiers for {tenantName} and manage active members.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyJoinUrl}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {copiedLink ? 'Copied Join URL!' : 'Copy /support Link'}
          </button>
          <Link
            href={supportPath}
            target="_blank"
            className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Preview Page ↗
          </Link>
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Add Tier
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Active Tiers</p>
          <p className="mt-1 text-2xl font-bold">
            {plans.filter((p) => p.active !== false).length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Active Members</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {activeSubscribers.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Estimated Monthly Recurring</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(mrrCents)}</p>
        </div>
      </div>

      {/* Add / Edit Tier Form */}
      {showForm && (
        <form
          onSubmit={handleSave}
          className="rounded-lg border border-primary/30 bg-card p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editingId ? 'Edit Membership Tier' : 'Create Membership Tier'}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Tier Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Founding Supporter"
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Price (USD)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Billing Interval</label>
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value === 'year' ? 'year' : 'month')}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Perks / Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Unlock members-only videos, posts, and private community channels."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? 'Saving…' : editingId ? 'Save Tier' : 'Create Tier'}
            </button>
          </div>
        </form>
      )}

      {/* Tiers Grid */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Supporter Tiers</h2>
        {plans.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/10 p-10 text-center">
            <h3 className="mb-1 font-semibold">No membership tiers yet</h3>
            <p className="mx-auto mb-4 max-w-md text-sm text-muted-foreground">
              Add your first supporter tier to unlock Members-Only posts, videos, and recurring pledges on your site.
            </p>
            <button
              type="button"
              onClick={openCreateForm}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              + Create First Tier
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`flex flex-col rounded-lg border p-5 ${
                  plan.active === false ? 'border-border/60 bg-muted/20 opacity-75' : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="text-sm font-medium text-primary">
                      {formatMoney(plan.amountCents)}/{plan.interval === 'year' ? 'yr' : 'mo'}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      plan.active !== false
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {plan.active !== false ? 'Active' : 'Hidden'}
                  </span>
                </div>
                {plan.description && (
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{plan.description}</p>
                )}
                <div className="mt-4 flex items-center gap-3 border-t border-border pt-3 text-xs">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openEditForm(plan)}
                    className="font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleToggleActive(plan)}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {plan.active !== false ? 'Hide' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(plan.id)}
                    className="ml-auto text-muted-foreground hover:text-red-600 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subscribers Table */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Members &amp; Subscribers</h2>
        {subscribers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No subscribers yet. Share your <code className="rounded bg-muted px-1">/support</code> page or publish Members-Only posts to start growing recurring support.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-medium">{sub.memberName}</p>
                      {sub.memberEmail && (
                        <p className="text-xs text-muted-foreground">{sub.memberEmail}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">{sub.planName}</td>
                    <td className="px-4 py-3 font-medium">
                      {formatMoney(sub.amountCents)}/{sub.interval === 'year' ? 'yr' : 'mo'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          statusTone[sub.status] || statusTone.incomplete
                        }`}
                      >
                        {sub.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {sub.startedAt ? new Date(sub.startedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
