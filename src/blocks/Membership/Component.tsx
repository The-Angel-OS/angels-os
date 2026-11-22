'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RichText } from '@/components/RichText'
import { PaymentRailSelector, type PaymentRailId } from '@/components/payments/PaymentRailSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Plan = {
  id: string
  name: string
  amountCents: number
  interval: 'month' | 'year'
  description?: string
}

type MyMembership = {
  id: string | number
  planName: string | null
  amountCents: number | null
  interval: 'month' | 'year' | null
  status: string | null
  currentPeriodEnd: string | null
  canManage: boolean
}

// A free tier reads as "Free", never "$0/mo" — a price of zero written as a
// price still asks the reader to think about money at the exact moment the
// point is that there isn't any.
const fmt = (cents: number, interval: 'month' | 'year') =>
  cents === 0
    ? 'Free'
    : `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}/${interval === 'month' ? 'mo' : 'yr'}`

const ACTIVE = new Set(['active', 'trialing', 'past_due'])

const statusLabel: Record<string, string> = {
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Past due',
  canceled: 'Canceled',
  incomplete: 'Incomplete',
}

/**
 * Membership (Join) block — fetches the host endeavor's active plans and starts a
 * recurring Square or PayPal subscription via hosted checkout redirect.
 */
export const MembershipBlock: React.FC<{
  id?: string
  richText?: unknown
  ctaText?: string
}> = ({ richText, ctaText = 'Become a member' }) => {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [step, setStep] = useState<'plans' | 'info' | 'verifying' | 'success' | 'cancelled'>('plans')
  const [selected, setSelected] = useState<string | null>(null)
  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [provider, setProvider] = useState<PaymentRailId | null>(null)
  const [hasProviders, setHasProviders] = useState(true)
  const [portalMessage, setPortalMessage] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ name?: string; email?: string } | null>(null)
  const [member, setMember] = useState<MyMembership | null | undefined>(undefined) // undefined = loading
  const [submitting, setSubmitting] = useState(false)
  const [managing, setManaging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshMyMemberships = useCallback(() => {
    fetch('/api/membership-ops/my', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { memberships: [] }))
      .then((d) => {
        const list = Array.isArray(d?.memberships) ? (d.memberships as MyMembership[]) : []
        const current = list.find((m) => m.status && ACTIVE.has(m.status)) || list[0] || null
        setMember(current)
      })
      .catch(() => {
        setMember(null)
      })
  }, [])

  // Handle Square / PayPal return (?membership=success&ref=... or ?membership=cancelled).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const m = params.get('membership')
    if (m === 'cancelled') {
      setStep('cancelled')
      return
    }
    if (m === 'success') {
      const ref = params.get('ref')
      if (!ref) {
        setStep('success')
        refreshMyMemberships()
        return
      }
      setStep('verifying')
      fetch('/api/payment-ops/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ref,
          orderId: params.get('orderId') || params.get('token') || undefined,
          transactionId: params.get('transactionId') || undefined,
          subscriptionId: params.get('subscription_id') || undefined,
        }),
      })
        .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
        .then(({ ok, data }) => {
          if (ok && data?.ok) {
            setStep('success')
            refreshMyMemberships()
          } else {
            setError(data?.error || 'Could not confirm your membership payment yet.')
            setStep('plans')
          }
        })
        .catch(() => {
          setError('Network error confirming membership. Please refresh to check status.')
          setStep('plans')
        })
    }
  }, [refreshMyMemberships])

  // Load the host endeavor's active plans (public GET, host-tenant authoritative).
  useEffect(() => {
    let cancelled = false
    fetch('/api/membership-ops/plans', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { plans: [] }))
      .then((d) => {
        if (cancelled) return
        const list = Array.isArray(d?.plans) ? (d.plans as Plan[]) : []
        setPlans(list)
        if (list.length) setSelected(list[0].id)
      })
      .catch(() => {
        if (!cancelled) setPlans([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Pre-fill name/email for signed-in members (mirrors Donation).
  useEffect(() => {
    let cancelled = false
    fetch('/api/users/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const u = d?.user as { name?: string; email?: string } | undefined
        if (cancelled || !u?.email) return
        setViewer({ name: u.name, email: u.email })
        setMemberName((prev) => prev || u.name || '')
        setMemberEmail((prev) => prev || u.email || '')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Load the viewer's own membership for this endeavor (if signed in + a member).
  useEffect(() => {
    refreshMyMemberships()
  }, [refreshMyMemberships])

  const openPortal = useCallback(async () => {
    setManaging(true)
    setError(null)
    setPortalMessage(null)
    try {
      const res = await fetch('/api/membership-ops/portal', { method: 'POST', credentials: 'include' })
      const data = (await res.json()) as { url?: string; message?: string; error?: string }
      if (!res.ok) throw new Error(data?.error || 'Could not load membership management details')
      if (data?.url) {
        window.location.href = data.url
        return
      }
      setPortalMessage(
        data?.message ||
          'Use your confirmation receipt or contact the organization to update or cancel your membership.',
      )
      setManaging(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setManaging(false)
    }
  }, [])

  const selectedPlan = useMemo(() => plans?.find((p) => p.id === selected) || null, [plans, selected])

  const startCheckout = useCallback(async () => {
    if (!selectedPlan) return
    setSubmitting(true)
    setError(null)
    try {
      const tenantSlug =
        document.cookie
          .split('; ')
          .find((c) => c.startsWith('payload-tenant='))
          ?.split('=')[1] || 'default'

      const res = await fetch('/api/membership-ops/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          planId: selectedPlan.id,
          tenantSlug,
          memberName: memberName || undefined,
          memberEmail: memberEmail || undefined,
          provider: selectedPlan.amountCents > 0 ? provider || undefined : undefined,
        }),
      })
      const data = (await res.json()) as { checkoutUrl?: string; url?: string; error?: string }
      const targetUrl = data.checkoutUrl || data.url
      if (!res.ok || !targetUrl) throw new Error(data?.error || 'Could not start checkout')
      window.location.href = targetUrl
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }, [selectedPlan, memberName, memberEmail, provider])

  if (step === 'verifying') {
    return (
      <div className="container">
        <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-8 text-center">
          <h2 className="mb-2 text-xl font-bold">Confirming your membership...</h2>
          <p className="text-sm text-muted-foreground">
            Verifying your subscription with the payment processor.
          </p>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="container">
        <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-8 text-center">
          <div className="mb-4 text-5xl">&#127881;</div>
          <h2 className="mb-2 text-2xl font-bold">Welcome aboard!</h2>
          <p className="text-muted-foreground">
            Your membership is active. Thank you for joining — we&apos;re glad you&apos;re here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="mx-auto max-w-lg space-y-6">
        {richText ? <RichText data={richText as never} enableGutter={false} /> : null}

        {step === 'cancelled' && (
          <p className="text-center text-sm text-muted-foreground">
            No worries — your checkout was cancelled and you weren&apos;t charged. Pick a plan whenever you&apos;re ready.
          </p>
        )}

        {/* Member's own membership — shown instead of the plan picker when active */}
        {(step === 'plans' || step === 'cancelled') && member && member.status && ACTIVE.has(member.status) && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Your membership</h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  member.status === 'past_due'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                    : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                }`}
              >
                {statusLabel[member.status] || member.status}
              </span>
            </div>
            <div className="text-sm">
              <p className="font-medium text-foreground">
                {member.planName || 'Membership'}
                {member.amountCents != null && member.interval ? ` · ${fmt(member.amountCents, member.interval)}` : ''}
              </p>
              {member.currentPeriodEnd && (
                <p className="text-muted-foreground">
                  {member.status === 'canceled' ? 'Access until' : 'Renews'}{' '}
                  {new Date(member.currentPeriodEnd).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>
            {member.canManage ? (
              <Button onClick={openPortal} className="w-full" size="lg" disabled={managing}>
                {managing ? 'Checking…' : 'Manage membership'}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Contact the organization to make changes to your membership.</p>
            )}
            {portalMessage && (
              <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-foreground">
                {portalMessage}
              </p>
            )}
            <p className="text-xs text-muted-foreground">Update your card, view receipts, or cancel anytime.</p>
          </div>
        )}

        {/* Plan selection — hidden once the viewer has an active membership */}
        {(step === 'plans' || step === 'cancelled') && !(member && member.status && ACTIVE.has(member.status)) && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">Choose your membership</h3>

            {plans === null ? (
              <p className="text-sm text-muted-foreground">Loading plans…</p>
            ) : plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Membership plans aren&apos;t set up yet. Check back soon.
              </p>
            ) : (
              <div className="space-y-2">
                {plans.map((plan) => {
                  const active = selected === plan.id
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelected(plan.id)}
                      className={`flex w-full items-start justify-between rounded-md border p-4 text-left transition-colors ${
                        active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <span className="space-y-1">
                        <span className="block font-medium">{plan.name}</span>
                        {plan.description ? (
                          <span className="block text-sm text-muted-foreground">{plan.description}</span>
                        ) : null}
                      </span>
                      <span className="ml-4 shrink-0 font-semibold">{fmt(plan.amountCents, plan.interval)}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {plans && plans.length > 0 && (
              <Button
                onClick={() => setStep('info')}
                disabled={!selectedPlan}
                className="w-full"
                size="lg"
              >
                Continue{selectedPlan ? ` — ${fmt(selectedPlan.amountCents, selectedPlan.interval)}` : ''}
              </Button>
            )}
          </div>
        )}

        {/* Member info + checkout */}
        {step === 'info' && selectedPlan && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">
              {selectedPlan.name} · {fmt(selectedPlan.amountCents, selectedPlan.interval)}
            </h3>
            {viewer ? (
              <p className="text-sm text-muted-foreground">
                Joining as{' '}
                <span className="font-medium text-foreground">{viewer.name || viewer.email}</span>
                {viewer.name && viewer.email ? ` · ${viewer.email}` : ''}.
              </p>
            ) : selectedPlan.amountCents === 0 ? (
              // A free membership is written against a user account (that is what
              // gets you into the rooms), so there is nothing for name/email to do
              // here — collecting them and then 401ing is a dead end. Send them to
              // sign in and come straight back to this page.
              <p className="text-sm text-muted-foreground">
                <a
                  href={`/login?redirect=${encodeURIComponent(
                    typeof window === 'undefined' ? '/' : window.location.pathname,
                  )}`}
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </a>{' '}
                to join — it takes a moment and it is what your membership is attached to.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="member-name">Name</Label>
                  <Input
                    id="member-name"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-email">Email</Label>
                  <Input
                    id="member-email"
                    type="email"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </>
            )}
            {selectedPlan.amountCents > 0 && (
              <PaymentRailSelector
                value={provider}
                onChange={setProvider}
                onLoaded={(info) => setHasProviders(info.providers.length > 0)}
                disabled={submitting}
              />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('plans')} className="flex-1" disabled={submitting}>
                Back
              </Button>
              {(viewer || selectedPlan.amountCents > 0) && (
                <Button
                  onClick={startCheckout}
                  className="flex-1"
                  size="lg"
                  disabled={submitting || (selectedPlan.amountCents > 0 && !hasProviders)}
                >
                  {submitting ? 'Starting…' : ctaText}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedPlan.amountCents === 0
                ? 'No payment, no card. Leave whenever you like.'
                : 'Secure recurring payment via Square or PayPal. Cancel anytime.'}
            </p>
          </div>
        )}

        {error && <p className="text-center text-sm text-red-500">{error}</p>}
      </div>
    </div>
  )
}
