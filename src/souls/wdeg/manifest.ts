// src/souls/wdeg/manifest.ts
// Where Did Everyone Go — the first full book in the Angel OS Library.

import type { SoulManifest } from '../rainmaker/manifest'

export const wdegManifest: SoulManifest = {
  id: 'wdeg',
  // Canonical to the Where Did Everyone Go endeavor — Kenneth's brother is the
  // author of record (publish-once-canonical; endeavor slug matches the tenant).
  canonical: { origin: 'https://wheredideveryonego.spacesangels.com', endeavor: 'wheredideveryonego', creditedTo: 'billthecat1022@gmail.com' },
  title: 'WHERE DID EVERYONE GO',
  subtitle: 'A book — in production for the Library',
  description:
    'The first full-length work in the Angel OS Library — a 26-page illustrated book, readable now in 17 languages with page-flip and continuous-scroll modes. The illustrated-primer experience, live.',
  status: 'READABLE NOW',
  statusColor: 'green',
  tags: ['book', 'fiction', 'library', 'primer'],
  bookSlug: 'wdeg',
  defaultDoc: 'readme',
  docs: [
    {
      id: 'readme',
      filename: 'README.md',
      title: 'About the Work',
      date: '2026-06-02',
      description: 'What WDEG is, how it reads, and where it will live',
      tier: 'index',
    },
  ],
  links: [
    {
      label: 'WDEG Portal (coming)',
      url: 'https://wheredideveryonego.spacesangels.com',
    },
  ],
}
