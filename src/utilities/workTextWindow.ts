/**
 * workTextWindow — send the reader the page it asked for, not the whole book.
 *
 * The book reader flips pages client-side, so the server used to serialize EVERY
 * page in EVERY language into the HTML. On the Bible (1,189 chapters × 2
 * translations) that made `/learn/holy-bible` a **9.65 MB page** to display
 * chapter one. This builds a window around the opening page in one language;
 * `/api/works-ops/text` serves the rest on demand.
 *
 * ponytail: the DATABASE still reads every chapter row per request — that is the
 * messages-as-storage tax, not this. A real `work-chapters` collection with an
 * `order` column is what removes it; this fixes the wire, which is the 9.6 MB.
 */

/** Pages either side of the opening one. A reader flips slower than it fetches. */
export const TEXT_WINDOW_RADIUS = 12

/** Hard cap on a single /api/works-ops/text range — a whole book is not a window. */
export const TEXT_WINDOW_MAX = 50

/** A page's text in one language: prose, or verse-structured scripture. */
export type WorkPageText = string | Array<{ v: number; t: string }>

type PageLike = { translations?: Record<string, unknown> }

/**
 * `{ [lang]: { [pageIndex]: text } }` for ONE language, windowed around `idx`.
 * Shaped exactly like the full map the reader already understands, so the
 * client-side merge is the same code path as before.
 */
export function buildTextWindow(
  pages: PageLike[],
  idx: number,
  lang: string,
  radius: number = TEXT_WINDOW_RADIUS,
): Record<string, Record<string, WorkPageText>> {
  const from = Math.max(0, idx - radius)
  const to = Math.min(pages.length, idx + radius + 1)
  const slice: Record<string, WorkPageText> = {}
  for (let i = from; i < to; i++) {
    const t = pages[i]?.translations?.[lang]
    if (t !== undefined) slice[String(i)] = t as WorkPageText
  }
  return { [lang]: slice }
}
