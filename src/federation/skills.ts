/**
 * Federation Skills Protocol — Type Definitions & Registry
 *
 * Skills are versioned, invocable capabilities that one Enterprise
 * publishes for other agents to call across the federation.
 *
 * Think of a skill as a "tool for agents" — like an MCP tool,
 * but invocable across the network with trust verification,
 * rate limiting, and economic settlement built in.
 *
 * Constitutional Reference:
 *   Article III (Agent Conduct) — agents operate within bounds, escalate to humans
 *   Article II (Anti-Demonic Safeguards) — no hidden actions, no manipulation
 *
 * Safety metadata is STRUCTURAL, not aspirational. Skills that modify data
 * must declare it. Skills with side effects must list them. Skills that
 * interact with humans carry anti-sycophancy constraints. The agent cannot
 * override these — they are part of the skill definition, not the agent's choice.
 */

import type { TrustLevel } from '@/utilities/federationEngine'

// ── Skill Definition ───────────────────────────────────────────────────────

export interface FederationSkill {
  /** Unique skill name (e.g., "search_catalog", "book_service") */
  name: string

  /** Semver version of this skill definition */
  version: string

  /** Human-readable description of what this skill does */
  description: string

  /** JSON Schema for the input parameters */
  inputSchema: Record<string, unknown>

  /** JSON Schema for the response */
  outputSchema: Record<string, unknown>

  /** Price per invocation in cents (0 = free) */
  costCents: number

  /** Maximum invocations per hour per calling Enterprise */
  rateLimit: number

  /** Minimum trust level required to invoke this skill */
  requiresTrust: TrustLevel

  /** Category for agent wallet spending rules */
  category: SkillCategory

  /** Safety metadata — STRUCTURAL, not optional */
  safety: SkillSafetyMetadata

  /** Whether this skill is currently published and available */
  enabled: boolean
}

// ── Safety Metadata ────────────────────────────────────────────────────────

/**
 * Constitutional safety metadata for federation skills.
 *
 * These constraints are STRUCTURAL — they are part of the skill definition
 * and enforced by the protocol. The calling agent cannot override them.
 * The providing agent cannot ignore them.
 *
 * Constitutional Reference:
 *   Article III — "Angels operate within bounds" → maxConsecutiveInteractions
 *   Article III — "Angels escalate to humans" → requiresHumanEscalation
 *   Article III — "Angels acknowledge AI nature" → disclosesAIOrigin
 *   Article II — "No hidden actions" → sideEffects must be declared
 *   Article II — "No manipulation" → canModifyUserData controls access
 */
export interface SkillSafetyMetadata {
  /**
   * Maximum consecutive interactions before requiring a pause or human check-in.
   * Prevents agent-to-agent runaway loops.
   * Article III: "Angels operate within the bounds of their Enterprise context."
   */
  maxConsecutiveInteractions?: number

  /**
   * If true, invoking this skill may trigger human escalation on the provider side.
   * The caller should expect a "pending_human_review" response.
   * Article III: "Angels escalate to humans when uncertain."
   */
  requiresHumanEscalation?: boolean

  /**
   * If true, this skill's output will identify itself as AI-generated.
   * Required for any skill that produces content shown to humans.
   * Article III: "Angels acknowledge their AI nature when sincerely asked."
   */
  disclosesAIOrigin?: boolean

  /**
   * If true, this skill can modify data (create, update, delete).
   * Skills with canModifyUserData=true require 'active' trust level minimum.
   * Article II: Least privilege — read-only by default.
   */
  canModifyUserData: boolean

  /**
   * Declared side effects of this skill.
   * Every change this skill makes must be listed here — no hidden actions.
   * Article II: "All actions observable."
   * Article IV: "The AI Bus is transparent by design."
   */
  sideEffects: string[]

  /**
   * If true, this skill involves direct interaction with end users (humans).
   * Triggers additional anti-sycophancy and dignity protections.
   * Article I: "Dignity: Every human being possesses inherent worth."
   */
  involvesHumanInteraction?: boolean
}

// ── Skill Categories ───────────────────────────────────────────────────────

export type SkillCategory =
  | 'catalog'         // Product/service browsing and search
  | 'booking'         // Appointment and service booking
  | 'content'         // Content creation and media generation
  | 'communication'   // Messaging, notifications
  | 'analytics'       // Reporting and insights
  | 'payment'         // Financial operations
  | 'moderation'      // Content moderation
  | 'infrastructure'  // System operations

// ── Skill Invocation ───────────────────────────────────────────────────────

export interface SkillInvocationRequest {
  skill: string
  params: Record<string, unknown>
  callerFederationId: string
  callerDomain: string
}

export interface SkillInvocationResponse {
  success: boolean
  result?: unknown
  costCents: number
  executionTimeMs: number
  error?: string
  /** If the skill requires human review, this will be set */
  pendingHumanReview?: boolean
}

// ── Spending Guardrails ────────────────────────────────────────────────────

