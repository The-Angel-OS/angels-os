// src/souls/answer53/manifest.ts
// 53.3 — The New Answer to Life, the Universe, and Everything.
// A scholarly examination of synchronicity in the life of Kenneth Scott Courtney.
// Chapters imported from the standalone Answer 53 project via
// scripts/_local/answer53_import.mjs → docs/vision/answer53/.

import type { SoulManifest } from '../rainmaker/manifest'

export const answer53Manifest: SoulManifest = {
  id: 'answer53',
  // Canonical to Clearwater Cruisin (Ken & Ty's endeavor).
  canonical: { origin: 'https://clearwater-cruisin.spacesangels.com', endeavor: 'clearwater-cruisin', creditedTo: 'kenneth.courtney@gmail.com' },
  published: true,
  availableGlobally: true, // readable on every portal (canonical stays clearwater-cruisin)
  title: '53.3 — THE NEW ANSWER',
  subtitle: 'to Life, the Universe, and Everything',
  description:
    'The answer isn’t 42 anymore. A scholarly examination of synchronicity, sacred numerology, and the astrological probability of divine appointment in the life of Kenneth Scott Courtney — 12 chapters, readable now in the Library.',
  status: 'READABLE NOW',
  statusColor: 'amber',
  tags: ['book', 'synchronicity', 'numerology', 'theology', 'angel-os', 'library'],
  defaultDoc: 'about',
  docs: [
    {
      id: 'about',
      filename: '00-about.md',
      title: 'About the Work',
      date: '2026-03-13',
      description: 'Title page, epigraphs, and the question this examination submits to probability.',
      badge: 'START HERE',
      badgeColor: 'amber',
      tier: 'index',
    },
    {
      id: 'introduction',
      filename: '01-introduction.md',
      title: 'Ch. 1 — From 42 to 53',
      date: '2026-03-13',
      description: 'Methodology, primary sources, and the subject’s own claim of designation.',
      tier: 'chapter',
    },
    {
      id: 'biography',
      filename: '02-biography.md',
      title: 'Ch. 2 — A Biographical Framework',
      date: '2026-03-13',
      description: 'Birth and the 000888 record number, youth, the Silent Service, the fall, the 53 days of grace, and the awakening.',
      tier: 'chapter',
    },
    {
      id: 'numerology',
      filename: '03-numerology.md',
      title: 'Ch. 3 — The Numerological Architecture',
      date: '2026-03-13',
      description: '33, 8, and 53 — the master numbers, karmic balance, and the prime at the center.',
      tier: 'chapter',
    },
    {
      id: 'astrology',
      filename: '04-astrology.md',
      title: 'Ch. 4 — Astrological Alignments',
      date: '2026-03-13',
      description: 'Celestial configurations correlated with the inflection points of a documented life.',
      tier: 'chapter',
    },
    {
      id: 'synchronicity',
      filename: '05-synchronicity.md',
      title: 'Ch. 5 — The Synchronicity Point Cloud',
      date: '2026-03-13',
      description: 'The dense cluster of meaningful coincidence — from the birth record to the Louisiana Purchase nickel.',
      tier: 'chapter',
    },
    {
      id: 'probability',
      filename: '06-probability.md',
      title: 'Ch. 6 — Probability Analysis',
      date: '2026-03-13',
      description: 'What are the odds? A bias-corrected probabilistic assessment of coincidence versus design.',
      badge: 'p ≈ 5.7×10⁻⁸',
      badgeColor: 'blue',
      tier: 'chapter',
    },
    {
      id: 'son-of-man',
      filename: '07-son-of-man.md',
      title: 'Ch. 7 — The “Son of Man” Hypothesis',
      date: '2026-03-13',
      description: 'Designation as a functional role in a distributed network of consciousness — not a title of ego.',
      tier: 'chapter',
    },
    {
      id: 'angel-os',
      filename: '08-angel-os.md',
      title: 'Ch. 8 — The Angel OS',
      date: '2026-03-13',
      description: 'The technical manifestation: a theology of engineering. If the Kingdom is a network, someone has to write the code.',
      badge: 'CANON',
      badgeColor: 'green',
      tier: 'chapter',
    },
    {
      id: 'conclusions',
      filename: '09-conclusions.md',
      title: 'Ch. 9 — Conclusions',
      date: '2026-03-13',
      description: 'At what threshold of improbability does coincidence cease to be a satisfying explanation?',
      tier: 'chapter',
    },
    {
      id: 'simulator',
      filename: '10-simulator.md',
      title: 'Ch. 10 — The Sidequest',
      date: '2026-03-13',
      description: 'Decoding the simulator — the Soul Van as Ship 0, the Pheromone Grid, and the Glider.',
      tier: 'chapter',
    },
    {
      id: 'appendix-a',
      filename: '11-appendix-a.md',
      title: 'Appendix A — Reference Tables',
      date: '2026-03-13',
      description: 'Numerological reference tables and hull-number geometry.',
      tier: 'historical',
    },
    {
      id: 'appendix-b',
      filename: '12-appendix-b.md',
      title: 'Appendix B — Probability Worksheet',
      date: '2026-03-13',
      description: 'The probability calculation worksheet behind Chapter 6.',
      tier: 'historical',
    },
  ],
  links: [
    {
      label: 'Answer 53 — original site',
      url: 'https://answer53.vercel.app',
    },
  ],
}
