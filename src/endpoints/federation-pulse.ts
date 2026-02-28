/**
 * Federation Pulse — GET /api/federation/pulse
 *
 * Live vital signs of the federation organism. Returns a real-time snapshot
 * of node health, work flow, quest activity, and pheromone trail strength.
 *
 * This is the heartbeat made visible — the single endpoint that answers
 * "is this thing alive?" with data.
 *
 * Response: {
 *   timestamp: string,
 *   pulse: { alive: boolean, strength: number },
 *   nodes: { active: number, total: number, healthy: number },
 *   workUnits: { executing: number, pending: number, completed24h: number, failed24h: number },
 *   quests: { active: number, completed24h: number, totalParticipants: number },
 *   pheromones: { activeTrails: number, avgStrength: number, strongestPath: string | null },
 *   capacity: { avgLoad: number, backpressure: boolean, totalSlots: number, usedSlots: number },
 * }
 *
 * Auth: Requires authentication (federation data is tenant-scoped).
 * Rate: 'default' (60/min) — read-only, cheap queries.
 *
 * @see src/utilities/federationEngine.ts — trust levels, health checks
 * @see src/utilities/pheromone-engine.ts — trail strength
 * @see src/utilities/workload-engine.ts — capacity scoring
 */
import type { PayloadHandler } from 'payload'
import { applyRateLimit } from '@/utilities/apiRateLimiter'

/** Max heartbeat age in seconds before a node is considered unhealthy */
const MAX_HEARTBEAT_AGE_SECONDS = 300

