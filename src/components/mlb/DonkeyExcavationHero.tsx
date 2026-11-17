'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface Hotspot {
  id: string
  depthFt: number
  title: string
  subtitle: string
  description: string
  episodeRef?: { number: number; title: string; youtubeId: string }
}

const SUBTERRANEAN_HOTSPOTS: Hotspot[] = [
  {
    id: 'buried-windows',
    depthFt: 18,
    title: 'BURIED ARCHED WINDOWS',
    subtitle: 'Strata 1 (-18 FT)',
    description:
      'Fully formed 12-foot classical arched windows buried completely under 15 feet of packed clay and silt, originally designed for sunlight and human entry.',
    episodeRef: { number: 182, title: 'The Subterranean Cities of America', youtubeId: 'tdpaBMgz2mE' },
  },
  {
    id: 'mudflood-arcades',
    depthFt: 30,
    title: 'SUBTERRANEAN ARCADES & STREETS',
    subtitle: 'Strata 2 (-30 FT)',
    description:
      'Paved Romanesque brick archways and storefront entrances bricked shut during late-19th-century street elevation projects.',
    episodeRef: { number: 199, title: 'Paris 1900 — The World Beneath', youtubeId: 'tdpaBMgz2mE' },
  },
  {
    id: 'megalithic-core',
    depthFt: 45,
    title: 'MEGALITHIC FOUNDATION & CONDUITS',
    subtitle: 'Bedrock (-45 FT)',
    description:
      'Heavy ashlar and high-fired antique brick foundations that far predate the 1880s recorded construction date.',
    episodeRef: { number: 164, title: 'Worlds Fairs Were NOT Temporary', youtubeId: 'tdpaBMgz2mE' },
  },
]

