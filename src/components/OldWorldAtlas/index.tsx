'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import rawLandmassPolygons from '@/data/world-landmass.json'

const landmassPolygons = rawLandmassPolygons as number[][][]

import { DonkeyExcavationHero } from '@/components/mlb/DonkeyExcavationHero'
import { AudienceScoreboard } from '@/components/mlb/AudienceScoreboard'

interface AtlasPlace {
  id: string
  name: string
  city: string | null
  state: string | null
  country: string | null
  latitude: string
  longitude: string
  category: string
  existence: string
  construction: string | null
  photo: string | null
  photoCredit?: string | null
  sourceUrl: string | null
  description: string
  status: string
  isLiveScan?: boolean
}

export interface AtlasEpisode {
  id: string
  number: number
  title: string
  videoUrl: string | null
  publishedAt: string | null
  status: string
}

export interface AtlasAppearance {
  id: string
  placeId: string
  episodeId: string
  importance: string
  evidence: string
  timestamp: string | null
  status: string
}

export interface AtlasFire {
  id: string
  building: string
  city: string
  country: string
  year: number
  description: string
  latitude: number
  longitude: number
  locationSource?: string
  sourceUrls?: string[]
  verificationStatus?: string
  episodeFeatures?: Array<{
    episodes?: Array<{ number: number; title: string; videoUrl?: string }>
    placeId?: string
  }>
}

export interface AtlasPlatform {
  id: string
  name: string
  handle: string
  url: string
  color: string
  icon: string
  unit: string
  count: number
  gain28: number | null
  sinceTracking: number | null
  status: string
}

export interface AtlasArchiveData {
  asOf: string
  places: AtlasPlace[]
  episodes: AtlasEpisode[]
  appearances: AtlasAppearance[]
  fires: AtlasFire[]
  dashboard: {
    platforms: AtlasPlatform[]
    views: Array<{ platform: string; count: number | null }>
    latestVideo: {
      id: string
      title: string
      url: string
      published: string
      thumbnail: string
    } | null
    latestPost: {
      id: string
      text: string
      url: string
      published: string
      image?: string
    } | null
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  Religious: '#f59e0b',
  Government: '#38bdf8',
  'Museum & Library': '#a855f7',
  'Castle & Palace': '#eab308',
  Underground: '#10b981',
  'Dam & Submerged': '#06b6d4',
  'Monument & Archaeology': '#f97316',
  Other: '#94a3b8',
}

const UAP_CATEGORY_COLORS: Record<string, string> = {
  'CRASH RETRIEVAL': '#ef4444',
  'NUCLEAR SILO INCURSION': '#eab308',
  'RADAR & FLIR TELEMETRY': '#06b6d4',
  'AVIATOR / PILOT LOCK': '#3b82f6',
  'MASS SIGHTING': '#a855f7',
  'PHYSICAL / SOIL TRACE': '#10b981',
  'UNDERGROUND / BLACK SITE': '#f97316',
  Other: '#94a3b8',
}

export interface AtlasQuickSector {
  label: string
  lat: number
  lon: number
  zoom: number
  city: string
}

export interface AtlasGlobalLayer {
  key: string
  label: string
}

const QUICK_SECTORS: AtlasQuickSector[] = [
  { label: '📍 Clearwater, FL (1933 Post Office)', lat: 27.9656, lon: -82.7959, zoom: 14, city: 'Clearwater, FL' },
  { label: '📍 Tampa, FL (1891 Plant Palace)', lat: 27.9467, lon: -82.4639, zoom: 14, city: 'Tampa, FL' },
  { label: '📍 Mumbai, India (Victoria Terminus)', lat: 18.9401, lon: 72.8355, zoom: 14, city: 'Mumbai, India' },
  { label: '📍 St. Petersburg, FL', lat: 27.7725, lon: -82.6386, zoom: 14, city: 'St. Petersburg, FL' },
  { label: '📍 San Diego (Balboa Park)', lat: 32.7314, lon: -117.1453, zoom: 15, city: 'San Diego, CA' },
  { label: '📍 Chicago (World’s Fair)', lat: 41.7905, lon: -87.5806, zoom: 13, city: 'Chicago, IL' },
  { label: '📍 Istanbul (Old World)', lat: 41.0082, lon: 28.9784, zoom: 14, city: 'Istanbul' },
  { label: '📍 London, UK', lat: 51.5074, lon: -0.1278, zoom: 13, city: 'London' },
]

const UAP_QUICK_SECTORS: AtlasQuickSector[] = [
  { label: '🛸 Roswell / Corona, NM (1947)', lat: 34.0537, lon: -105.3406, zoom: 11, city: 'Corona, NM' },
  { label: '🛸 USS Nimitz / Pacific (2004)', lat: 31.42, lon: -117.88, zoom: 9, city: 'Pacific Ocean (San Diego)' },
  { label: '☢️ Malmstrom AFB, MT (1967)', lat: 47.505, lon: -111.183, zoom: 12, city: 'Great Falls, MT' },
  { label: '🌲 Rendlesham Forest, UK (1980)', lat: 52.09, lon: 1.43, zoom: 12, city: 'Suffolk, UK' },
  { label: '🛸 Varginha, Brazil (1996)', lat: -21.551, lon: -45.43, zoom: 12, city: 'Varginha, Brazil' },
  { label: '⚡ Tehran F-4 Intercept (1976)', lat: 35.6892, lon: 51.389, zoom: 11, city: 'Tehran, Iran' },
  { label: '🏫 Ariel School, Zimbabwe (1994)', lat: -17.805, lon: 31.332, zoom: 12, city: 'Ruwa, Zimbabwe' },
  { label: '🛸 Kecksburg Acorn, PA (1965)', lat: 40.1833, lon: -79.4628, zoom: 12, city: 'Kecksburg, PA' },
  { label: '🛸 Phoenix Lights, AZ (1997)', lat: 33.4484, lon: -112.074, zoom: 10, city: 'Phoenix, AZ' },
  { label: '☢️ Minot AFB, ND (1975)', lat: 48.4156, lon: -101.358, zoom: 12, city: 'Minot, ND' },
]

const GLOBAL_LAYERS: AtlasGlobalLayer[] = [
  { key: 'train_stations', label: '🚂 Old World Grand Train Stations' },
  { key: 'cathedrals', label: '⛪ World Cathedrals & Basilicas' },
  { key: 'carnegie', label: '📚 Carnegie Libraries Worldwide' },
  { key: 'nrhp_landmarks', label: '🏛 U.S. Historic Landmarks (NRHP)' },
  { key: 'star_forts', label: '🏰 Star Forts & Citadels' },
  { key: 'asylums', label: '🏥 Kirkbride Asylums' },
]

const UAP_GLOBAL_LAYERS: AtlasGlobalLayer[] = [
  { key: 'crash_retrievals', label: '💥 Crash Retrievals & Debris' },
  { key: 'nuclear_silos', label: '☢️ Nuclear Silo Incursions' },
  { key: 'military_radar', label: '📡 Military Radar & FLIR' },
  { key: 'pilot_locks', label: '✈️ Aviator Locks (Navy/USAF)' },
  { key: 'mass_sightings', label: '👁 Mass Eyewitness Clusters' },
  { key: 'underground_facilities', label: '⛰ Subterranean Facilities & Black Sites' },
]

const NDE_CATEGORY_COLORS: Record<string, string> = {
  '1700-1850 BASELINE': '#94a3b8',
  'LOST ARCHITECTURE / ENERGY': '#10b981',
  'CATACLYSM / RESET MEMORY': '#ef4444',
  'NDE HALL OF RECORDS': '#06b6d4',
  'NDE PAST-LIFE FLASH': '#a855f7',
  'UVA VERIFIED CHILD CASE': '#3b82f6',
  'PRE-2018 BLIND OUTLIER': '#f59e0b',
  Other: '#94a3b8',
}

const NDE_QUICK_SECTORS: AtlasQuickSector[] = [
  { label: '🏛 Alexandria / Med (Cannon QHHT)', lat: 31.2001, lon: 29.9187, zoom: 7, city: 'Alexandria' },
  { label: '🌊 Bimini / Atlantic (Cayce)', lat: 25.728, lon: -79.297, zoom: 8, city: 'Alice Town' },
  { label: '🇬🇧 London 1700 Cohort (Wambach)', lat: 51.5074, lon: -0.1278, zoom: 7, city: 'London' },
  { label: '🇺🇸 St. Louis 1850 Cohort (Wambach)', lat: 38.627, lon: -90.1994, zoom: 7, city: 'St. Louis' },
  { label: '🇮🇪 Belfast 1798 (Bridey Murphy)', lat: 54.5973, lon: -5.9301, zoom: 8, city: 'Belfast' },
  { label: '🇮🇳 Mathura (Stevenson / Shanti Devi)', lat: 27.4924, lon: 77.6737, zoom: 8, city: 'Mathura' },
  { label: '🇫🇷 Paris 1985 (Howard Storm NDE)', lat: 48.8376, lon: 2.3404, zoom: 8, city: 'Paris' },
  { label: '🇺🇸 Houma, LA (NDERF HQ)', lat: 29.5958, lon: -90.7195, zoom: 7, city: 'Houma' },
]

const NDE_GLOBAL_LAYERS: AtlasGlobalLayer[] = [
  { key: 'nde_baseline_1700', label: '📜 1700–1850 Baselines (Wambach)' },
  { key: 'nde_lost_arch', label: '🏛 Lost Architecture / Energy' },
  { key: 'nde_cataclysm', label: '🌊 Cataclysm / Reset Memories' },
  { key: 'nde_hall_records', label: '💫 NDE Hall of Records' },
  { key: 'nde_past_flash', label: '✨ NDE Past-Life Flashes' },
  { key: 'nde_uva_child', label: '👶 UVA Verified Child Cases' },
]

const MILESTONES = [
  1_500_000, 2_000_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000,
]

export interface OldWorldAtlasProps {
  initialData?: AtlasArchiveData
  showExcavationHero?: boolean
  showAudienceMonitor?: boolean
  showGlobeAndRecon?: boolean
  title?: string
  subtitle?: string
  missionBrief?: string
  mode?: 'old_world' | 'uap' | 'nde' | 'jon_levi' | 'custom'
  searchPlaceholder?: string
  primaryLayerLabel?: string
  categoryColors?: Record<string, string>
  quickSectors?: AtlasQuickSector[]
  globalLayers?: AtlasGlobalLayer[]
  showCityScanner?: boolean
  allowFullscreen?: boolean
  blogArchiveLink?: {
    href: string
    label: string
  }
}

export const OldWorldAtlas: React.FC<OldWorldAtlasProps> = ({
  initialData,
  showExcavationHero = true,
  showAudienceMonitor = true,
  showGlobeAndRecon = true,
  title,
  subtitle,
  missionBrief,
  mode = 'old_world',
  searchPlaceholder,
  primaryLayerLabel,
  categoryColors,
  quickSectors,
  globalLayers,
  showCityScanner,
  allowFullscreen = true,
  blogArchiveLink,
}) => {
  const activeTitle =
    title ||
    (mode === 'uap'
      ? 'ORBITAL RECON // GLOBAL UAP DECLASSIFIED ATLAS'
      : mode === 'nde'
        ? 'CONSCIOUSNESS RECON // NDE & PAST-LIFE ANOMALY ATLAS'
        : 'SPY SATELLITE // OLD WORLD & TARTARIA ARCHIVE')

  const activeSubtitle =
    subtitle ||
    (mode === 'uap'
      ? 'Interactive 3D Spy-Satellite Globe, Declassified Radar Intercepts, Crash Retrievals & Whistleblower Dossiers'
      : mode === 'nde'
        ? 'Cross-Referencing Pre-2018 Blind Hypnotic Regressions, NDERF Accounts & 1700–1850 Historical Outliers'
        : 'Orbital Reconnaissance, Historic Architecture City Scanner & Satan’s Little Season Investigation Index')

  const activeMissionBrief =
    missionBrief ||
    (mode === 'uap'
      ? 'ORBITAL RECON // DECLASSIFIED DISCLOSURE & TELEMETRY ARCHIVE'
      : mode === 'nde'
        ? 'CONSCIOUSNESS ARCHIVE // PRE-2018 BLIND REGRESSION & NDE ANOMALY INDEX'
        : "ORBITAL RECON // SATAN'S LITTLE SEASON & OLD WORLD ARCHIVE")

  const effectiveShowCityScanner =
    showCityScanner !== undefined ? showCityScanner : mode === 'old_world'

  const activeCategoryColors = useMemo(() => {
    if (categoryColors) return categoryColors
    if (mode === 'uap') return UAP_CATEGORY_COLORS
    if (mode === 'nde') return NDE_CATEGORY_COLORS
    return CATEGORY_COLORS
  }, [categoryColors, mode])

  const activeQuickSectors = useMemo(() => {
    if (quickSectors && quickSectors.length > 0) return quickSectors
    if (mode === 'uap') return UAP_QUICK_SECTORS
    if (mode === 'nde') return NDE_QUICK_SECTORS
    return QUICK_SECTORS
  }, [quickSectors, mode])

  const activeLayersList = useMemo(() => {
    if (globalLayers && globalLayers.length > 0) return globalLayers
    if (mode === 'uap') return UAP_GLOBAL_LAYERS
    if (mode === 'nde') return NDE_GLOBAL_LAYERS
    return GLOBAL_LAYERS
  }, [globalLayers, mode])

  const [data, setData] = useState<AtlasArchiveData | null>(initialData ?? null)
  const [scannedPlaces, setScannedPlaces] = useState<AtlasPlace[]>([])
  const [activeGlobalLayers, setActiveGlobalLayers] = useState<Record<string, boolean>>({})
  const [showMlbLayer, setShowMlbLayer] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState<string | null>(null)
  const [scanCityInput, setScanCityInput] = useState(mode === 'uap' ? 'Roswell, NM' : 'Tampa, FL')
  const [scanFilter, setScanFilter] = useState('all')

  // Fullscreen / Maximize states
  const [isMaximized, setIsMaximized] = useState(false)
  const [collapseDossierInMax, setCollapseDossierInMax] = useState(false)

  // Listen to Escape key to exit maximized mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMaximized) {
        setIsMaximized(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMaximized])

