/**
 * Work progress — /api/works-ops/progress
 *
 * GET  → the signed-in user's reading positions across ALL works (dashboard
 *        "your works in progress"), or one work's position with ?soulId=.
 * POST → upsert one work's position { soulId, chapterIdx, segIdx, percent }.
 *
 * Per-user, in the settings bag on the identity node (spacesangels), so progress
 * follows the person across portals and surfaces in their dashboard. Auth required.
 *
 * @see src/utilities/workProgress.ts
 */
import type { PayloadHandler } from 'payload'
import { getWorkProgress, setWorkProgress } from '@/utilities/workProgress'

export const workProgressHandler: PayloadHandler = async (req) => {
  const user = req.user as { id?: number | string } | null
  if (!user?.id) return Response.json({ error: 'auth required' }, { status: 401 })

  const method = (req as Request).method?.toUpperCase()

  if (method === 'GET') {
    const url = new URL(req.url || '', 'http://localhost')
    const soulId = url.searchParams.get('soulId')
    const map = await getWorkProgress(req.payload, user.id)
    if (soulId) return Response.json({ soulId, position: map[soulId] ?? null })
    return Response.json({ progress: map, count: Object.keys(map).length })
  }

  if (method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* validated below */
  }

  const soulId = typeof body.soulId === 'string' ? body.soulId.trim() : ''
  if (!soulId) return Response.json({ error: 'soulId is required' }, { status: 400 })

  const chapterIdx = Number(body.chapterIdx)
  const segIdx = Number(body.segIdx)
  if (!Number.isFinite(chapterIdx) || !Number.isFinite(segIdx)) {
    return Response.json({ error: 'chapterIdx and segIdx must be numbers' }, { status: 400 })
  }
  const percent = Number.isFinite(Number(body.percent)) ? Number(body.percent) : undefined

  const map = await setWorkProgress(req.payload, user.id, soulId, {
    chapterIdx: Math.max(0, Math.floor(chapterIdx)),
    segIdx: Math.max(0, Math.floor(segIdx)),
    ...(percent != null ? { percent } : {}),
  })

  return Response.json({ ok: true, soulId, position: map[soulId] })
}
