import React from 'react'
import Link from 'next/link'
import mlbArchive from '@/data/mlb-archive.json'

interface EpisodeNavigatorProps {
  currentSlug: string
  currentTitle: string
  sourceUrl?: string | null
}

/**
 * Elegant My Lunch Break / Series Episode Navigator
 *
 * Renders on `/posts/[slug]` when viewing an episode post (matching `ep-<num>`
 * or `EP <num>` or a matching YouTube video URL in `mlb-archive.json`).
 * Shows:
 *   - Previous / Next Episode buttons
 *   - Featured Old World Structures investigated in this episode (with 1-click
 *     links to open them in the Spy-Satellite Atlas `/atlas`)
 *   - Quick Episode Jump selector
 */
export const EpisodeNavigator: React.FC<EpisodeNavigatorProps> = ({
  currentSlug,
  currentTitle,
  sourceUrl,
}) => {
  // Determine episode number from slug (`ep-196...`) or title (`EP 196...`) or sourceUrl
  const slugMatch = currentSlug.match(/^ep-(\d+)/i)
  const titleMatch = currentTitle.match(/\bEP(?:ISODE)?\s*#?(\d+)\b/i)
  const epNumFromSlugOrTitle = slugMatch
    ? parseInt(slugMatch[1], 10)
    : titleMatch
      ? parseInt(titleMatch[1], 10)
      : null

  const episodesWithVideo = mlbArchive.episodes
    .filter((e): e is (typeof mlbArchive.episodes)[number] & { number: number } => typeof e.number === 'number')
    .sort((a, b) => a.number - b.number)

  // Deduplicate by episode number
  const byNumber = new Map<number, (typeof episodesWithVideo)[number]>()
  for (const ep of episodesWithVideo) {
    const existing = byNumber.get(ep.number)
    if (!existing || (!existing.videoUrl && ep.videoUrl)) {
      byNumber.set(ep.number, ep)
    }
  }
  const orderedEpisodes = Array.from(byNumber.values()).sort((a, b) => a.number - b.number)

  const currentEp =
    (epNumFromSlugOrTitle ? byNumber.get(epNumFromSlugOrTitle) : undefined) ||
    (sourceUrl
      ? orderedEpisodes.find((e) => e.videoUrl && sourceUrl.includes(e.videoUrl.split('v=')[1] || '__'))
      : undefined)

  if (!currentEp) return null

  const currentIndex = orderedEpisodes.findIndex((e) => e.number === currentEp.number)
  const prevEp = currentIndex > 0 ? orderedEpisodes[currentIndex - 1] : null
  const nextEp =
    currentIndex >= 0 && currentIndex < orderedEpisodes.length - 1
      ? orderedEpisodes[currentIndex + 1]
      : null

  // Find all historic places featured in this episode
  const epKeys = new Set([`ep:${currentEp.number}`, currentEp.id])
  const featuredAppearances = mlbArchive.appearances.filter((a) => epKeys.has(a.episodeId))
  const placeMap = new Map(mlbArchive.places.map((p) => [p.id, p]))
  const featuredPlaces = featuredAppearances
    .map((a) => ({
      place: placeMap.get(a.placeId),
      evidence: a.evidence,
      importance: a.importance,
    }))
    .filter((x): x is { place: NonNullable<typeof x.place>; evidence: string; importance: string } =>
      Boolean(x.place),
    )

  return (
    <div className="container my-8">
      <div className="rounded-xl border border-amber-500/30 bg-[#080c14] p-5 text-slate-100 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="rounded bg-amber-500 px-2.5 py-0.5 font-mono text-xs font-bold text-slate-950">
              EPISODE #{currentEp.number}
            </span>
            <span className="font-mono text-xs uppercase tracking-wider text-amber-400">
              MY LUNCH BREAK · INVESTIGATION NAVIGATOR
            </span>
          </div>

          <Link
            href="/atlas"
            className="rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 font-mono text-xs text-cyan-300 hover:bg-cyan-500/20"
          >
            🛰 Open 3D Spy-Satellite Globe &amp; Building Tracker →
          </Link>
        </div>

        {/* Previous / Next Episode Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prevEp ? (
            <Link
              href={`/posts/ep-${prevEp.number}`}
              className="group flex flex-col justify-between rounded-lg border border-slate-800 bg-[#0c121f] p-3 hover:border-amber-500/50"
            >
              <span className="font-mono text-[11px] text-slate-400 group-hover:text-amber-300">
                ◀ PREVIOUS INVESTIGATION (EP #{prevEp.number})
              </span>
              <span className="mt-1 text-sm font-semibold text-white truncate">{prevEp.title}</span>
            </Link>
          ) : (
            <div className="rounded-lg border border-slate-900 bg-slate-950/40 p-3 text-xs font-mono text-slate-600">
              Beginning of recorded episode archive
            </div>
          )}

          {nextEp ? (
            <Link
              href={`/posts/ep-${nextEp.number}`}
              className="group flex flex-col justify-between rounded-lg border border-slate-800 bg-[#0c121f] p-3 text-right hover:border-amber-500/50"
            >
              <span className="font-mono text-[11px] text-slate-400 group-hover:text-amber-300">
                NEXT INVESTIGATION (EP #{nextEp.number}) ▶
              </span>
              <span className="mt-1 text-sm font-semibold text-white truncate">{nextEp.title}</span>
            </Link>
          ) : (
            <div className="rounded-lg border border-slate-900 bg-slate-950/40 p-3 text-right text-xs font-mono text-slate-600">
              Latest recorded episode in archive
            </div>
          )}
        </div>

        {/* Featured Historic Structures in This Episode */}
        {featuredPlaces.length > 0 && (
          <div className="border-t border-slate-800 pt-3">
            <div className="mb-2 font-mono text-xs uppercase tracking-wider text-cyan-400">
              🏛 STRUCTURES INVESTIGATED IN EPISODE #{currentEp.number} ({featuredPlaces.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {featuredPlaces.map(({ place, evidence }) => (
                <div
                  key={place.id}
                  className="rounded-lg border border-slate-800 bg-[#0b101b] p-3 space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-amber-400">
                    <span>{place.category}</span>
                    <span>
                      {[place.city, place.country].filter(Boolean).join(', ')}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white">{place.name}</div>
                  {evidence && (
                    <p className="text-[11px] italic text-slate-400 line-clamp-2">
                      &ldquo;{evidence}&rdquo;
                    </p>
                  )}
                  <div className="flex items-center gap-3 pt-1 text-[11px] font-mono">
                    <Link href="/atlas" className="text-cyan-400 hover:underline">
                      🛰 Locate on Globe
                    </Link>
                    {place.sourceUrl && (
                      <a
                        href={place.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:underline"
                      >
                        Wikipedia ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
