// src/souls/wdeg/manifest.ts
// Where Did Everyone Go — the first full book in the Angel OS Library.

import type { SoulManifest } from '../rainmaker/manifest'

export const wdegManifest: SoulManifest = {
  id: 'wdeg',
  title: 'WHERE DID EVERYONE GO',
  subtitle: 'A book — in production for the Library',
  description:
    'The first full-length work brought into the Angel OS Library. Being imported chapter by chapter into the message-backed reader; destined for the illustrated-primer experience.',
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
