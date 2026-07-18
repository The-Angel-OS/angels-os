'use client'

/**
 * WelcomeWizard — the Core rendering of the shared onboarding flow.
 *
 * Walks the flat step list from onboardingFlow.ts (welcome → identity → invite →
 * first-act → done). Each advance persists position via setOnboardingStep so the
 * flow resumes on return and the dashboard can nudge unfinished onboarding. The
 * SAME step spec renders as cards in Nimue — keep behavior changes in the shared
 * spec where practical so the two surfaces stay in lockstep.
 */

import React, { useCallback, useMemo, useState, useTransition } from 'react'
import {
  ONBOARDING_STEPS,
  onboardingStepIndex,
  nextOnboardingStep,
  getOnboardingStep,
  type OnboardingStepKey,
} from '@/utilities/onboardingFlow'
import {
  updateEndeavor,
  setOnboardingStep,
} from '@/app/[locale]/(dashboard)/dashboard/endeavor/actions'
import { inviteToEndeavor } from './actions'

export function WelcomeWizard({
  startStep,
  endeavorName,
  endeavorTagline,
  userName,
}: {
  startStep: OnboardingStepKey
  endeavorName: string
  endeavorTagline: string
  userName?: string
}) {
  const [stepKey, setStepKey] = useState<OnboardingStepKey>(startStep)
  const [name, setName] = useState(endeavorName)
  const [tagline, setTagline] = useState(endeavorTagline)
  const [inviteText, setInviteText] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const step = getOnboardingStep(stepKey)!
  const index = onboardingStepIndex(stepKey)

  const advance = useCallback(() => {
    const next = nextOnboardingStep(stepKey)
    if (!next) return
    setNotice(null)
    setStepKey(next)
    // Fire-and-forget persistence; the UI advances immediately.
    startTransition(() => {
      void setOnboardingStep(next)
    })
  }, [stepKey])

  const onIdentitySave = useCallback(() => {
    setNotice(null)
    startTransition(async () => {
      const res = await updateEndeavor({ name: name.trim(), tagline: tagline.trim() })
      if (!res.success) {
        setNotice(res.error || 'Could not save — try again.')
        return
      }
      advance()
    })
  }, [name, tagline, advance])

  const onInviteSend = useCallback(() => {
    setNotice(null)
    const emails = inviteText.split(/[\s,;]+/).filter(Boolean)
    if (!emails.length) {
      // Inviting is encouraged, not required — allow skipping forward.
      advance()
      return
    }
    startTransition(async () => {
      const res = await inviteToEndeavor(emails)
      if (!res.success) {
        setNotice(res.error || 'Could not send invites — try again.')
        return
      }
      const sent = res.invited.filter((i) => i.emailSent).length
      setNotice(`Invited ${res.invited.length} · ${sent} email${sent === 1 ? '' : 's'} sent.`)
      advance()
    })
  }, [inviteText, advance])

  const goDashboard = useCallback(() => {
    window.location.href = '/dashboard'
  }, [])

  const askLeoFirstAct = useCallback((text: string) => {
    // Same channel FirstRunDriver uses — if a LEO panel is mounted it opens with
    // this seeded ask. Harmless if not (the explicit links below always work).
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('leo:ask', { detail: { text } }))
    }
  }, [])

  const primaryLabel = useMemo(() => (pending ? 'Working…' : step.cta), [pending, step.cta])

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      {/* Step indicator */}
      <ol className="mb-10 flex items-center justify-center gap-2">
        {ONBOARDING_STEPS.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={[
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                i < index
                  ? 'bg-primary text-primary-foreground'
                  : i === index
                    ? 'ring-2 ring-primary text-primary'
                    : 'bg-muted text-muted-foreground',
              ].join(' ')}
              aria-current={i === index ? 'step' : undefined}
              title={s.label}
            >
              {i < index ? '✓' : i + 1}
            </span>
            {i < ONBOARDING_STEPS.length - 1 && (
              <span className={i < index ? 'h-px w-6 bg-primary' : 'h-px w-6 bg-border'} />
            )}
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
          {step.label}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {stepKey === 'welcome' && userName ? `${userName} — ${step.title}` : step.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.blurb}</p>

        {/* Step body */}
        <div className="mt-6">
          {stepKey === 'identity' && (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What's your endeavor called?"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Tagline</span>
                <input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="One line — what it's for"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </div>
          )}

          {stepKey === 'invite' && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Email addresses (comma, space, or newline separated)
              </span>
              <textarea
                value={inviteText}
                onChange={(e) => setInviteText(e.target.value)}
                rows={3}
                placeholder="friend@example.com, family@example.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Optional — you can always invite more later. Leave blank to skip.
              </span>
            </label>
          )}

          {stepKey === 'first-act' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <a
                href="/dashboard"
                className="rounded-xl border border-border p-4 text-sm transition-colors hover:border-primary hover:bg-muted"
              >
                <span className="block font-semibold">Post a welcome</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Say hello in your space.
                </span>
              </a>
              <a
                href="/dashboard/products"
                className="rounded-xl border border-border p-4 text-sm transition-colors hover:border-primary hover:bg-muted"
              >
                <span className="block font-semibold">List an offering</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  A product, service, or plan.
                </span>
              </a>
              <button
                type="button"
                onClick={() =>
                  askLeoFirstAct(
                    "Help me take my first dollar today — what's the fastest thing I can offer or sell right now?",
                  )
                }
                className="rounded-xl border border-border p-4 text-left text-sm transition-colors hover:border-primary hover:bg-muted"
              >
                <span className="block font-semibold">Ask LEO</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Take a dollar, day one.
                </span>
              </button>
            </div>
          )}

          {stepKey === 'done' && (
            <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
              You can revisit any of this from your dashboard whenever you like.
            </div>
          )}
        </div>

        {notice && (
          <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-xs text-foreground">{notice}</p>
        )}

        {/* Primary action */}
        <div className="mt-8 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Step {index + 1} of {ONBOARDING_STEPS.length}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (stepKey === 'identity') return onIdentitySave()
              if (stepKey === 'invite') return onInviteSend()
              if (step.terminal) return goDashboard()
              return advance()
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {primaryLabel}
          </button>
        </div>
      </div>

      {/* Escape hatch — never trap someone in onboarding. */}
      {!step.terminal && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={goDashboard}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Skip for now — go to dashboard
          </button>
        </div>
      )}
    </div>
  )
}