  // View & HUD states
  const [viewMode, setViewMode] = useState<'globe' | 'recon' | 'gleason'>('globe')
  const [shaderMode, setShaderMode] = useState<'optical' | 'flir' | 'thermal' | 'blueprint'>('optical')
  const [focusMode, setFocusMode] = useState(false)
  const [showMilestones, setShowMilestones] = useState(false)
  const [selectedMilestone, setSelectedMilestone] = useState(2_000_000)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>('ALL')
  const [selectedExistence, setSelectedExistence] = useState<string>('ALL')

  // Selected Place Dossier
  const [selectedPlace, setSelectedPlace] = useState<AtlasPlace | null>(null)
  const [imgError, setImgError] = useState(false)

  // Reset img error on place change
  useEffect(() => {
    setImgError(false)
  }, [selectedPlace?.id])

  // Camera state (shared between Globe & Recon Map) - default to panoramic least zoom showing US and transatlantic pins
  const [camera, setCamera] = useState<{ lat: number; lon: number; zoom: number }>({
    lat: 28,
    lon: -50,
    zoom: 3.2,
  })

  // Fetch initial archive if not passed as prop
  useEffect(() => {
    if (data) return
    fetch('/api/atlas')
      .then((r) => r.json())
      .then((json: AtlasArchiveData) => {
        setData(json)
        if (json.places?.length) {
          const defaultPlace = json.places.find((p) => p.id === 'Q54109') || json.places[0]
          setSelectedPlace(defaultPlace)
        }
      })
      .catch(() => {})
  }, [data])

  // Select US Capitol by default once loaded (card preview only, preserve least zoom)
  useEffect(() => {
    if (data?.places?.length && !selectedPlace) {
      const defaultPlace = data.places.find((p) => p.id === 'Q54109') || data.places[0]
      setSelectedPlace(defaultPlace)
    }
  }, [data, selectedPlace])

  // Combine built-in places + live scanned places (deduplicated)
  const allPlaces = useMemo(() => {
    const base = showMlbLayer ? data?.places ?? [] : []
    const seen = new Set(base.map((p) => p.id))
    return [...scannedPlaces.filter((p) => !seen.has(p.id)), ...base]
  }, [data?.places, scannedPlaces, showMlbLayer])

