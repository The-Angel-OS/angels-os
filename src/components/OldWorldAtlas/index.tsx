'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import rawLandmassPolygons from '@/data/world-landmass.json'

const landmassPolygons = rawLandmassPolygons as number[][][]

export interface AtlasPlace {
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

const QUICK_SECTORS = [
  { label: '📍 Clearwater, FL (1933 Post Office)', lat: 27.9656, lon: -82.7959, zoom: 14, city: 'Clearwater, FL' },
  { label: '📍 Tampa, FL (1891 Plant Palace)', lat: 27.9467, lon: -82.4639, zoom: 14, city: 'Tampa, FL' },
  { label: '📍 Mumbai, India (Victoria Terminus)', lat: 18.9401, lon: 72.8355, zoom: 14, city: 'Mumbai, India' },
  { label: '📍 St. Petersburg, FL', lat: 27.7725, lon: -82.6386, zoom: 14, city: 'St. Petersburg, FL' },
  { label: '📍 San Diego (Balboa Park)', lat: 32.7314, lon: -117.1453, zoom: 15, city: 'San Diego, CA' },
  { label: '📍 Chicago (World’s Fair)', lat: 41.7905, lon: -87.5806, zoom: 13, city: 'Chicago, IL' },
  { label: '📍 Istanbul (Old World)', lat: 41.0082, lon: 28.9784, zoom: 14, city: 'Istanbul' },
  { label: '📍 London, UK', lat: 51.5074, lon: -0.1278, zoom: 13, city: 'London' },
]

const GLOBAL_LAYERS = [
  { key: 'train_stations', label: '🚂 Old World Grand Train Stations' },
  { key: 'cathedrals', label: '⛪ World Cathedrals & Basilicas' },
  { key: 'carnegie', label: '📚 Carnegie Libraries Worldwide' },
  { key: 'nrhp_landmarks', label: '🏛 U.S. Historic Landmarks (NRHP)' },
  { key: 'star_forts', label: '🏰 Star Forts & Citadels' },
  { key: 'asylums', label: '🏥 Kirkbride Asylums' },
]

const MILESTONES = [
  1_500_000, 2_000_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000,
]

export const OldWorldAtlas: React.FC<{
  initialData?: AtlasArchiveData
  showAudienceMonitor?: boolean
  showGlobeAndRecon?: boolean
  title?: string
  subtitle?: string
}> = ({
  initialData,
  showAudienceMonitor = true,
  showGlobeAndRecon = true,
  title = 'SPY SATELLITE // OLD WORLD & TARTARIA ARCHIVE',
  subtitle = 'Orbital Reconnaissance, Historic Architecture City Scanner & Satan’s Little Season Investigation Index',
}) => {
  const [data, setData] = useState<AtlasArchiveData | null>(initialData ?? null)
  const [scannedPlaces, setScannedPlaces] = useState<AtlasPlace[]>([])
  const [activeGlobalLayers, setActiveGlobalLayers] = useState<Record<string, boolean>>({})
  const [showMlbLayer, setShowMlbLayer] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState<string | null>(null)
  const [scanCityInput, setScanCityInput] = useState('Tampa, FL')
  const [scanFilter, setScanFilter] = useState('all')

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

  // Camera state (shared between Globe & Recon Map)
  const [camera, setCamera] = useState<{ lat: number; lon: number; zoom: number }>({
    lat: 27.955,
    lon: -82.62,
    zoom: 3,
  })

  // Fetch initial archive if not passed as prop
  useEffect(() => {
    if (data) return
    fetch('/api/atlas')
      .then((r) => r.json())
      .then((json: AtlasArchiveData) => {
        setData(json)
        if (json.places?.[0]) setSelectedPlace(json.places[0])
      })
      .catch(() => {})
  }, [data])

  // Select Clearwater 1933 Post Office by default once loaded
  useEffect(() => {
    if (data?.places?.length && !selectedPlace) {
      setSelectedPlace(data.places[0])
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
        const color = CATEGORY_COLORS[p.category] || '#f59e0b'
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
        const color = p.isLiveScan ? '#22c55e' : CATEGORY_COLORS[p.category] || '#f59e0b'

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
          const color = p.isLiveScan ? '#22c55e' : CATEGORY_COLORS[p.category] || '#f59e0b'
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
    <section className="w-full bg-[#070a10] text-slate-100 rounded-2xl border border-amber-500/20 shadow-2xl overflow-hidden my-6">
      {/* ── Top Classified Telemetry Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-amber-500/20 bg-[#0b101b] px-6 py-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>ORBITAL RECON // SATAN&apos;S LITTLE SEASON &amp; OLD WORLD ARCHIVE</span>
          </div>
          <h2 className="mt-1 text-xl md:text-2xl font-bold tracking-tight text-white">{title}</h2>
          {!focusMode && <p className="text-xs md:text-sm text-slate-400">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFocusMode((v) => !v)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-200 hover:border-amber-400/60"
          >
            {focusMode ? 'Exit Focus ⛶' : 'Focus View ⛶'}
          </button>
          <Link
            href="/posts"
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-mono text-amber-300 hover:bg-amber-500/20"
          >
            🎬 Episode Blog Archive ({data?.episodes?.length ?? 179})
          </Link>
        </div>
      </div>

      {/* ── 1. Audience Monitor & 11-Platform Social Matrix ── */}
      {showAudienceMonitor && !focusMode && platforms.length > 0 && (
        <div className="border-b border-slate-800/80 bg-[#090d16] px-6 py-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">
                MY LUNCH BREAK AUDIENCE MONITOR · 11 NETWORKS
              </div>
              <div className="mt-1 flex items-baseline gap-4">
                <span className="font-mono text-4xl md:text-5xl font-extrabold tracking-tight text-amber-400">
                  {totalAudience.toLocaleString()}
                </span>
                <span className="text-xs font-mono text-emerald-400">
                  +27.2M YOUTUBE VIEWS · LIVE TELEMETRY
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-[260px] max-w-md">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1.5">
                <span>
                  {milestoneRemaining.toLocaleString()} TO GO · {milestonePct.toFixed(2)}%
                </span>
                <button
                  type="button"
                  onClick={() => setShowMilestones((s) => !s)}
                  className="text-amber-400 hover:underline"
                >
                  Target: {(selectedMilestone / 1_000_000).toFixed(1)}M ▾
                </button>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-cyan-400 transition-all duration-500"
                  style={{ width: `${milestonePct}%` }}
                />
              </div>
              {showMilestones && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {MILESTONES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setSelectedMilestone(m)
                        setShowMilestones(false)
                      }}
                      className={`rounded px-2 py-0.5 text-[11px] font-mono border ${
                        selectedMilestone === m
                          ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                      }`}
                    >
                      {m / 1_000_000}M
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 11-Platform Matrix */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {platforms.map((plat) => (
              <a
                key={plat.id}
                href={plat.url || '#'}
                target={plat.url ? '_blank' : undefined}
                rel="noreferrer"
                className="group rounded-lg border border-slate-800 bg-[#0d1320] p-3 hover:border-amber-500/40 transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{plat.name}</span>
                  <span
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${plat.color}22`, color: plat.color }}
                  >
                    {plat.status === 'current' ? 'LIVE' : 'SYNC'}
                  </span>
                </div>
                <div className="mt-1.5 font-mono text-lg font-bold text-white">
                  {Number(plat.count || 0).toLocaleString()}
                </div>
                <div className="mt-0.5 text-[11px] font-mono text-slate-400 truncate">
                  {plat.gain28 != null && plat.gain28 > 0 ? (
                    <span className="text-emerald-400">+{plat.gain28.toLocaleString()} (28d)</span>
                  ) : (
                    <span>{plat.handle || plat.unit}</span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── 2. Spy-Satellite Mode Switcher & Live City / Carnegie / Post Office Scanner ── */}
      {showGlobeAndRecon && (
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
            🎬 MLB Episodes Layer ({data?.places?.length ?? 256})
          </button>
          {GLOBAL_LAYERS.map((layer) => {
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
          {QUICK_SECTORS.map((sec) => (
            <button
              key={sec.label}
              type="button"
              onClick={() => {
                setCamera({ lat: sec.lat, lon: sec.lon, zoom: sec.zoom })
                setScanCityInput(sec.city)
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
            placeholder={`Search ${allPlaces.length} verified structures, cities, countries...`}
            className="rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-200"
          >
            <option value="ALL">All Categories ({allPlaces.length})</option>
            {Object.keys(CATEGORY_COLORS).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
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
          <select
            value={selectedExistence}
            onChange={(e) => setSelectedExistence(e.target.value)}
            className="rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-200"
          >
            <option value="ALL">Standing &amp; Lost / Demolished</option>
            <option value="standing">Standing Structures Only</option>
            <option value="lost">Demolished, Submerged &amp; Unknown</option>
          </select>
        </div>
      </div>

      {/* ── 3. Main Split Viewport: Orbital Globe / Recon Map (Left) + Classified Dossier (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[560px]">
        {/* Left 7 Cols: Interactive Viewport */}
        <div className="lg:col-span-7 relative border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#05080e] min-h-[460px]">
          {viewMode === 'recon' ? (
            <div ref={mapContainerRef} className="h-[540px] w-full z-0" />
          ) : (
            <canvas
              ref={globeCanvasRef}
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
              onWheel={(e) => {
                e.preventDefault()
                setCamera((prev) => ({
                  ...prev,
                  zoom: Math.max(1.5, Math.min(18, prev.zoom + (e.deltaY < 0 ? 0.5 : -0.5))),
                }))
              }}
              className="h-[540px] w-full cursor-grab active:cursor-grabbing block"
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
          </div>

          {/* Zoom + Switch to Street Recon Controls */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-10">
            <button
              type="button"
              onClick={() => setCamera((p) => ({ ...p, zoom: Math.min(18, p.zoom + 1) }))}
              className="rounded border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-xs font-mono text-white hover:border-amber-400"
            >
              + ZOOM IN
            </button>
            <button
              type="button"
              onClick={() => setCamera((p) => ({ ...p, zoom: Math.max(1.5, p.zoom - 1) }))}
              className="rounded border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-xs font-mono text-white hover:border-amber-400"
            >
              - ZOOM OUT
            </button>
            {viewMode !== 'recon' && (
              <button
                type="button"
                onClick={() => setViewMode('recon')}
                className="rounded bg-amber-500 px-3 py-1 text-xs font-mono font-bold text-slate-950 hover:bg-amber-400"
              >
                🔍 HIGH-ZOOM SATELLITE ROOF RECON
              </button>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Selected Building Dossier + Script Evidence */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-[#0a0f1a] p-5 overflow-y-auto max-h-[540px]">
          {selectedPlace ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className="inline-block rounded px-2 py-0.5 text-[10px] font-mono uppercase font-semibold"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[selectedPlace.category] || '#f59e0b'}22`,
                      color: CATEGORY_COLORS[selectedPlace.category] || '#f59e0b',
                    }}
                  >
                    {selectedPlace.category} · {selectedPlace.existence.toUpperCase()}
                  </span>
                  <h3 className="mt-1.5 text-xl font-bold text-white">{selectedPlace.name}</h3>
                  <p className="text-xs font-mono text-slate-400">
                    {[selectedPlace.city, selectedPlace.state, selectedPlace.country]
                      .filter(Boolean)
                      .join(', ')}{' '}
                    {selectedPlace.construction ? `· Claimed: ${selectedPlace.construction}` : ''}
                  </p>
                </div>
              </div>

              {selectedPlace.photo && (
                <div className="relative h-44 w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedPlace.photo}
                    alt={selectedPlace.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
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
                  🛰 Zoom Satellite Roof View
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
                    📜 Official Narrative Source ↗
                  </a>
                )}
              </div>

              {/* Episode Appearances & Cleaned Script Evidence */}
              <div className="border-t border-slate-800 pt-3">
                <div className="text-xs font-mono uppercase tracking-wider text-amber-400 mb-2">
                  🎬 FEATURED IN MLB EPISODES ({selectedAppearances.length})
                </div>
                {selectedAppearances.length === 0 ? (
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
              Select any pin on the globe or list below to inspect its Old World dossier.
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Scrollable Structure Directory & Historic Fire Archive ── */}
      <div className="border-t border-slate-800 bg-[#080c14] px-6 py-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-mono uppercase tracking-widest text-amber-400">
            VERIFIED OLD WORLD STRUCTURES IN CURRENT FILTER ({filteredPlaces.length})
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
                  <span style={{ color: CATEGORY_COLORS[place.category] || '#f59e0b' }}>
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
      )}
    </section>
  )
}
