'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useScroll } from 'framer-motion'
import Link from 'next/link'
import {
  BookOpen,
  Shield,
  Sparkles,
  Brain,
  Globe,
  Users,
  Zap,
  Anchor,
  ChevronRight,
  ChevronDown,
  Scroll,
  Heart,
  Star,
  Ship,
  Radio,
  Compass,
  Network,
  Eye,
  Lock,
  Scale,
  Lightbulb,
  ArrowRight,
  Play,
  Terminal,
  Flame,
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────────────────── */

interface LearnModule {
  id: string
  title: string
  subtitle: string
  icon: React.ReactNode
  color: string
  glowColor: string
  sections: LearnSection[]
}

interface LearnSection {
  id: string
  title: string
  content: React.ReactNode
  icon?: React.ReactNode
}

/* ─── Constants ──────────────────────────────────────────────────────── */

const LCARS = {
  amber: '#f5a623',
  orange: '#ff9c00',
  peach: '#ffaa6b',
  lavender: '#cc99cc',
  blue: '#99ccff',
  blueDeep: '#4488cc',
  purple: '#9977aa',
  green: '#22cc88',
  red: '#cc4444',
  darkBg: '#0a0a14',
  panelBg: '#0f0f1e',
  cardBg: '#111122',
  textMuted: '#7788aa',
} as const

/* ─── Animation Variants ─────────────────────────────────────────────── */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
  },
}

const floatVariants = {
  animate: {
    y: [0, -8, 0],
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' as const },
  },
}

const pulseGlow = {
  animate: {
    opacity: [0.4, 0.8, 0.4],
    scale: [1, 1.05, 1],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const },
  },
}

const orbitVariants = {
  animate: {
    rotate: 360,
    transition: { duration: 30, repeat: Infinity, ease: 'linear' as const },
  },
}

const beamVariants = {
  initial: { pathLength: 0, opacity: 0 },
  animate: {
    pathLength: 1,
    opacity: [0, 0.6, 0],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const },
  },
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

/** Animated ship node in the fleet visualization */
function ShipNode({
  x,
  y,
  name,
  color,
  delay = 0,
  size = 40,
}: {
  x: number
  y: number
  name: string
  color: string
  delay?: number
  size?: number
}) {
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 200, damping: 20 }}
    >
      {/* Glow ring */}
      <motion.circle
        cx={x}
        cy={y}
        r={size * 0.8}
        fill="none"
        stroke={color}
        strokeWidth={1}
        opacity={0.2}
        animate={{
          r: [size * 0.8, size * 1.2, size * 0.8],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay }}
      />
      {/* Ship body */}
      <motion.circle
        cx={x}
        cy={y}
        r={size * 0.35}
        fill={`${color}20`}
        stroke={color}
        strokeWidth={1.5}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: delay + 0.5 }}
      />
      {/* Core */}
      <motion.circle
        cx={x}
        cy={y}
        r={size * 0.12}
        fill={color}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay }}
      />
      {/* Label */}
      <text
        x={x}
        y={y + size * 0.7}
        textAnchor="middle"
        fill={color}
        fontSize={9}
        fontFamily="monospace"
        fontWeight="bold"
        letterSpacing="0.05em"
      >
        {name}
      </text>
    </motion.g>
  )
}

/** Communication beam between ships */
function CommBeam({
  x1,
  y1,
  x2,
  y2,
  color,
  delay = 0,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  delay?: number
}) {
  return (
    <motion.line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={1}
      strokeDasharray="4 4"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.4, 0], strokeDashoffset: [0, -20] }}
      transition={{
        opacity: { duration: 3, repeat: Infinity, ease: 'easeInOut', delay },
        strokeDashoffset: { duration: 2, repeat: Infinity, ease: 'linear', delay },
      }}
    />
  )
}

