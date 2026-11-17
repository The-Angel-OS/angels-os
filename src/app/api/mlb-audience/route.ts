import { NextResponse } from 'next/server'
import mlbArchive from '@/data/mlb-archive.json'

export const dynamic = 'force-dynamic'

interface PlatformItem {
  id: string
  name: string
  handle: string
  url: string
  color: string
  icon: string
  unit: string
  count: number
  rounded?: boolean
  status?: string
  gain28?: number | null
  updatedAt?: string
  checkedAt?: string
  message?: string | null
}

interface CachedDashboard {
  timestamp: number
  data: {
    platforms: PlatformItem[]
    views?: { total?: number }
    checkedAt?: string
    servedAt?: string
  }
}

let cache: CachedDashboard | null = null
const CACHE_TTL_MS = 8_000 // 8-second cache to prevent upstream hammering

export async function GET() {
  const now = Date.now()

  // Return fresh cache if within TTL
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    const totalAudience = cache.data.platforms.reduce((acc, p) => acc + (p.count || 0), 0)
    return NextResponse.json({
      ok: true,
      cached: true,
      totalAudience,
      ...cache.data,
    })
  }

  try {
    const upstreamUrl = `https://my-lunch-break-live.mjmkfttqvz.chatgpt.site/api/dashboard?t=${now}`
    const res = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'application/json',
      },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(6000),
    })

    if (res.ok) {
      const json = await res.json()
      if (json && Array.isArray(json.platforms) && json.platforms.length > 0) {
        cache = {
          timestamp: now,
          data: {
            platforms: json.platforms,
            views: json.views,
            checkedAt: json.checkedAt,
            servedAt: json.servedAt,
          },
        }

        const totalAudience = json.platforms.reduce(
          (acc: number, p: PlatformItem) => acc + (p.count || 0),
          0,
        )

        return NextResponse.json({
          ok: true,
          cached: false,
          totalAudience,
          ...cache.data,
        })
      }
    }
  } catch (err) {
    console.warn('[mlb-audience] Upstream polling failed, using fallback:', err)
  }

  // Fallback to cache if available
  if (cache) {
    const totalAudience = cache.data.platforms.reduce((acc, p) => acc + (p.count || 0), 0)
    return NextResponse.json({
      ok: true,
      cached: true,
      stale: true,
      totalAudience,
      ...cache.data,
    })
  }

  // Fallback to local mlb-archive.json dashboard
  const fallbackPlatforms = (mlbArchive as { dashboard?: { platforms?: PlatformItem[] } })?.dashboard?.platforms ?? []
  const totalAudience = fallbackPlatforms.reduce((acc, p) => acc + (p.count || 0), 0)

  return NextResponse.json({
    ok: true,
    cached: false,
    fallback: true,
    totalAudience,
    platforms: fallbackPlatforms,
    checkedAt: new Date().toISOString(),
  })
}