  const toggleGlobalLayer = useCallback(
    async (layerKey: string) => {
      if (mode === 'uap' || mode === 'nde') {
        const categoryMap: Record<string, string> = {
          crash_retrievals: 'CRASH RETRIEVAL',
          nuclear_silos: 'NUCLEAR SILO INCURSION',
          military_radar: 'RADAR & FLIR TELEMETRY',
          pilot_locks: 'AVIATOR / PILOT LOCK',
          mass_sightings: 'MASS SIGHTING',
          underground_facilities: 'UNDERGROUND / BLACK SITE',
          nde_baseline_1700: '1700-1850 BASELINE',
          nde_lost_arch: 'LOST ARCHITECTURE / ENERGY',
          nde_cataclysm: 'CATACLYSM / RESET MEMORY',
          nde_hall_records: 'NDE HALL OF RECORDS',
          nde_past_flash: 'NDE PAST-LIFE FLASH',
          nde_uva_child: 'UVA VERIFIED CHILD CASE',
        }
        const targetCat = categoryMap[layerKey]
        if (targetCat) {
          const isCurrentlyActive = Boolean(activeGlobalLayers[layerKey])
          setActiveGlobalLayers((prev) => ({
            ...prev,
            [layerKey]: !isCurrentlyActive,
          }))
          setSelectedCategory((curr) => (curr === targetCat ? 'ALL' : targetCat))
          return
        }
      }

      const currentlyOn = Boolean(activeGlobalLayers[layerKey])
      if (currentlyOn) {
        setActiveGlobalLayers((prev) => ({ ...prev, [layerKey]: false }))
        setScannedPlaces((prev) => prev.filter((p) => !p.id.startsWith(`layer-${layerKey}-`)))
        return
      }
      setActiveGlobalLayers((prev) => ({ ...prev, [layerKey]: true }))
      setIsScanning(true)
      setScanStatus(`Loading global layer: ${layerKey.replace('_', ' ')}...`)
      try {
        const res = await fetch(`/api/atlas?globalLayer=${encodeURIComponent(layerKey)}`)
        const json = (await res.json()) as { places?: AtlasPlace[] }
        if (json.places?.length) {
          setScannedPlaces((prev) => {
            const ids = new Set(prev.map((p) => p.id))
            return [...json.places!.filter((p) => !ids.has(p.id)), ...prev]
          })
          setScanStatus(`Loaded +${json.places.length} global pins for ${layerKey.replace('_', ' ')}.`)
        }
      } catch {
        setScanStatus('Could not load global layer.')
      } finally {
        setIsScanning(false)
      }
    },
    [activeGlobalLayers],
  )

  // Map episodeId -> episode object
  const episodeMap = useMemo(() => {
    const m = new Map<string, AtlasEpisode>()
    for (const ep of data?.episodes ?? []) {
      m.set(ep.id, ep)
      if (ep.number) m.set(`ep:${ep.number}`, ep)
    }
    return m
  }, [data?.episodes])

  // Map placeId -> appearances
  const appearancesByPlace = useMemo(() => {
    const m = new Map<string, AtlasAppearance[]>()
    for (const app of data?.appearances ?? []) {
      const list = m.get(app.placeId) ?? []
      list.push(app)
      m.set(app.placeId, list)
    }
    return m
  }, [data?.appearances])

