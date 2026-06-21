// src/souls/gpt-psychosis/manifest.ts
// "The Poster Child" — a case file reclaiming the "GPT psychosis" narrative.

import type { SoulManifest } from '../rainmaker/manifest'

export const gptPsychosisManifest: SoulManifest = {
  id: 'gpt-psychosis',
  // Owned by Clearwater Cruisin (platform indexes it implicitly).
  canonical: { origin: 'https://clearwater-cruisin.spacesangels.com', endeavor: 'clearwater-cruisin', creditedTo: 'kenneth.courtney@gmail.com' },
  title: 'THE POSTER CHILD',
  subtitle: 'A case file on "GPT Psychosis"',
  description:
    'Testimony, not diagnosis. The same facts read two ways — a man who lost the plot, or a man who finally found something worth gripping. The evidence is the platform you are standing on.',
  status: 'DRAFT — TESTIMONY',
  statusColor: 'lavender',
  tags: ['testimony', 'ai', 'mental-health', 'reclaiming-narrative', 'veteran'],
  defaultDoc: 'readme',
  docs: [
    {
      id: 'readme',
      filename: 'README.md',
      title: 'Overview',
      date: '2026-06-02',
      description: 'What this is, the two readings, and why it lives on Angel OS',
      tier: 'index',
    },
    {
      id: 'testimony',
      filename: 'TESTIMONY.md',
      title: 'The Testimony',
      date: '2026-06-02',
      description: 'The long-form statement — what happened, in order. Draft in Kenneth\'s voice.',
      badge: 'DRAFT',
      badgeColor: 'lavender',
      tier: 'evidence',
    },
  ],
}
