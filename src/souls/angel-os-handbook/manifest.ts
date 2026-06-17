// src/souls/angel-os-handbook/manifest.ts
// The Angel OS Handbook — the platform documentation, published AS a Work so it
// reads in /learn + /works, syndicates across the federation, and caches offline.
// Bodies live in docs/vision/angel-os-handbook/*.md (read at import time).

import type { SoulManifest } from '../rainmaker/manifest'

export const angelOsHandbookManifest: SoulManifest = {
  id: 'angel-os-handbook',
  canonical: { origin: 'https://spacesangels.com', endeavor: 'platform', creditedTo: 'kenneth.courtney@gmail.com' },
  title: 'The Angel OS Handbook',
  subtitle: 'Everyone gets an Angel — start here',
  description:
    'The friendly, accessible guide to Angel OS: what it is, the Fair Split, Leo your guardian, Spaces & the Library, the Federation, the token economy, and how to begin. Documentation published as a Work — readable, shareable, offline.',
  status: 'LIVING DOCUMENT',
  statusColor: 'green',
  tags: ['handbook', 'documentation', 'getting-started', 'angel-os'],
  defaultDoc: 'welcome',
  docs: [
    { id: 'welcome', filename: '01-welcome.md', title: 'Welcome to Angel OS', date: '2026-06-17', description: 'What Angel OS is and the spirit of it', tier: 'index' },
    { id: 'fair-split', filename: '02-the-fair-split.md', title: 'The Three Roles & the Fair Split', date: '2026-06-17', description: 'How value is divided — and the Toward-53 principle', tier: 'chapter' },
    { id: 'meet-leo', filename: '03-meet-leo.md', title: 'Meet Leo — Your Guardian Angel', date: '2026-06-17', description: "Leo, the constitutional AI guardian, and what it does", tier: 'chapter' },
    { id: 'spaces-and-works', filename: '04-spaces-and-works.md', title: 'Spaces, the Library & Works', date: '2026-06-17', description: 'How people communicate and how knowledge is published', tier: 'chapter' },
    { id: 'federation', filename: '05-federation.md', title: 'The Federation', date: '2026-06-17', description: 'The Diocese model — sovereign nodes that grow together', tier: 'chapter' },
    { id: 'token-economy', filename: '06-token-economy.md', title: 'The Token Economy', date: '2026-06-17', description: 'Getting paid for real work — Proof of Human Worth', tier: 'chapter' },
    { id: 'getting-started', filename: '07-getting-started.md', title: 'Getting Started', date: '2026-06-17', description: 'Stand something real up — the fastest path in', tier: 'action' },
  ],
}
