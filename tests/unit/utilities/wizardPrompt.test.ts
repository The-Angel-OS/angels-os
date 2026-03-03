/**
 * wizardPrompt — Unit Tests
 *
 * buildWizardSystemPromptSuffix, getWizardStepName, WIZARD_STEP_NAMES
 */
import { describe, it, expect } from 'vitest'

import {
  buildWizardSystemPromptSuffix,
  getWizardStepName,
  WIZARD_STEP_NAMES,
} from '@/utilities/wizardPrompt'

// ── buildWizardSystemPromptSuffix ──────────────────────────────────────────────

describe('buildWizardSystemPromptSuffix', () => {
  it('returns empty string for an invalid step', () => {
    expect(buildWizardSystemPromptSuffix(99)).toBe('')
  })

  it('returns a non-empty string for step 0 (Welcome)', () => {
    const suffix = buildWizardSystemPromptSuffix(0)
    expect(typeof suffix).toBe('string')
    expect(suffix.length).toBeGreaterThan(0)
  })

  it('contains WIZARD MODE header', () => {
    const suffix = buildWizardSystemPromptSuffix(1)
    expect(suffix).toContain('WIZARD MODE')
  })

  it('includes the step name', () => {
    const suffix = buildWizardSystemPromptSuffix(2)
    expect(suffix).toContain('Endeavor Type')
  })

  it('includes the operator name from context', () => {
    const suffix = buildWizardSystemPromptSuffix(1, { operatorName: 'Dana' })
    expect(suffix).toContain('Dana')
  })

  it('defaults to "the operator" when no operator name provided', () => {
    const suffix = buildWizardSystemPromptSuffix(1)
    expect(suffix).toContain('the operator')
  })

  it('includes enterprise name when provided', () => {
    const suffix = buildWizardSystemPromptSuffix(3, { enterpriseName: 'Clearwater Cruisin' })
    expect(suffix).toContain('Clearwater Cruisin')
  })

  it('includes completed steps list', () => {
    const suffix = buildWizardSystemPromptSuffix(2, { completedSteps: [0, 1] })
    expect(suffix).toContain('Welcome')
    expect(suffix).toContain('Identity')
  })

  it('shows "none yet" when no steps completed', () => {
    const suffix = buildWizardSystemPromptSuffix(0, { completedSteps: [] })
    expect(suffix).toContain('none yet')
  })

  it('works for all valid steps 0-8', () => {
    for (let step = 0; step <= 8; step++) {
      const suffix = buildWizardSystemPromptSuffix(step)
      expect(suffix.length).toBeGreaterThan(0)
    }
  })
})

// ── getWizardStepName ──────────────────────────────────────────────────────────

describe('getWizardStepName', () => {
  it('returns "Welcome" for step 0', () => {
    expect(getWizardStepName(0)).toBe('Welcome')
  })

  it('returns "Identity" for step 1', () => {
    expect(getWizardStepName(1)).toBe('Identity')
  })

  it('returns "Federation" for step 8', () => {
    expect(getWizardStepName(8)).toBe('Federation')
  })

  it('returns "Step N" for an unknown step', () => {
    expect(getWizardStepName(99)).toBe('Step 99')
  })
})

// ── WIZARD_STEP_NAMES ─────────────────────────────────────────────────────────

describe('WIZARD_STEP_NAMES', () => {
  it('is an array', () => {
    expect(Array.isArray(WIZARD_STEP_NAMES)).toBe(true)
  })

  it('has 9 steps (0-8)', () => {
    expect(WIZARD_STEP_NAMES).toHaveLength(9)
  })

  it('starts with "Welcome"', () => {
    expect(WIZARD_STEP_NAMES[0]).toBe('Welcome')
  })

  it('ends with "Federation"', () => {
    expect(WIZARD_STEP_NAMES[8]).toBe('Federation')
  })
})
