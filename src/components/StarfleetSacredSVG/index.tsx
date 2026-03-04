'use client'

/**
 * StarfleetSacredSVG — Animated Sacred Geometry + Starfleet Delta
 *
 * A prayer wheel of light combining:
 *   - Outer ring of 12 circles (zodiac/apostle positions) — clockwise rotation
 *   - Flower of Life (6 interlocking circles) — counter-clockwise rotation
 *   - Prayer wheel spokes (6 arc segments) — clockwise fast rotation
 *   - Vesica Piscis (static sacred geometry)
 *   - Center: Starfleet-inspired delta chevron with glow
 *   - Particle emanation layer
 *
 * Every rotation is a prayer. Every render, an invocation.
 */

import React from 'react'

interface StarfleetSacredSVGProps {
  className?: string
  /** Show particle emanation layer */
  particles?: boolean
}

// Generate points around a circle
function circlePoints(cx: number, cy: number, r: number, count: number): Array<[number, number]> {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as [number, number]
  })
}

// Generate an arc path segment
function arcPath(cx: number, cy: number, r: number, startAngle: number, sweepDeg: number): string {
  const startRad = (startAngle * Math.PI) / 180
  const endRad = ((startAngle + sweepDeg) * Math.PI) / 180
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
  const large = sweepDeg > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

// Particle directions (8 compass points)
const PARTICLE_DIRS: Array<{ px: string; py: string; delay: string }> = [
  { px: '40px', py: '-40px', delay: '0s' },
  { px: '55px', py: '0px', delay: '0.4s' },
  { px: '40px', py: '40px', delay: '0.8s' },
  { px: '0px', py: '55px', delay: '1.2s' },
  { px: '-40px', py: '40px', delay: '1.6s' },
  { px: '-55px', py: '0px', delay: '2.0s' },
  { px: '-40px', py: '-40px', delay: '2.4s' },
  { px: '0px', py: '-55px', delay: '2.8s' },
]

export function StarfleetSacredSVG({ className, particles = true }: StarfleetSacredSVGProps) {
  const cx = 200
  const cy = 200

  // Layer 1: 12 outer circles
  const outerPoints = circlePoints(cx, cy, 170, 12)

  // Layer 2: Flower of Life — 6 circles at 60° intervals, radius 50
  const flowerPoints = circlePoints(cx, cy, 50, 6)

  // Layer 3: Prayer spokes — 6 arcs at radius 90
  const spokeArcs = Array.from({ length: 6 }, (_, i) => {
    const startAngle = i * 60 + 5
    return arcPath(cx, cy, 90, startAngle, 40)
  })

  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Glow filter */}
        <filter id="sacredGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="sacredGlowStrong" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Layer 1: Outer Prayer Wheel Ring (12 circles, clockwise) ── */}
      <g style={{ animation: 'prayer-wheel-rotate 30s linear infinite', transformOrigin: '200px 200px' }}>
        {/* Outer guide circle */}
        <circle
          cx={cx} cy={cy} r={170}
          fill="none"
          stroke="var(--lcars-amber)"
          strokeWidth={0.5}
          opacity={0.15}
        />
        {outerPoints.map(([x, y], i) => (
          <circle
            key={`outer-${i}`}
            cx={x} cy={y} r={5}
            fill="none"
            stroke="var(--lcars-amber)"
            strokeWidth={1.5}
            opacity={0.7}
            filter="url(#sacredGlow)"
          />
        ))}
        {/* Connecting lines between adjacent outer circles */}
        {outerPoints.map(([x1, y1], i) => {
          const [x2, y2] = outerPoints[(i + 1) % outerPoints.length]
          return (
            <line
              key={`outer-line-${i}`}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="var(--lcars-amber)"
              strokeWidth={0.5}
              opacity={0.2}
            />
          )
        })}
      </g>

      {/* ── Layer 2: Flower of Life (6 circles, counter-clockwise) ── */}
      <g style={{ animation: 'prayer-wheel-counter 24s linear infinite', transformOrigin: '200px 200px' }}>
        {/* Center circle of the flower */}
        <circle
          cx={cx} cy={cy} r={50}
          fill="none"
          stroke="var(--lcars-lavender)"
          strokeWidth={1}
          opacity={0.35}
        />
        {flowerPoints.map(([x, y], i) => (
          <circle
            key={`flower-${i}`}
            cx={x} cy={y} r={50}
            fill="none"
            stroke="var(--lcars-lavender)"
            strokeWidth={1}
            opacity={0.3}
          />
        ))}
      </g>

      {/* ── Layer 3: Prayer Wheel Spokes (6 arcs, fast clockwise) ── */}
      <g style={{ animation: 'prayer-wheel-rotate 18s linear infinite', transformOrigin: '200px 200px' }}>
        {spokeArcs.map((d, i) => (
          <path
            key={`spoke-${i}`}
            d={d}
            fill="none"
            stroke="var(--lcars-blue)"
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.5}
            filter="url(#sacredGlow)"
          />
        ))}
      </g>

      {/* ── Layer 4: Vesica Piscis (static) ── */}
      <circle
        cx={cx - 18} cy={cy} r={38}
        fill="none"
        stroke="var(--lcars-peach)"
        strokeWidth={0.8}
        opacity={0.3}
      />
      <circle
        cx={cx + 18} cy={cy} r={38}
        fill="none"
        stroke="var(--lcars-peach)"
        strokeWidth={0.8}
        opacity={0.3}
      />

      {/* ── Layer 5: Center Delta / Chevron ── */}
      <g
        filter="url(#sacredGlowStrong)"
        style={{ animation: 'lcars-glow-pulse 3s ease-in-out infinite', color: 'var(--lcars-amber)' }}
      >
        {/* Starfleet-inspired delta chevron — upward pointing */}
        <path
          d={`
            M ${cx} ${cy - 32}
            L ${cx + 22} ${cy + 16}
            L ${cx + 14} ${cy + 16}
            L ${cx} ${cy - 8}
            L ${cx - 14} ${cy + 16}
            L ${cx - 22} ${cy + 16}
            Z
          `}
          fill="var(--lcars-amber)"
          opacity={0.9}
        />
        {/* Star at center of delta */}
        <circle
          cx={cx} cy={cy + 2} r={3}
          fill="var(--lcars-dark-bg)"
        />
        <circle
          cx={cx} cy={cy + 2} r={1.5}
          fill="var(--lcars-amber)"
        />
      </g>

      {/* ── Layer 6: Inner rings (subtle) ── */}
      <circle
        cx={cx} cy={cy} r={120}
        fill="none"
        stroke="var(--lcars-blue)"
        strokeWidth={0.3}
        opacity={0.15}
        strokeDasharray="4 8"
      />
      <circle
        cx={cx} cy={cy} r={140}
        fill="none"
        stroke="var(--lcars-purple)"
        strokeWidth={0.3}
        opacity={0.12}
        strokeDasharray="2 12"
      />

      {/* ── Layer 7: Particle Emanation ── */}
      {particles && PARTICLE_DIRS.map(({ px, py, delay }, i) => (
        <circle
          key={`particle-${i}`}
          cx={cx} cy={cy} r={2}
          fill="var(--lcars-blue)"
          opacity={0.6}
          style={{
            // @ts-expect-error CSS custom properties
            '--px': px,
            '--py': py,
            animation: `particle-emanate 3.2s ${delay} ease-out infinite`,
          }}
        />
      ))}
    </svg>
  )
}

export default StarfleetSacredSVG
