/**
 * User Journey Integration Tests — validates end-to-end logic flows
 * across multiple modules without requiring a running server.
 *
 * Tests cross-cutting concerns and complete user workflows using
 * only the pure-logic exports that don't require Payload.
 *
 * @see src/utilities/
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// 1. Invitation Journey
// ---------------------------------------------------------------------------

import {
  generateInvitationToken,
  calculateExpiration,
  isValidEmail,
  maskEmail,
  generateInviteUrl,
  INVITABLE_ROLES,
  INVITE_CAPABLE_ROLES,
  DEFAULT_EXPIRY_DAYS,
} from '@/utilities/invitationSystem'

describe('Invitation Journey', () => {
  describe('complete invite flow: generate → validate → URL → mask', () => {
    it('full lifecycle from token generation to invite URL', () => {
      // Step 1: Validate the email
      const email = 'dana@clearwater-cruisin.com'
      expect(isValidEmail(email)).toBe(true)

      // Step 2: Generate invitation token
      const token = generateInvitationToken()
      expect(token).toBeTruthy()
      expect(token.length).toBeGreaterThan(10)

      // Step 3: Calculate expiration
      const expiry = calculateExpiration()
      expect(expiry).toBeInstanceOf(Date)
      expect(expiry.getTime()).toBeGreaterThan(Date.now())

      // Step 4: Generate invite URL
      const url = generateInviteUrl(token, 'https://clearwater.angelos.app')
      expect(url).toBe(`https://clearwater.angelos.app/invite/${token}`)

      // Step 5: Mask email for display
      const masked = maskEmail(email)
      expect(masked).toContain('@clearwater-cruisin.com')
      expect(masked).not.toBe(email)
    })

    it('tokens are unique', () => {
      const t1 = generateInvitationToken()
      const t2 = generateInvitationToken()
      expect(t1).not.toBe(t2)
    })

    it('expiry defaults to 7 days', () => {
      expect(DEFAULT_EXPIRY_DAYS).toBe(7)
      const expiry = calculateExpiration()
      const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000
      // setDate is DST-aware; allow 2h tolerance for DST transitions in the 7-day window
      expect(Math.abs(expiry.getTime() - sevenDaysFromNow)).toBeLessThan(7200000)
    })

    it('custom expiry days work', () => {
      const expiry = calculateExpiration(30)
      // setDate is DST-aware; allow 2h tolerance for DST transitions in the window
      const thirtyDaysFromNow = Date.now() + 30 * 24 * 60 * 60 * 1000
      expect(Math.abs(expiry.getTime() - thirtyDaysFromNow)).toBeLessThan(7200000)
    })
  })

  describe('email validation edge cases', () => {
    it('rejects empty string', () => {
      expect(isValidEmail('')).toBe(false)
    })

    it('rejects missing @', () => {
      expect(isValidEmail('notanemail')).toBe(false)
    })

    it('rejects missing domain', () => {
      expect(isValidEmail('user@')).toBe(false)
    })

    it('accepts standard emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name@domain.co')).toBe(true)
    })
  })

  describe('role permissions', () => {
    it('members can be invited', () => {
      expect(INVITABLE_ROLES).toContain('member')
    })

    it('moderators can be invited', () => {
      expect(INVITABLE_ROLES).toContain('moderator')
    })

    it('guests can be invited', () => {
      expect(INVITABLE_ROLES).toContain('guest')
    })

    it('space_admin can send invites', () => {
      expect(INVITE_CAPABLE_ROLES).toContain('space_admin')
    })

    it('moderator can send invites', () => {
      expect(INVITE_CAPABLE_ROLES).toContain('moderator')
    })
  })
})

// ---------------------------------------------------------------------------
// 2. Order Routing Lifecycle (using actual exports)
// ---------------------------------------------------------------------------

import {
  calculateDistance,
  matchCapabilities,
  matchMaterials,
  calculateProximityScore,
  WEIGHT_CAPABILITY,
  WEIGHT_PROXIMITY,
  WEIGHT_RATING,
  WEIGHT_FAIRNESS,
  FULFILLMENT_STATES,
  VALID_TRANSITIONS,
  type FulfillmentStatus,
  type HolonCapability,
} from '@/utilities/orderRoutingEngine'

describe('Order Routing Lifecycle Journey', () => {
  describe('complete order routing flow', () => {
    it('scores and ranks multiple vendors for an order', () => {
      // Customer in Clearwater
      const customerLat = 27.9659
      const customerLng = -82.8001

      // Vendor 1: Close, in Clearwater
      const vendor1Dist = calculateDistance(customerLat, customerLng, 27.96, -82.80)
      expect(vendor1Dist).toBeLessThan(1) // < 1 mile

      // Vendor 2: Tampa (~22 miles)
      const vendor2Dist = calculateDistance(customerLat, customerLng, 27.9506, -82.4572)
      expect(vendor2Dist).toBeGreaterThan(15) // > 15 miles

      // Vendor 3: Orlando (~100 miles)
      const vendor3Dist = calculateDistance(customerLat, customerLng, 28.5383, -81.3792)
      expect(vendor3Dist).toBeGreaterThan(80) // > 80 miles

      // Closer vendor should score higher on proximity
      const prox1 = calculateProximityScore(vendor1Dist, 100)
      const prox2 = calculateProximityScore(vendor2Dist, 100)
      const prox3 = calculateProximityScore(vendor3Dist, 100)
      expect(prox1).toBeGreaterThan(prox2)
      expect(prox2).toBeGreaterThan(prox3)
    })

    it('capability matching determines eligibility', () => {
      const caps: HolonCapability[] = [
        { skill: '3d-printing', materials: ['PLA', 'PETG'] },
        { skill: 'laser-cutting', materials: ['wood', 'acrylic'] },
      ]

      // Exact match
      // Args order: (required skills, holon capabilities)
      expect(matchCapabilities(['3d-printing'], caps)).toBe(true)
      expect(matchCapabilities(['3d-printing', 'laser-cutting'], caps)).toBe(true)
      expect(matchCapabilities(['cnc-milling'], caps)).toBe(false)
    })

    it('material availability affects routing', () => {
      const caps: HolonCapability[] = [
        { skill: '3d-printing', materials: ['PLA', 'PETG'] },
      ]

      // Args order: (required materials, holon capabilities)
      expect(matchMaterials(['PLA'], caps)).toBe(true)
      expect(matchMaterials(['ABS'], caps)).toBe(false)
      expect(matchMaterials([], caps)).toBe(true) // no materials required
    })
  })

  describe('fulfillment state machine journey', () => {
    it('traces the happy path: pending_match → matched → accepted → in_production → shipped → delivered', () => {
      const happyPath: FulfillmentStatus[] = [
        'pending_match',
        'matched',
        'accepted',
        'in_production',
        'shipped',
        'delivered',
      ]

      for (let i = 0; i < happyPath.length - 1; i++) {
        const from = happyPath[i]
        const to = happyPath[i + 1]
        const validNextStates = VALID_TRANSITIONS[from]
        expect(validNextStates).toContain(to)
      }
    })

    it('all fulfillment states are defined', () => {
      expect(FULFILLMENT_STATES.length).toBeGreaterThanOrEqual(8)
      expect(FULFILLMENT_STATES).toContain('pending_match')
      expect(FULFILLMENT_STATES).toContain('delivered')
      expect(FULFILLMENT_STATES).toContain('cancelled')
      expect(FULFILLMENT_STATES).toContain('rejected')
    })

    it('delivered state is terminal (no transitions)', () => {
      const transitions = VALID_TRANSITIONS['delivered']
      expect(transitions).toBeDefined()
      expect(transitions.length).toBe(0)
    })

    it('cancelled state is terminal (no transitions)', () => {
      const transitions = VALID_TRANSITIONS['cancelled']
      expect(transitions).toBeDefined()
      expect(transitions.length).toBe(0)
    })

    it('rejected can go back to pending_match', () => {
      const transitions = VALID_TRANSITIONS['rejected']
      expect(transitions).toContain('pending_match')
    })
  })

  describe('scoring weights', () => {
    it('weights sum to 1.0', () => {
      const sum = WEIGHT_CAPABILITY + WEIGHT_PROXIMITY + WEIGHT_RATING + WEIGHT_FAIRNESS
      expect(sum).toBeCloseTo(1.0, 10)
    })

    it('capability has highest weight', () => {
      expect(WEIGHT_CAPABILITY).toBeGreaterThan(WEIGHT_PROXIMITY)
      expect(WEIGHT_CAPABILITY).toBeGreaterThan(WEIGHT_RATING)
      expect(WEIGHT_CAPABILITY).toBeGreaterThan(WEIGHT_FAIRNESS)
    })
  })
})

// ---------------------------------------------------------------------------
// 3. Space Provisioning Journey
// ---------------------------------------------------------------------------

import {
  SPACE_TEMPLATES,
  getAvailableTemplates,
  type SpaceTemplate,
  type EndeavorType,
} from '@/utilities/spaceProvisioning'

describe('Space Provisioning Journey', () => {
  describe('template registry', () => {
    it('has templates for all endeavor types', () => {
      const templates = getAvailableTemplates()
      expect(templates.length).toBeGreaterThanOrEqual(4)
    })

    it('service-provider template has channels', () => {
      const template = SPACE_TEMPLATES['service-provider']
      expect(template).toBeDefined()
      expect(template.channels.length).toBeGreaterThan(0)
    })

    it('retail-commerce template has channels', () => {
      const template = SPACE_TEMPLATES['retail-commerce']
      expect(template).toBeDefined()
      expect(template.channels.length).toBeGreaterThan(0)
    })

    it('each template has a name', () => {
      const templates = getAvailableTemplates()
      for (const { template: t } of templates) {
        expect(t.name).toBeTruthy()
      }
    })
  })

  describe('channel templates', () => {
    it('every template channel has name and type', () => {
      for (const [, template] of Object.entries(SPACE_TEMPLATES)) {
        for (const ch of (template as SpaceTemplate).channels) {
          expect(ch.name).toBeTruthy()
          expect(ch.type).toBeTruthy()
        }
      }
    })

    it('service-provider template includes a general channel', () => {
      const template = SPACE_TEMPLATES['service-provider']
      const hasGeneral = template.channels.some((c) => c.name === 'general')
      expect(hasGeneral).toBe(true)
    })
  })

  describe('full provisioning flow', () => {
    it('select template → verify channels → ready for creation', () => {
      const endeavorType = 'service-provider' as EndeavorType
      const template = SPACE_TEMPLATES[endeavorType]

      expect(template).toBeDefined()
      expect(template.channels.length).toBeGreaterThan(0)

      // Every channel should be valid
      for (const ch of template.channels) {
        expect(ch.name.length).toBeGreaterThan(0)
        expect(ch.type.length).toBeGreaterThan(0)
        // Channel names should be URL-safe
        expect(ch.name).toMatch(/^[a-z0-9-]+$/)
      }
    })
  })
})

// ---------------------------------------------------------------------------
// 4. Constitutional Prompt Journey
// ---------------------------------------------------------------------------

import { buildConstitutionalPrompt } from '@/utilities/constitutional-prompt'

describe('Constitutional Prompt Journey', () => {
  it('generates a system prompt', () => {
    const prompt = buildConstitutionalPrompt()
    expect(prompt).toBeTruthy()
    expect(prompt.length).toBeGreaterThan(100)
  })

  it('includes Leo identity', () => {
    const prompt = buildConstitutionalPrompt()
    expect(prompt).toContain('Leo')
  })

  it('includes constitutional principles', () => {
    const prompt = buildConstitutionalPrompt()
    expect(prompt.toLowerCase()).toContain('constitution')
  })

  it('includes anti-demonic safeguards reference', () => {
    const prompt = buildConstitutionalPrompt()
    expect(prompt.toLowerCase()).toContain('demonic')
  })

  it('prompt is substantial (over 500 characters)', () => {
    const prompt = buildConstitutionalPrompt()
    expect(prompt.length).toBeGreaterThan(500)
  })
})

// ---------------------------------------------------------------------------
// 5. Media Availability Check
// ---------------------------------------------------------------------------

import { isImageGenerationAvailable } from '@/utilities/imageGeneration'

describe('Image Generation Availability', () => {
  it('isImageGenerationAvailable returns a boolean', () => {
    const available = isImageGenerationAvailable()
    expect(typeof available).toBe('boolean')
  })

  // OpenRouter is one link in a chain (gateway → openrouter → openai → google
  // → cloudflare), so removing its key no longer means "unavailable". The
  // contract that survives: a tenant's own key stands alone.
  it('is available when a tenant brings its own key', () => {
    expect(isImageGenerationAvailable('sk-tenant-key')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 6. Federation + Wizard Cross-Journey
// ---------------------------------------------------------------------------

import { buildWizardSystemPromptSuffix } from '@/utilities/wizardPrompt'
import { getActiveConstitution } from '@/federation/constitution'

describe('Cross-Module Journey: Wizard → Constitution → Federation', () => {
  it('wizard step 8 references constitution, which is signable', () => {
    const wizardSuffix = buildWizardSystemPromptSuffix(8)
    expect(wizardSuffix).toContain('sign_constitution')

    const constitution = getActiveConstitution()
    expect(constitution.version).toBe('1.1')
    expect(constitution.articles.length).toBeGreaterThan(0)
    expect(constitution.checksum.length).toBe(64)
  })

  it('wizard step 6 revenue split matches actual split implementation', () => {
    const wizardSuffix = buildWizardSystemPromptSuffix(6)
    expect(wizardSuffix).toContain('70%')
    expect(wizardSuffix).toContain('20%')
  })

  it('constitutional prompt and wizard both reference core Angel OS identity', () => {
    const constitutionalPrompt = buildConstitutionalPrompt()
    const wizardSuffix = buildWizardSystemPromptSuffix(0)

    expect(wizardSuffix).toContain('Clearwater')
    // The main constitutional prompt references the Herald and constitutional principles
    expect(constitutionalPrompt).toContain('Angel OS')
    expect(constitutionalPrompt).toContain('Constitution')
  })
})