export const federationPulseHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rateLimited = applyRateLimit(req, 'default')
  if (rateLimited) return rateLimited

  try {
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // ── Parallel queries — maximize speed ────────────────────────────
    const [
      endeavorsResult,
      activeWorkResult,
      completedWorkResult,
      failedWorkResult,
      activeQuestsResult,
      completedQuestsResult,
      pheromonesResult,
    ] = await Promise.all([
      // 1. Federation nodes — all with federationId
      payload.find({
        collection: 'endeavors' as any,
        where: {
          'federation.federationId': { exists: true },
        },
        depth: 0,
        limit: 200,
        overrideAccess: true,
      }),

      // 2. Active work units (pending + claimed + executing)
      payload.find({
        collection: 'work-units' as any,
        where: {
          status: { in: ['pending', 'claimed', 'executing'] },
        },
        depth: 0,
        limit: 0, // just count
        overrideAccess: true,
      }),

      // 3. Completed work units in last 24h
      payload.find({
        collection: 'work-units' as any,
        where: {
          and: [
            { status: { equals: 'completed' } },
            { completedAt: { greater_than_equal: twentyFourHoursAgo.toISOString() } },
          ],
        },
        depth: 0,
        limit: 0,
        overrideAccess: true,
      }),

      // 4. Failed work units in last 24h
      payload.find({
        collection: 'work-units' as any,
        where: {
          and: [
            { status: { in: ['failed', 'timeout'] } },
            { updatedAt: { greater_than_equal: twentyFourHoursAgo.toISOString() } },
          ],
        },
        depth: 0,
        limit: 0,
        overrideAccess: true,
      }),

      // 5. Active quest participations
      payload.find({
        collection: 'quest-participations' as any,
        where: {
          status: { in: ['accepted', 'in_progress', 'submitted', 'under_review'] },
        },
        depth: 0,
        limit: 0,
        overrideAccess: true,
      }),

      // 6. Completed quests in last 24h
      payload.find({
        collection: 'quest-participations' as any,
        where: {
          and: [
            { status: { in: ['approved', 'paid'] } },
            { completedAt: { greater_than_equal: twentyFourHoursAgo.toISOString() } },
          ],
        },
        depth: 0,
        limit: 0,
        overrideAccess: true,
      }),

      // 7. Active pheromone trails (strength > 5)
      payload.find({
        collection: 'pheromones' as any,
        where: {
          strength: { greater_than: 5 },
        },
        depth: 0,
        limit: 100,
        sort: '-strength',
        overrideAccess: true,
      }),
    ])

    // ── Compute node health ────────────────────────────────────────
    const nodes = endeavorsResult.docs as any[]
    let healthyCount = 0
    let totalCapacitySlots = 0
    let usedCapacitySlots = 0

    for (const node of nodes) {
      const lastPing = node.federation?.lastPingAt
      if (lastPing) {
        const ageSeconds = (now.getTime() - new Date(lastPing).getTime()) / 1000
        if (ageSeconds <= MAX_HEARTBEAT_AGE_SECONDS) {
          healthyCount++
        }
      }

      // Parse capacity snapshot if available
      const cap = node.federation?.capacitySnapshot
      if (cap && typeof cap === 'object') {
        const max = typeof cap.maxConcurrent === 'number' ? cap.maxConcurrent : 0
        const active = typeof cap.activeWorkUnits === 'number' ? cap.activeWorkUnits : 0
        totalCapacitySlots += max
        usedCapacitySlots += active
      }
    }

    // ── Compute pheromone stats ─────────────────────────────────────
    const trails = pheromonesResult.docs as any[]
    const activeTrails = trails.length
    const avgStrength =
      activeTrails > 0
        ? Math.round(trails.reduce((sum: number, t: any) => sum + (t.strength || 0), 0) / activeTrails)
        : 0
    const strongestTrail = trails.length > 0 ? trails[0] : null

    // ── Compute work unit breakdown ─────────────────────────────────
    const activeWork = activeWorkResult.docs as any[]
    const executing = activeWork.filter((w: any) => w.status === 'executing').length
    const pending = activeWork.filter((w: any) => w.status === 'pending' || w.status === 'claimed').length

    // ── Compute pulse strength (0-100) ──────────────────────────────
    // Composite metric: node health + work activity + quest engagement + trail vitality
    const nodeHealthRatio = nodes.length > 0 ? healthyCount / nodes.length : 0
    const workActivity = Math.min(1, (executing + pending) / Math.max(1, totalCapacitySlots))
    const questEngagement = Math.min(1, activeQuestsResult.totalDocs / Math.max(1, nodes.length * 5))
    const trailVitality = Math.min(1, avgStrength / 50)

    const pulseStrength = Math.round(
      nodeHealthRatio * 40 + // 40% weight: nodes alive
      workActivity * 25 +    // 25% weight: work flowing
      questEngagement * 20 + // 20% weight: quests active
      trailVitality * 15     // 15% weight: pheromone health
    )

    // ── Compute capacity + backpressure ─────────────────────────────
    const avgLoad = totalCapacitySlots > 0
      ? Math.round((usedCapacitySlots / totalCapacitySlots) * 100)
      : 0
    const backpressure = avgLoad > 85

    return Response.json({
      timestamp: now.toISOString(),
      pulse: {
        alive: healthyCount > 0,
        strength: pulseStrength,
      },
      nodes: {
        active: healthyCount,
        total: nodes.length,
        healthy: healthyCount,
      },
      workUnits: {
        executing,
        pending,
        completed24h: completedWorkResult.totalDocs,
        failed24h: failedWorkResult.totalDocs,
      },
      quests: {
        active: activeQuestsResult.totalDocs,
        completed24h: completedQuestsResult.totalDocs,
        totalParticipants: activeQuestsResult.totalDocs,
      },
      pheromones: {
        activeTrails,
        avgStrength,
        strongestPath: strongestTrail?.path || null,
      },
      capacity: {
        avgLoad,
        backpressure,
        totalSlots: totalCapacitySlots,
        usedSlots: usedCapacitySlots,
      },
    })
  } catch (err) {
    console.error('[Federation Pulse] Error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch federation pulse' },
      { status: 500 },
    )
  }
}
