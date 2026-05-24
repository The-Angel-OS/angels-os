// src/souls/index.ts
// Global soul registry — each soul is a case file, project, or endeavor
// with a manifest and markdown documents served from docs/

import { rainmakerManifest } from './rainmaker/manifest'
import type { SoulManifest } from './rainmaker/manifest'

export type { SoulManifest, SoulDoc } from './rainmaker/manifest'

export const SOULS: Record<string, SoulManifest> = {
  rainmaker: rainmakerManifest,
  // Future souls registered here:
  // 'angel-os': angelOsManifest,
  // 'clearwater-cruisin': clearwaterManifest,
}

export function getSoul(id: string): SoulManifest | null {
  return SOULS[id] ?? null
}

export function getAllSouls(): SoulManifest[] {
  return Object.values(SOULS)
}
