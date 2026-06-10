/**
 * Nav partitioning — decide which items stay inline (primary) and which collapse
 * into the "More ▾" dropdown.
 *
 * Rules layered on top of a simple inline cap:
 *  - `forceOverflowUrls`: ALWAYS in More regardless of room (e.g. /dashboard).
 *  - `demoteUrls`: in More because the section is empty (e.g. /shop with no
 *    products, /events with none) — they become first-class again automatically
 *    once populated, since the caller recomputes demoteUrls from live counts.
 *  - everything else fills primary up to `maxInline`, the rest overflow.
 *
 * Original order is preserved within each band. Pure + testable.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NavItem = any

const urlOf = (i: NavItem): string | undefined => i?.link?.url ?? undefined

export interface PartitionOpts {
  maxInline: number
  forceOverflowUrls?: string[]
  demoteUrls?: string[]
}

export function partitionNavItems(
  menu: NavItem[],
  opts: PartitionOpts,
): { primary: NavItem[]; overflow: NavItem[] } {
  const demote = new Set([...(opts.forceOverflowUrls ?? []), ...(opts.demoteUrls ?? [])])
  const primary: NavItem[] = []
  const overflow: NavItem[] = []

  for (const item of Array.isArray(menu) ? menu : []) {
    if (demote.has(urlOf(item) as string)) {
      overflow.push(item)
    } else if (primary.length < opts.maxInline) {
      primary.push(item)
    } else {
      overflow.push(item)
    }
  }
  return { primary, overflow }
}
