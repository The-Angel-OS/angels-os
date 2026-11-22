'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Lock, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PaymentRailSelector, type PaymentRailId } from '@/components/payments/PaymentRailSelector'
import { useAuth } from '@/providers/Auth'
import {
  isPostLockedForViewer,
  type ViewerAccessStanding,
} from '@/lib/memberships/access'

export { isPostLockedForViewer, type ViewerAccessStanding }

interface PlanOption {
  id: string
  name: string
  amountCents: number
  interval: 'month' | 'year'
  description?: string
}

const fmtPlanPrice = (cents: number, interval: 'month' | 'year') =>
  cents === 0
    ? 'Free'
    : `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}/${interval === 'month' ? 'mo' : 'yr'}`

export interface JoinToUnlockPanelProps {
  access: string
  targetPath: string
  title?: string
  thumbnailUrl?: string | null
  description?: string | null
  onClose?: () => void
  onUnlocked?: () => void
}

/**
 * Patreon-style inline membership unlock widget.
 * Allows visitors to pick a creator tier & pay via Square/PayPal OR sign in
 * cleanly right over the locked preview, returning to `targetPath` on completion.
 */
export function JoinToUnlockPanel({
  access,
  targetPath,
  title,
  thumbnailUrl,
  description,
  onClose,
  onUnlocked,
}: JoinToUnlockPanelProps) {
  const router = useRouter()
  const { user, login } = useAuth()
  const needsAuthOnly = access === 'authenticated'
  const goodStanding = access === 'good_standing'

  const [tab, setTab] = useState<'join' | 'signin'>(needsAuthOnly ? 'signin' : 'join')
  const [plans, setPlans] = useState<PlanOption[] | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [provider, setProvider] = useState<PaymentRailId | null>(null)
  const [hasProviders, setHasProviders] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Inline Sign In form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  // Pre-fill signed-in viewer details cleanly (zero 401 fetches for guests)
  useEffect(() => {
    if (user?.email) {
      setMemberEmail((prev) => prev || user.email || '')
      setMemberName((prev) => prev || ((user as { name?: string }).name || ''))
    }
  }, [user])

  // Fetch active creator membership tiers when membership is required
  useEffect(() => {
    if (needsAuthOnly) {
      setPlans([])
      return
    }
    let cancelled = false
    fetch('/api/membership-ops/plans', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { plans: [] }))
      .then((d) => {
        if (cancelled) return
        const list = Array.isArray(d?.plans) ? (d.plans as PlanOption[]) : []
        setPlans(list)
        if (list.length > 0) {
          const firstPaid = list.find((p) => p.amountCents > 0)
          setSelectedPlanId((firstPaid ?? list[0])!.id)
        }
      })
      .catch(() => {
        if (!cancelled) setPlans([])
      })
    return () => {
      cancelled = true
    }
  }, [needsAuthOnly])

  // Confirm Square/PayPal membership checkout return directly on this gated page
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const m = params.get('membership')
    if (m === 'cancelled') {
      setNotice('Checkout was cancelled — you were not charged.')
      return
    }
    if (m === 'success') {
      const ref = params.get('ref')
      if (!ref) {
        window.history.replaceState({}, '', targetPath)
        router.refresh()
        onUnlocked?.()
        return
      }
      setVerifying(true)
      setError(null)
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
          setVerifying(false)
          if (ok && data?.ok) {
            window.history.replaceState({}, '', targetPath)
            router.refresh()
            onUnlocked?.()
          } else {
            setError(
              data?.error ||
                'Your membership payment is still finalizing — refresh in a few seconds.',
            )
          }
        })
        .catch(() => {
          setVerifying(false)
          setError('Network error confirming your membership. Please refresh this page.')
        })
    }
  }, [targetPath, router, onUnlocked])

  const selectedPlan = useMemo(
    () => plans?.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  )

  const handleJoinSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!selectedPlan) return
      setSubmitting(true)
      setError(null)
      setNotice(null)
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
            memberName: memberName.trim() || undefined,
            memberEmail: memberEmail.trim() || undefined,
            provider: selectedPlan.amountCents > 0 ? provider || undefined : undefined,
            returnPath: targetPath,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          checkoutUrl?: string
          url?: string
          error?: string
        }
        const targetUrl = data.checkoutUrl || data.url
        if (!res.ok || !targetUrl) {
          throw new Error(data.error || 'Could not start membership checkout.')
        }
        window.location.href = targetUrl
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
        setSubmitting(false)
      }
    },
    [selectedPlan, memberName, memberEmail, provider, targetPath],
  )

  const handleSignInSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSigningIn(true)
      setError(null)
      try {
        await login({ email: loginEmail.trim(), password: loginPassword })
        router.refresh()
        onUnlocked?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid email or password.')
        setSigningIn(false)
      }
    },
    [login, loginEmail, loginPassword, router, onUnlocked],
  )

  if (verifying) {
    return (
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <h2 className="text-xl font-bold">Unlocking your content...</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Confirming your membership with the payment processor.
        </p>
      </div>
    )
  }

  return (
    <div className="relative mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card text-left shadow-2xl">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close membership dialog"
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-background"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Blurred Teaser Header */}
      <div className="relative overflow-hidden border-b border-border bg-slate-950 px-6 py-7 text-white">
        {thumbnailUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-md"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/55" />
          </>
        )}
        <div className="relative z-10 pr-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-slate-950/80 px-3 py-1 text-xs font-semibold text-amber-300 backdrop-blur-sm">
            <Lock className="h-3.5 w-3.5" />
            {needsAuthOnly ? 'Account Required' : goodStanding ? 'Active Members Only' : 'Members Only'}
          </span>
          {title && <h2 className="mt-3 text-xl font-bold leading-snug">{title}</h2>}
          {description && (
            <p className="mt-1.5 line-clamp-2 text-sm text-slate-200/85">{description}</p>
          )}
          <p className="mt-2 text-xs text-slate-300">
            {needsAuthOnly
              ? 'Sign in with a free account to watch or read immediately.'
              : goodStanding
                ? 'This release is for active members in good standing. Renew or join below to unlock.'
                : 'Become a supporting member to unlock this release and all members-only content.'}
          </p>
        </div>
      </div>

      {/* Mode Tabs */}
      {!needsAuthOnly && (
        <div className="grid grid-cols-2 border-b border-border bg-muted/30 text-sm font-medium">
          <button
            type="button"
            onClick={() => {
              setTab('join')
              setError(null)
            }}
            className={`py-2.5 text-center transition-colors ${
              tab === 'join'
                ? 'border-b-2 border-primary bg-card text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Join to Unlock
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('signin')
              setError(null)
            }}
            className={`py-2.5 text-center transition-colors ${
              tab === 'signin'
                ? 'border-b-2 border-primary bg-card text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Already a member? Sign In
          </button>
        </div>
      )}

      <div className="p-6 space-y-4">
        {notice && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
            {notice}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {tab === 'join' && !needsAuthOnly && (
          <>
            {plans === null ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading membership tiers...
              </div>
            ) : plans.length === 0 ? (
              <div className="space-y-4 text-center py-2">
                <p className="text-sm text-muted-foreground">
                  Membership tiers are not published on this portal yet. If you already have an invite
                  or member account, sign in below.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button type="button" onClick={() => setTab('signin')}>
                    Sign In
                  </Button>
                  {onClose && (
                    <Button type="button" variant="outline" onClick={onClose}>
                      Keep Browsing
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleJoinSubmit} className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Select membership tier
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {plans.map((plan) => {
                      const active = selectedPlan?.id === plan.id
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setSelectedPlanId(plan.id)}
                          className={`flex w-full items-start justify-between rounded-lg border p-3 text-left transition-colors ${
                            active
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-border hover:bg-muted/40'
                          }`}
                        >
                          <span className="space-y-0.5 pr-3">
                            <span className="block text-sm font-semibold">{plan.name}</span>
                            {plan.description && (
                              <span className="block text-xs text-muted-foreground">
                                {plan.description}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-sm font-bold text-foreground">
                            {fmtPlanPrice(plan.amountCents, plan.interval)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {user?.email ? (
                  <p className="text-xs text-muted-foreground">
                    Joining as{' '}
                    <span className="font-medium text-foreground">
                      {(user as { name?: string }).name || user.email}
                    </span>
                    . Your access unlocks on return.
                  </p>
                ) : selectedPlan?.amountCents === 0 ? (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Free memberships tie to your account —{' '}
                    <button
                      type="button"
                      onClick={() => setTab('signin')}
                      className="font-semibold text-primary underline"
                    >
                      sign in or create a free account
                    </button>{' '}
                    to unlock instantly.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="join-modal-name" className="text-xs">
                        Name (optional)
                      </Label>
                      <Input
                        id="join-modal-name"
                        value={memberName}
                        onChange={(e) => setMemberName(e.target.value)}
                        placeholder="Your name"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="join-modal-email" className="text-xs">
                        Email (for instant access)
                      </Label>
                      <Input
                        id="join-modal-email"
                        type="email"
                        required
                        value={memberEmail}
                        onChange={(e) => setMemberEmail(e.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                )}

                {selectedPlan && selectedPlan.amountCents > 0 && (
                  <PaymentRailSelector
                    value={provider}
                    onChange={setProvider}
                    onLoaded={(info) => setHasProviders(info.providers.length > 0)}
                    disabled={submitting}
                  />
                )}

                {(user || (selectedPlan && selectedPlan.amountCents > 0)) && (
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={
                      submitting ||
                      !selectedPlan ||
                      (selectedPlan.amountCents > 0 && !hasProviders)
                    }
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {submitting
                      ? 'Redirecting to checkout...'
                      : selectedPlan
                        ? selectedPlan.amountCents === 0
                          ? 'Unlock Free Membership'
                          : `Join & Unlock — ${fmtPlanPrice(selectedPlan.amountCents, selectedPlan.interval)}`
                        : 'Join to Unlock'}
                  </Button>
                )}

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>Cancel anytime. Returns right back here.</span>
                  <Link href="/support" className="underline hover:text-foreground">
                    Compare all tiers
                  </Link>
                </div>
              </form>
            )}
          </>
        )}

        {(tab === 'signin' || needsAuthOnly) && (
          <div className="space-y-4">
            <a
              href={`/api/auth/google?redirect=${encodeURIComponent(targetPath)}`}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Continue with Google
            </a>

            <div className="relative text-center text-xs uppercase text-muted-foreground">
              <span className="bg-card px-2">or sign in with email</span>
            </div>

            <form onSubmit={handleSignInSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="signin-modal-email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="signin-modal-email"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="signin-modal-password" className="text-xs">
                  Password
                </Label>
                <Input
                  id="signin-modal-password"
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={signingIn}>
                {signingIn ? 'Signing in...' : 'Sign In & Unlock'}
              </Button>
            </form>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <Link
                href={`/create-account?redirect=${encodeURIComponent(targetPath)}`}
                className="font-medium text-primary hover:underline"
              >
                Create a free account
              </Link>
              <Link href="/forgot-password" className="hover:underline">
                Forgot password?
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export interface JoinToUnlockModalProps extends JoinToUnlockPanelProps {
  open: boolean
}

/**
 * Full-screen Patreon-style overlay modal launched when a viewer clicks any
 * locked video/post card directly inside an archive grid.
 */
export function JoinToUnlockModal({ open, onClose, ...panelProps }: JoinToUnlockModalProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={panelProps.title ? `Unlock ${panelProps.title}` : 'Unlock members-only content'}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <JoinToUnlockPanel {...panelProps} onClose={onClose} />
    </div>
  )
}