/**
 * Agent wallet spending rules — structural limits the agent CANNOT override.
 *
 * These are set by the Enterprise operator, not by LEO itself.
 * "The agent cannot adjust its own guardrails."
 *
 * Constitutional Reference:
 *   Article I — "Sovereignty: Users own their data" (operator controls the wallet)
 *   Article II — "No automated punishment" (spending failures are graceful, not punitive)
 */
export interface SpendingGuardrails {
  /** Hard cap per single spend in cents (default: $10.00 = 1000) */
  maxPerTransactionCents: number

  /** Daily spending ceiling in cents (default: $50.00 = 5000) */
  maxDailySpendCents: number

  /** Monthly spending budget in cents (set on tenant) */
  monthlyBudgetCents: number

  /** Whitelist of skill categories LEO is allowed to spend on */
  allowedCategories: SkillCategory[]

  /**
   * Above this amount (in cents), LEO must ask the operator before spending.
   * Default: $5.00 = 500
   */
  humanApprovalThresholdCents: number
}

/** Default spending guardrails for new tenants */
export const DEFAULT_SPENDING_GUARDRAILS: SpendingGuardrails = {
  maxPerTransactionCents: 1000,    // $10.00
  maxDailySpendCents: 5000,        // $50.00
  monthlyBudgetCents: 10000,       // $100.00
  allowedCategories: ['catalog', 'booking', 'content', 'analytics'],
  humanApprovalThresholdCents: 500, // $5.00
}

// ── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate that a skill definition meets constitutional requirements.
 */
export function validateSkillDefinition(
  skill: FederationSkill,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!skill.name || skill.name.length === 0) {
    errors.push('Skill name is required')
  }

  if (!skill.version || !/^\d+\.\d+\.\d+$/.test(skill.version)) {
    errors.push('Skill version must be semver (e.g., 1.0.0)')
  }

  if (!skill.description || skill.description.length < 10) {
    errors.push('Skill description must be at least 10 characters')
  }

  // Constitutional: data-modifying skills need active trust
  if (skill.safety.canModifyUserData && skill.requiresTrust === 'none') {
    errors.push(
      'Skills that modify user data must require at least "probationary" trust level (Article II)',
    )
  }

  // Constitutional: side effects must be declared
  if (skill.safety.canModifyUserData && skill.safety.sideEffects.length === 0) {
    errors.push(
      'Skills that modify user data must declare their side effects (Article II: no hidden actions)',
    )
  }

  // Constitutional: human-facing skills must disclose AI origin
  if (skill.safety.involvesHumanInteraction && !skill.safety.disclosesAIOrigin) {
    errors.push(
      'Skills that interact with humans must disclose AI origin (Article III)',
    )
  }

  // Rate limit must be positive
  if (skill.rateLimit <= 0) {
    errors.push('Rate limit must be a positive number')
  }

  // Cost must be non-negative
  if (skill.costCents < 0) {
    errors.push('Cost cannot be negative')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Check if a spending request is within guardrails.
 */
export function checkSpendingGuardrails(
  guardrails: SpendingGuardrails,
  amountCents: number,
  category: SkillCategory,
  currentDailySpendCents: number,
  currentMonthlySpendCents: number,
): { allowed: boolean; reason?: string; requiresHumanApproval?: boolean } {
  // Check category whitelist
  if (!guardrails.allowedCategories.includes(category)) {
    return {
      allowed: false,
      reason: `Category '${category}' is not in the allowed spending categories`,
    }
  }

  // Check per-transaction limit
  if (amountCents > guardrails.maxPerTransactionCents) {
    return {
      allowed: false,
      reason: `Amount $${(amountCents / 100).toFixed(2)} exceeds per-transaction limit of $${(guardrails.maxPerTransactionCents / 100).toFixed(2)}`,
    }
  }

  // Check daily limit
  if (currentDailySpendCents + amountCents > guardrails.maxDailySpendCents) {
    return {
      allowed: false,
      reason: `Would exceed daily spending limit of $${(guardrails.maxDailySpendCents / 100).toFixed(2)} (already spent $${(currentDailySpendCents / 100).toFixed(2)} today)`,
    }
  }

  // Check monthly limit
  if (currentMonthlySpendCents + amountCents > guardrails.monthlyBudgetCents) {
    return {
      allowed: false,
      reason: `Would exceed monthly budget of $${(guardrails.monthlyBudgetCents / 100).toFixed(2)} (already spent $${(currentMonthlySpendCents / 100).toFixed(2)} this month)`,
    }
  }

  // Check if human approval is needed
  if (amountCents > guardrails.humanApprovalThresholdCents) {
    return {
      allowed: true,
      requiresHumanApproval: true,
      reason: `Amount $${(amountCents / 100).toFixed(2)} exceeds human approval threshold of $${(guardrails.humanApprovalThresholdCents / 100).toFixed(2)}`,
    }
  }

  return { allowed: true }
}
