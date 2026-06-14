'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RichText } from '@/components/RichText'
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

const fmt = (cents: number, interval: 'month' | 'year') =>
  `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}/${interval === 'month' ? 'mo' : 'yr'}`

/**
 * Membership (Join) block — fetches the host endeavor's active plans and starts a
 * recurring Stripe Connect subscription. Hosted-checkout redirect (no Elements):
 * the engine's /api/membership-ops/checkout returns a Stripe URL.
 */
export const MembershipBlock: React.FC<{
  id?: string
  richText?: unknown
  ctaText?: string
}> = ({ richText, ctaText = 'Become a member' }) => {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [step, setStep] = useState<'plans' | 'info' | 'success' | 'cancelled'>('plans')
  const [selected, setSelected] = useState<string | null>(null)
  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [viewer, setViewer] = useState<{ name?: string; email?: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reflect the Stripe return state (success_url / cancel_url use ?membership=...).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const m = params.get('membership')
    if (m === 'success') setStep('success')
    else if (m === 'cancelled') setStep('cancelled')
  }, [])

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
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Could not start checkout')
      window.location.href = data.url as string
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }, [selectedPlan, memberName, memberEmail])

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

        {/* Plan selection */}
        {(step === 'plans' || step === 'cancelled') && (
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('plans')} className="flex-1" disabled={submitting}>
                Back
              </Button>
              <Button onClick={startCheckout} className="flex-1" size="lg" disabled={submitting}>
                {submitting ? 'Starting…' : ctaText}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Secure recurring payment via Stripe. Cancel anytime.
            </p>
          </div>
        )}

        {error && <p className="text-center text-sm text-red-500">{error}</p>}
      </div>
    </div>
  )
}
