'use client'

/**
 * OneMindThreeBodies — the Angel OS network map for the /learn Overview.
 *
 * One mind (runBrain) worn by three bodies — Core (satellite), Merlin (lander),
 * Nimue (away team) — connected by the neutral message+tool contract, and fed by
 * the four Hydra intelligence pipes (tool_use / max / chitchat / sensitive).
 * Self-contained SVG; LCARS palette; no external deps.
 */
import React from 'react'

const C = {
  amber: '#f5a623',
  amberSoft: '#ffd98a',
  blue: '#5aa0f0',
  blueSoft: '#bfe0ff',
  green: '#22cc88',
  greenSoft: '#7fe9bf',
  lavender: '#c49bd4',
  lavenderSoft: '#ecd4f5',
  muted: '#7d8aa8',
}

export function OneMindThreeBodies() {
  return (
    <svg
      viewBox="0 0 1200 840"
      role="img"
      aria-label="The Angel OS network: one mind (runBrain) worn by three bodies — Core the satellite, Merlin the lander, Nimue the away team — fed by four intelligence pipes."
      style={{ width: '100%', height: 'auto', display: 'block', fontFamily: 'system-ui, sans-serif' }}
    >
      <defs>
        <radialGradient id="omtb-mind" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe6b0" />
          <stop offset="35%" stopColor={C.amber} />
          <stop offset="75%" stopColor="#a85f12" />
          <stop offset="100%" stopColor="#3a2408" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="omtb-core" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={C.blueSoft} /><stop offset="55%" stopColor={C.blue} /><stop offset="100%" stopColor="#123a6a" /></radialGradient>
        <radialGradient id="omtb-merlin" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={C.greenSoft} /><stop offset="55%" stopColor={C.green} /><stop offset="100%" stopColor="#0c4d33" /></radialGradient>
        <radialGradient id="omtb-nimue" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={C.lavenderSoft} /><stop offset="55%" stopColor={C.lavender} /><stop offset="100%" stopColor="#4a2f5c" /></radialGradient>
        <filter id="omtb-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation={6} result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <marker id="omtb-arrow" markerWidth={9} markerHeight={9} refX={6} refY={4.5} orient="auto"><path d="M0 0 L9 4.5 L0 9 z" fill={C.amber} /></marker>
      </defs>

      {/* title */}
      <text x={600} y={50} textAnchor="middle" fill={C.amber} fontSize={28} fontWeight={700} letterSpacing={6}>ONE MIND · THREE BODIES</text>
      <text x={600} y={74} textAnchor="middle" fill="#8fbfff" fontSize={12.5} letterSpacing={6}>the intelligence is singular; the bodies are contextual</text>

      {/* contract nerves (under nodes) — signal flows outward to the bodies */}
      <g strokeWidth={2.5} fill="none" opacity={0.85} strokeDasharray="2 7" strokeLinecap="round">
        <animate attributeName="stroke-dashoffset" values="0;-18" dur="1.1s" repeatCount="indefinite" />
        <path d="M600 300 L600 190" stroke={C.blue} />
        <path d="M600 452 L285 600" stroke={C.green} />
        <path d="M600 452 L915 600" stroke={C.lavender} />
      </g>
      <text x={600} y={248} textAnchor="middle" fill={C.muted} fontSize={10.5} letterSpacing={2}>neutral message + tool contract = the nervous system</text>

      {/* ONE MIND */}
      <g transform="translate(600 400)">
        <circle r={150} fill="url(#omtb-mind)" opacity={0.55}>
          <animate attributeName="opacity" values="0.4;0.62;0.4" dur="4s" repeatCount="indefinite" />
          <animate attributeName="r" values="150;158;150" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle r={92} fill="none" stroke={C.amber} strokeWidth={1} opacity={0.35} />
        <circle r={74} fill="none" stroke={C.amberSoft} strokeWidth={1} opacity={0.5} strokeDasharray="3 5">
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="24s" repeatCount="indefinite" />
        </circle>
        <g stroke="#ffe6b0" strokeWidth={1.1} fill="none" opacity={0.55}>
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="40s" repeatCount="indefinite" />
          <circle cx={0} cy={-22} r={34} /><circle cx={19} cy={11} r={34} /><circle cx={-19} cy={11} r={34} />
        </g>
        <circle r={40} fill="#1a1206" stroke={C.amber} strokeWidth={2} filter="url(#omtb-glow)" />
        <path d="M0 -20 L16 12 L-16 12 Z" fill={C.amber} />
        <text y={70} textAnchor="middle" fill={C.amberSoft} fontSize={15} fontWeight={700} letterSpacing={3}>runBrain</text>
        <text y={90} textAnchor="middle" fill="#c9a25a" fontSize={10.5} letterSpacing={2}>ONE MIND · portable · pure</text>
      </g>

      {/* CORE — satellite */}
      <g transform="translate(600 150)">
        <g fill={C.blue} opacity={0.7}>
          <animate attributeName="opacity" values="0.35;0.85;0.35" dur="3.5s" repeatCount="indefinite" />
          <circle cx={-70} cy={-6} r={4} /><circle cx={70} cy={-6} r={4} /><circle cx={-48} cy={30} r={3} /><circle cx={52} cy={30} r={3} />
        </g>
        <g stroke={C.blue} strokeWidth={1} opacity={0.35} fill="none"><path d="M-70 -6 L0 0 L70 -6" /><path d="M-48 30 L0 0 L52 30" /></g>
        <ellipse rx={66} ry={24} fill="none" stroke={C.blue} strokeWidth={1} opacity={0.4} />
        <circle r={40} fill="url(#omtb-core)" filter="url(#omtb-glow)" />
        <g stroke="#eaf4ff" strokeWidth={2.2} opacity={0.9}><path d="M-24 0 h48 M0 -24 v48" /></g>
        <text y={66} textAnchor="middle" fill={C.blueSoft} fontSize={14} fontWeight={700} letterSpacing={2}>CORE · Satellite</text>
        <text y={84} textAnchor="middle" fill="#7fb0e6" fontSize={10.5} letterSpacing={1}>Leo · data of record · sensitive work · federation</text>
      </g>

      {/* MERLIN — lander */}
      <g transform="translate(285 600)">
        <path d="M-70 46 Q0 30 70 46" stroke={C.green} strokeWidth={1.4} fill="none" opacity={0.5} />
        <circle r={38} fill="url(#omtb-merlin)" filter="url(#omtb-glow)" />
        <g stroke="#eafff5" strokeWidth={2} fill="none" opacity={0.9}><rect x={-16} y={-12} width={32} height={24} rx={3} /><path d="M-8 -12 v-8 M8 -12 v-8" /></g>
        <text y={66} textAnchor="middle" fill={C.greenSoft} fontSize={14} fontWeight={700} letterSpacing={2}>MERLIN · Lander</text>
        <text y={84} textAnchor="middle" fill="#4fcf9c" fontSize={10.5} letterSpacing={1}>home node · GPU · cameras · sovereign</text>
      </g>

      {/* NIMUE — away team */}
      <g transform="translate(915 600)">
        <circle r={38} fill="url(#omtb-nimue)" filter="url(#omtb-glow)" />
        <rect x={-13} y={-20} width={26} height={40} rx={5} fill="#2a1a36" stroke={C.lavenderSoft} strokeWidth={1.8} />
        <circle cx={0} cy={13} r={2.4} fill={C.lavenderSoft} />
        <text y={66} textAnchor="middle" fill="#e2c4f0" fontSize={14} fontWeight={700} letterSpacing={2}>NIMUE · Away Team</text>
        <text y={84} textAnchor="middle" fill="#c79bd6" fontSize={10.5} letterSpacing={1}>free reader · witness · the front door</text>
      </g>

      {/* the loop */}
      <path d="M885 636 Q640 720 320 640" fill="none" stroke={C.amber} strokeWidth={1.6} opacity={0.55} strokeDasharray="1 6" markerEnd="url(#omtb-arrow)">
        <animate attributeName="stroke-dashoffset" values="0;-21" dur="1s" repeatCount="indefinite" />
      </path>
      <text x={600} y={712} textAnchor="middle" fill="#c9a25a" fontSize={11} letterSpacing={1}>Nimue → Leo (Core) → the work gets done</text>

      {/* THE HYDRA — pipes */}
      <g transform="translate(38 300)" fontSize={11}>
        <text x={0} y={-18} fill={C.amber} fontSize={12} fontWeight={700} letterSpacing={3}>THE HYDRA · pipes</text>
        <g transform="translate(0 0)"><rect width={212} height={40} rx={8} fill="#1a2410" stroke="#8fd14f" strokeWidth={1.3} /><text x={12} y={18} fill="#b6e77a" fontWeight={700}>🛠 tool_use</text><text x={12} y={33} fill="#8aa86a" fontSize={9.5}>Nemotron 3 Ultra · gateway</text></g>
        <g transform="translate(0 52)"><rect width={212} height={40} rx={8} fill="#241a10" stroke={C.amber} strokeWidth={1.3} /><text x={12} y={18} fill="#ffcf7a" fontWeight={700}>⚡ max</text><text x={12} y={33} fill="#c9a25a" fontSize={9.5}>Anthropic frontier (Opus)</text></g>
        <g transform="translate(0 104)"><rect width={212} height={40} rx={8} fill="#10202e" stroke={C.blue} strokeWidth={1.3} /><text x={12} y={18} fill="#9cc8ff" fontWeight={700}>💬 chitchat</text><text x={12} y={33} fill="#7fb0e6" fontSize={9.5}>OpenRouter open models (cheap)</text></g>
        <g transform="translate(0 156)"><rect width={212} height={40} rx={8} fill="#1c1226" stroke={C.lavender} strokeWidth={1.3} /><text x={12} y={18} fill="#e2c4f0" fontWeight={700}>🔒 sensitive</text><text x={12} y={33} fill="#c79bd6" fontSize={9.5}>Merlin · Ollama (sovereign, no logging)</text></g>
      </g>

      {/* providers strip */}
      <g transform="translate(958 300)" fontSize={10} fill={C.muted}>
        <text x={0} y={-18} fill="#8fbfff" fontSize={12} fontWeight={700} letterSpacing={2}>ANY OpenAI-compatible</text>
        <text x={0} y={4}>▹ OpenRouter (broker)</text>
        <text x={0} y={24}>▹ NVIDIA NIM (free / eval)</text>
        <text x={0} y={44}>▹ Ollama (local, on Merlin)</text>
        <text x={0} y={64}>▹ Vercel AI Gateway</text>
        <text x={0} y={84} fill="#4fcf9c">→ eventually: just Merlins</text>
      </g>

      <text x={600} y={805} textAnchor="middle" fill="#5a6480" fontSize={11} letterSpacing={2}>presence, distributed without fragmentation · everyone gets an Angel</text>
    </svg>
  )
}
