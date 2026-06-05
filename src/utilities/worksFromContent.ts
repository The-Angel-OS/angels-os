/**
 * worksFromContent — turn raw readable text (a fetched article, a Google Doc, or
 * pasted/uploaded text) into a Work draft (manifest-shaped), so anything can enter
 * the Library through the same authoring → seal → read pipeline.
 *
 * The structuring step (split into a title + ordered Markdown pages) uses the AI
 * gateway, but is injectable (`structureFn`) for testing and degrades to a robust
 * heading-split fallback when no model is available or the model output is unusable.
 * It never throws — worst case you get a single-page draft of the cleaned text.
 */
import { generateText } from 'ai'
import { getModel, getFallbackModel } from '@/utilities/ai-gateway'
import type { WorkDraft } from '@/utilities/worksSeal'

export interface StructuredWork {
  title: string
  subtitle?: string
  pages: { title?: string; markdown: string }[]
}

export type StructureFn = (text: string, titleHint?: string) => Promise<StructuredWork>

const STRUCTURE_SYSTEM_PROMPT = [
  'You restructure raw article/document text into a clean, readable Work for a library.',
  'Return ONLY minified JSON of shape {"title":string,"subtitle":string,"pages":[{"title":string,"markdown":string}]}.',
  'Split the content into logical sections — each becomes a page with a short title and Markdown body.',
  'Preserve the author\'s words and meaning; do NOT summarize, editorialize, or invent. Clean up scrape artifacts, fix obvious broken line-wrapping, and format with Markdown headings/lists where the structure implies them.',
  'Aim for 1–12 pages. No preamble, no code fences — just the JSON.',
].join(' ')

const uid = (i: number) => `p_${i}_${Math.abs(Math.imul(i + 1, 2654435761)).toString(36)}`

/** Strip ``` fences and isolate the first {...} JSON object. */
function parseStructuredJson(raw: string): StructuredWork | null {
  try {
    let s = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const start = s.indexOf('{')
    const end = s.lastIndexOf('}')
    if (start >= 0 && end > start) s = s.slice(start, end + 1)
    const obj = JSON.parse(s) as Partial<StructuredWork>
    if (!obj || typeof obj.title !== 'string' || !Array.isArray(obj.pages)) return null
    const pages = obj.pages
      .filter((p): p is { title?: string; markdown: string } => !!p && typeof p.markdown === 'string')
      .map((p) => ({ title: typeof p.title === 'string' ? p.title : undefined, markdown: p.markdown }))
    if (pages.length === 0) return null
    return { title: obj.title.trim() || 'Untitled', subtitle: typeof obj.subtitle === 'string' ? obj.subtitle : undefined, pages }
  } catch {
    return null
  }
}

/** Default structurer: routes through the AI gateway. */
export const gatewayStructure: StructureFn = async (text, titleHint) => {
  const model = getModel() || getFallbackModel()
  if (!model) throw new Error('no model')
  const { text: out } = await generateText({
    model,
    system: STRUCTURE_SYSTEM_PROMPT,
    prompt: `${titleHint ? `Suggested title: ${titleHint}\n\n` : ''}Restructure this into a Work:\n\n${text.slice(0, 24_000)}`,
    maxOutputTokens: 8000,
  })
  const parsed = parseStructuredJson(out)
  if (!parsed) throw new Error('unparseable structure')
  return parsed
}

/** Heading-aware fallback: split on top-level Markdown headings, else one page. */
function fallbackStructure(text: string, titleHint?: string): StructuredWork {
  const lines = text.split('\n')
  const firstHeading = lines.find((l) => /^#{1,2}\s+/.test(l))?.replace(/^#+\s+/, '').trim()
  const firstLine = lines.map((l) => l.trim()).find(Boolean) || 'Imported Work'
  const title = (titleHint || firstHeading || firstLine).slice(0, 120)

  // Split on H1/H2 boundaries when present.
  const sections: { title?: string; markdown: string }[] = []
  let current: { title?: string; lines: string[] } | null = null
  for (const line of lines) {
    const h = line.match(/^#{1,2}\s+(.*)$/)
    if (h) {
      if (current) sections.push({ title: current.title, markdown: current.lines.join('\n').trim() })
      current = { title: h[1].trim(), lines: [] }
    } else {
      if (!current) current = { title: undefined, lines: [] }
      current.lines.push(line)
    }
  }
  if (current) sections.push({ title: current.title, markdown: current.lines.join('\n').trim() })

  const pages = sections.filter((s) => s.markdown.length > 0)
  return { title, pages: pages.length ? pages : [{ markdown: text.trim() }] }
}

export interface BuildWorkOptions {
  title?: string
  subtitle?: string
  structureFn?: StructureFn
}

/**
 * Build a Work draft from raw text. Uses the structurer, falling back gracefully.
 * Returns a draft ready to persist as a Channel's `data.workDraft`.
 */
export async function buildWorkDraftFromText(rawText: string, opts: BuildWorkOptions = {}): Promise<WorkDraft> {
  const text = rawText.replace(/\r\n/g, '\n').trim()
  const structureFn = opts.structureFn ?? gatewayStructure

  let structured: StructuredWork
  try {
    structured = await structureFn(text, opts.title)
  } catch {
    structured = fallbackStructure(text, opts.title)
  }

  return {
    title: opts.title?.trim() || structured.title,
    subtitle: opts.subtitle ?? structured.subtitle ?? '',
    media: 'doc',
    defaultLanguage: 'en',
    languages: [{ code: 'en', name: 'English', rtl: false }],
    pages: structured.pages.map((p, i) => ({
      id: uid(i),
      order: i,
      title: p.title || `Page ${i + 1}`,
      markdown: p.markdown,
    })),
  }
}
