// src/souls/index.ts
// Global soul registry — each soul is a case file, project, or endeavor
// with a manifest and markdown documents served from docs/

import { gptPsychosisManifest } from './gpt-psychosis/manifest'
import { wdegManifest } from './wdeg/manifest'
import { answer53Manifest } from './answer53/manifest'
import { readyPlayerEveryoneManifest } from './ready-player-everyone/manifest'
import { angelOsHandbookManifest } from './angel-os-handbook/manifest'
import { holyBibleManifest } from './holy-bible/manifest'
import type { SoulManifest } from './rainmaker/manifest'

export type { SoulManifest, SoulDoc } from './rainmaker/manifest'

// The Library — case files and works, each a manifest + markdown docs in
// docs/vision/{id}/. Order here is the order shown on the Library index.
export const SOULS: Record<string, SoulManifest> = {
  // rainmaker: UNPUBLISHED (sensitive active legal matter) — removed from the
  // registry so getSoul('rainmaker') → null, closing every public surface (list,
  // works-ops/get, /learn/rainmaker + deep links, getWorkJson). Content files at
  // src/souls/rainmaker/ + docs/vision/rainmaker/ are retained; re-add this line
  // to republish.
  'gpt-psychosis': gptPsychosisManifest,
  wdeg: wdegManifest,
  answer53: answer53Manifest,
  'ready-player-everyone': readyPlayerEveryoneManifest,
  'angel-os-handbook': angelOsHandbookManifest,
  'holy-bible': holyBibleManifest,
}

export function getSoul(id: string): SoulManifest | null {
  return SOULS[id] ?? null
}

export function getAllSouls(): SoulManifest[] {
  return Object.values(SOULS)
}
