/**
 * Which alternation slot each Media + Text block occupies.
 *
 * Two blocks are deliberately NOT counted:
 *   • anything that isn't a mediaText — otherwise dropping a Content block
 *     between two sections flips every one below it;
 *   • a FULL-WIDTH mediaText — it has no side at all, so letting it consume a
 *     slot would silently invert the zig-zag beneath it.
 *
 * Returns layout-index → alternation-index, so callers keep their own ordering.
 */
export function buildAlternateIndex(
  blocks: Array<{ blockType?: string | null; width?: string | null } | null | undefined>,
): Map<number, number> {
  const map = new Map<number, number>()
  let seen = 0
  blocks.forEach((b, i) => {
    if (b?.blockType !== 'mediaText') return
    if (b?.width === 'full') return
    map.set(i, seen++)
  })
  return map
}
