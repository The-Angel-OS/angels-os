/**
 * Shared dashboard list page-size. Default 30 (was 50) with a user-selectable
 * option surfaced via the `?limit=` query param. Clamped to a known set so a
 * hand-edited URL can't request an unbounded page.
 */
export const PAGE_SIZE_OPTIONS = [30, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 30

export function resolvePageSize(param?: string | null): number {
  const n = Number(param)
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE
}
