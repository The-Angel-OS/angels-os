import React from 'react'
import type { Metadata } from 'next'
import { OldWorldAtlas, type AtlasArchiveData } from '@/components/OldWorldAtlas'
import mlbArchive from '@/data/mlb-archive.json'

export const metadata: Metadata = {
  title: 'Old World & Satan’s Little Season Spy-Satellite Atlas',
  description:
    'Interactive 3D Spy-Satellite Globe, Gleason Azimuthal Map, and Live City Historic Architecture Scanner featuring 250+ Old World structures and My Lunch Break episode dossiers.',
}

export default function AtlasPage() {
  return (
    <div className="container py-6">
      <OldWorldAtlas
        initialData={mlbArchive as unknown as AtlasArchiveData}
        showAudienceMonitor={true}
      />
    </div>
  )
}
