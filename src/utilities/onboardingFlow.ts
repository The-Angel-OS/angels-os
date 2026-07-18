/**
 * Onboarding flow — the single, isomorphic source of truth for the new-endeavor
 * reception flow. Ken's locked spec (260718): after a new endeavor is provisioned
 * the owner lands on a host-authoritative reception route (`/welcome` on the new
 * endeavor's FQDN) that walks a FLAT step list. The SAME spec renders two ways:
 * a Core wizard (src/app/[locale]/(app)/welcome) and Nimue cards (C:\Dev\nimue).
 *
 * This file has NO server imports on purpose so Nimue can import the exact same
 * step shape and stay in lockstep — the flow is defined once, rendered anywhere.
 *
 * @see docs/HANDOFF_260718.md (focus area 1 — onboarding)
 */

/** The flat, ordered step keys. `welcome → identity → invite → first-act → done`. */
export const ONBOARDING_STEP_KEYS = [
  'welcome',
  'identity',
  'invite',
  'first-act',
  'done',
] as const

export type OnboardingStepKey = (typeof ONBOARDING_STEP_KEYS)[number]

export interface OnboardingStep {
  key: OnboardingStepKey
  /** Short label for the step indicator. */
  label: string
  /** Headline shown at the top of the step. */
  title: string
  /** One or two sentences framing what this step is for. */
  blurb: string
  /** Primary call-to-action label. */
  cta: string
  /** True for the terminal step (no forward action beyond finishing). */
  terminal?: boolean
}

/**
 * The steps, in order. Copy lives here so the wizard and the Nimue cards read
 * identically — change the words once, both surfaces update.
 */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    key: 'welcome',
    label: 'Welcome',
    title: 'Your endeavor is live',
    blurb:
      "It exists now — a home on the web that's yours. Let's spend a minute making it feel like you and getting your first people in the door.",
    cta: 'Get started',
  },
  {
    key: 'identity',
    label: 'Identity',
    title: 'Say who you are',
    blurb:
      'A name and a one-line tagline is all it takes for your endeavor to introduce itself. You can refine everything else later.',
    cta: 'Save & continue',
  },
  {
    key: 'invite',
    label: 'Invite',
    title: 'Bring your people',
    blurb:
      'An endeavor comes alive with people in it. Invite a few now — they land straight inside, no setup on their end.',
    cta: 'Send invites',
  },
  {
    key: 'first-act',
    label: 'First act',
    title: 'Do one real thing',
    blurb:
      "Post a welcome, list your first offering, or ask LEO to help you take a dollar today. The first act is what turns a page into a going concern.",
    cta: 'Take my first act',
  },
  {
    key: 'done',
    label: 'Done',
    title: "You're up and running",
    blurb:
      'That’s the whole spine. Your endeavor is set up, your people are invited, and you’ve done the first real thing. Everything from here lives in your dashboard.',
    cta: 'Go to my dashboard',
    terminal: true,
  },
] as const

/** Look up a step by key. */
export function getOnboardingStep(key: string): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((s) => s.key === key)
}

/** Zero-based index of a step key, or -1 if unknown. */
export function onboardingStepIndex(key: string): number {
  return ONBOARDING_STEP_KEYS.indexOf(key as OnboardingStepKey)
}

/** The next step key after `key`, or null if `key` is the last/unknown. */
export function nextOnboardingStep(key: string): OnboardingStepKey | null {
  const i = onboardingStepIndex(key)
  if (i < 0 || i >= ONBOARDING_STEP_KEYS.length - 1) return null
  return ONBOARDING_STEP_KEYS[i + 1]
}

/** True once the flow has reached its terminal step. */
export function isOnboardingComplete(key: string | null | undefined): boolean {
  return key === 'done'
}

/** The step to resume at — the stored step, or 'welcome' for a fresh endeavor. */
export function resumeOnboardingStep(stored: string | null | undefined): OnboardingStepKey {
  if (!stored) return 'welcome'
  return onboardingStepIndex(stored) >= 0 ? (stored as OnboardingStepKey) : 'welcome'
}