  // Filtered places
  const filteredPlaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return allPlaces.filter((p) => {
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false
      if (selectedExistence === 'standing' && p.existence !== 'standing') return false
      if (selectedExistence === 'lost' && p.existence === 'standing') return false
      if (selectedEpisodeId !== 'ALL') {
        const apps = appearancesByPlace.get(p.id) ?? []
        if (!apps.some((a) => a.episodeId === selectedEpisodeId)) return false
      }
      if (q) {
        const hay = `${p.name} ${p.city || ''} ${p.state || ''} ${p.country || ''} ${p.category || ''} ${p.description || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [allPlaces, searchQuery, selectedCategory, selectedExistence, selectedEpisodeId, appearancesByPlace])

  // Live City / Sector Scan handler
  const runSectorScan = useCallback(
    async (opts: { city?: string; lat?: number; lon?: number; radiusKm?: number }) => {
      setIsScanning(true)
      setScanStatus('Uplinking to Wikidata & National Historic Register...')
      try {
        const params = new URLSearchParams()
        if (opts.city) params.set('scanCity', opts.city)
        if (opts.lat != null && opts.lon != null) {
          params.set('lat', String(opts.lat))
          params.set('lon', String(opts.lon))
        }
        params.set('radiusKm', String(opts.radiusKm ?? 30))
        params.set('filter', scanFilter)

        const res = await fetch(`/api/atlas?${params.toString()}`)
        const json = (await res.json()) as {
          center: { lat: number; lon: number; label: string } | null
          places: AtlasPlace[]
        }

        if (json.places?.length) {
          setScannedPlaces((prev) => {
            const ids = new Set(prev.map((p) => p.id))
            return [...json.places.filter((p) => !ids.has(p.id)), ...prev]
          })
          if (json.center) {
            setCamera({ lat: json.center.lat, lon: json.center.lon, zoom: 13 })
          }
          setSelectedPlace(json.places[0])
          setScanStatus(`Acquired ${json.places.length} historic structures in ${json.center?.label || 'sector'}.`)
        } else {
          setScanStatus('No additional registered structures found in that sector filter.')
        }
      } catch {
        setScanStatus('Satellite telemetry link interrupted — try again.')
      } finally {
        setIsScanning(false)
      }
    },
    [scanFilter],
  )

  const flyToPlace = useCallback((place: AtlasPlace, switchRecon = false) => {
    setSelectedPlace(place)
    const lat = parseFloat(place.latitude)
    const lon = parseFloat(place.longitude)
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      setCamera({ lat, lon, zoom: 15 })
    }
    if (switchRecon) {
      setViewMode('recon')
    }
  }, [])

  // ── 3D Spy-Satellite Globe Canvas Renderer ──────────────────────────────────
  const globeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number; lat: number; lon: number }>({
    x: 0,
    y: 0,
    lat: 27.95,
    lon: -82.62,
  })
  const projectedPinsRef = useRef<Array<{ x: number; y: number; r: number; place: AtlasPlace }>>([])

  // Keep cameraRef in sync with camera state for fresh reads inside touch callbacks
  const cameraRef = useRef(camera)
  useEffect(() => {
    cameraRef.current = camera
  }, [camera])
  const pinchStartRef = useRef<{ dist: number; zoom: number }>({ dist: 0, zoom: 12 })

  useEffect(() => {
    if (viewMode !== 'globe' && viewMode !== 'gleason') return
    const canvas = globeCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const cx = w / 2
    const cy = h / 2
    const radius = Math.min(w, h) * 0.41 * Math.max(0.85, Math.min(camera.zoom / 3.2, 2.6))

    ctx.clearRect(0, 0, w, h)

    // Background starfield / grid
    ctx.fillStyle =
      shaderMode === 'blueprint' ? '#07192f' : shaderMode === 'flir' ? '#031409' : '#06090f'
    ctx.fillRect(0, 0, w, h)

    const primaryStroke =
      shaderMode === 'flir'
        ? '#22c55e'
        : shaderMode === 'thermal'
          ? '#f97316'
          : shaderMode === 'blueprint'
            ? '#60a5fa'
            : '#38bdf8'

    const pins: Array<{ x: number; y: number; r: number; place: AtlasPlace }> = []

    if (viewMode === 'gleason') {
      // ── Gleason North Polar Azimuthal Equidistant Projection ──
      const maxR = Math.min(w, h) * 0.43
      for (const frac of [0.25, 0.5, 0.75, 1]) {
        ctx.beginPath()
        ctx.arc(cx, cy, maxR * frac, 0, Math.PI * 2)
        ctx.strokeStyle = `${primaryStroke}33`
        ctx.lineWidth = 1
        ctx.stroke()
      }
      for (let deg = 0; deg < 360; deg += 30) {
        const rad = (deg * Math.PI) / 180
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(rad) * maxR, cy + Math.sin(rad) * maxR)
        ctx.strokeStyle = `${primaryStroke}22`
        ctx.stroke()
      }

      for (const p of filteredPlaces) {
        const lat = parseFloat(p.latitude)
        const lon = parseFloat(p.longitude)
        if (Number.isNaN(lat) || Number.isNaN(lon)) continue
        // Distance from North Pole (90° -> 0, -90° -> maxR)
        const dist = ((90 - lat) / 180) * maxR
        const angle = ((lon - 90) * Math.PI) / 180
        const px = cx + Math.cos(angle) * dist
        const py = cy + Math.sin(angle) * dist

        const isSelected = selectedPlace?.id === p.id
        const color = activeCategoryColors[p.category] || '#f59e0b'
        ctx.beginPath()
        ctx.arc(px, py, isSelected ? 7 : 4, 0, Math.PI * 2)
        ctx.fillStyle = isSelected ? '#ffffff' : color
        ctx.fill()
        if (isSelected) {
          ctx.beginPath()
          ctx.arc(px, py, 14, 0, Math.PI * 2)
          ctx.strokeStyle = '#f59e0b'
          ctx.lineWidth = 2
          ctx.stroke()
        }
        pins.push({ x: px, y: py, r: 9, place: p })
      }
    } else {
      // ── 3D Orthographic Spy-Satellite Globe Projection ──
      const grad = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.25, radius * 0.1, cx, cy, radius)
      if (shaderMode === 'flir') {
        grad.addColorStop(0, '#0b2e16')
        grad.addColorStop(1, '#020b05')
      } else if (shaderMode === 'thermal') {
        grad.addColorStop(0, '#2a1205')
        grad.addColorStop(1, '#090401')
      } else {
        grad.addColorStop(0, '#101f36')
        grad.addColorStop(1, '#050a12')
      }

      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
      ctx.strokeStyle = `${primaryStroke}88`
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Orbital Atmosphere Halo
      ctx.beginPath()
      ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2)
      ctx.strokeStyle = `${primaryStroke}22`
      ctx.lineWidth = 6
      ctx.stroke()

      const lat0 = (camera.lat * Math.PI) / 180
      const lon0 = (camera.lon * Math.PI) / 180

      const project = (latDeg: number, lonDeg: number) => {
        const phi = (latDeg * Math.PI) / 180
        const lam = (lonDeg * Math.PI) / 180
        const cosc =
          Math.sin(lat0) * Math.sin(phi) + Math.cos(lat0) * Math.cos(phi) * Math.cos(lam - lon0)
        if (cosc < 0) return null
        const x = cx + radius * Math.cos(phi) * Math.sin(lam - lon0)
        const y =
          cy -
          radius * (Math.cos(lat0) * Math.sin(phi) - Math.sin(lat0) * Math.cos(phi) * Math.cos(lam - lon0))
        return { x, y, cosc }
      }

      // Draw continent landmass outlines on the 3D globe
      ctx.fillStyle = shaderMode === 'flir' ? '#064e3b40' : shaderMode === 'thermal' ? '#451a0340' : '#1e3a5f40'
      ctx.strokeStyle = shaderMode === 'flir' ? '#10b98166' : shaderMode === 'thermal' ? '#f9731666' : '#38bdf855'
      ctx.lineWidth = 1
      for (const poly of landmassPolygons) {
        ctx.beginPath()
        let started = false
        for (let i = 0; i < poly.length; i++) {
          const pt = project(poly[i][1], poly[i][0])
          if (pt) {
            if (!started) {
              ctx.moveTo(pt.x, pt.y)
              started = true
            } else {
              ctx.lineTo(pt.x, pt.y)
            }
          } else {
            started = false
          }
        }
        if (started) {
          ctx.stroke()
          ctx.fill()
        }
      }

      // Draw latitude/longitude graticule lines
      ctx.strokeStyle = `${primaryStroke}26`
      ctx.lineWidth = 0.8
      for (let lat = -60; lat <= 60; lat += 20) {
        ctx.beginPath()
        let started = false
        for (let lon = -180; lon <= 180; lon += 5) {
          const pt = project(lat, lon)
          if (pt) {
            if (!started) {
              ctx.moveTo(pt.x, pt.y)
              started = true
            } else {
              ctx.lineTo(pt.x, pt.y)
            }
          } else {
            started = false
          }
        }
        ctx.stroke()
      }

      for (let lon = -180; lon < 180; lon += 20) {
        ctx.beginPath()
        let started = false
        for (let lat = -80; lat <= 80; lat += 5) {
          const pt = project(lat, lon)
          if (pt) {
            if (!started) {
              ctx.moveTo(pt.x, pt.y)
              started = true
            } else {
              ctx.lineTo(pt.x, pt.y)
            }
          } else {
            started = false
          }
        }
        ctx.stroke()
      }

      // Plot all filtered Old World pins on the 3D globe
      for (const p of filteredPlaces) {
        const lat = parseFloat(p.latitude)
        const lon = parseFloat(p.longitude)
        if (Number.isNaN(lat) || Number.isNaN(lon)) continue
        const pt = project(lat, lon)
        if (!pt) continue

        const isSelected = selectedPlace?.id === p.id
        const color = p.isLiveScan ? '#22c55e' : activeCategoryColors[p.category] || '#f59e0b'

        ctx.beginPath()
        ctx.arc(pt.x, pt.y, isSelected ? 7 : 4.2, 0, Math.PI * 2)
        ctx.fillStyle = isSelected ? '#ffffff' : color
        ctx.fill()

        if (isSelected) {
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 15, 0, Math.PI * 2)
          ctx.strokeStyle = '#f59e0b'
          ctx.lineWidth = 2
          ctx.stroke()

          ctx.fillStyle = '#fef08a'
          ctx.font = 'bold 11px monospace'
          ctx.fillText(p.name.slice(0, 32), pt.x + 12, pt.y + 4)
        }

        pins.push({ x: pt.x, y: pt.y, r: 10, place: p })
      }
    }

    // Spy-Satellite Tactical Crosshair Reticle
    ctx.strokeStyle = `${primaryStroke}44`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx - 24, cy)
    ctx.lineTo(cx - 6, cy)
    ctx.moveTo(cx + 6, cy)
    ctx.lineTo(cx + 24, cy)
    ctx.moveTo(cx, cy - 24)
    ctx.lineTo(cx, cy - 6)
    ctx.moveTo(cx, cy + 6)
    ctx.lineTo(cx, cy + 24)
    ctx.stroke()

    projectedPinsRef.current = pins
  }, [viewMode, shaderMode, camera, filteredPlaces, selectedPlace])

  // ── Touch & Pointer Gestures for Mobile (Android Chrome, iOS Safari) ────────
  useEffect(() => {
    const canvas = globeCanvasRef.current
    if (!canvas) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        // Single finger drag / rotation
        isDraggingRef.current = true
        const t = e.touches[0]
        dragStartRef.current = {
          x: t.clientX,
          y: t.clientY,
          lat: cameraRef.current.lat,
          lon: cameraRef.current.lon,
        }
        pinchStartRef.current = { dist: 0, zoom: cameraRef.current.zoom }
      } else if (e.touches.length === 2) {
        // Two-finger pinch-to-zoom
        isDraggingRef.current = false
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const d = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
        pinchStartRef.current = {
          dist: Math.max(10, d),
          zoom: cameraRef.current.zoom,
        }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      // Prevent browser default behavior: viewport zoom & page scrolling on canvas
      if (e.cancelable) {
        e.preventDefault()
      }

      if (e.touches.length === 1 && isDraggingRef.current) {
        const t = e.touches[0]
        const dx = t.clientX - dragStartRef.current.x
        const dy = t.clientY - dragStartRef.current.y
        setCamera((prev) => ({
          ...prev,
          lat: Math.max(-80, Math.min(80, dragStartRef.current.lat + dy * 0.25)),
          lon: ((dragStartRef.current.lon - dx * 0.35 + 540) % 360) - 180,
        }))
      } else if (e.touches.length === 2 && pinchStartRef.current.dist > 0) {
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const d = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
        const scale = d / pinchStartRef.current.dist
        setCamera((prev) => ({
          ...prev,
          zoom: Math.max(1.5, Math.min(18, pinchStartRef.current.zoom * scale)),
        }))
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        if (isDraggingRef.current && e.changedTouches.length === 1) {
          const t = e.changedTouches[0]
          const moved =
            Math.hypot(t.clientX - dragStartRef.current.x, t.clientY - dragStartRef.current.y) > 8
          if (!moved && globeCanvasRef.current) {
            const rect = globeCanvasRef.current.getBoundingClientRect()
            const mx = t.clientX - rect.left
            const my = t.clientY - rect.top
            const hit = projectedPinsRef.current.find(
              (pin) => Math.hypot(pin.x - mx, pin.y - my) <= pin.r + 10,
            )
            if (hit) setSelectedPlace(hit.place)
          }
        }
        isDraggingRef.current = false
        pinchStartRef.current = { dist: 0, zoom: cameraRef.current.zoom }
      } else if (e.touches.length === 1) {
        // Transitioned from 2 fingers down to 1 finger
        isDraggingRef.current = true
        const t = e.touches[0]
        dragStartRef.current = {
          x: t.clientX,
          y: t.clientY,
          lat: cameraRef.current.lat,
          lon: cameraRef.current.lon,
        }
        pinchStartRef.current = { dist: 0, zoom: cameraRef.current.zoom }
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setCamera((prev) => ({
        ...prev,
        zoom: Math.max(1.5, Math.min(18, prev.zoom + (e.deltaY < 0 ? 0.6 : -0.6))),
      }))
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false })
    canvas.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchEnd)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [])

  // ── High-Zoom Street / Satellite Recon Map (Leaflet via CDN) ────────────────
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletMapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersLayerRef = useRef<any>(null)

  useEffect(() => {
    if (viewMode !== 'recon') return
    let cancelled = false

    async function ensureLeaflet() {
      if (!document.getElementById('leaflet-css-cdn')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css-cdn'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(window as any).L) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
          script.onload = () => resolve()
          script.onerror = () => reject()
          document.body.appendChild(script)
        })
      }
      if (cancelled || !mapContainerRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as any).L
      if (!leafletMapRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [camera.lat, camera.lon],
          zoom: Math.max(camera.zoom, 5),
        })
        // Esri World Imagery Satellite Layer + Carto Dark Labels (with Carto fallback to Stamen/OSM labels)
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          {
            attribution: 'Esri World Imagery Spy-Recon',
            maxZoom: 19,
          },
        ).addTo(map)
        L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
          {
            subdomains: 'abcd',
            maxZoom: 19,
          },
        ).addTo(map)

        markersLayerRef.current = L.layerGroup().addTo(map)
        leafletMapRef.current = map
      } else {
        leafletMapRef.current.setView([camera.lat, camera.lon], Math.max(camera.zoom, 5))
      }

      // Render markers
      if (markersLayerRef.current) {
        markersLayerRef.current.clearLayers()
        for (const p of filteredPlaces) {
          const lat = parseFloat(p.latitude)
          const lon = parseFloat(p.longitude)
          if (Number.isNaN(lat) || Number.isNaN(lon)) continue
          const color = p.isLiveScan ? '#22c55e' : activeCategoryColors[p.category] || '#f59e0b'
          const isSelected = selectedPlace?.id === p.id
          const marker = L.circleMarker([lat, lon], {
            radius: isSelected ? 10 : 6,
            fillColor: color,
            color: isSelected ? '#ffffff' : '#080b10',
            weight: isSelected ? 3 : 1.5,
            opacity: 1,
            fillOpacity: 0.9,
          })
          marker.bindTooltip(`<b>${p.name}</b><br/>${p.city || ''} ${p.construction ? `(${p.construction})` : ''}`)
          marker.on('click', () => setSelectedPlace(p))
          marker.addTo(markersLayerRef.current)
        }
      }
    }

    ensureLeaflet().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [viewMode, camera, filteredPlaces, selectedPlace])

  // Cleanup Leaflet map when switching out of recon mode
  useEffect(() => {
    if (viewMode !== 'recon' && leafletMapRef.current) {
      leafletMapRef.current.remove()
      leafletMapRef.current = null
      markersLayerRef.current = null
    }
  }, [viewMode])

  // Audience total calculation
  const platforms = data?.dashboard?.platforms ?? []
  const totalAudience = useMemo(
    () => platforms.reduce((sum, p) => sum + (Number(p.count) || 0), 0),
    [platforms],
  )
  const milestoneRemaining = Math.max(0, selectedMilestone - totalAudience)
  const milestonePct = Math.min(100, (totalAudience / selectedMilestone) * 100)

  const selectedAppearances = useMemo(
    () => (selectedPlace ? appearancesByPlace.get(selectedPlace.id) ?? [] : []),
    [selectedPlace, appearancesByPlace],
  )

  return (
    <>
      {showExcavationHero && !focusMode && (
        <DonkeyExcavationHero
          onExploreAtlas={() => {
            const el = document.getElementById('orbital-recon-section')
            if (el) el.scrollIntoView({ behavior: 'smooth' })
          }}
        />
      )}
      <section
        id="orbital-recon-section"
        className={
          isMaximized
            ? 'fixed inset-0 z-[9999] w-screen h-screen bg-[#05080e] text-slate-100 overflow-hidden flex flex-col m-0 rounded-none border-0'
            : 'w-full bg-[#070a10] text-slate-100 rounded-2xl border border-amber-500/20 shadow-2xl overflow-hidden my-6'
        }
      >
        {/* ── Top Classified Telemetry Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-amber-500/20 bg-[#0b101b] px-6 py-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>{activeMissionBrief}</span>
            </div>
            <h2 className="mt-1 text-xl md:text-2xl font-bold tracking-tight text-white">{activeTitle}</h2>
            {!focusMode && !isMaximized && <p className="text-xs md:text-sm text-slate-400">{activeSubtitle}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {allowFullscreen && (
              <button
                type="button"
                onClick={() => setIsMaximized((v) => !v)}
                className={`rounded-md border px-3 py-1.5 text-xs font-mono font-bold transition-all ${
                  isMaximized
                    ? 'border-red-500/80 bg-red-500/20 text-red-300 hover:bg-red-500/30'
                    : 'border-cyan-500/80 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 shadow-lg shadow-cyan-950/50'
                }`}
                title={isMaximized ? 'Exit Fullscreen (Esc)' : 'Expand to Full Screen Viewport'}
              >
                {isMaximized ? '✕ EXIT FULLSCREEN (ESC)' : '⛶ EXPAND FULLSCREEN'}
              </button>
            )}
            {isMaximized && (
              <button
                type="button"
                onClick={() => setCollapseDossierInMax((v) => !v)}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-200 hover:border-cyan-400/60"
              >
                {collapseDossierInMax ? '📋 SHOW DOSSIER' : '📋 HIDE DOSSIER (100% GLOBE)'}
              </button>
            )}
            {!isMaximized && (
              <button
                type="button"
                onClick={() => setFocusMode((v) => !v)}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-200 hover:border-amber-400/60"
              >
                {focusMode ? 'Exit Focus ⛶' : 'Focus View ⛶'}
              </button>
            )}
            {blogArchiveLink ? (
              <Link
                href={blogArchiveLink.href}
                className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-mono text-amber-300 hover:bg-amber-500/20"
              >
                {blogArchiveLink.label}
              </Link>
            ) : mode === 'uap' ? (
              <Link
                href="/posts"
                className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-mono text-cyan-300 hover:bg-cyan-500/20"
              >
                📑 Declassified Dossiers ({allPlaces.length})
              </Link>
            ) : mode === 'nde' ? (
              <Link
                href="/posts"
                className="rounded-md border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-xs font-mono text-purple-300 hover:bg-purple-500/20"
              >
                ✨ Session &amp; NDE Case Index ({allPlaces.length})
              </Link>
            ) : (
              <Link
                href="/posts"
                className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-mono text-amber-300 hover:bg-amber-500/20"
              >
                🎬 Episode Blog Archive ({data?.episodes?.length ?? 179})
              </Link>
            )}
          </div>
        </div>

      {/* ── 1. Audience Monitor & 11-Platform Social Matrix ── */}
      {showAudienceMonitor && !focusMode && (
        <AudienceScoreboard initialPlatforms={platforms} />
      )}

      {/* ── 2. Spy-Satellite Mode Switcher & Live City / Carnegie / Post Office Scanner ── */}
      {showGlobeAndRecon && (
        <>
          <div className="border-b border-slate-800 bg-[#0b101b] px-6 py-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* View Mode Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode('globe')}
              className={`rounded-md px-3 py-1.5 text-xs font-mono font-semibold transition-colors ${
                viewMode === 'globe'
                  ? 'bg-amber-500 text-slate-950'
                  : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-amber-400/50'
              }`}
            >
              🛰 3D SPY-SATELLITE GLOBE
            </button>
            <button
              type="button"
              onClick={() => setViewMode('recon')}
              className={`rounded-md px-3 py-1.5 text-xs font-mono font-semibold transition-colors ${
                viewMode === 'recon'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-400/50'
              }`}
            >
              🗺 STREET / SATELLITE CITY RECON
            </button>
            <button
              type="button"
              onClick={() => setViewMode('gleason')}
              className={`rounded-md px-3 py-1.5 text-xs font-mono font-semibold transition-colors ${
                viewMode === 'gleason'
                  ? 'bg-emerald-400 text-slate-950'
                  : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-emerald-400/50'
              }`}
            >
              🧭 GLEASON AZIMUTHAL MAP
            </button>
          </div>

          {/* Optical / FLIR Shader Toggles */}
          {viewMode !== 'recon' && (
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-slate-400 mr-1">OPTICS:</span>
              {(['optical', 'flir', 'thermal', 'blueprint'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setShaderMode(mode)}
                  className={`rounded px-2 py-1 uppercase border ${
                    shaderMode === mode
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Live Global City & Historic Register Scanner */}
        {effectiveShowCityScanner && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan-500/30 bg-[#071220] p-3">
            <span className="text-xs font-mono font-semibold text-cyan-300">
              🔎 LIVE CITY / HISTORIC REGISTER SCANNER:
            </span>
            <input
              type="text"
              value={scanCityInput}
              onChange={(e) => setScanCityInput(e.target.value)}
              placeholder="Enter city (e.g. Tampa, FL · Clearwater, FL · Chicago · Prague)"
              className="flex-1 min-w-[200px] rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder:text-slate-500"
            />
            <select
              value={scanFilter}
              onChange={(e) => setScanFilter(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-mono text-slate-200"
            >
              <option value="all">All Pre-1940 &amp; Historic Landmarks</option>
              <option value="carnegie">Carnegie Libraries &amp; Archives</option>
              <option value="post_office">Historic Post Offices &amp; Custom Houses</option>
              <option value="government">Capitols, Courthouses &amp; City Halls</option>
              <option value="religious">Cathedrals, Basilicas &amp; Temples</option>
              <option value="palace_castle">Palaces, Castles, Hotels &amp; Forts</option>
              <option value="asylum_hospital">Asylums &amp; Historic Hospitals</option>
            </select>
            <button
              type="button"
              disabled={isScanning}
              onClick={() => runSectorScan({ city: scanCityInput })}
              className="rounded bg-cyan-500 px-3 py-1.5 text-xs font-mono font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              {isScanning ? 'SCANNING ORBIT...' : '🛰 SCAN CITY'}
            </button>
            <button
              type="button"
              disabled={isScanning}
              onClick={() => runSectorScan({ lat: camera.lat, lon: camera.lon, radiusKm: 25 })}
              className="rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-mono text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50"
            >
              ◎ Scan Current Coords
            </button>
            {scanStatus && (
              <span className="w-full text-[11px] font-mono text-emerald-400 mt-1">{scanStatus}</span>
            )}
          </div>
        )}

        {/* Global Architectural Layers Bar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-mono text-amber-400 mr-1">GLOBAL LAYERS:</span>
          <button
            type="button"
            onClick={() => setShowMlbLayer((v) => !v)}
            className={`rounded border px-2.5 py-1 text-[11px] font-mono transition-colors ${
              showMlbLayer
                ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                : 'border-slate-800 bg-slate-900 text-slate-400'
            }`}
          >
            {primaryLayerLabel ||
              (mode === 'uap'
                ? '🛸 Declassified Incidents Layer'
                : mode === 'nde'
                  ? '✨ Regression & NDE Case Layer'
                  : '🎬 MLB Episodes Layer')}{' '}
            ({data?.places?.length ?? (mode === 'uap' ? 15 : mode === 'nde' ? 12 : 256)})
          </button>
          {activeLayersList.map((layer) => {
            const active = Boolean(activeGlobalLayers[layer.key])
            return (
              <button
                key={layer.key}
                type="button"
                onClick={() => toggleGlobalLayer(layer.key)}
                className={`rounded border px-2.5 py-1 text-[11px] font-mono transition-colors ${
                  active
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-cyan-400/50'
                }`}
              >
                {layer.label} {active ? '✓' : '+'}
              </button>
            )
          })}
        </div>

        {/* Quick Sector Jump Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-mono text-slate-400 mr-1">QUICK JUMP:</span>
          {activeQuickSectors.map((sec) => (
            <button
              key={sec.label}
              type="button"
              onClick={() => {
                setCamera({ lat: sec.lat, lon: sec.lon, zoom: sec.zoom })
                setScanCityInput(sec.city)
                if (mode === 'uap' || mode === 'nde') {
                  const queryCity = sec.city.split(',')[0].trim().toLowerCase()
                  const match = allPlaces.find((p) =>
                    p.name.toLowerCase().includes(queryCity) ||
                    (p.city && p.city.toLowerCase().includes(queryCity))
                  )
                  if (match) setSelectedPlace(match)
                }
              }}
              className="rounded border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:border-amber-400/50 hover:text-amber-300"
            >
              {sec.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                  setCamera({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    zoom: 13,
                  })
                  runSectorScan({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    radiusKm: 25,
                  })
                })
              }
            }}
            className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-mono text-emerald-300 hover:bg-emerald-500/20"
          >
            ◎ EXPLORE NEAR ME (GPS)
          </button>
        </div>

        {/* Archive Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              searchPlaceholder ||
              (mode === 'uap'
                ? `Search ${allPlaces.length} declassified incidents, crash sites, radar locks, witnesses...`
                : mode === 'nde'
                  ? `Search ${allPlaces.length} regressions, NDEs, researchers (Wambach, Cannon, Cayce, NDERF)...`
                  : `Search ${allPlaces.length} verified structures, cities, countries...`)
            }
            className="rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-200"
          >
            <option value="ALL">All Categories ({allPlaces.length})</option>
            {Object.keys(activeCategoryColors).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {mode === 'uap' ? (
            <select
              value={selectedEpisodeId}
              onChange={(e) => setSelectedEpisodeId(e.target.value)}
              className="rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-200"
            >
              <option value="ALL">All Classification Levels</option>
              <option value="TOP SECRET / MAJIC">Top Secret / MAJIC</option>
              <option value="SECRET / NOFORN">Secret / NOFORN</option>
              <option value="DECLASSIFIED (DOD)">Declassified (DoD / Navy)</option>
              <option value="CONFIDENTIAL">Confidential / Witness Record</option>
            </select>
          ) : mode === 'nde' ? (
            <select
              value={selectedEpisodeId}
              onChange={(e) => setSelectedEpisodeId(e.target.value)}
              className="rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-200"
            >
              <option value="ALL">All Blindness / Prompt Ratings</option>
              <option value="PRE_2018_BLIND">Pre-2018 Blind / Unprompted</option>
              <option value="POST_2018_UNPROMPTED">Post-2018 Unprompted</option>
              <option value="POST_2018_LED">Post-2018 (Verify Prompting)</option>
            </select>
          ) : (
            <select
              value={selectedEpisodeId}
              onChange={(e) => setSelectedEpisodeId(e.target.value)}
              className="rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-200"
            >
              <option value="ALL">All MLB Episodes ({data?.episodes?.length ?? 0})</option>
              {(data?.episodes ?? []).map((ep) => (
                <option key={ep.id} value={ep.id}>
                  EP {ep.number} — {ep.title}
                </option>
              ))}
            </select>
          )}
          {mode === 'uap' ? (
            <select
              value={selectedExistence}
              onChange={(e) => setSelectedExistence(e.target.value)}
              className="rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-200"
            >
              <option value="ALL">All Telemetry &amp; Evidence Types</option>
              <option value="radar">Multi-Sensor / FLIR Telemetry</option>
              <option value="retrieval">Debris / Physical Craft Retrieved</option>
              <option value="nuclear">Nuclear Facility Disruption</option>
              <option value="witness">Military / Aviator Eyewitness</option>
            </select>
          ) : mode === 'nde' ? (
            <select
              value={selectedExistence}
              onChange={(e) => setSelectedExistence(e.target.value)}
              className="rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-200"
            >
              <option value="ALL">All Claimed Era Windows</option>
              <option value="1700-1850">1700–1850 Target Window</option>
              <option value="ATLANTIS_UNPLACED">Deep Antiquity / &ldquo;Atlantis&rdquo; Unplaced</option>
              <option value="1850-1950">1850–1950 Modern Window</option>
              <option value="NON_LOCAL">Non-Local / Hall of Records</option>
            </select>
          ) : (
            <select
              value={selectedExistence}
              onChange={(e) => setSelectedExistence(e.target.value)}
              className="rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-200"
            >
              <option value="ALL">Standing &amp; Lost / Demolished</option>
              <option value="standing">Standing Structures Only</option>
              <option value="lost">Demolished, Submerged &amp; Unknown</option>
            </select>
          )}
        </div>
      </div>

      {/* ── 3. Main Split Viewport: Orbital Globe / Recon Map (Left) + Classified Dossier (Right) ── */}
      <div
        className={
          isMaximized
            ? 'flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden'
            : 'grid grid-cols-1 lg:grid-cols-12 min-h-[560px]'
        }
      >
        {/* Left Cols: Interactive Viewport */}
        <div
          className={`${
            isMaximized
              ? collapseDossierInMax
                ? 'lg:col-span-12'
                : 'lg:col-span-7 xl:col-span-8'
              : 'lg:col-span-7'
          } relative border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#05080e] ${
            isMaximized ? 'h-full flex-1' : 'min-h-[460px]'
          }`}
        >
          {viewMode === 'recon' ? (
            <div
              ref={mapContainerRef}
              className={`${isMaximized ? 'h-full' : 'h-[540px]'} w-full z-0 touch-none`}
            />
          ) : (
            <canvas
              ref={globeCanvasRef}
              style={{ touchAction: 'none' }}
              onMouseDown={(e) => {
                isDraggingRef.current = true
                dragStartRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  lat: camera.lat,
                  lon: camera.lon,
                }
              }}
              onMouseMove={(e) => {
                if (!isDraggingRef.current) return
                const dx = e.clientX - dragStartRef.current.x
                const dy = e.clientY - dragStartRef.current.y
                setCamera((prev) => ({
                  ...prev,
                  lat: Math.max(-80, Math.min(80, dragStartRef.current.lat + dy * 0.25)),
                  lon: ((dragStartRef.current.lon - dx * 0.35 + 540) % 360) - 180,
                }))
              }}
              onMouseUp={(e) => {
                const moved =
                  Math.hypot(e.clientX - dragStartRef.current.x, e.clientY - dragStartRef.current.y) > 5
                isDraggingRef.current = false
                if (!moved && globeCanvasRef.current) {
                  const rect = globeCanvasRef.current.getBoundingClientRect()
                  const mx = e.clientX - rect.left
                  const my = e.clientY - rect.top
                  const hit = projectedPinsRef.current.find(
                    (pin) => Math.hypot(pin.x - mx, pin.y - my) <= pin.r,
                  )
                  if (hit) setSelectedPlace(hit.place)
                }
              }}
              className={`${
                isMaximized ? 'h-full' : 'h-[540px]'
              } w-full cursor-grab active:cursor-grabbing block touch-none select-none`}
            />
          )}

          {/* Orbital Telemetry HUD Overlay */}
          <div className="pointer-events-none absolute top-3 left-3 rounded bg-slate-950/85 border border-slate-800 px-3 py-2 font-mono text-[11px] text-cyan-300 space-y-0.5">
            <div>
              LAT: {camera.lat.toFixed(4)}° · LON: {camera.lon.toFixed(4)}°
            </div>
            <div>
              PINS IN SECTOR: {filteredPlaces.length} / {allPlaces.length}
            </div>
            <div className="text-amber-400">
              MODE: {viewMode.toUpperCase()} ({shaderMode.toUpperCase()})
            </div>
            <div className="text-[10px] text-slate-400 sm:hidden">
              📱 Pinch to zoom · Drag to rotate
            </div>
          </div>

          {/* Zoom + Switch to Street Recon + Maximize Controls */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-10">
            {allowFullscreen && (
              <button
                type="button"
                onClick={() => setIsMaximized((v) => !v)}
                className="rounded border border-cyan-500/60 bg-slate-900/90 px-2.5 py-1.5 text-xs font-mono text-cyan-300 hover:border-cyan-400 active:scale-95 touch-manipulation select-none"
                title={isMaximized ? 'Exit Fullscreen' : 'Maximize Fullscreen'}
              >
                {isMaximized ? '✕ MINIMIZE' : '⛶ FULLSCREEN'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setCamera((p) => ({ ...p, zoom: Math.min(18, p.zoom + 1) }))}
              className="rounded border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-mono text-white hover:border-amber-400 active:scale-95 touch-manipulation select-none"
            >
              + ZOOM IN
            </button>
            <button
              type="button"
              onClick={() => setCamera((p) => ({ ...p, zoom: Math.max(1.5, p.zoom - 1) }))}
              className="rounded border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-mono text-white hover:border-amber-400 active:scale-95 touch-manipulation select-none"
            >
              − ZOOM OUT
            </button>
            {viewMode !== 'recon' && (
              <button
                type="button"
                onClick={() => setViewMode('recon')}
                className="rounded bg-amber-500 px-3 py-1 text-xs font-mono font-bold text-slate-950 hover:bg-amber-400"
              >
                {mode === 'uap' ? '🔍 HIGH-ZOOM SATELLITE SITE RECON' : '🔍 HIGH-ZOOM SATELLITE ROOF RECON'}
              </button>
            )}
          </div>
        </div>

        {/* Right Cols: Selected Building Dossier + Evidence */}
        {(!isMaximized || !collapseDossierInMax) && (
          <div
            className={`${
              isMaximized ? 'lg:col-span-5 xl:col-span-4 max-h-full' : 'lg:col-span-5 max-h-[540px]'
            } flex flex-col justify-between bg-[#0a0f1a] p-5 overflow-y-auto`}
          >
          {selectedPlace ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className="inline-block rounded px-2 py-0.5 text-[10px] font-mono uppercase font-semibold"
                    style={{
                      backgroundColor: `${activeCategoryColors[selectedPlace.category] || '#f59e0b'}22`,
                      color: activeCategoryColors[selectedPlace.category] || '#f59e0b',
                    }}
                  >
                    {selectedPlace.category} · {selectedPlace.existence.toUpperCase()}
                  </span>
                  <h3 className="mt-1.5 text-xl font-bold text-white">{selectedPlace.name}</h3>
                  <p className="text-xs font-mono text-slate-400">
                    {[selectedPlace.city, selectedPlace.state, selectedPlace.country]
                      .filter(Boolean)
                      .join(', ')}{' '}
                    {selectedPlace.construction
                      ? mode === 'uap'
                        ? `· Incident Date: ${selectedPlace.construction}`
                        : mode === 'nde'
                          ? `· Recorded: ${selectedPlace.construction}`
                          : `· Claimed: ${selectedPlace.construction}`
                      : ''}
                  </p>
                </div>
              </div>

              {selectedPlace.photo && !imgError ? (
                <div className="relative h-48 w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedPlace.photo}
                    alt={selectedPlace.name}
                    className="h-full w-full object-cover transition-opacity duration-300"
                    loading="lazy"
                    onError={() => setImgError(true)}
                  />
                </div>
              ) : (
                <div className="relative h-32 w-full overflow-hidden rounded-lg border border-cyan-900/40 bg-gradient-to-br from-slate-950 via-cyan-950/20 to-slate-950 p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400/90">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      SATELLITE RECON DOSSIER
                    </span>
                    <span className="rounded bg-cyan-950/80 px-1.5 py-0.5 border border-cyan-700/60 text-cyan-300">
                      {selectedPlace.existence.toUpperCase()}
                    </span>
                  </div>
                  <div className="py-1">
                    <p className="font-semibold text-xs text-slate-200 line-clamp-1">{selectedPlace.name}</p>
                    <p className="text-[10px] font-mono text-slate-400">
                      {[selectedPlace.city, selectedPlace.state, selectedPlace.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-amber-400/80 border-t border-slate-800/80 pt-1.5">
                    <span>COORDS: {parseFloat(selectedPlace.latitude).toFixed(4)}°, {parseFloat(selectedPlace.longitude).toFixed(4)}°</span>
                    <span>{selectedPlace.category}</span>
                  </div>
                </div>
              )}

              <p className="text-xs leading-relaxed text-slate-300">{selectedPlace.description}</p>

              {/* Recon Action Links */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => flyToPlace(selectedPlace, true)}
                  className="rounded bg-cyan-500/20 border border-cyan-400/50 px-2.5 py-1 text-xs font-mono text-cyan-300 hover:bg-cyan-500/30"
                >
                  {mode === 'uap' || mode === 'nde' ? '🛰 Zoom Satellite Site View' : '🛰 Zoom Satellite Roof View'}
                </button>
                <a
                  href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${selectedPlace.latitude},${selectedPlace.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded bg-amber-500/20 border border-amber-400/50 px-2.5 py-1 text-xs font-mono text-amber-300 hover:bg-amber-500/30"
                >
                  👁 Street-Level 360° Inspection
                </a>
                {selectedPlace.sourceUrl && (
                  <a
                    href={selectedPlace.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-mono text-slate-300 hover:border-slate-500"
                  >
                    {mode === 'uap'
                      ? '📑 Primary Source Archive ↗'
                      : mode === 'nde'
                        ? '✨ Primary Study / Session Link ↗'
                        : '📜 Official Narrative Source ↗'}
                  </a>
                )}
              </div>

              {/* Episode Appearances & Cleaned Script Evidence OR Declassified Primary Evidence */}
              <div className="border-t border-slate-800 pt-3">
                <div className="text-xs font-mono uppercase tracking-wider text-amber-400 mb-2">
                  {mode === 'uap'
                    ? '📑 DECLASSIFIED TELEMETRY & MEDIA SOURCES'
                    : mode === 'nde'
                      ? '✨ PRIMARY ARCHIVE & BLINDNESS METADATA'
                      : `🎬 FEATURED IN MLB EPISODES (${selectedAppearances.length})`}
                </div>
                {mode === 'uap' || mode === 'nde' ? (
                  <div className="rounded-lg border border-slate-800 bg-[#070b12] p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-cyan-300 font-bold">
                        {mode === 'nde'
                          ? 'REGRESSION / NDE EVIDENCE & BLINDNESS RATING'
                          : 'MILITARY TELEMETRY & WITNESS DEPOSITIONS'}
                      </span>
                      <span className="text-[10px] text-amber-400 uppercase font-mono">{selectedPlace.existence}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-mono">
                      {mode === 'nde'
                        ? 'Indexed for pre-2018 blindness, leading-prompt risk, and historical-baseline deviation. Direct outbound link preserved without re-hosting third-party media.'
                        : 'Logged under official DoD declassifications, military radar logs, and whistleblower testimony. Direct primary links preserved to the original media without third-party hosting.'}
                    </p>
                    {selectedPlace.sourceUrl && (
                      <a
                        href={selectedPlace.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:underline pt-1"
                      >
                        <span>
                          {mode === 'nde'
                            ? '🔗 Open Original NDERF / Study / YouTube Session ↗'
                            : '🔗 Access Original Declassified Dossier / Media Link ↗'}
                        </span>
                      </a>
                    )}
                  </div>
                ) : selectedAppearances.length === 0 ? (
                  <p className="text-xs text-slate-500 font-mono">
                    Regional Old World / Historic Register Landmark — ready for field investigation.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedAppearances.map((app) => {
                      const ep = episodeMap.get(app.episodeId)
                      const epNum = ep?.number || app.episodeId.replace(/^ep:/, '')
                      return (
                        <div
                          key={app.id}
                          className="rounded-lg border border-slate-800 bg-[#070b12] p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono font-bold text-amber-300">
                              {ep?.title || `Episode ${epNum}`}
                            </span>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/posts/ep-${epNum}`}
                                className="text-[11px] font-mono text-cyan-400 hover:underline"
                              >
                                Read Episode Post →
                              </Link>
                              {ep?.videoUrl && (
                                <a
                                  href={ep.videoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] font-mono text-red-400 hover:underline"
                                >
                                  ▶ YouTube
                                </a>
                              )}
                            </div>
                          </div>
                          {app.evidence && (
                            <blockquote className="border-l-2 border-amber-500/40 pl-2.5 text-[11px] italic text-slate-400 line-clamp-4">
                              &ldquo;{app.evidence}&rdquo;
                            </blockquote>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-mono text-slate-500">
              {mode === 'uap'
                ? 'Select any incident pin on the globe or list below to inspect its declassified dossier.'
                : mode === 'nde'
                  ? 'Select any regression or NDE pin on the globe or list below to inspect its case dossier.'
                  : 'Select any pin on the globe or list below to inspect its Old World dossier.'}
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Scrollable Structure Directory & Historic Fire Archive ── */}
      <div className="border-t border-slate-800 bg-[#080c14] px-6 py-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-mono uppercase tracking-widest text-amber-400">
            {mode === 'uap'
              ? `DECLASSIFIED INCIDENT DOSSIERS IN CURRENT FILTER (${filteredPlaces.length})`
              : mode === 'nde'
                ? `INDEXED REGRESSION & NDE CASES IN CURRENT FILTER (${filteredPlaces.length})`
                : `VERIFIED OLD WORLD STRUCTURES IN CURRENT FILTER (${filteredPlaces.length})`}
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            Click any card to lock satellite camera
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-80 overflow-y-auto pr-1">
          {filteredPlaces.slice(0, 60).map((place) => {
            const active = selectedPlace?.id === place.id
            const appCount = appearancesByPlace.get(place.id)?.length ?? 0
            return (
              <button
                key={place.id}
                type="button"
                onClick={() => flyToPlace(place)}
                className={`text-left rounded-lg border p-3 transition-all ${
                  active
                    ? 'border-amber-400 bg-amber-500/10'
                    : 'border-slate-800 bg-[#0c121e] hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                  <span style={{ color: activeCategoryColors[place.category] || '#f59e0b' }}>
                    {place.category}
                  </span>
                  {appCount > 0 ? (
                    <span className="text-cyan-400">{appCount} ep</span>
                  ) : place.isLiveScan ? (
                    <span className="text-emerald-400">LIVE SCAN</span>
                  ) : null}
                </div>
                <div className="mt-1 font-semibold text-xs text-white truncate">{place.name}</div>
                <div className="mt-0.5 text-[11px] text-slate-400 truncate">
                  {[place.city, place.state, place.country].filter(Boolean).join(', ')}
                </div>
              </button>
            )
          })}
        </div>

        {/* Historic Fire Intelligence Ticker */}
        {!focusMode && (data?.fires?.length ?? 0) > 0 && (
          <div className="mt-6 border-t border-slate-800/80 pt-4">
            <div className="text-xs font-mono uppercase tracking-widest text-orange-400 mb-2.5">
              🔥 THE HISTORIC FIRE ARCHIVE · VERIFIED OLD WORLD INCIDENTS ({data?.fires?.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {(data?.fires ?? []).map((fire) => (
                <button
                  key={fire.id}
                  type="button"
                  onClick={() => {
                    setCamera({ lat: fire.latitude, lon: fire.longitude, zoom: 15 })
                    setViewMode('recon')
                  }}
                  className="text-left rounded-lg border border-orange-500/30 bg-orange-950/15 p-3 hover:border-orange-400"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-orange-300">
                    <span>BUILT: {fire.year}</span>
                    <span>CONFIRMED FIRE</span>
                  </div>
                  <div className="mt-1 text-xs font-bold text-white truncate">{fire.building}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {fire.city}, {fire.country}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </section>
    </>
  )
}
