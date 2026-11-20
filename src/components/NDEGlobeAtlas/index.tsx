'use client'

import React, { useMemo } from 'react'
import { OldWorldAtlas, type AtlasArchiveData } from '@/components/OldWorldAtlas'
import ndeArchiveData from '@/data/nde-archive.json'

export const NDEGlobeAtlas: React.FC = () => {
  const ndeData: AtlasArchiveData = useMemo(() => {
    const rawRecords = (ndeArchiveData.records || []) as Array<{
      id: string
      slug: string
      title: string
      category: string
      eraWindow: string
      recordedYear: number
      blindnessRating: string
      leadingPromptScore: number
      historicalDeviationScore: number
      researcher: string
      sourceType: string
      location: {
        name: string
        city: string
        state: string
        country: string
        latitude: number
        longitude: number
      }
      summary: string
      anomalyMarkers: string[]
      sources: Array<{ title: string; url: string }>
    }>

    const places = rawRecords.map((rec) => ({
      id: rec.id,
      name: `${rec.title}`,
      city: rec.location.city || null,
      state: rec.location.state || null,
      country: rec.location.country || null,
      latitude: String(rec.location.latitude),
      longitude: String(rec.location.longitude),
      category: rec.category,
      existence: `${rec.blindnessRating.replace(/_/g, ' ')} · ERA: ${rec.eraWindow}`,
      construction: String(rec.recordedYear),
      photo: null,
      sourceUrl: rec.sources?.[0]?.url || 'https://nde.spacesangels.com',
      description: `${rec.summary}\n\n• Researcher / Archive: ${rec.researcher}\n• Blindness Rating: ${rec.blindnessRating} (Leading-Prompt Risk: ${rec.leadingPromptScore}/10)\n• Historical Deviation Score: ${rec.historicalDeviationScore}/10\n• Key Markers: ${rec.anomalyMarkers.join('; ')}`,
      status: 'current',
    }))

    return {
      asOf: new Date().toISOString(),
      places,
      episodes: [],
      appearances: [],
      fires: [],
      dashboard: {
        platforms: [],
        views: [],
        latestVideo: null,
        latestPost: null,
      },
    }
  }, [])

  return (
    <div className="w-full">
      <OldWorldAtlas
        initialData={ndeData}
        showExcavationHero={false}
        showAudienceMonitor={false}
        showGlobeAndRecon={true}
        showCityScanner={false}
        allowFullscreen={true}
        mode="nde"
        title="CONSCIOUSNESS RECON // NDE & PAST-LIFE ANOMALY ATLAS"
        subtitle="Cross-Referencing Pre-2018 Blind Hypnotic Regressions, NDERF Accounts & 1700–1850 Historical Outliers"
        missionBrief="CONSCIOUSNESS ARCHIVE // PRE-2018 BLIND REGRESSION & NDE ANOMALY INDEX"
        searchPlaceholder="Search regressions, NDEs, researchers (Wambach, Cannon, Cayce, Stevenson, NDERF)..."
      />
    </div>
  )
}