export const DonkeyExcavationHero: React.FC<{
  onExploreAtlas?: () => void
}> = ({ onExploreAtlas }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [depthFt, setDepthFt] = useState<number>(0)
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const isRadarSweeping = true

  // Neon sign letters for "MY LUNCH BREAK LIVE"
  // The 'U' has a realistic vintage tube flicker (delayed ignition)
  const titleWords = [
    { word: 'MY', letters: ['M', 'Y'] },
    { word: 'LUNCH', letters: ['L', 'U', 'N', 'C', 'H'] },
    { word: 'BREAK', letters: ['B', 'R', 'E', 'A', 'K'] },
    { word: 'LIVE', letters: ['L', 'I', 'V', 'E'] },
  ]

  // Canvas render loop: procedural flag, donkey, capitol building, ladder, and radar strata
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0
    let running = true

    // Internal virtual resolution: 480 x 180 (scaled by 2x on 960x360 canvas)
    const VW = 480
    const VH = 180

    const render = (timeMs: number) => {
      if (!running) return
      const t = timeMs / 1000

      ctx.setTransform(2, 0, 0, 2, 0, 0)
      ctx.clearRect(0, 0, VW, VH)

      // ── 1. Sky & Horizon ──
      ctx.fillStyle = '#060a0f'
      ctx.fillRect(0, 0, VW, VH)

      // Ambient night horizon glow behind dome (centered at domeCx = 317.5)
      const domeCxGlow = 317.5
      const horizonGrad = ctx.createRadialGradient(domeCxGlow, 85, 10, domeCxGlow, 85, 130)
      horizonGrad.addColorStop(0, 'rgba(40, 70, 60, 0.28)')
      horizonGrad.addColorStop(1, 'rgba(6, 10, 15, 0)')
      ctx.fillStyle = horizonGrad
      ctx.fillRect(160, 10, 300, 150)

      // ── 2. Street Level Line (y = 135) ──
      const groundY = 135
      ctx.strokeStyle = '#475569'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(0, groundY)
      ctx.lineTo(VW, groundY)
      ctx.stroke()

      // Cobblestone / dirt texture specs
      ctx.fillStyle = '#1e293b'
      for (let i = 0; i < VW; i += 8) {
        ctx.fillRect(i + ((i * 13) % 5), groundY + 1, 3, 1)
      }

      // ── 3. Waving Flag: "DONKEY'S INC." (x: 18, y: 70 to 94) ──
      const flagWave = (n: number) => Math.sin(t * 3.2 - n * 5) * 1.5 + Math.sin(t * 1.8 - n * 3) * 0.8

      // Flagpole
      ctx.beginPath()
      ctx.moveTo(18, groundY)
      ctx.lineTo(18, 68)
      ctx.strokeStyle = '#78716c'
      ctx.lineWidth = 1.3
      ctx.stroke()

      // Gold finial on top of flagpole
      ctx.beginPath()
      ctx.arc(18, 67.5, 1.3, 0, Math.PI * 2)
      ctx.fillStyle = '#f59e0b'
      ctx.fill()

      // Silk flag body
      ctx.beginPath()
      for (let i = 0; i <= 20; i++) {
        const u = i / 20
        const x = 19 + u * 50
        const y = 71 + flagWave(u)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      for (let i = 20; i >= 0; i--) {
        const u = i / 20
        const x = 19 + u * 50
        const y = 92 + flagWave(u)
        ctx.lineTo(x, y)
      }
      ctx.closePath()

      const flagGrad = ctx.createLinearGradient(19, 71, 69, 92)
      flagGrad.addColorStop(0, '#1d4ed8')
      flagGrad.addColorStop(1, '#0f172a')
      ctx.fillStyle = flagGrad
      ctx.fill()

      // Text on flag: "DONKEY'S INC."
      ctx.save()
      ctx.font = 'bold 6.5px Georgia, serif'
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = '#020617'
      ctx.shadowBlur = 1
      ctx.fillText("DONKEY'S", 23, 80 + flagWave(0.3))
      ctx.font = 'bold 5.8px Georgia, serif'
      ctx.fillText('INC.', 31, 88 + flagWave(0.5))
      ctx.restore()

      // ── 4. The Neoclassical Capitol / Cathedral Dome (X_BASE = 95) ──
      const X_BASE = 95
      const capitolOutline: [number, number][] = [
        [X_BASE + 130, 135], [X_BASE + 130, 102], [X_BASE + 140, 102], [X_BASE + 140, 95], [X_BASE + 148, 90],
        [X_BASE + 175, 90], [X_BASE + 184, 95], [X_BASE + 198, 95], [X_BASE + 198, 80], [X_BASE + 194, 80],
        [X_BASE + 194, 71], [X_BASE + 197, 71], [X_BASE + 197, 56], [X_BASE + 202, 44], [X_BASE + 211, 36],
        [X_BASE + 218, 33], [X_BASE + 218, 24], [X_BASE + 221, 24], [X_BASE + 222, 18], [X_BASE + 224, 24],
        [X_BASE + 227, 24], [X_BASE + 227, 33], [X_BASE + 235, 36], [X_BASE + 244, 44], [X_BASE + 249, 56],
        [X_BASE + 249, 71], [X_BASE + 252, 71], [X_BASE + 252, 80], [X_BASE + 247, 80], [X_BASE + 247, 95],
        [X_BASE + 261, 95], [X_BASE + 270, 90], [X_BASE + 297, 90], [X_BASE + 305, 95], [X_BASE + 305, 102],
        [X_BASE + 314, 102], [X_BASE + 314, 135],
      ]

      ctx.beginPath()
      capitolOutline.forEach(([px, py], idx) => {
        if (idx === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.closePath()

      // Stone building fill gradient (marble / limestone)
      const bldgGrad = ctx.createLinearGradient(X_BASE + 130, 25, X_BASE + 314, 135)
      bldgGrad.addColorStop(0, '#e2e8f0')
      bldgGrad.addColorStop(0.5, '#cbd5e1')
      bldgGrad.addColorStop(1, '#94a3b8')
      ctx.fillStyle = bldgGrad
      ctx.fill()
      ctx.strokeStyle = '#475569'
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Neoclassical Dome detail (hemisphere with ribs)
      const domeCx = X_BASE + 222.5
      const domeCy = 64
      const domeR = 21

      ctx.beginPath()
      ctx.arc(domeCx, domeCy, domeR, Math.PI, Math.PI * 2)
      ctx.fillStyle = '#64748b'
      ctx.fill()
      ctx.strokeStyle = '#334155'
      ctx.lineWidth = 0.6
      ctx.stroke()

      // Dome vertical copper ribs
      for (let r = -15; r <= 15; r += 5) {
        ctx.beginPath()
        ctx.moveTo(domeCx + r, domeCy)
        ctx.quadraticCurveTo(domeCx + r * 0.4, domeCy - domeR, domeCx, domeCy - domeR)
        ctx.strokeStyle = '#94a3b8'
        ctx.lineWidth = 0.4
        ctx.stroke()
      }

      // Colonnade (Corinthian pillars on facade)
      for (let colX = X_BASE + 145; colX <= X_BASE + 300; colX += 7.5) {
        if ((colX > X_BASE + 192 && colX < X_BASE + 210) || (colX > X_BASE + 235 && colX < X_BASE + 252)) continue
        ctx.fillStyle = '#f8fafc'
        ctx.fillRect(colX, 99, 1.8, 36)
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(colX + 2.2, 107, 3.8, 22) // shadow / recessed window
      }

      // Grand Entrance Portico & Triangular Pediment
      ctx.beginPath()
      ctx.moveTo(X_BASE + 205, 95)
      ctx.lineTo(domeCx, 84)
      ctx.lineTo(X_BASE + 240, 95)
      ctx.closePath()
      ctx.fillStyle = '#f1f5f9'
      ctx.fill()
      ctx.strokeStyle = '#334155'
      ctx.lineWidth = 0.6
      ctx.stroke()

      // Main Entrance Arch
      ctx.beginPath()
      ctx.arc(domeCx, 123, 4.5, Math.PI, 0)
      ctx.lineTo(domeCx + 4.5, 135)
      ctx.lineTo(domeCx - 4.5, 135)
      ctx.closePath()
      ctx.fillStyle = '#090d16'
      ctx.fill()

      // ── 5. Rickety Wooden Ladder Leaning on the 300ft Dome (Satire) ──
      ctx.strokeStyle = '#b45309'
      ctx.lineWidth = 0.6
      ctx.beginPath()
      ctx.moveTo(domeCx - 6.5, 135)
      ctx.lineTo(domeCx - 1.5, 37)
      ctx.moveTo(domeCx - 5, 135)
      ctx.lineTo(domeCx, 37)
      ctx.stroke()

      // Rungs
      for (let rungY = 41; rungY < 134; rungY += 4) {
        const u = (rungY - 37) / (135 - 37)
        const lx1 = domeCx - 1.5 + (-5) * (1 - u)
        const lx2 = domeCx + (-5) * (1 - u)
        ctx.beginPath()
        ctx.moveTo(lx1, rungY)
        ctx.lineTo(lx2 + 1.5, rungY)
        ctx.strokeStyle = '#d97706'
        ctx.lineWidth = 0.4
        ctx.stroke()
      }

      // ── 6. The Procedural Donkey (x: 58, y: 133) ──
      ctx.save()
      ctx.translate(58, 133)
      ctx.scale(0.85, 0.85)

      // Ground shadow
      ctx.beginPath()
      ctx.ellipse(-1, 5, 10, 1.4, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
      ctx.fill()

      // Legs with trotting / idle gait
      for (const [idx, lx] of [-7, -3, 4, 7].entries()) {
        const step = Math.sin(t * 3.5 + idx * 1.5) * 0.8
        ctx.beginPath()
        ctx.moveTo(lx, -4)
        ctx.lineTo(lx + step * 0.5, 1)
        ctx.lineTo(lx + step, 5)
        ctx.strokeStyle = '#78716c'
        ctx.lineWidth = 1.3
        ctx.stroke()

        // Hoof
        ctx.fillStyle = '#1c1917'
        ctx.fillRect(lx + step - 0.5, 4.8, 1.4, 0.9)
      }

      // Torso / Donkey Body
      ctx.beginPath()
      ctx.moveTo(-10, -7)
      ctx.bezierCurveTo(-12, -15, -3, -16, 5, -13)
      ctx.bezierCurveTo(9, -16, 8, -21, 12, -20)
      ctx.bezierCurveTo(16, -20, 18, -15, 16, -13)
      ctx.bezierCurveTo(12, -10, 9, -11, 8, -5)
      ctx.bezierCurveTo(4, -1, -8, -1, -10, -7)
      ctx.closePath()

      const donkeyGrad = ctx.createLinearGradient(-10, -15, 10, 5)
      donkeyGrad.addColorStop(0, '#a8a29e')
      donkeyGrad.addColorStop(1, '#57534e')
      ctx.fillStyle = donkeyGrad
      ctx.fill()

      // Snout
      ctx.beginPath()
      ctx.ellipse(15, -15, 3.2, 2.1, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#d6d3d1'
      ctx.fill()
      ctx.fillStyle = '#292524'
      ctx.fillRect(16.5, -15.5, 0.6, 0.8) // nostril

      // Ears (twitching)
      const earTwitch = Math.sin(t * 1.2) > 0.9 ? 1.5 : 0
      ctx.beginPath()
      ctx.moveTo(10, -19)
      ctx.quadraticCurveTo(10 + earTwitch, -30, 12 + earTwitch, -28)
      ctx.lineTo(13, -19)
      ctx.closePath()
      ctx.fillStyle = '#78716c'
      ctx.fill()

      // Eye with occasional blink
      const blink = Math.sin(t * 0.7) > 0.95
      ctx.fillStyle = blink ? '#57534e' : '#0c0a09'
      ctx.fillRect(13, -17.5, 0.8, blink ? 0.2 : 0.8)

      // Wagging Tail
      const tailWag = Math.sin(t * 5) * 2.5
      ctx.beginPath()
      ctx.moveTo(-10, -10)
      ctx.bezierCurveTo(-14, -9, -12, -2, -15 + tailWag, 0)
      ctx.strokeStyle = '#78716c'
      ctx.lineWidth = 0.8
      ctx.stroke()
      ctx.fillStyle = '#292524'
      ctx.fillRect(-16 + tailWag, -0.5, 1.4, 1.2) // tail brush

      ctx.restore()

      // Tiny mason worker figure standing at ladder base
      ctx.fillStyle = '#94a3b8'
      ctx.fillRect(domeCx - 8.5, 129, 1.5, 5) // body
      ctx.beginPath()
      ctx.arc(domeCx - 7.7, 127.8, 1, 0, Math.PI * 2)
      ctx.fillStyle = '#fde68a'
      ctx.fill() // hard hat

      // ── 7. Ground-Penetrating Radar Subterranean Mud-Flood Layer (y > 126) ──
      // Height available below ground: 180 - 126 = 54 virtual pixels (representing up to -50 FT)
      const maxSubH = VH - groundY
      const activeExcavationH = (depthFt / 45) * maxSubH

      if (activeExcavationH > 1) {
        ctx.save()
        // Clip to the excavated subterranean area
        ctx.beginPath()
        ctx.rect(0, groundY, VW, activeExcavationH)
        ctx.clip()

        // Mud / Silt strata background
        const strataGrad = ctx.createLinearGradient(0, groundY, 0, VH)
        strataGrad.addColorStop(0, '#1c1917') // Topsoil / modern fill
        strataGrad.addColorStop(0.35, '#292524') // Clay / mud-flood strata
        strataGrad.addColorStop(0.7, '#1f130b') // Antique red brick foundation
        strataGrad.addColorStop(1, '#0c0a09') // Bedrock / conduit core
        ctx.fillStyle = strataGrad
        ctx.fillRect(0, groundY, VW, maxSubH)

        // Subterranean Strata Geological Lines
        ctx.strokeStyle = 'rgba(180, 83, 9, 0.25)'
        ctx.lineWidth = 0.5
        for (let sy = groundY + 12; sy < VH; sy += 14) {
          ctx.beginPath()
          ctx.moveTo(0, sy)
          ctx.lineTo(VW, sy + Math.sin(sy) * 2)
          ctx.stroke()
        }

        // Subterranean Buried Building Extension (The Mud-Flood Reality)
        // Shows 3 hidden lower stories continuing straight down beneath the Capitol facade!
        const bldgLeft = 130
        const bldgRight = 314
        const bldgWidth = bldgRight - bldgLeft

        // Antique Red Brick Sub-Basement Wall
        ctx.fillStyle = '#3f1f1a'
        ctx.fillRect(bldgLeft, groundY, bldgWidth, maxSubH)
        ctx.strokeStyle = '#7f2d22'
        ctx.lineWidth = 0.4
        ctx.strokeRect(bldgLeft, groundY, bldgWidth, maxSubH)

        // Buried Arched Windows & Doors (The smoking gun evidence)
        for (let bx = bldgLeft + 8; bx < bldgRight - 8; bx += 14) {
          // Level 1: Buried windows (-15 FT, y ~ 138)
          ctx.beginPath()
          ctx.arc(bx + 4, groundY + 10, 3, Math.PI, 0)
          ctx.lineTo(bx + 7, groundY + 18)
          ctx.lineTo(bx + 1, groundY + 18)
          ctx.closePath()
          ctx.fillStyle = '#0f172a'
          ctx.fill()
          ctx.strokeStyle = '#f59e0b'
          ctx.lineWidth = 0.4
          ctx.stroke()

          // Level 2: Subterranean Arched Portals (-30 FT, y ~ 154)
          ctx.beginPath()
          ctx.arc(bx + 4, groundY + 26, 3.8, Math.PI, 0)
          ctx.lineTo(bx + 7.8, groundY + 38)
          ctx.lineTo(bx + 0.2, groundY + 38)
          ctx.closePath()
          ctx.fillStyle = '#020617'
          ctx.fill()
          ctx.strokeStyle = '#38bdf8'
          ctx.lineWidth = 0.4
          ctx.stroke()
        }

        // Ancient Energy Grid Conduit Chamber (-45 FT, y ~ 170)
        ctx.strokeStyle = '#10b981'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(bldgLeft + 20, groundY + 46)
        ctx.lineTo(bldgRight - 20, groundY + 46)
        ctx.stroke()

        // Pulsing glowing power conduits
        const conduitPulse = (Math.sin(t * 4) + 1) * 0.5
        ctx.fillStyle = `rgba(16, 185, 129, ${0.3 + conduitPulse * 0.5})`
        for (let cx = bldgLeft + 30; cx < bldgRight - 30; cx += 25) {
          ctx.beginPath()
          ctx.arc(cx, groundY + 46, 2, 0, Math.PI * 2)
          ctx.fill()
        }

        // Radar Scanning Sweep Line (Cyan / Neon Green)
        if (isRadarSweeping) {
          const scanY = groundY + ((t * 22) % activeExcavationH)
          const scanGrad = ctx.createLinearGradient(0, scanY - 6, 0, scanY)
          scanGrad.addColorStop(0, 'rgba(34, 197, 94, 0)')
          scanGrad.addColorStop(1, 'rgba(34, 197, 94, 0.45)')
          ctx.fillStyle = scanGrad
          ctx.fillRect(0, scanY - 6, VW, 6)

          ctx.strokeStyle = '#4ade80'
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.moveTo(0, scanY)
          ctx.lineTo(VW, scanY)
          ctx.stroke()
        }

        // Depth markers on the left axis
        ctx.font = '5px monospace'
        ctx.fillStyle = '#94a3b8'
        ctx.fillText('0 FT', 2, groundY + 6)
        if (activeExcavationH > 15) ctx.fillText('-15 FT', 2, groundY + 18)
        if (activeExcavationH > 30) ctx.fillText('-30 FT', 2, groundY + 34)
        if (activeExcavationH > 42) ctx.fillText('-45 FT', 2, groundY + 48)

        ctx.restore()
      }

      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => {
      running = false
      cancelAnimationFrame(animId)
    }
  }, [depthFt, isRadarSweeping])

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#060a0f] text-white shadow-2xl mb-8 w-full max-w-full select-none">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-center p-4 sm:p-5 md:p-6 w-full max-w-full">
        {/* ── Column 1: Neon Title & Community Tagline (Top on Mobile, Left 5 cols on Desktop) ── */}
        <div className="md:col-span-5 flex flex-col justify-center select-none w-full min-w-0">
          {/* Channel Tag */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-semibold truncate">
              MY LUNCH BREAK · COMMUNITY ARCHIVE
            </span>
          </div>

          {/* Row 1: MY LUNCH BREAK */}
          <h1 className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl font-black tracking-wider flex flex-wrap items-baseline gap-x-2 sm:gap-x-2.5">
            <span
              className="text-[#e0ffd2] drop-shadow-[0_0_8px_rgba(71,255,24,0.75)]"
              style={{
                textShadow: '0 0 2px #ffffff, 0 0 8px #47ff18, 0 0 22px rgba(66,229,26,0.6)',
                WebkitTextStroke: '0.5px #9dff70',
              }}
            >
              MY
            </span>
            <span className="inline-flex">
              <span
                className="text-[#e0ffd2] drop-shadow-[0_0_8px_rgba(71,255,24,0.75)]"
                style={{
                  textShadow: '0 0 2px #ffffff, 0 0 8px #47ff18, 0 0 22px rgba(66,229,26,0.6)',
                  WebkitTextStroke: '0.5px #9dff70',
                }}
              >
                L
              </span>
              {/* Signature unlit 'U' tube */}
              <span
                className="text-emerald-950/60 transition-colors duration-200"
                style={{
                  textShadow: '0 0 2px rgba(16,185,129,0.2)',
                  WebkitTextStroke: '0.6px #064e3b',
                }}
              >
                U
              </span>
              <span
                className="text-[#e0ffd2] drop-shadow-[0_0_8px_rgba(71,255,24,0.75)]"
                style={{
                  textShadow: '0 0 2px #ffffff, 0 0 8px #47ff18, 0 0 22px rgba(66,229,26,0.6)',
                  WebkitTextStroke: '0.5px #9dff70',
                }}
              >
                NCH
              </span>
            </span>
            <span
              className="text-[#e0ffd2] drop-shadow-[0_0_8px_rgba(71,255,24,0.75)]"
              style={{
                textShadow: '0 0 2px #ffffff, 0 0 8px #47ff18, 0 0 22px rgba(66,229,26,0.6)',
                WebkitTextStroke: '0.5px #9dff70',
              }}
            >
              BREAK
            </span>
          </h1>

          {/* Row 2: LIVE */}
          <div
            className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl font-black tracking-wider text-[#e0ffd2] mt-0.5 drop-shadow-[0_0_8px_rgba(71,255,24,0.75)]"
            style={{
              textShadow: '0 0 2px #ffffff, 0 0 8px #47ff18, 0 0 22px rgba(66,229,26,0.6)',
              WebkitTextStroke: '0.5px #9dff70',
            }}
          >
            LIVE
          </div>

          {/* Row 3: Tagline */}
          <p className="mt-2 text-xs sm:text-sm font-medium text-slate-300 tracking-wide">
            Your community, all in one place.
          </p>
        </div>

        {/* ── Column 2: Animation Viewport (Under text on Mobile, Right 7 cols on Desktop) ── */}
        <div className="md:col-span-7 relative w-full aspect-[16/6] min-h-[140px] sm:min-h-[160px] md:min-h-[180px] rounded-xl overflow-hidden bg-[#060a0f] border border-slate-800/80 shadow-inner">
          <canvas
            ref={canvasRef}
            width={960}
            height={360}
            className="h-full w-full object-cover select-none pointer-events-none block"
          />

          {/* Bottom Right: Authentic [ ↖ VIEW EXCAVATION ] Button inside animation container */}
          <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-10">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 rounded border border-[#c29b38]/80 bg-[#0c1017]/90 px-2.5 sm:px-3.5 py-1 text-[10px] sm:text-xs font-mono font-bold text-[#e6c875] hover:bg-[#151c28] hover:border-[#e6c875] hover:text-[#fff0ad] transition-all shadow-xl backdrop-blur-sm cursor-pointer"
            >
              <span className="text-xs sm:text-sm font-black">↖</span>
              <span className="tracking-wider">VIEW EXCAVATION</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Excavation Archive Modal (`[ ↖ VIEW EXCAVATION ]`) ── */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl rounded-2xl border border-amber-500/50 bg-[#090d16] p-6 text-white shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <span className="text-[11px] font-mono tracking-widest text-amber-400 uppercase">
                  MY LUNCH BREAK // INVESTIGATIVE DOSSIER
                </span>
                <h2 className="text-2xl font-black text-white mt-1">
                  THE GREAT EXCAVATION ARCHIVE
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Subterranean street elevations, buried colonnades, and the Mud-Flood architectural evidence.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-sm font-mono text-slate-300 hover:text-white cursor-pointer"
              >
                ✕ CLOSE
              </button>
            </div>

            {/* Modal GPR Radar Depth Controller */}
            <div className="rounded-xl border border-slate-800 bg-[#060a0f] p-4 mb-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-mono text-emerald-400">
                    📡 GPR RADAR TELEMETRY
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-300">
                    {depthFt === 0
                      ? 'SURFACE STORY (0 FT)'
                      : `DEPTH: -${depthFt} FT · MUD-FLOOD STRATA EXPOSED`}
                  </span>
                </div>
                {/* Preset Depth Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDepthFt(0)}
                    className={`rounded px-2.5 py-1 text-xs font-mono transition-colors cursor-pointer ${
                      depthFt === 0
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    Surface (0&apos;)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepthFt(18)}
                    className={`rounded px-2.5 py-1 text-xs font-mono transition-colors cursor-pointer ${
                      depthFt === 18
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    -18 FT
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepthFt(45)}
                    className={`rounded px-2.5 py-1 text-xs font-mono transition-colors cursor-pointer ${
                      depthFt === 45
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    -45 FT
                  </button>
                </div>
              </div>

              {/* Slider */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-400">SURFACE</span>
                <input
                  type="range"
                  min={0}
                  max={45}
                  step={1}
                  value={depthFt}
                  onChange={(e) => setDepthFt(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
                <span className="text-[11px] font-mono text-amber-400">-45&apos; BEDROCK</span>
              </div>
            </div>

            {/* Evidence Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-xs font-mono text-amber-400 mb-1">EPISODE 182</div>
                <h3 className="font-bold text-sm text-white">The Subterranean Cities of America</h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  How Seattle, Chicago, Chattanooga, and Atlanta raised their street levels 15 to 30 feet, leaving full-height brick buildings with arched windows completely underground.
                </p>
                <div className="mt-3">
                  <a
                    href="https://www.youtube.com/watch?v=tdpaBMgz2mE"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-mono text-amber-400 hover:underline"
                  >
                    ▶ Watch on YouTube (34:12) ↗
                  </a>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-xs font-mono text-amber-400 mb-1">EPISODE 199</div>
                <h3 className="font-bold text-sm text-white">Paris 1900 — The World Beneath</h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  Deep excavation records for the 1900 Exposition Universelle revealing pre-existing stone conduits and subterranean foundation networks.
                </p>
                <div className="mt-3">
                  <a
                    href="https://www.youtube.com/watch?v=tdpaBMgz2mE"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-mono text-amber-400 hover:underline"
                  >
                    ▶ Watch on YouTube (28:45) ↗
                  </a>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-xs font-mono text-amber-400 mb-1">EPISODE 164</div>
                <h3 className="font-bold text-sm text-white">World&apos;s Fairs Were NOT Temporary</h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  Analysis of the colossal masonry foundations, deep pilings, and underground rail networks beneath Chicago 1893 and St. Louis 1904.
                </p>
                <div className="mt-3">
                  <a
                    href="https://www.youtube.com/watch?v=tdpaBMgz2mE"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-mono text-amber-400 hover:underline"
                  >
                    ▶ Watch on YouTube (41:03) ↗
                  </a>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-xs font-mono text-amber-400 mb-1">THE DONKEY&apos;S INC. PARADOX</div>
                <h3 className="font-bold text-sm text-white">The Official Construction Narrative</h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  Official archives report that monumental 1800s government buildings and palaces were erected by manual labor with horses and wooden scaffolding before electricity.
                </p>
                <div className="mt-3">
                  <Link
                    href="/episodes"
                    className="inline-flex items-center gap-1 text-xs font-mono text-cyan-400 hover:underline"
                  >
                    Explore all 202 Episodes in Archive →
                  </Link>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>All 202 investigations verified &amp; geo-pinned on Angel OS</span>
              <Link
                href="/shop"
                className="text-amber-400 hover:underline"
              >
                Official Donkey&apos;s Inc. Merch in Shop →
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
