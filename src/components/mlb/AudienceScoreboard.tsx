'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import populationsData from '@/data/mlb-populations.json'
import './audience-scoreboard.css'

export interface PlatformItem {
  id: string
  name: string
  handle?: string
  url?: string
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

interface GainEvent {
  id: string
  platformId: string
  platformName: string
  color: string
  icon: string
  amount: number
  timestamp: number
}

interface PopulationItem {
  id: string
  name: string
  code: string
  population: number
  year: number
  kind: string
  rank: number
}

function getFlagEmoji(countryCode: string) {
  if (!countryCode || countryCode.length !== 2) return '🌐'
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

function playMilestoneChime(isMajorMilestone = false) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()

    osc.type = 'sine'
    const now = ctx.currentTime
    const startFreq = isMajorMilestone ? 1046.5 : 880
    const endFreq = isMajorMilestone ? 1318.51 : 1174.66

    osc.frequency.setValueAtTime(startFreq, now)
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.12)

    gainNode.gain.setValueAtTime(0.04, now)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)

    osc.connect(gainNode)
    gainNode.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.4)
  } catch {
    // AudioContext blocked or unsupported
  }
}

export const AudienceScoreboard: React.FC<{
  initialPlatforms?: PlatformItem[]
}> = ({ initialPlatforms }) => {
  const [platforms, setPlatforms] = useState<PlatformItem[]>(initialPlatforms ?? [])
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [recentGains, setRecentGains] = useState<GainEvent[]>([])
  const [lastCheckTime, setLastCheckTime] = useState<string>('')
  const [activePulsePlatform, setActivePulsePlatform] = useState<string | null>(null)

  const prevCountsRef = useRef<Record<string, number>>({})
  const prevTotalRef = useRef<number>(0)
  const isFirstLoadRef = useRef(true)

  // Calculate current total audience
  const totalAudience = useMemo(() => {
    return platforms.reduce((acc, p) => acc + (Number(p.count) || 0), 0)
  }, [platforms])

  // Select closest population comparison (largest population <= totalAudience)
  const currentComparison = useMemo(() => {
    const pops = populationsData as PopulationItem[]
    if (!pops.length) return null
    let candidate = pops[0]
    for (const item of pops) {
      if (item.population <= totalAudience) {
        candidate = item
      } else {
        break
      }
    }
    return candidate
  }, [totalAudience])

  // Fetch live telemetry from our server proxy route
  const fetchTelemetry = async () => {
    try {
      const res = await fetch(`/api/mlb-audience?t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = await res.json()
      if (!data || !Array.isArray(data.platforms) || data.platforms.length === 0) return

      const newPlatforms: PlatformItem[] = data.platforms
      const newTotal = Number(data.totalAudience) || newPlatforms.reduce((a, b) => a + (b.count || 0), 0)

      setLastCheckTime(new Date().toLocaleTimeString())

      // Check for deltas on existing platforms
      if (!isFirstLoadRef.current && prevTotalRef.current > 0) {
        const detectedGains: GainEvent[] = []

        for (const np of newPlatforms) {
          const prev = prevCountsRef.current[np.id]
          if (prev != null && np.count > prev) {
            const delta = np.count - prev
            detectedGains.push({
              id: `${np.id}-${Date.now()}`,
              platformId: np.id,
              platformName: np.name,
              color: np.color,
              icon: np.icon,
              amount: delta,
              timestamp: Date.now(),
            })
            setActivePulsePlatform(np.id)
            setTimeout(() => setActivePulsePlatform(null), 3000)
          }
        }

        if (detectedGains.length > 0) {
          setRecentGains((prev) => [...prev, ...detectedGains])

          if (soundEnabled) {
            const isMilestone = Math.floor(newTotal / 1000) > Math.floor(prevTotalRef.current / 1000)
            playMilestoneChime(isMilestone)
          }

          // Automatically clear gain badge after 5 seconds
          setTimeout(() => {
            setRecentGains((current) => current.filter((g) => Date.now() - g.timestamp < 5000))
          }, 5200)
        }
      }

      // Update refs
      const countsMap: Record<string, number> = {}
      for (const p of newPlatforms) {
        countsMap[p.id] = p.count
      }
      prevCountsRef.current = countsMap
      prevTotalRef.current = newTotal
      isFirstLoadRef.current = false

      setPlatforms(newPlatforms)
    } catch (err) {
      console.warn('[AudienceScoreboard] Polling error:', err)
    }
  }

  // Initial fetch and 10-second polling interval
  useEffect(() => {
    fetchTelemetry()
    const timer = setInterval(fetchTelemetry, 10_000)
    return () => clearInterval(timer)
  }, [soundEnabled])

  return (
    <section className="hero follower-power-host audience-scoreboard relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#060a0f] p-6 text-white shadow-2xl my-6 w-full max-w-full">
      {/* ── Electrical Current Animated SVG Wire Border ── */}
      <svg className="audience-border-current" aria-hidden="true" focusable="false">
        <defs>
          <filter id="audience-wire-filament" x="-1%" y="-2%" width="102%" height="104%">
            <feTurbulence type="fractalNoise" baseFrequency=".24 .61" numOctaves={2} seed={17} result="wire-noise" />
            <feDisplacementMap in="SourceGraphic" in2="wire-noise" scale={2} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="audience-wire-discharge" x="-1%" y="-2%" width="102%" height="104%">
            <feTurbulence type="fractalNoise" baseFrequency=".39 .73" numOctaves={2} seed={31} result="arc-noise" />
            <feDisplacementMap in="SourceGraphic" in2="arc-noise" scale={4} xChannelSelector="G" yChannelSelector="R" />
          </filter>
        </defs>
        <rect className="border-current-glow" x={1} y={1} rx={12} pathLength={100} />
        <rect className="border-current-core" x={1} y={1} rx={12} pathLength={100} />
        <rect className="border-current-spark" x={1} y={1} rx={12} pathLength={100} />
      </svg>

      {/* ── Top Header Bar: Title + Sound Toggle + Verification Badge ── */}
      <div className="hero-top flex flex-col sm:flex-row items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <span className="eyebrow audience-heading font-mono text-xs uppercase tracking-widest text-[#e0ffd2]">
          COMBINED AUDIENCE
        </span>
        <div className="flex items-center gap-3">
          <button
            className="audience-sound-toggle rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-[10px] font-mono font-semibold text-emerald-400 hover:bg-emerald-900/60 transition-colors"
            type="button"
            aria-pressed={soundEnabled}
            onClick={() => setSoundEnabled((v) => !v)}
            title="Optional milestone chime; tap to enable sound"
          >
            Sound {soundEnabled ? 'ON' : 'OFF'}
          </button>
          <span className="status audience-metadata flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>4/5 automatic sources verified</span>
          </span>
        </div>
      </div>

      {/* ── Central Odometer & Electric Circuit Arcs ── */}
      <div className="total my-6 flex flex-col items-center justify-center text-center" aria-live="polite">
        <span className="audience-value audience-fit-slot">
          <span className="audience-fit-content golden100-host">
            <span className="charged-audience relative inline-block">
              {/* Giant Glowing Odometer Number */}
              <span className="odometer text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black font-mono tracking-tight text-[#b6ff00]">
                <span className="odometer-visual" data-value={totalAudience.toLocaleString()}>
                  {totalAudience.toLocaleString()}
                </span>
              </span>

              {/* Electric Circuit Arcs SVG */}
              <svg
                className="charge-circuit absolute inset-0 w-full h-full pointer-events-none opacity-80"
                viewBox="0 0 1000 160"
                preserveAspectRatio="none"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  className="charge-arc charge-arc-a"
                  pathLength={1000}
                  stroke="#b6ff00"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.6"
                  d="M0 42 L39 39 52 48 67 29 81 45 118 40 133 53 151 34 173 47 207 42 224 57 243 39 270 49 303 44 329 60 353 52 391 66 M67 29 L88 17 104 28 131 19 M151 34 L176 21 197 32 220 25 M224 57 L247 77 265 65 292 81"
                />
                <path
                  className="charge-arc charge-arc-b"
                  pathLength={1000}
                  stroke="#58e0dd"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.5"
                  d="M1000 124 L969 118 951 132 930 111 912 127 877 119 854 136 839 117 812 128 780 121 759 141 738 124 706 134 679 129 651 146 619 137 M930 111 L905 95 889 108 867 98 M839 117 L816 98 797 109 774 101 M759 141 L736 159 717 145 690 157"
                />
                <path
                  className="charge-arc charge-arc-c"
                  pathLength={1000}
                  stroke="#ffffff"
                  strokeWidth="1"
                  fill="none"
                  opacity="0.4"
                  d="M25 83 L113 83 126 72 137 92 149 81 258 81 269 69 281 88 294 79 403 79 417 92 430 74 443 84 552 84 565 72 578 91 590 81 697 81 710 70 724 90 736 80 843 80 856 72 869 89 880 82 975 82"
                />
              </svg>
            </span>
          </span>
        </span>

        {/* ── Floating Live Gains Badge Slot: (f) +2 ── */}
        <div className="combined-gains-slot min-h-[44px] flex items-center justify-center mt-2">
          {recentGains.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {recentGains.slice(-3).map((g) => (
                <span
                  key={g.id}
                  className="combined-gain inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-sm font-bold shadow-lg animate-bounce"
                  style={{
                    backgroundColor: `${g.color}22`,
                    borderColor: `${g.color}66`,
                    color: g.color,
                  }}
                >
                  <span className="font-sans text-xs uppercase px-1.5 py-0.5 rounded-full bg-white/20">
                    {g.icon}
                  </span>
                  <span>+{g.amount}</span>
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/60 animate-ping" />
              <span>Realtime telemetry active · Polling every 10s</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Dynamic Population Comparison ── */}
      {currentComparison && (
        <p className="population-comparison text-center my-3" aria-live="polite" aria-atomic="true">
          <a
            href="https://data.worldbank.org/indicator/SP.POP.TOTL"
            target="_blank"
            rel="noopener noreferrer"
            title={`${currentComparison.population.toLocaleString()} people · ${currentComparison.year} · World Bank indicator`}
            className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-amber-300 hover:text-amber-200 underline decoration-amber-500/50 hover:decoration-amber-300 transition-colors"
          >
            Bigger than the population of {currentComparison.name} {getFlagEmoji(currentComparison.code)}
          </a>
        </p>
      )}

      {/* ── Footer Metadata ── */}
      <div className="hero-bottom flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-3 pt-3 border-t border-slate-800/80 text-xs font-mono text-slate-400">
        <div>
          <strong className="text-slate-200">Total followers &amp; subscribers</strong>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {platforms.length} accounts · 6 manual counts included {lastCheckTime && `· Last updated ${lastCheckTime}`}
          </p>
        </div>
        <div className="hero-note text-right hidden sm:block">
          <span className="text-slate-300">Independent research.</span>
          <br />
          <span className="text-emerald-400 font-semibold">A growing community.</span>
        </div>
      </div>

      {/* ── Segmented Platform Audience Ratio Bar ── */}
      <div className="segmented mt-4 flex h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
        {platforms.map((p) => {
          const pct = totalAudience > 0 ? (Number(p.count || 0) / totalAudience) * 100 : 0
          return (
            <div
              key={p.id}
              title={`${p.name}: ${Number(p.count || 0).toLocaleString()}`}
              className="h-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: p.color }}
            />
          )
        })}
      </div>

      {/* ── 11-Platform Social Matrix Grid ── */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        {platforms.map((plat) => {
          const isPulsing = activePulsePlatform === plat.id
          return (
            <a
              key={plat.id}
              href={plat.url || '#'}
              target={plat.url ? '_blank' : undefined}
              rel="noreferrer"
              className={`group rounded-lg border bg-[#0d1320] p-3 transition-all ${
                isPulsing
                  ? 'border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)] scale-105'
                  : 'border-slate-800 hover:border-amber-500/40 hover:bg-[#121a2c]'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 group-hover:text-white transition-colors">
                  {plat.name}
                </span>
                <span
                  className="font-mono text-[10px] px-1.5 py-0.5 rounded font-bold"
                  style={{ backgroundColor: `${plat.color}22`, color: plat.color }}
                >
                  {plat.status === 'current' ? 'LIVE' : 'SYNC'}
                </span>
              </div>
              <div className="mt-1.5 font-mono text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                {Number(plat.count || 0).toLocaleString()}
              </div>
              <div className="mt-0.5 text-[11px] font-mono text-slate-400 truncate">
                {plat.gain28 != null && plat.gain28 > 0 ? (
                  <span className="text-emerald-400">+{Number(plat.gain28).toLocaleString()} (28d)</span>
                ) : (
                  <span className="text-slate-400">Tracked</span>
                )}
              </div>
            </a>
          )
        })}
      </div>
    </section>
  )
}
