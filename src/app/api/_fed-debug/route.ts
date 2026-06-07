/**
 * TEMPORARY federation Discovery debug route — GET /api/_fed-debug
 *
 * Returns the exact per-peer fetch outcome (status, headers, body snippet,
 * error) for every visible federation peer, so we can see why cross-node
 * Discovery aggregation isn't surfacing a reachable peer. DELETE after diagnosis.
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await getPayload({ config: configPromise })

  let peers: Array<{ name?: string; domain?: string; ministryStatus?: string; networkVisible?: boolean }> = []
  try {
    const result = await payload.find({
      collection: 'federation-peers' as never,
      where: {
        and: [
          { networkVisible: { equals: true } },
          { ministryStatus: { in: ['active', 'probation', 'vouched', 'full'] } },
          { domain: { exists: true } },
        ],
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    peers = (result.docs as any[]).map((p) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      name: p.name,
      domain: p.domain,
      ministryStatus: p.ministryStatus,
      networkVisible: p.networkVisible,
    }))
  } catch (e) {
    return Response.json({ stage: 'peer-query', error: String(e) })
  }

  const results = []
  for (const peer of peers) {
    const domain = (peer.domain || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')
    const url = `https://${domain}/api/federation/holons?limit=100`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const startedAt = Date.now()
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { accept: 'application/json', 'user-agent': 'AngelOS-Federation/1.0' },
        cache: 'no-store',
      })
      const body = await res.text()
      let holonCount: number | null = null
      try {
        const j = JSON.parse(body)
        holonCount = Array.isArray(j.holons) ? j.holons.length : null
      } catch {
        /* not json */
      }
      results.push({
        domain,
        url,
        ms: Date.now() - startedAt,
        status: res.status,
        ok: res.ok,
        contentType: res.headers.get('content-type'),
        holonCount,
        bodySnippet: body.slice(0, 240),
      })
    } catch (err) {
      results.push({
        domain,
        url,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? `${err.name}: ${err.message}${(err as any).cause ? ` :: cause=${String((err as any).cause)}` : ''}` : String(err), // eslint-disable-line @typescript-eslint/no-explicit-any
      })
    } finally {
      clearTimeout(timer)
    }
  }

  return Response.json({ peerCount: peers.length, peers, results })
}
