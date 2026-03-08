/**
 * CIC Status Endpoint — GET /api/cic/status
 *
 * Command Information Center — real-time operational dashboard data feed.
 * Aggregates crew status, work queue depth, department readiness,
 * and platform health into a single response.
 *
 * Naval metaphor: This is the data that feeds the bridge's main viewscreen.
 * Every department reports status. The CIC officer synthesizes it all.
 *
 * Auth: Optional. Authenticated users get full details. Anonymous users get
 * aggregated public data (department counts, queue depth, federation status)
 * without PII (no names, emails, or assignee details).
 *
 * @see src/collections/CrewAssignments/index.ts — crew roster
 * @see src/collections/Intelligence/WorkUnits.ts — work queue
 * @see src/utilities/crew-routing-engine.ts — crew scoring
 */

import type { PayloadHandler } from 'payload'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'
import { fetchTenantByDomain } from '@/utilities/fetchTenantByDomain'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DepartmentStatus {
  department: string
  activeCount: number
  reserveCount: number
  totalCount: number
}

export interface WorkQueueStatus {
  pending: number
  claimed: number
  executing: number
  completed24h: number
  failed24h: number
  avgExecutionMs: number
}

export interface CrewReadiness {
  totalCrew: number
  activeDuty: number
  reserve: number
  shoreLeave: number
  detached: number
  departments: DepartmentStatus[]
}

export interface CICStatusResponse {
  endeavorName: string
  endeavorStatus: string
  timestamp: string
  crew: CrewReadiness
  workQueue: WorkQueueStatus
  federation: {
    networkVisible: boolean
    ministryStatus: string
    federationId: string | null
    lastPingAt: string | null
  }
  platforms: {
    name: string
    status: 'connected' | 'disconnected' | 'unknown'
    detail?: string
  }[]
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const cicStatusHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  // Auth is optional — anonymous users get aggregated public data
  const isAuthenticated = !!user

  // Resolve tenant — same chain as resolveTenantFromHeaders:
  // 1. x-tenant-id header (slug, from middleware for subdomain tenants)
  // 2. host header (domain-based lookup for platform domains like spacesangels.com)
  let tenantId: number | null = null
  const tenantSlug = req.headers.get('x-tenant-id')
  if (tenantSlug) {
    const tenant = await fetchTenantBySlug(tenantSlug)
    tenantId = tenant?.id ?? null
  }
  if (!tenantId) {
    const host = req.headers.get('host') || req.headers.get('x-forwarded-host')
    if (host) {
      const tenant = await fetchTenantByDomain(host)
      tenantId = tenant?.id ?? null
    }
  }
  if (!tenantId) {
    return Response.json({ error: 'Tenant context required' }, { status: 400 })
  }

