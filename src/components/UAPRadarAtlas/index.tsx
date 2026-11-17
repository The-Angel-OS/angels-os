'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import uapArchiveData from '@/data/uap-archive.json'

export interface UAPIncident {
  id: string
  slug: string
  title: string
  category: 'crash_retrieval' | 'nuclear_interference' | 'military_radar_flir' | 'pilot_sightings' | 'mass_sighting' | 'physical_trace' | string
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
}

const CATEGORY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  crash_retrieval: { label: 'CRASH RETRIEVAL', color: '#ff3366', icon: '💥' },
  nuclear_interference: { label: 'NUCLEAR SILO INCURSION', color: '#ffb700', icon: '☢️' },
  military_radar_flir: { label: 'RADAR & FLIR TELEMETRY', color: '#00f0ff', icon: '📡' },
  pilot_sightings: { label: 'AVIATOR / PILOT LOCK', color: '#00ff66', icon: '✈️' },
  mass_sighting: { label: 'MASS SIGHTING', color: '#9d4edd', icon: '👁️' },
  physical_trace: { label: 'PHYSICAL / SOIL TRACE', color: '#ff9e00', icon: '🔬' },
}

export const UAPRadarAtlas: React.FC = () => {
  const incidents = (uapArchiveData.incidents || []) as UAPIncident[]

  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activeIncident, setActiveIncident] = useState<UAPIncident | null>(incidents[0] || null)
  const [sweepAngle, setSweepAngle] = useState(0)

  // Radar sweep animation
  useEffect(() => {
    let animId: number
    let start = performance.now()
    const frame = (now: number) => {
      const elapsed = (now - start) / 1000
      setSweepAngle((elapsed * 45) % 360) // 45 deg/sec = 8s per rotation
      animId = requestAnimationFrame(frame)
    }
    animId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animId)
  }, [])

  // Filtered incidents
  const filtered = useMemo(() => {
    return incidents.filter((inc) => {
      const matchesCat = selectedCategory === 'all' || inc.category === selectedCategory
      if (!matchesCat) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        inc.title.toLowerCase().includes(q) ||
        inc.location.city.toLowerCase().includes(q) ||
        inc.location.country.toLowerCase().includes(q) ||
        inc.witnesses.some((w) => w.toLowerCase().includes(q)) ||
        inc.militaryUnits.some((m) => m.toLowerCase().includes(q)) ||
        inc.anomalies.some((a) => a.toLowerCase().includes(q))
      )
    })
  }, [incidents, selectedCategory, searchQuery])

  return (
    <div className="w-full rounded-2xl border border-cyan-500/30 bg-[#040711] p-4 sm:p-6 text-slate-100 shadow-[0_0_50px_rgba(0,240,255,0.08)] my-8">
      {/* ── Military HUD Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyan-900/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-mono text-xs uppercase tracking-widest text-cyan-400">
              TACTICAL RADAR DECLASSIFICATION ARCHIVE // GLOBAL DISCLOSURE
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1 font-mono">
            UAP DECLASSIFIED RADAR &amp; INCIDENT ATLAS
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            Cross-indexed military radar locks, crash recoveries, and whistleblower depositions from Greer, Blue Book, and international MoD dossiers.
          </p>
        </div>

        {/* Telemetry Badge HUD */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="rounded border border-cyan-500/40 bg-cyan-950/40 px-3 py-1.5 text-cyan-300">
            <div className="text-[9px] uppercase tracking-wider text-cyan-500">Active Dossiers</div>
            <div className="font-bold text-base text-cyan-200">{incidents.length} CASES</div>
          </div>
          <div className="rounded border border-amber-500/40 bg-amber-950/40 px-3 py-1.5 text-amber-300">
            <div className="text-[9px] uppercase tracking-wider text-amber-500">Radar Verified</div>
            <div className="font-bold text-base text-amber-200">12 INTERCEPTS</div>
          </div>
        </div>
      </div>

      {/* ── Filter Chips Bar ── */}
      <div className="flex flex-wrap items-center gap-2 my-4 pt-1 font-mono text-xs">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded border transition-colors ${
            selectedCategory === 'all'
              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 font-bold shadow-[0_0_10px_rgba(0,240,255,0.3)]'
              : 'border-slate-800 bg-[#090e1a] text-slate-400 hover:border-slate-700'
          }`}
        >
          ALL CATEGORIES ({incidents.length})
        </button>
        {Object.entries(CATEGORY_LABELS).map(([catKey, catMeta]) => {
          const count = incidents.filter((i) => i.category === catKey).length
          const isActive = selectedCategory === catKey
          return (
            <button
              key={catKey}
              type="button"
              onClick={() => setSelectedCategory(catKey)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded border transition-colors ${
                isActive
                  ? 'border-white/80 bg-white/10 text-white font-bold'
                  : 'border-slate-800 bg-[#090e1a] text-slate-400 hover:border-slate-700'
              }`}
              style={{
                borderColor: isActive ? catMeta.color : undefined,
                color: isActive ? catMeta.color : undefined,
                boxShadow: isActive ? `0 0 12px ${catMeta.color}40` : undefined,
              }}
            >
              <span>{catMeta.icon}</span>
              <span>{catMeta.label}</span>
              <span className="opacity-60 text-[10px]">({count})</span>
            </button>
          )
        })}
      </div>

      {/* ── Search Input ── */}
      <div className="relative mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by location, witness (e.g. Fravor, Salas, Marcel), military base, or physical anomaly..."
          className="w-full rounded-lg border border-slate-800 bg-[#080d1a] px-4 py-2.5 font-mono text-sm text-cyan-200 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-xs font-mono text-slate-500 hover:text-slate-300"
          >
            CLEAR
          </button>
        )}
      </div>

      {/* ── Main Tactical Grid: Radar Map View + Selected Dossier ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Tactical Radar Map Visualizer (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-cyan-500/30 bg-[#02050b]">
            {/* Tactical Grid Background & Range Rings */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#00f0ff08_1px,transparent_1px),linear-gradient(to_bottom,#00f0ff08_1px,transparent_1px)] bg-[size:32px_32px]" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-[75%] aspect-square rounded-full border border-cyan-500/15" />
              <div className="absolute h-[50%] aspect-square rounded-full border border-cyan-500/20" />
              <div className="absolute h-[25%] aspect-square rounded-full border border-cyan-500/25" />
              {/* Center Crosshairs */}
              <div className="absolute h-full w-[1px] bg-cyan-500/20" />
              <div className="absolute w-full h-[1px] bg-cyan-500/20" />
            </div>

            {/* Rotating Radar Sweep Line */}
            <div
              className="absolute inset-0 pointer-events-none origin-center"
              style={{
                transform: `rotate(${sweepAngle}deg)`,
                background:
                  'conic-gradient(from 0deg, rgba(0, 240, 255, 0.15) 0deg, rgba(0, 240, 255, 0) 60deg, transparent 60deg)',
              }}
            />

            {/* Tactical Radar HUD Overlay Labels */}
            <div className="absolute top-3 left-3 font-mono text-[10px] text-cyan-400/80 flex flex-col gap-0.5 pointer-events-none">
              <span>RADAR SCAN: ACTIVE</span>
              <span>GRID: WGS-84 GLOBAL COORDINATES</span>
              <span>SWEEP RATE: 45°/SEC</span>
            </div>
            <div className="absolute top-3 right-3 font-mono text-[10px] text-cyan-400/80 pointer-events-none text-right">
              <span>TARGETS IDENTIFIED: {filtered.length}</span>
              <span className="block text-amber-400/80">AIR DEFENSE STATUS: DEFCON 3</span>
            </div>

            {/* Incident Pins on Radar Map */}
            <div className="absolute inset-4 sm:inset-6">
              {filtered.map((inc) => {
                // Map Lat/Lon into roughly 0-100% relative coordinates
                // Lon: -180 to 180 -> 0 to 100%
                // Lat: -60 to 75 -> 100 to 0%
                const x = ((inc.location.longitude + 160) / 260) * 100
                const y = ((70 - inc.location.latitude) / 110) * 100
                const isSelected = activeIncident?.id === inc.id
                const catMeta = CATEGORY_LABELS[inc.category] || { color: '#00f0ff', icon: '🛸' }

                // Clamp within bounds
                const posX = Math.max(5, Math.min(95, x))
                const posY = Math.max(5, Math.min(95, y))

                return (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => setActiveIncident(inc)}
                    title={`${inc.title} (${inc.year})`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer transition-transform hover:scale-125 focus:outline-none"
                    style={{ left: `${posX}%`, top: `${posY}%` }}
                  >
                    {/* Pulsing Target Ring */}
                    <span
                      className={`block rounded-full ${
                        isSelected ? 'h-5 w-5 animate-ping' : 'h-3 w-3'
                      }`}
                      style={{
                        backgroundColor: isSelected ? catMeta.color : `${catMeta.color}88`,
                        boxShadow: `0 0 10px ${catMeta.color}`,
                      }}
                    />
                    <span
                      className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-white"
                      style={{ boxShadow: `0 0 6px ${catMeta.color}` }}
                    />
                    {/* Hover Tooltip Label */}
                    <span className="absolute left-1/2 -top-6 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity border border-cyan-500/40 pointer-events-none z-20">
                      {inc.year} · {inc.location.city}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Bottom Coordinates Readout */}
            <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between font-mono text-[10px] text-slate-500 pointer-events-none">
              <span>LAT 34.0537° N / LON 105.3406° W [ORIGIN ROSWELL]</span>
              <span>USG DECLASSIFIED RETRIEVAL RADAR</span>
            </div>
          </div>

          {/* Incident Quick Selector List Strip */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent">
            {filtered.map((inc) => {
              const isSelected = activeIncident?.id === inc.id
              const catMeta = CATEGORY_LABELS[inc.category] || { color: '#00f0ff', icon: '🛸' }
              return (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => setActiveIncident(inc)}
                  className={`flex-shrink-0 text-left rounded-lg border p-2.5 transition-all w-48 ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                      : 'border-slate-800 bg-[#080d1a] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="font-bold text-cyan-300">{inc.year}</span>
                    <span
                      className="px-1 py-0.2 rounded text-[8px] font-bold"
                      style={{ color: catMeta.color, backgroundColor: `${catMeta.color}22` }}
                    >
                      {catMeta.icon}
                    </span>
                  </div>
                  <div className="font-mono text-xs font-bold text-white truncate mt-1">
                    {inc.location.city}, {inc.location.state || inc.location.country}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                    {inc.title}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: Selected Incident Intelligence Dossier (5 cols) */}
        <div className="lg:col-span-5 flex flex-col">
          {activeIncident ? (
            <div className="rounded-xl border border-cyan-500/30 bg-[#070b16] p-5 font-mono flex flex-col h-full shadow-lg">
              {/* Dossier Header */}
              <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3">
                <span className="rounded border border-red-500/50 bg-red-950/50 px-2 py-0.5 text-[10px] font-bold text-red-300 tracking-wider">
                  {activeIncident.classification}
                </span>
                <span className="text-xs text-cyan-400">
                  REF: {activeIncident.id.toUpperCase()}
                </span>
              </div>

              <div className="mt-3">
                <div className="text-xs text-amber-400 font-bold">
                  {activeIncident.date} · {activeIncident.location.name}
                </div>
                <h3 className="text-xl font-black text-white mt-1 leading-snug">
                  {activeIncident.title}
                </h3>
                <div className="text-xs text-cyan-300/80 mt-1">
                  📍 {activeIncident.location.latitude}° N, {activeIncident.location.longitude}° W (
                  {activeIncident.location.city}, {activeIncident.location.country})
                </div>
              </div>

              {/* Witnesses & Military Units */}
              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] border-y border-slate-800/80 py-2.5">
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Key Witnesses</span>
                  <span className="text-slate-200 font-semibold">
                    {activeIncident.witnesses.join(', ')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Military Units</span>
                  <span className="text-slate-200 font-semibold">
                    {activeIncident.militaryUnits.join(', ')}
                  </span>
                </div>
              </div>

              {/* Physical Anomalies Tags */}
              <div className="mt-3">
                <span className="text-[10px] uppercase text-slate-500 block mb-1.5">
                  Logged Physical Anomalies
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeIncident.anomalies.map((anom, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 text-[10px] text-cyan-300"
                    >
                      ⚡ {anom}
                    </span>
                  ))}
                </div>
              </div>

              {/* Dual-Perspective Narrative */}
              <div className="mt-4 flex-1 space-y-3">
                <div className="rounded border border-slate-800 bg-[#040810] p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                    <span>🏛️</span>
                    <span>Official DoD / Consensus Explanation</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {activeIncident.officialNarrative}
                  </p>
                </div>

                <div className="rounded border border-cyan-500/30 bg-[#04121f] p-3">
                  <div className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1.5">
                    <span>🛸</span>
                    <span>Declassified / Whistleblower Deposition</span>
                  </div>
                  <p className="text-xs text-cyan-200 mt-1 leading-relaxed">
                    {activeIncident.investigativeHypothesis}
                  </p>
                </div>
              </div>

              {/* Primary Source Reference Links */}
              {activeIncident.sources && activeIncident.sources.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-800 text-[11px]">
                  <span className="text-[10px] uppercase text-slate-500 block mb-1">
                    Primary Declassified Sources
                  </span>
                  <div className="space-y-1">
                    {activeIncident.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:text-cyan-200 underline block truncate"
                      >
                        🔗 {src.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-500 font-mono text-xs">
              Select an incident pin on the radar map to inspect the declassified dossier.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
