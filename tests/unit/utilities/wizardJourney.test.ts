/**
 * Unit tests for the Enterprise Setup Wizard (8-step onboarding journey).
 *
 * Tests the wizard prompt builder, step definitions, context handling,
 * and the complete journey from Welcome through Federation.
 *
 * @see src/utilities/wizardPrompt.ts
 */
import { describe, it, expect } from 'vitest'

import {
  buildWizardSystemPromptSuffix,
  type WizardContext,
} from '@/utilities/wizardPrompt'

// ---------------------------------------------------------------------------
// Step Definitions
// ---------------------------------------------------------------------------

describe('Enterprise Setup Wizard', () => {
  describe('step definitions', () => {
    it('has 9 steps (0 through 8)', () => {
      for (let step = 0; step <= 8; step++) {
        const suffix = buildWizardSystemPromptSuffix(step)
        expect(suffix.length).toBeGreaterThan(0)
      }
    })

    it('returns empty string for invalid step number', () => {
      expect(buildWizardSystemPromptSuffix(-1)).toBe('')
      expect(buildWizardSystemPromptSuffix(9)).toBe('')
      expect(buildWizardSystemPromptSuffix(99)).toBe('')
    })

    it('step 0 is Welcome', () => {
      const suffix = buildWizardSystemPromptSuffix(0)
      expect(suffix).toContain('Welcome')
      expect(suffix).toContain('step 0 of 8')
    })

    it('step 1 is Identity', () => {
      const suffix = buildWizardSystemPromptSuffix(1)
      expect(suffix).toContain('Identity')
      expect(suffix).toContain('step 1 of 8')
    })

    it('step 2 is Endeavor Type', () => {
      const suffix = buildWizardSystemPromptSuffix(2)
      expect(suffix).toContain('Endeavor Type')
      expect(suffix).toContain('step 2 of 8')
    })

    it('step 3 is First Space', () => {
      const suffix = buildWizardSystemPromptSuffix(3)
      expect(suffix).toContain('First Space')
      expect(suffix).toContain('step 3 of 8')
    })

    it('step 4 is First Member', () => {
      const suffix = buildWizardSystemPromptSuffix(4)
      expect(suffix).toContain('First Member')
      expect(suffix).toContain('step 4 of 8')
    })

    it('step 5 is First Offering', () => {
      const suffix = buildWizardSystemPromptSuffix(5)
      expect(suffix).toContain('First Offering')
      expect(suffix).toContain('step 5 of 8')
    })

    it('step 6 is Payments', () => {
      const suffix = buildWizardSystemPromptSuffix(6)
      expect(suffix).toContain('Payments')
      expect(suffix).toContain('step 6 of 8')
    })

    it('step 7 is Enlistment', () => {
      const suffix = buildWizardSystemPromptSuffix(7)
      expect(suffix).toContain('Enlistment')
      expect(suffix).toContain('step 7 of 8')
    })

    it('step 8 is Federation', () => {
      const suffix = buildWizardSystemPromptSuffix(8)
      expect(suffix).toContain('Federation')
      expect(suffix).toContain('step 8 of 8')
    })
  })

  // ---------------------------------------------------------------------------
  // Tool Associations
  // ---------------------------------------------------------------------------

  describe('tool associations per step', () => {
    it('step 0 (Welcome) has no tool call', () => {
      const suffix = buildWizardSystemPromptSuffix(0)
      expect(suffix).toContain('none')
    })

    it('step 1 (Identity) calls configure_business', () => {
      const suffix = buildWizardSystemPromptSuffix(1)
      expect(suffix).toContain('configure_business')
    })

    it('step 2 (Endeavor Type) calls configure_business', () => {
      const suffix = buildWizardSystemPromptSuffix(2)
      expect(suffix).toContain('configure_business')
    })

    it('step 3 (First Space) calls create_space', () => {
      const suffix = buildWizardSystemPromptSuffix(3)
      expect(suffix).toContain('create_space')
    })

    it('step 4 (First Member) calls invite_member', () => {
      const suffix = buildWizardSystemPromptSuffix(4)
      expect(suffix).toContain('invite_member')
    })

    it('step 5 (First Offering) calls create_product', () => {
      const suffix = buildWizardSystemPromptSuffix(5)
      expect(suffix).toContain('create_product')
    })

    it('step 6 (Payments) calls connect_stripe_account', () => {
      const suffix = buildWizardSystemPromptSuffix(6)
      expect(suffix).toContain('connect_stripe_account')
    })

    it('step 7 (Enlistment) calls complete_enlistment', () => {
      const suffix = buildWizardSystemPromptSuffix(7)
      expect(suffix).toContain('complete_enlistment')
    })

    it('step 8 (Federation) calls sign_constitution + ping_federation', () => {
      const suffix = buildWizardSystemPromptSuffix(8)
      expect(suffix).toContain('sign_constitution')
      expect(suffix).toContain('ping_federation')
    })
  })

  // ---------------------------------------------------------------------------
  // Context Injection
  // ---------------------------------------------------------------------------

  describe('wizard context injection', () => {
    it('includes operator name when provided', () => {
      const suffix = buildWizardSystemPromptSuffix(0, { operatorName: 'Kenneth' })
      expect(suffix).toContain('Kenneth')
    })

    it('defaults operator name to "the operator"', () => {
      const suffix = buildWizardSystemPromptSuffix(0, {})
      expect(suffix).toContain('the operator')
    })

    it('includes enterprise name when provided', () => {
      const suffix = buildWizardSystemPromptSuffix(2, {
        enterpriseName: 'Clearwater Cruisin',
      })
      expect(suffix).toContain('Clearwater Cruisin')
    })

    it('includes endeavor type when provided', () => {
      const suffix = buildWizardSystemPromptSuffix(3, {
        endeavorType: 'retail',
      })
      expect(suffix).toContain('retail')
    })

    it('lists completed step names', () => {
      const suffix = buildWizardSystemPromptSuffix(3, {
        completedSteps: [0, 1, 2],
      })
      expect(suffix).toContain('Welcome')
      expect(suffix).toContain('Identity')
      expect(suffix).toContain('Endeavor Type')
    })

    it('shows "none yet" when no steps completed', () => {
      const suffix = buildWizardSystemPromptSuffix(0, {
        completedSteps: [],
      })
      expect(suffix).toContain('none yet')
    })

    it('ignores invalid completed step numbers (filter produces empty)', () => {
      const suffix = buildWizardSystemPromptSuffix(0, {
        completedSteps: [99, 100],
      })
      // Invalid steps filter out, leaving empty join result
      // completedSteps.length > 0 is true, but all entries filter out
      expect(suffix).not.toContain('none yet')
      expect(suffix).toContain('Completed steps:')
    })
  })

  // ---------------------------------------------------------------------------
  // Content Quality
  // ---------------------------------------------------------------------------

  describe('wizard content quality', () => {
    it('all steps mention WIZARD MODE', () => {
      for (let step = 0; step <= 8; step++) {
        const suffix = buildWizardSystemPromptSuffix(step)
        expect(suffix).toContain('WIZARD MODE')
      }
    })

    it('all steps include pacing notes', () => {
      for (let step = 0; step <= 8; step++) {
        const suffix = buildWizardSystemPromptSuffix(step)
        expect(suffix).toContain('Pacing notes')
      }
    })

    it('all steps include wizard rules', () => {
      for (let step = 0; step <= 8; step++) {
        const suffix = buildWizardSystemPromptSuffix(step)
        expect(suffix).toContain('Wizard rules')
        expect(suffix).toContain('Stay on this step')
      }
    })

    it('uses correct terminology — Enterprise, Endeavor, Flagship', () => {
      for (let step = 0; step <= 8; step++) {
        const suffix = buildWizardSystemPromptSuffix(step)
        expect(suffix).toContain('Enterprise')
      }
    })

    it('mentions Flagship (Clearwater) in the terminology section', () => {
      const suffix = buildWizardSystemPromptSuffix(0)
      expect(suffix).toContain('Flagship')
      expect(suffix).toContain('Clearwater')
    })

    it('step 6 (Payments) mentions the 70/20/4/1/5 split', () => {
      const suffix = buildWizardSystemPromptSuffix(6)
      expect(suffix).toContain('70%')
      expect(suffix).toContain('20%')
    })

    it('step 7 (Federation) mentions Constitution', () => {
      const suffix = buildWizardSystemPromptSuffix(7)
      expect(suffix).toContain('Constitution')
    })
  })

  // ---------------------------------------------------------------------------
  // Full Journey Simulation
  // ---------------------------------------------------------------------------

  describe('full 9-step journey', () => {
    it('progresses through all steps with accumulating context', () => {
      const context: WizardContext = {
        operatorName: 'Kenneth',
        completedSteps: [],
      }

      // Step 0: Welcome
      let suffix = buildWizardSystemPromptSuffix(0, context)
      expect(suffix).toContain('Kenneth')
      expect(suffix).toContain('Welcome')
      context.completedSteps!.push(0)

      // Step 1: Identity
      suffix = buildWizardSystemPromptSuffix(1, context)
      expect(suffix).toContain('Identity')
      expect(suffix).toContain('Welcome') // completed step visible
      context.enterpriseName = 'Clearwater Cruisin'
      context.completedSteps!.push(1)

      // Step 2: Endeavor Type
      suffix = buildWizardSystemPromptSuffix(2, context)
      expect(suffix).toContain('Clearwater Cruisin')
      context.endeavorType = 'service'
      context.completedSteps!.push(2)

      // Step 3: First Space
      suffix = buildWizardSystemPromptSuffix(3, context)
      expect(suffix).toContain('service')
      context.completedSteps!.push(3)

      // Step 4: First Member
      suffix = buildWizardSystemPromptSuffix(4, context)
      context.completedSteps!.push(4)

      // Step 5: First Offering
      suffix = buildWizardSystemPromptSuffix(5, context)
      context.completedSteps!.push(5)

      // Step 6: Payments
      suffix = buildWizardSystemPromptSuffix(6, context)
      context.completedSteps!.push(6)

      // Step 7: Enlistment
      suffix = buildWizardSystemPromptSuffix(7, context)
      expect(suffix).toContain('complete_enlistment')
      expect(suffix).toContain('Welcome') // all completed steps visible
      expect(suffix).toContain('Identity')
      expect(suffix).toContain('Payments')
      context.completedSteps!.push(7)

      // Step 8: Federation
      suffix = buildWizardSystemPromptSuffix(8, context)
      expect(suffix).toContain('sign_constitution')
      expect(suffix).toContain('ping_federation')
      expect(suffix).toContain('Enlistment') // step 7 now completed
      context.completedSteps!.push(8)

      // All 9 steps completed
      expect(context.completedSteps).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    })
  })
})
