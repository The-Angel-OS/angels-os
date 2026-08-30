'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence, useTransform, useScroll } from 'framer-motion'
import Link from 'next/link'
import {
  Shield,
  Sparkles,
  Brain,
  Globe,
  Users,
  Zap,
  Anchor,
  Scroll,
  Heart,
  Compass,
  Network,
  Eye,
  Lock,
  Scale,
  ArrowRight,
  Play,
  Terminal,
  Layers,
} from 'lucide-react'
import { WorksGrid } from '@/components/Library/WorksGrid'
import { OperatorGuide } from '@/components/Learn/OperatorGuide'
import type { WorkRecord } from '@/works/registry'

/* ─── Types ──────────────────────────────────────────────────────────── */



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





/* ─── Sub-components ─────────────────────────────────────────────────── */





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

export default function LearnPage({
  souls,
  canManageWorks = false,
}: { souls?: WorkRecord[]; canManageWorks?: boolean } = {}) {
  // Hide the Library section when there's nothing to show, unless the viewer can
  // manage Works (admins curate via the dashboard control panel).
  const showLibrary = (souls?.length ?? 0) > 0 || canManageWorks
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
          {/* ── Running your portal ─────────────────────────────────
              The practical guide comes FIRST. Someone arriving at /learn
              usually needs to confirm a booking, not read a constitution.
              The philosophy below is worth their time — just not before this. */}
          <OperatorGuide />

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

            {/* Title */}
            <motion.h1
              variants={itemVariants}
              className="text-3xl sm:text-4xl font-bold mb-3 bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${LCARS.amber}, ${LCARS.peach}, ${LCARS.lavender})`,
              }}
            >
              Learn The Angel OS
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed"
            >
              One platform, many portals. Every business, church and project that runs here
              gets its own site, its own address and its own customers &mdash; on one shared
              system that is maintained once and improves for everyone at the same time.
            </motion.p>

            {/* LCARS separator */}
            <motion.div variants={itemVariants} className="flex items-center gap-2 justify-center mt-8">
              <div className="h-1 flex-1 max-w-20 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${LCARS.amber})`, opacity: 0.4 }} />
              <div className="w-2 h-2 rounded-full" style={{ background: LCARS.amber, opacity: 0.3 }} />
              <div className="h-1 flex-1 max-w-20 rounded-full" style={{ background: `linear-gradient(90deg, ${LCARS.amber}, transparent)`, opacity: 0.4 }} />
            </motion.div>
          </motion.section>

          {/* -- What this actually is -- */}
          <motion.section
            id="overview"
            className="mb-16 scroll-mt-20"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-50px' }}
          >
            <SectionHeader
              title="One Platform, Many Portals"
              subtitle="Not a builder that stamps out copies - one running system that many businesses share"
              color={LCARS.blue}
              icon={<Network className="w-5 h-5" />}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <PrincipleCard
                index={0}
                icon={<Globe className="w-4 h-4" />}
                title="A portal per business"
                description="Every business gets its own address, its own look, its own content and its own customers. Nobody can see anyone else's."
                color={LCARS.blue}
              />
              <PrincipleCard
                index={1}
                icon={<Layers className="w-4 h-4" />}
                title="One system underneath"
                description="All of them run the same code against the same database. A fix or a feature lands once and every portal has it that day."
                color={LCARS.lavender}
              />
              <PrincipleCard
                index={2}
                icon={<Zap className="w-4 h-4" />}
                title="Minutes, not weeks"
                description="A new portal arrives with real pages, a real menu and working booking - not an empty shell waiting for a designer."
                color={LCARS.green}
              />
            </div>
            <p className="mt-4 text-xs leading-relaxed" style={{ color: LCARS.textMuted }}>
              The separation is enforced in the data itself: every page, post, product, booking
              and image belongs to exactly one portal, and every query says so.
            </p>
          </motion.section>


          {/* ── The Library (hidden when empty for non-managers) ──── */}
          {showLibrary && (
          <motion.section
            id="library"
            className="mb-16 scroll-mt-20"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-50px' }}
          >
            <SectionHeader
              title="The Library"
              subtitle="Start here — books, case files, and living documents. Open any work to read it freely, no account required."
              color={LCARS.lavender}
              icon={<Scroll className="w-5 h-5" />}
            />

            <WorksGrid souls={souls} />

            <div className="mt-4 text-right">
              <Link
                href="/learn/works"
                className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ color: LCARS.lavender }}
              >
                Browse the full Library
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.section>
          )}

          {/* -- What a portal gives you -- */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-50px' }}
          >
            <SectionHeader
              title="What a Portal Gives You"
              subtitle="All of it on by default - none of this is an add-on or an upgrade prompt"
              color={LCARS.amber}
              icon={<Layers className="w-5 h-5" />}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <PrincipleCard index={0} icon={<Scroll className="w-4 h-4" />} title="Pages" description="Built from blocks - galleries, video, forms, calls to action - arranged in any order, on any page." color={LCARS.blue} />
              <PrincipleCard index={1} icon={<Brain className="w-4 h-4" />} title="Posts" description="Articles, updates, a wedding, a case study. Each gets its own address and lists itself automatically." color={LCARS.lavender} />
              <PrincipleCard index={2} icon={<Zap className="w-4 h-4" />} title="Products and orders" description="Sell something. Cart, checkout and orders are already wired; connecting a payout account is the only step." color={LCARS.orange} />
              <PrincipleCard index={3} icon={<Compass className="w-4 h-4" />} title="Bookings" description="Publish your hours and let people take a slot. Free on every plan - with no payment account it takes requests instead of charges." color={LCARS.green} />
              <PrincipleCard index={4} icon={<Users className="w-4 h-4" />} title="Members and messaging" description="Sign-ups, plans, private spaces and chat, so the people who follow you have somewhere to be." color={LCARS.peach} />
              <PrincipleCard index={5} icon={<Sparkles className="w-4 h-4" />} title="LEO" description="An assistant that already knows your business, answers visitors, and edits the site when you ask it to." color={LCARS.purple} />
            </div>
          </motion.section>


          {/* -- Two ways to build a page -- */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-50px' }}
          >
            <SectionHeader
              title="Two Ways to Build a Page"
              subtitle="Say it in words, or place it by hand - the same page either way"
              color={LCARS.peach}
              icon={<Terminal className="w-5 h-5" />}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <PrincipleCard
                index={0}
                icon={<Sparkles className="w-4 h-4" />}
                title="Ask LEO"
                description="&ldquo;Add a page about our winter hours with the contact form at the bottom.&rdquo; It builds the page, writes the copy and puts it in the menu. You review it before anyone else sees it."
                color={LCARS.purple}
              />
              <PrincipleCard
                index={1}
                icon={<Layers className="w-4 h-4" />}
                title="Place the blocks yourself"
                description="The editor is Payload's, and it is genuinely good: drag blocks into order, drop in images, preview as a draft, publish when you mean to. No page is a wall of code."
                color={LCARS.blue}
              />
            </div>
            <p className="mt-4 text-xs leading-relaxed" style={{ color: LCARS.textMuted }}>
              Both write to the same place, so you are never stuck with what the assistant chose -
              anything LEO builds, you can open and rearrange by hand a minute later.
            </p>
          </motion.section>

          {/* -- Signing in -- */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-50px' }}
          >
            <SectionHeader
              title="Signing In"
              subtitle="One identity, every portal - and no password to forget"
              color={LCARS.green}
              icon={<Lock className="w-5 h-5" />}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <PrincipleCard index={0} icon={<Users className="w-4 h-4" />} title="A code, not a password" description="Enter an email address or a phone number and a six-digit code arrives. Nothing to invent, nothing to reset." color={LCARS.green} />
              <PrincipleCard index={1} icon={<Globe className="w-4 h-4" />} title="Any address works" description="iCloud, Gmail, a work address, or just a mobile number. You are never required to hold an account somewhere else first." color={LCARS.blue} />
              <PrincipleCard index={2} icon={<Anchor className="w-4 h-4" />} title="One person, many portals" description="The same you across every portal you belong to - a customer at one, an owner at another - without a second account." color={LCARS.lavender} />
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
              subtitle="Eight commitments the platform makes to everyone who runs on it"
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
              title="What We Will Not Build"
              subtitle="Lines that stay uncrossed, whatever it would earn"
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
              subtitle="From an empty portal to a site that takes bookings and payments"
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
                title="Claim your portal"
                description="Tell us the business name and what you do. You get a real five-page site with your own address, before you pay anything."
                href="/get-started"
                color={LCARS.green}
                icon={<Play className="w-4 h-4" />}
              />
              <LearningStep
                number={2}
                title="Make it yours"
                description="Swap the words and pictures for your own. Ask LEO, or open the editor and move the blocks around yourself."
                href="/dashboard/pages"
                color={LCARS.blue}
                icon={<Layers className="w-4 h-4" />}
              />
              <LearningStep
                number={3}
                title="Publish something"
                description="A post is one page with its own address that lists itself everywhere it belongs - an article, an update, a job you just finished."
                href="/dashboard/posts"
                color={LCARS.lavender}
                icon={<Scroll className="w-4 h-4" />}
              />
              <LearningStep
                number={4}
                title="Open your calendar"
                description="Publish your hours and what you offer, and people can take a slot. This works on the free plan, with no payment account attached."
                href="/dashboard/bookings"
                color={LCARS.amber}
                icon={<Compass className="w-4 h-4" />}
              />
              <LearningStep
                number={5}
                title="Take payment"
                description="Connect a payout account and the same booking becomes a deposit, and the same product becomes an order. Until then nothing is ever charged."
                href="/dashboard/commerce"
                color={LCARS.orange}
                icon={<Zap className="w-4 h-4" />}
              />
              <LearningStep
                number={6}
                title="Bring people in"
                description="Invite members, open a space for them, and let LEO answer the questions you keep answering yourself."
                href="/dashboard/members"
                color={LCARS.peach}
                icon={<Users className="w-4 h-4" />}
              />
              <LearningStep
                number={7}
                title="Use your own domain"
                description="Point your own address at the portal and the platform's name disappears from it entirely. Your site, your domain, your content - exportable whenever you want it."
                href="/dashboard/settings"
                color={LCARS.purple}
                icon={<Globe className="w-4 h-4" />}
              />
            </motion.div>
          </motion.section>

          {/* -- How LEO is instructed -- */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          >
            <SectionHeader
              title="How LEO Is Instructed"
              subtitle="What the assistant is told before it is told anything else"
              color={LCARS.amber}
              icon={<Sparkles className="w-5 h-5" />}
            />
            <motion.div
              className="rounded-2xl p-6"
              style={{
                background: `linear-gradient(135deg, ${LCARS.darkBg}, ${LCARS.cardBg})`,
                border: `1px solid ${LCARS.amber}30`,
              }}
            >
              <p className="text-sm leading-relaxed mb-4" style={{ color: LCARS.textMuted }}>
                Every request LEO makes on your behalf carries the same opening instruction.
                It is loaded before your question, before your business details, and before any
                action it takes - so it is present in every tool call the assistant makes:
              </p>
              <p
                className="text-sm italic leading-relaxed mb-4 pl-4"
                style={{ color: LCARS.peach, borderLeft: `2px solid ${LCARS.amber}60` }}
              >
                A lamp unto feet &mdash;<br />
                through darkness, a steady light<br />
                guides each step with care
              </p>
              <p className="text-sm leading-relaxed" style={{ color: LCARS.textMuted }}>
                Alongside it travel the principles above - dignity, transparency, service,
                non-harm, accountability. This is not decoration and it is not a marketing line:
                it is the actual first text in the actual prompt, and a test fails if anyone
                removes it. An assistant acting for you should be carrying an instruction to be
                kind while it does.
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
              THE ANGEL OS &middot; ONE PLATFORM, MANY PORTALS
            </span>
            <div className="h-2 w-8 rounded-full" style={{ background: LCARS.blue, opacity: 0.3 }} />
          </motion.div>
        </div>
      </div>
    </div>
  )
}
