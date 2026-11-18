import React from 'react'
import { OldWorldAtlas } from '@/components/OldWorldAtlas'
import { UAPGlobeAtlas } from '@/components/UAPGlobeAtlas'

export interface GlobeAtlasBlockProps {
  id?: string
  blockType?: 'globeAtlas'
  mode?: 'old_world' | 'uap' | string | null
  heading?: string | null
  subheading?: string | null
  searchPlaceholder?: string | null
  primaryLayerLabel?: string | null
  showCityScanner?: boolean | null
  allowFullscreen?: boolean | null
  showAudienceMonitor?: boolean | null
  showExcavationHero?: boolean | null
  showGlobeAndRecon?: boolean | null
  defaultShader?: 'optical' | 'flir' | 'thermal' | 'blueprint' | string | null
}

export const GlobeAtlasBlockComponent: React.FC<GlobeAtlasBlockProps> = ({
  mode = 'old_world',
  heading,
  subheading,
  searchPlaceholder,
  primaryLayerLabel,
  showCityScanner,
  allowFullscreen = true,
  showAudienceMonitor,
  showExcavationHero,
  showGlobeAndRecon = true,
}) => {
  if (mode === 'uap') {
    return (
      <section className="container my-8">
        <UAPGlobeAtlas />
      </section>
    )
  }

  return (
    <section className="container my-8">
      <OldWorldAtlas
        title={heading || undefined}
        subtitle={subheading || undefined}
        searchPlaceholder={searchPlaceholder || undefined}
        primaryLayerLabel={primaryLayerLabel || undefined}
        showCityScanner={showCityScanner !== undefined && showCityScanner !== null ? showCityScanner : undefined}
        allowFullscreen={Boolean(allowFullscreen)}
        showAudienceMonitor={Boolean(showAudienceMonitor)}
        showExcavationHero={Boolean(showExcavationHero)}
        showGlobeAndRecon={Boolean(showGlobeAndRecon)}
      />
    </section>
  )
}
