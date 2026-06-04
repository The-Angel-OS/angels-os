// src/souls/index.ts
// Global soul registry — each soul is a case file, project, or endeavor
// with a manifest and markdown documents served from docs/

import { rainmakerManifest } from './rainmaker/manifest'
import { gptPsychosisManifest } from './gpt-psychosis/manifest'
import { wdegManifest } from './wdeg/manifest'
import { answer53Manifest } from './answer53/manifest'
import { readyPlayerEveryoneManifest } from './ready-player-everyone/manifest'
import type { SoulManifest } from './rainmaker/manifest'

export type { SoulManifest, SoulDoc } from './rainmaker/manifest'

// The Library — case files and works, each a manifest + markdown docs in
// docs/vision/{id}/. Order here is the order shown on the Library index.
export const SOULS: Record<string, SoulManifest> = {
  rainmaker: rainmakerManifest,
  'gpt-psychosis': gptPsychosisManifest,
  wdeg: wdegManifest,
  answer53: answer53Manifest,
  'ready-player-everyone': readyPlayerEveryoneManifest,
}

export function getSoul(id: string): SoulManifest | null {
  return SOULS[id] ?? null
}

export function getAllSouls(): SoulManifest[] {
  return Object.values(SOULS)
}