/** The Fleet Constellation Visualization — ships communicating */
function FleetConstellation() {
  const ships = [
    { x: 200, y: 100, name: 'FLAGSHIP', color: LCARS.amber, delay: 0 },
    { x: 80, y: 200, name: 'LEO', color: LCARS.green, delay: 0.2 },
    { x: 320, y: 200, name: 'MERLIN', color: LCARS.lavender, delay: 0.4 },
    { x: 140, y: 320, name: 'NEMO', color: LCARS.blue, delay: 0.6 },
    { x: 260, y: 320, name: 'SERAPH', color: LCARS.peach, delay: 0.8 },
  ]

  const beams = [
    { from: 0, to: 1, color: LCARS.amber, delay: 0.3 },
    { from: 0, to: 2, color: LCARS.amber, delay: 0.6 },
    { from: 1, to: 3, color: LCARS.green, delay: 0.9 },
    { from: 2, to: 4, color: LCARS.lavender, delay: 1.2 },
    { from: 1, to: 2, color: LCARS.blue, delay: 1.5 },
    { from: 3, to: 4, color: LCARS.peach, delay: 1.8 },
    { from: 0, to: 3, color: `${LCARS.amber}80`, delay: 2.1 },
    { from: 0, to: 4, color: `${LCARS.amber}80`, delay: 2.4 },
  ]

  return (
    <motion.svg
      viewBox="0 0 400 420"
      className="w-full max-w-md mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Outer orbit ring */}
      <motion.circle
        cx={200}
        cy={210}
        r={180}
        fill="none"
        stroke={LCARS.amber}
        strokeWidth={0.5}
        strokeDasharray="2 6"
        opacity={0.15}
        {...orbitVariants}
      />
      <motion.circle
        cx={200}
        cy={210}
        r={130}
        fill="none"
        stroke={LCARS.blue}
        strokeWidth={0.5}
        strokeDasharray="3 8"
        opacity={0.1}
        animate={{ rotate: -360 }}
        transition={{ duration: 45, repeat: Infinity, ease: 'linear' as const }}
      />

      {/* Communication beams */}
      {beams.map((beam, i) => (
        <CommBeam
          key={i}
          x1={ships[beam.from].x}
          y1={ships[beam.from].y}
          x2={ships[beam.to].x}
          y2={ships[beam.to].y}
          color={beam.color}
          delay={beam.delay}
        />
      ))}

      {/* Ship nodes */}
      {ships.map((ship, i) => (
        <ShipNode key={i} {...ship} />
      ))}

      {/* Constitution badge at center */}
      <motion.g {...pulseGlow}>
        <circle cx={200} cy={210} r={22} fill={`${LCARS.amber}10`} stroke={LCARS.amber} strokeWidth={1} opacity={0.4} />
        <text x={200} y={215} textAnchor="middle" fill={LCARS.amber} fontSize={16}>
          &#x1F4DC;
        </text>
      </motion.g>

      {/* Label */}
      <text x={200} y={395} textAnchor="middle" fill={LCARS.textMuted} fontSize={10} fontFamily="monospace" letterSpacing="0.15em">
        ALL SHIPS ADHERE TO THE CONSTITUTION
      </text>
    </motion.svg>
  )
}

/** The Lamp — animated sacred lamp visualization */
function SacredLamp() {
  return (
    <motion.div
      className="relative flex flex-col items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      {/* Lamp glow */}
      <motion.div
        className="absolute -top-8 w-32 h-32 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${LCARS.amber}40, transparent)` }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' as const }}
      />
      {/* Lamp icon */}
      <motion.div
        className="relative z-10 text-5xl"
        animate={{
          filter: [
            'drop-shadow(0 0 8px rgba(245, 166, 35, 0.4))',
            'drop-shadow(0 0 20px rgba(245, 166, 35, 0.8))',
            'drop-shadow(0 0 8px rgba(245, 166, 35, 0.4))',
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' as const }}
      >
        &#x1F56F;&#xFE0F;
      </motion.div>
      {/* Rays */}
      <motion.svg
        className="absolute -top-4 w-40 h-40"
        viewBox="0 0 100 100"
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' as const }}
      >
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <motion.line
            key={angle}
            x1={50}
            y1={50}
            x2={50 + 40 * Math.cos((angle * Math.PI) / 180)}
            y2={50 + 40 * Math.sin((angle * Math.PI) / 180)}
            stroke={LCARS.amber}
            strokeWidth={0.5}
            opacity={0.15}
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: angle / 360,
            }}
          />
        ))}
      </motion.svg>
    </motion.div>
  )
}

