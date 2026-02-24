/**
 * Federation Skills Endpoint — /api/federation/skills
 *
 * Two routes:
 *   GET  /api/federation/skills         — list available skills (public discovery)
 *   POST /api/federation/skills/invoke  — execute a skill (requires signing + trust)
 *
 * Skills are versioned, invocable capabilities that this diocese publishes
 * to the federation. Other agents call them via the federation client.
 *
 * Constitutional Reference:
 *   Article III (Agent Conduct) — agents operate within bounds
 *   Article II (Anti-Demonic) — no hidden actions, declared side effects
 */

import type { PayloadHandler } from 'payload'
import { verifyFederationRequest, createPeerLookup, type TrustRequirement } from '@/federation/trustGuard'
import { logFromVerification } from '@/federation/auditLog'
import { getDefaultSkills } from '@/federation/defaultSkills'
import { recordEarning } from '@/utilities/agentWallet'

// ── GET: List Skills ────────────────────────────────────────────────────────

export const federationSkillsListHandler: PayloadHandler = async (req) => {
  const skills = await getDefaultSkills()

  // Only return enabled skills with safe public info (no internals)
  const publicSkills = skills
    .filter((s) => s.enabled)
    .map((s) => ({
      name: s.name,
      version: s.version,
      description: s.description,
      inputSchema: s.inputSchema,
      outputSchema: s.outputSchema,
      costCents: s.costCents,
      rateLimit: s.rateLimit,
      requiresTrust: s.requiresTrust,
      category: s.category,
      safety: {
        canModifyUserData: s.safety.canModifyUserData,
        sideEffects: s.safety.sideEffects,
        disclosesAIOrigin: s.safety.disclosesAIOrigin,
        involvesHumanInteraction: s.safety.involvesHumanInteraction,
      },
    }))

  return Response.json({
    skills: publicSkills,
    diocese: 'Angel OS Instance',
    count: publicSkills.length,
  })
}

// ── POST: Invoke Skill ──────────────────────────────────────────────────────

export const federationSkillsInvokeHandler: PayloadHandler = async (req) => {
  const startTime = Date.now()

  // Parse body
  let rawBody: string
  let body: Record<string, unknown>
  try {
    rawBody = await (req as Request).text()
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { skill: skillName, params, callerFederationId } = body

  if (!skillName || typeof skillName !== 'string') {
    return Response.json({ success: false, error: 'Missing skill name' }, { status: 400 })
  }

  // Find the requested skill
  const skills = await getDefaultSkills()
  const skill = skills.find((s) => s.name === skillName && s.enabled)

  if (!skill) {
    return Response.json(
      { success: false, error: `Skill '${skillName}' not found or not enabled` },
      { status: 404 },
    )
  }

  // Verify federation request (trust guard)
  const requirement: TrustRequirement = {
    minimumTrust: skill.requiresTrust,
    action: 'skill_invoke',
  }

  const verification = await verifyFederationRequest(
    req.headers as unknown as Headers,
    rawBody,
    requirement,
    createPeerLookup(req.payload),
  )

  // Audit log (fire-and-forget)
  logFromVerification(req.payload, verification, 'skill_invoke', {
    targetAction: skillName,
    responseTimeMs: Date.now() - startTime,
    metadata: { params, callerFederationId },
  }).catch(() => {})

  if (!verification.verified) {
    const status = verification.reason.includes('Rate limit') ? 429 : 403
    return Response.json(
      {
        success: false,
        error: verification.reason,
        costCents: 0,
        executionTimeMs: Date.now() - startTime,
      },
      {
        status,
        headers: status === 429 ? { 'Retry-After': '60' } : {},
      },
    )
  }

  // Execute the skill
  try {
    // For now, skills return mock/simple results.
    // In Phase 4D, this will map to actual LEO tools internally.
    const result = await executeSkill(
      req.payload,
      skillName,
      (params as Record<string, unknown>) || {},
    )

    // Record earning if skill has a cost
    if (skill.costCents > 0 && callerFederationId) {
      const tenants = await req.payload.find({
        collection: 'tenants',
        limit: 1,
        depth: 0,
        overrideAccess: true,
        sort: 'createdAt',
      })
      const tenantId = tenants.docs[0]?.id as number | undefined
      if (tenantId) {
        await recordEarning(req.payload, tenantId, skill.costCents, `Skill: ${skillName}`, {
          sourceFederationId: callerFederationId as string,
          skillInvoked: skillName,
          skillCategory: skill.category,
        })
      }
    }

    return Response.json({
      success: true,
      result,
      costCents: skill.costCents,
      executionTimeMs: Date.now() - startTime,
    })
  } catch (err) {
    console.error(`[Federation Skills] Error executing ${skillName}:`, err)
    return Response.json(
      {
        success: false,
        error: `Skill execution failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        costCents: 0,
        executionTimeMs: Date.now() - startTime,
      },
      { status: 500 },
    )
  }
}

// ── Skill Execution ─────────────────────────────────────────────────────────

/**
 * Execute a named skill with params.
 * Maps skill names to actual Payload operations.
 */
async function executeSkill(
  payload: any,
  skillName: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  switch (skillName) {
    case 'search_catalog': {
      const q = (params.q as string) || ''
      const limit = Math.min((params.limit as number) || 10, 50)
      const products = await payload.find({
        collection: 'products',
        where: q ? { title: { contains: q } } : {},
        limit,
        depth: 0,
        overrideAccess: true,
      })
      return {
        products: products.docs.map((p: any) => ({
          id: p.id,
          title: p.title || p.name,
          price: p.price || p.basePrice,
          description: p.shortDescription || p.description,
        })),
        total: products.totalDocs,
      }
    }

    case 'search_events': {
      const limit = Math.min((params.limit as number) || 10, 50)
      const events = await payload.find({
        collection: 'events',
        limit,
        depth: 0,
        overrideAccess: true,
      })
      return {
        events: events.docs.map((e: any) => ({
          id: e.id,
          title: e.title || e.name,
          startDate: e.startDate,
          endDate: e.endDate,
        })),
        total: events.totalDocs,
      }
    }

    case 'check_availability': {
      const availability = await payload.find({
        collection: 'availability',
        limit: 20,
        depth: 0,
        overrideAccess: true,
      })
      return {
        slots: availability.docs,
        total: availability.totalDocs,
      }
    }

    default:
      return { message: `Skill '${skillName}' executed successfully (default handler)` }
  }
}
