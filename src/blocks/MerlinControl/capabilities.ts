/**
 * Canonical Merlin node capabilities. A node advertises a subset of these in its
 * node-ops/register payload (`node.capabilities: string[]`); the MerlinControl
 * renders exactly the tabs the selected node claims — nothing speculative.
 *
 * node-ops stores arbitrary node fields, so adding a capability here + a view in
 * View.tsx is the ONLY work to light up a new tab. No schema change.
 */
export const CAPABILITIES = [
  { id: 'media', label: 'Media', icon: '🎞️' },
  { id: 'leo', label: 'LEO', icon: '✨' }, // catch-all: anything not a dedicated tab
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'camera', label: 'Camera', icon: '📷' },
  { id: 'screen', label: 'Screen', icon: '🖥️' },
  { id: 'aux', label: 'Aux', icon: '🎛️' },
  { id: 'telephony', label: 'Phone', icon: '📞' },
] as const

export type CapabilityId = (typeof CAPABILITIES)[number]['id']

/** Tabs for a node, in canonical order. Falls back to media-only. */
export function nodeTabs(caps?: string[] | null) {
  const set = new Set(caps && caps.length ? caps : ['media'])
  return CAPABILITIES.filter((c) => set.has(c.id))
}