  try {
    // ── Fetch Endeavor ─────────────────────────────────────────────
    const endeavors = await payload.find({
      collection: 'endeavors',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const endeavor = (endeavors.docs[0] as any) || null

    // ── Fetch Crew Assignments ─────────────────────────────────────
    const crewResult = await payload.find({
      collection: 'crew-assignments' as any,
      where: { tenant: { equals: tenantId } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    const crewDocs = crewResult.docs as any[]

    // Tally by duty status
    let activeDuty = 0
    let reserve = 0
    let shoreLeave = 0
    let detached = 0
    const deptCounts: Record<string, { active: number; reserve: number; total: number }> = {}

    for (const c of crewDocs) {
      const dept = c.department || 'operations'
      if (!deptCounts[dept]) deptCounts[dept] = { active: 0, reserve: 0, total: 0 }
      deptCounts[dept].total++

      switch (c.dutyStatus) {
        case 'active_duty':
          activeDuty++
          deptCounts[dept].active++
          break
        case 'reserve':
          reserve++
          deptCounts[dept].reserve++
          break
        case 'shore_leave':
          shoreLeave++
          break
        case 'detached':
          detached++
          break
      }
    }

    const departments: DepartmentStatus[] = Object.entries(deptCounts).map(
      ([department, counts]) => ({
        department,
        activeCount: counts.active,
        reserveCount: counts.reserve,
        totalCount: counts.total,
      }),
    )

    // ── Fetch Work Queue Status ────────────────────────────────────
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    // Current queue counts
    const [pendingResult, claimedResult, executingResult] = await Promise.all([
      payload.count({
        collection: 'work-units' as any,
        where: { status: { equals: 'pending' } },
        overrideAccess: true,
      }),
      payload.count({
        collection: 'work-units' as any,
        where: { status: { equals: 'claimed' } },
        overrideAccess: true,
      }),
      payload.count({
        collection: 'work-units' as any,
        where: { status: { equals: 'executing' } },
        overrideAccess: true,
      }),
    ])

    // 24h completed/failed
    const [completed24h, failed24h] = await Promise.all([
      payload.count({
        collection: 'work-units' as any,
        where: {
          status: { equals: 'completed' },
          completedAt: { greater_than: twentyFourHoursAgo },
        },
        overrideAccess: true,
      }),
      payload.count({
        collection: 'work-units' as any,
        where: {
          status: { equals: 'failed' },
          completedAt: { greater_than: twentyFourHoursAgo },
        },
        overrideAccess: true,
      }),
    ])

    // Average execution time (last 50 completed)
    const recentCompleted = await payload.find({
      collection: 'work-units' as any,
      where: {
        status: { equals: 'completed' },
        executionTimeMs: { greater_than: 0 },
      },
      sort: '-completedAt',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    const execTimes = (recentCompleted.docs as any[])
      .map((d) => d.executionTimeMs)
      .filter((t): t is number => typeof t === 'number' && t > 0)
    const avgExecutionMs =
      execTimes.length > 0
        ? Math.round(execTimes.reduce((a, b) => a + b, 0) / execTimes.length)
        : 0

    // ── Platform Health (basic checks) ─────────────────────────────
    const platforms: CICStatusResponse['platforms'] = []

    // Vercel — check if env vars suggest a Vercel deployment
    if (process.env.VERCEL || process.env.VERCEL_URL) {
      platforms.push({
        name: 'Vercel',
        status: 'connected',
        detail: process.env.VERCEL_URL || 'deployed',
      })
    }

    // Cloudflare — check if Workers are configured
    if (process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_API_TOKEN) {
      platforms.push({
        name: 'Cloudflare',
        status: 'connected',
        detail: 'Workers configured',
      })
    }

    // Cloudinary — check env
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      platforms.push({
        name: 'Cloudinary',
        status: 'connected',
        detail: `Cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`,
      })
    }

    // Stripe — check env
    if (process.env.STRIPE_SECRET_KEY) {
      platforms.push({ name: 'Stripe', status: 'connected' })
    }

    // ── Build Response ─────────────────────────────────────────────
    const response: CICStatusResponse = {
      endeavorName: endeavor?.name || 'Unknown Endeavor',
      endeavorStatus: endeavor?.status || 'unknown',
      timestamp: now.toISOString(),
      crew: {
        totalCrew: crewDocs.length,
        activeDuty,
        reserve,
        shoreLeave,
        detached,
        departments,
      },
      workQueue: {
        pending: pendingResult.totalDocs,
        claimed: claimedResult.totalDocs,
        executing: executingResult.totalDocs,
        completed24h: completed24h.totalDocs,
        failed24h: failed24h.totalDocs,
        avgExecutionMs,
      },
      federation: {
        networkVisible: endeavor?.federation?.networkVisible ?? false,
        ministryStatus: endeavor?.federation?.ministryStatus || 'unknown',
        federationId: endeavor?.federation?.federationId || null,
        lastPingAt: endeavor?.federation?.lastPingAt || null,
      },
      platforms,
    }

    // For anonymous users, strip platform connection details and internal URLs
    if (!isAuthenticated) {
      response.platforms = response.platforms.map((p) => ({
        name: p.name,
        status: p.status,
        // Omit 'detail' field which may contain internal URLs/cloud names
      }))
    }

    return Response.json(response)
  } catch (err: any) {
    return Response.json(
      { error: 'CIC status aggregation failed', detail: err?.message || String(err) },
      { status: 500 },
    )
  }
}
