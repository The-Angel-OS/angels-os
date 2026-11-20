'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { OldWorldAtlas, type AtlasArchiveData, type AtlasPlace } from '@/components/OldWorldAtlas'
import uapArchiveData from '@/data/uap-archive.json'

export const UAPGlobeAtlas: React.FC = () => {
  const staticData: AtlasArchiveData = useMemo(() => {
    const rawIncidents = (uapArchiveData.incidents || []) as Array<{
      id: string
      slug: string
      title: string
      category: string
      date: string
      year: number
      location: {
        name: string
        city: string
        state: string
        country: string
        latitude: number
        longitude: number
      }
      witnesses: string[]
      militaryUnits: string[]
      classification: string
      officialNarrative: string
      investigativeHypothesis: string
      anomalies: string[]
      sources: Array<{ title: string; url: string }>
    }>

    const places = rawIncidents.map((inc) => ({
      id: inc.id,
      name: `${inc.title} (${inc.year})`,
      city: inc.location.city || null,
      state: inc.location.state || null,
      country: inc.location.country || null,
      latitude: String(inc.location.latitude),
      longitude: String(inc.location.longitude),
      category: inc.category.replace(/_/g, ' ').toUpperCase(),
      existence: inc.classification,
      construction: String(inc.year),
      photo: null,
      sourceUrl: inc.sources?.[0]?.url || 'https://uap.spacesangels.com',
      description: `[${inc.classification}] ${inc.investigativeHypothesis}\n\n• Key Witnesses: ${inc.witnesses.join(', ')}\n• Military Units: ${inc.militaryUnits.join(', ')}\n• Anomalies: ${inc.anomalies.join('; ')}\n\nOfficial Statement: ${inc.officialNarrative}`,
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

  const [liveData, setLiveData] = useState<AtlasArchiveData>(staticData)

  useEffect(() => {
    fetch('/api/geo-posts?tenant=uap&limit=250')
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { places?: AtlasPlace[]; asOf?: string } | null) => {
        if (json?.places && json.places.length > 0) {
          setLiveData((prev) => ({
            ...prev,
            asOf: json.asOf || prev.asOf,
            places: json.places!,
          }))
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="w-full">
      <OldWorldAtlas
        initialData={liveData}
        showExcavationHero={false}
        showAudienceMonitor={false}
        showGlobeAndRecon={true}
        showCityScanner={false}
        allowFullscreen={true}
        mode="uap"
        title="ORBITAL RECON // GLOBAL UAP DECLASSIFIED ATLAS"
        subtitle="Interactive 3D Spy-Satellite Globe, Declassified Radar Intercepts, Crash Retrievals & Whistleblower Dossiers"
        missionBrief="ORBITAL RECON // DECLASSIFIED DISCLOSURE & TELEMETRY ARCHIVE"
        searchPlaceholder="Search declassified incidents, crash sites, radar locks, witnesses..."
      />
    </div>
  )
}