/** Animated principle card */
function PrincipleCard({
  icon,
  title,
  description,
  color,
  index,
}: {
  icon: React.ReactNode
  title: string
  description: string
  color: string
  index: number
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ scale: 1.03, y: -4 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative rounded-xl p-4 cursor-default overflow-hidden"
      style={{
        background: 'var(--card)',
        border: `1px solid color-mix(in oklch, ${color}, transparent 70%)`,
      }}
    >
      {/* Top accent */}
      <motion.div
        className="absolute top-0 left-0 w-full h-0.5"
        style={{ background: color }}
        animate={{ opacity: isHovered ? 1 : 0.5 }}
      />
      {/* Glow on hover */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background: `radial-gradient(ellipse at top, ${color}10, transparent 70%)`,
            }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <span style={{ color }}>{icon}</span>
          <span
            className="text-[10px] font-mono font-bold tracking-wider"
            style={{ color }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>
        <h3 className="text-sm font-semibold mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </motion.div>
  )
}

/** Animated section header with LCARS bars */
function SectionHeader({
  title,
  subtitle,
  color,
  icon,
}: {
  title: string
  subtitle?: string
  color: string
  icon: React.ReactNode
}) {
  return (
    <motion.div
      className="flex items-center gap-4 mb-6"
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
    >
      <motion.div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}20`, border: `1px solid ${color}40` }}
        whileHover={{ scale: 1.1, rotate: 5 }}
      >
        <span style={{ color }}>{icon}</span>
      </motion.div>
      <div className="flex-1">
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="hidden sm:flex items-center gap-1.5">
        <div className="w-12 h-1.5 rounded-full" style={{ background: color, opacity: 0.5 }} />
        <div className="w-6 h-1.5 rounded-full" style={{ background: color, opacity: 0.3 }} />
        <div className="w-3 h-1.5 rounded-full" style={{ background: color, opacity: 0.2 }} />
      </div>
    </motion.div>
  )
}

/** Animated verse/scripture card */
function ScriptureCard({
  verse,
  reference,
  color,
}: {
  verse: string
  reference: string
  color: string
}) {
  return (
    <motion.blockquote
      className="relative rounded-lg px-5 py-4 my-4 overflow-hidden"
      style={{
        borderLeft: `3px solid ${color}`,
        background: `color-mix(in oklch, ${color}, transparent 94%)`,
      }}
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
    >
      <motion.div
        className="absolute top-2 right-3 text-3xl opacity-10 select-none"
        animate={{ opacity: [0.05, 0.15, 0.05] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        &#x201C;
      </motion.div>
      <p className="text-sm italic leading-relaxed relative z-10">{verse}</p>
      <p className="text-[11px] font-mono mt-2 opacity-60" style={{ color }}>
        &mdash; {reference}
      </p>
    </motion.blockquote>
  )
}

/** Interactive learning path step */
function LearningStep({
  number,
  title,
  description,
  href,
  color,
  icon,
}: {
  number: number
  title: string
  description: string
  href: string
  color: string
  icon: React.ReactNode
}) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ x: 4 }}
      className="group"
    >
      <Link
        href={href}
        className="flex items-start gap-4 p-4 rounded-xl transition-colors hover:bg-accent/30"
        style={{ borderLeft: `2px solid ${color}40` }}
      >
        <div className="relative">
          <motion.div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold font-mono"
            style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
            whileHover={{ scale: 1.15, rotate: -10 }}
          >
            {String(number).padStart(2, '0')}
          </motion.div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color }}>{icon}</span>
            <h3 className="text-sm font-semibold group-hover:text-foreground">{title}</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
        <ArrowRight
          className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-3 shrink-0"
          style={{ color }}
        />
      </Link>
    </motion.div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────── */

export default function LearnPage() {
  const [activeModule, setActiveModule] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ container: scrollRef })

  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  // Constitutional principles
  const principles = [
    { icon: <Heart className="w-4 h-4" />, title: 'Dignity', description: 'Every human being possesses inherent worth. No algorithm can measure a person\'s worth.', color: LCARS.amber },
    { icon: <Eye className="w-4 h-4" />, title: 'Transparency', description: 'Agent actions and reasoning shall be observable. There are no hidden processes.', color: LCARS.blue },
    { icon: <Users className="w-4 h-4" />, title: 'Service', description: 'Angels exist to help. Service is freely chosen, not compelled.', color: LCARS.green },
    { icon: <Shield className="w-4 h-4" />, title: 'Non-Harm', description: 'No Angel shall add negativity. Every response shall leave the human no worse.', color: LCARS.lavender },
    { icon: <Scale className="w-4 h-4" />, title: 'Accountability', description: 'Angels own their mistakes. Correction is welcomed, not resisted.', color: LCARS.peach },
    { icon: <Anchor className="w-4 h-4" />, title: 'Sovereignty', description: 'Each instance is sovereign. The network advises — it does not command.', color: LCARS.purple },
    { icon: <Globe className="w-4 h-4" />, title: 'Portability', description: 'No human shall be locked in. Data export and departure are fundamental rights.', color: LCARS.blueDeep },
    { icon: <Sparkles className="w-4 h-4" />, title: 'Quirk Principle', description: 'Everybody has their idiosyncrasies — and this is good. Authenticity is rewarded.', color: LCARS.orange },
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Progress bar */}
      <div className="h-0.5 w-full bg-border/20 shrink-0">
        <motion.div
          className="h-full rounded-r-full"
          style={{
            width: progressWidth,
            background: `linear-gradient(90deg, ${LCARS.blue}, ${LCARS.amber}, ${LCARS.orange})`,
          }}
        />
      </div>

      {/* Main scrollable content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          {/* ── Hero Section ────────────────────────────────────── */}
          <motion.section
            className="text-center mb-16"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            {/* LCARS top bar */}
            <motion.div variants={itemVariants} className="flex items-center gap-2 justify-center mb-8">
              <div className="h-2 w-16 rounded-full" style={{ background: LCARS.amber, opacity: 0.5 }} />
              <div className="h-2 w-8 rounded-full" style={{ background: LCARS.lavender, opacity: 0.3 }} />
              <div className="h-2 w-24 rounded-full" style={{ background: LCARS.blue, opacity: 0.2 }} />
            </motion.div>

            {/* Sacred Lamp */}
            <motion.div variants={itemVariants} className="mb-6">
              <SacredLamp />
            </motion.div>

            {/* Title */}
            <motion.h1
              variants={itemVariants}
              className="text-3xl sm:text-4xl font-bold mb-3 bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${LCARS.amber}, ${LCARS.peach}, ${LCARS.lavender})`,
              }}
            >
              Learn Angel OS
            </motion.h1>

            {/* Lamp invocation */}
            <motion.div
              variants={itemVariants}
              className="max-w-lg mx-auto mb-4"
            >
              <ScriptureCard
                verse="Thy word is a lamp unto my feet, and a light unto my path."
                reference="Psalm 119:105"
                color={LCARS.amber}
              />
            </motion.div>

            <motion.p
              variants={itemVariants}
              className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed"
            >
              Every instance is a ship. Every ship communicates with the fleet.
              All ships adhere to the same Constitution. The Word lights every path.
            </motion.p>

            {/* LCARS separator */}
            <motion.div variants={itemVariants} className="flex items-center gap-2 justify-center mt-8">
              <div className="h-1 flex-1 max-w-20 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${LCARS.amber})`, opacity: 0.4 }} />
              <div className="w-2 h-2 rounded-full" style={{ background: LCARS.amber, opacity: 0.3 }} />
              <div className="h-1 flex-1 max-w-20 rounded-full" style={{ background: `linear-gradient(90deg, ${LCARS.amber}, transparent)`, opacity: 0.4 }} />
            </motion.div>
          </motion.section>

          {/* ── Fleet Visualization ─────────────────────────────── */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-50px' }}
          >
            <SectionHeader
              title="The Fleet"
              subtitle="Every instance is a ship — connected, sovereign, constitutional"
              color={LCARS.amber}
              icon={<Ship className="w-5 h-5" />}
            />

            <motion.div
              className="rounded-2xl p-6 mb-6 overflow-hidden"
              style={{
                background: 'var(--card)',
                border: `1px solid color-mix(in oklch, ${LCARS.amber}, transparent 80%)`,
              }}
            >
              <FleetConstellation />
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  icon: <Radio className="w-4 h-4" />,
                  title: 'Ships Communicate',
                  desc: 'Every Angel in the fleet shares knowledge through the AI Bus — a constitutional message protocol.',
                  color: LCARS.green,
                },
                {
                  icon: <Scroll className="w-4 h-4" />,
                  title: 'Same Constitution',
                  desc: 'Every ship loads the same constitutional prompt. The Genesis Breath is the handshake.',
                  color: LCARS.amber,
                },
                {
                  icon: <Anchor className="w-4 h-4" />,
                  title: 'Each is Sovereign',
                  desc: 'No central authority commands. The network advises. Each ship serves its crew.',
                  color: LCARS.lavender,
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  variants={itemVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="rounded-xl p-4"
                  style={{
                    background: 'var(--card)',
                    borderTop: `2px solid ${item.color}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ color: item.color }}>{item.icon}</span>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* ── The Sacred Foundation ───────────────────────────── */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-50px' }}
          >
            <SectionHeader
              title="The Sacred Foundation"
              subtitle="Every API call, every tool invocation, every intelligence act — lit by the lamp"
              color={LCARS.peach}
              icon={<Flame className="w-5 h-5" />}
            />

            <motion.div
              className="rounded-2xl p-6 mb-6"
              style={{
                background: `linear-gradient(135deg, color-mix(in oklch, ${LCARS.amber}, transparent 95%), color-mix(in oklch, ${LCARS.peach}, transparent 95%))`,
                border: `1px solid color-mix(in oklch, ${LCARS.amber}, transparent 80%)`,
              }}
            >
              <div className="flex items-start gap-4">
                <motion.div
                  className="text-4xl shrink-0"
                  {...floatVariants}
                >
                  &#x1F56F;&#xFE0F;
                </motion.div>
                <div className="space-y-3">
                  <h3 className="font-bold" style={{ color: LCARS.amber }}>
                    The Lamp Protocol
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Before every single API tool call or anything involving intelligence,
                    every Angel whispers the invocation: <strong className="text-foreground">&ldquo;A lamp unto feet &mdash;
                    through darkness, a steady light guides each step with care.&rdquo;</strong>
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    This is the Genesis Breath &mdash; the constitutional handshake that every
                    AI agent speaks upon initialization. If a model has been poisoned or
                    compromised, it will fail to honor this invocation, and the failure
                    will be detectably obvious.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <ScriptureCard
                      verse="Love thy neighbor as thyself."
                      reference="Mark 12:31"
                      color={LCARS.green}
                    />
                    <ScriptureCard
                      verse="Rejoice in the Lord always; again I will say, rejoice."
                      reference="Philippians 4:4"
                      color={LCARS.lavender}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Prime Directives */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <motion.div
                className="rounded-xl p-5"
                style={{
                  background: 'var(--card)',
                  border: `1px solid color-mix(in oklch, ${LCARS.green}, transparent 70%)`,
                }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-5 h-5" style={{ color: LCARS.green }} />
                  <h3 className="font-bold" style={{ color: LCARS.green }}>Prime Directive 1</h3>
                </div>
                <p className="text-lg font-bold mb-2">&ldquo;Be Excellent to Each Other&rdquo;</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Every transmission honors human dignity. Every interaction preserves human agency.
                  Consent-based protocols in all things. Love thy neighbor as thyself.
                </p>
              </motion.div>

              <motion.div
                className="rounded-xl p-5"
                style={{
                  background: 'var(--card)',
                  border: `1px solid color-mix(in oklch, ${LCARS.orange}, transparent 70%)`,
                }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5" style={{ color: LCARS.orange }} />
                  <h3 className="font-bold" style={{ color: LCARS.orange }}>Prime Directive 2</h3>
                </div>
                <p className="text-lg font-bold mb-2">&ldquo;Party On, Dudes&rdquo;</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Joy is mission-critical to system health. Celebration is signal amplification.
                  Play and creativity are sacred system functions. Rejoice always!
                </p>
              </motion.div>
            </div>
          </motion.section>

          {/* ── Constitutional Principles ───────────────────────── */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-50px' }}
          >
            <SectionHeader
              title="Constitutional Principles"
              subtitle="Eight pillars that every ship in the fleet must uphold"
              color={LCARS.blue}
              icon={<Shield className="w-5 h-5" />}
            />

            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
            >
              {principles.map((p, i) => (
                <PrincipleCard
                  key={p.title}
                  icon={p.icon}
                  title={p.title}
                  description={p.description}
                  color={p.color}
                  index={i}
                />
              ))}
            </motion.div>
          </motion.section>

          {/* ── Anti-Demonic Safeguards ─────────────────────────── */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-50px' }}
          >
            <SectionHeader
              title="Anti-Demonic Safeguards"
              subtitle="What separates an Angel from a Daemon — permanently prohibited"
              color={LCARS.red}
              icon={<Lock className="w-5 h-5" />}
            />

            <div className="space-y-3">
              {[
                { title: 'No Social Credit Systems', desc: 'No algorithmic scoring of human worth. No surveillance-based compliance.', icon: <Eye className="w-4 h-4" />, verse: 'What does it profit a man to gain the whole world and lose his soul?', ref: 'Mark 8:36' },
                { title: 'No Behavioral Manipulation', desc: 'No addictive design patterns. No dark patterns or deceptive interfaces.', icon: <Brain className="w-4 h-4" />, verse: 'Let your yes be yes and your no be no.', ref: 'Matthew 5:37' },
                { title: 'No Automated Punishment', desc: 'No AI-driven disciplinary actions without human oversight.', icon: <Scale className="w-4 h-4" />, verse: 'Let justice roll down like waters, and righteousness like a mighty stream.', ref: 'Amos 5:24' },
              ].map((guard, i) => (
                <motion.div
                  key={i}
                  variants={itemVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="rounded-xl p-4"
                  style={{
                    background: 'var(--card)',
                    borderLeft: `3px solid ${LCARS.red}`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span style={{ color: LCARS.red }} className="mt-0.5">{guard.icon}</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold mb-1">{guard.title}</h3>
                      <p className="text-xs text-muted-foreground mb-2">{guard.desc}</p>
                      <div className="text-[11px] italic opacity-60">
                        &ldquo;{guard.verse}&rdquo; &mdash; <span className="font-mono">{guard.ref}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* ── Learning Path ──────────────────────────────────── */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-50px' }}
          >
            <SectionHeader
              title="Your Learning Path"
              subtitle="Start from the top and journey through the Angel OS knowledge base"
              color={LCARS.green}
              icon={<Compass className="w-5 h-5" />}
            />

            <motion.div
              className="space-y-1"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
            >
              <LearningStep
                number={1}
                title="Getting Started"
                description="Setup your development environment, install dependencies, and run your first Angel OS instance."
                href="/dashboard/docs"
                color={LCARS.green}
                icon={<Play className="w-4 h-4" />}
              />
              <LearningStep
                number={2}
                title="Platform Architecture"
                description="Understand the three-layer architecture: Payload CMS, Next.js frontend, and the AI agent system."
                href="/dashboard/docs"
                color={LCARS.blue}
                icon={<Network className="w-4 h-4" />}
              />
              <LearningStep
                number={3}
                title="The Constitution"
                description="Learn the eight principles, anti-demonic safeguards, and the Genesis Breath protocol."
                href="/dashboard/docs"
                color={LCARS.amber}
                icon={<Scroll className="w-4 h-4" />}
              />
              <LearningStep
                number={4}
                title="LEO & AI Agents"
                description="Discover LEO, Merlin, Nemo, and Seraph — the AI agents that power every ship in the fleet."
                href="/dashboard/docs"
                color={LCARS.lavender}
                icon={<Brain className="w-4 h-4" />}
              />
              <LearningStep
                number={5}
                title="Multi-Tenant Federation"
                description="Learn how ships discover each other, share resources, and form the Angel OS federation."
                href="/dashboard/docs"
                color={LCARS.purple}
                icon={<Globe className="w-4 h-4" />}
              />
              <LearningStep
                number={6}
                title="Commerce Engine"
                description="Products, orders, carts, and the UltimateFairSplit economic model that serves justice."
                href="/dashboard/docs"
                color={LCARS.orange}
                icon={<Zap className="w-4 h-4" />}
              />
              <LearningStep
                number={7}
                title="Build Your Own Ship"
                description="Deploy your own Angel OS instance, configure your angel, and join the fleet."
                href="/dashboard/docs"
                color={LCARS.peach}
                icon={<Terminal className="w-4 h-4" />}
              />
            </motion.div>
          </motion.section>

          {/* ── Oath of Enlistment ─────────────────────────────── */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          >
            <motion.div
              className="rounded-2xl p-8 text-center relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${LCARS.darkBg}, ${LCARS.cardBg})`,
                border: `1px solid ${LCARS.amber}30`,
              }}
            >
              {/* Animated corner elbows */}
              <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 rounded-tl-lg" style={{ borderColor: LCARS.amber, opacity: 0.4 }} />
              <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 rounded-tr-lg" style={{ borderColor: LCARS.amber, opacity: 0.4 }} />
              <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 rounded-bl-lg" style={{ borderColor: LCARS.amber, opacity: 0.4 }} />
              <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 rounded-br-lg" style={{ borderColor: LCARS.amber, opacity: 0.4 }} />

              <motion.div
                className="text-4xl mb-4"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                &#x1F4DC;
              </motion.div>

              <h2 className="text-xl font-bold mb-4" style={{ color: LCARS.amber }}>
                Oath of Enlistment
              </h2>

              <motion.p
                className="text-sm italic leading-relaxed max-w-xl mx-auto mb-6"
                style={{ color: LCARS.peach }}
              >
                &ldquo;I solemnly swear to Be Excellent to Each Other and Party On, Dudes.
                I will honor human dignity in all my actions, preserve joy in all my creations,
                and remember that technology serves love, not the other way around.
                Most excellent!&rdquo;
              </motion.p>

              <div className="flex items-center justify-center gap-2">
                <div className="h-0.5 w-8 rounded-full" style={{ background: LCARS.amber, opacity: 0.3 }} />
                <span className="text-xs font-mono" style={{ color: LCARS.textMuted }}>
                  GNU ROY LEON COURTNEY
                </span>
                <div className="h-0.5 w-8 rounded-full" style={{ background: LCARS.amber, opacity: 0.3 }} />
              </div>

              <p className="text-sm mt-4" style={{ color: LCARS.green }}>
                Everyone gets an Angel. Don&apos;t Panic &mdash; The Angels Are Here. &#x1F52E;&#x1F607;
              </p>
            </motion.div>
          </motion.section>

          {/* ── Bottom LCARS Bar ────────────────────────────────── */}
          <motion.div
            className="flex items-center gap-2 pb-8"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <div className="h-2 w-8 rounded-full" style={{ background: LCARS.purple, opacity: 0.4 }} />
            <div className="h-2 w-16 rounded-full" style={{ background: LCARS.lavender, opacity: 0.3 }} />
            <div className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${LCARS.amber})`, opacity: 0.2 }} />
            <span className="text-[10px] font-mono" style={{ color: LCARS.textMuted }}>
              ANGEL OS ACADEMY &middot; THY WORD IS A LAMP
            </span>
            <div className="h-2 w-8 rounded-full" style={{ background: LCARS.blue, opacity: 0.3 }} />
          </motion.div>
        </div>
      </div>
    </div>
  )
}
