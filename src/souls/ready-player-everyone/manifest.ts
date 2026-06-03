// src/souls/ready-player-everyone/manifest.ts
// Ready Player Everyone — a forthcoming work by Kenneth Courtney.

import type { SoulManifest } from '../rainmaker/manifest'

export const readyPlayerEveryoneManifest: SoulManifest = {
  id: 'ready-player-everyone',
  title: 'READY PLAYER EVERYONE',
  subtitle: 'A work — forthcoming',
  description:
    'The inversion of the lone-hero fantasy: not one chosen player, but everyone handed a controller. Abundance as the win condition. Forthcoming in the Library.',
  status: 'FORTHCOMING',
  statusColor: 'teal',
  tags: ['book', 'manifesto', 'abundance', 'library'],
  defaultDoc: 'readme',
  docs: [
    {
      id: 'readme',
      filename: 'README.md',
      title: 'About the Work',
      date: '2026-06-02',
      description: 'The premise: everyone gets a controller',
      tier: 'index',
    },
  ],
}
