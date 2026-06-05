/**
 * worksTranslate — auto-translate a Work draft into additional languages.
 *
 * The base language is immutable (it anchors the sealed identity). Translation is
 * purely additive: for each requested target language we translate every page's
 * base-language Markdown and fold the result into `draft.translations[lang]`, mark
 * the language `machineTranslated`, and register it in `draft.languages`. The next
 * seal picks the new languages up automatically — translations can always come
 * later without disturbing the base.
 *
 * The translator is injectable (`translateFn`) so the orchestration is unit-testable
 * without a live model; the default uses the Angel OS AI gateway.
 */
import { generateText } from 'ai'
import { getModel, getFallbackModel } from '@/utilities/ai-gateway'
import { PLATFORM_LANGUAGE_BY_CODE } from '@/config/platformLanguages'
import type { WorkDraft, WorkLanguage } from '@/utilities/worksSeal'

export type TranslateFn = (text: string, targetLanguageEnglishName: string) => Promise<string>

const TRANSLATION_SYSTEM_PROMPT = [
  'You are a professional literary translator.',
  'Translate the user-provided text faithfully into the requested target language.',
  'Preserve Markdown structure exactly: headings, lists, emphasis, links, code blocks, and line breaks.',
  'Do not translate code, URLs, or text inside inline/back-tick code or fenced code blocks.',
  'Preserve proper nouns and brand names unless they have a well-established localized form.',
  'Return ONLY the translation — no preamble, no notes, no quotation wrapper.',
].join(' ')

/** Default translator: routes through the AI gateway (gateway model, then fallback). */
export const gatewayTranslate: TranslateFn = async (text, targetLanguageEnglishName) => {
  if (!text.trim()) return ''
  const model = getModel() || getFallbackModel()
  if (!model) throw new Error('No translation model available (AI gateway not configured)')
  const { text: out } = await generateText({
    model,
    system: TRANSLATION_SYSTEM_PROMPT,
    prompt: `Translate the following into ${targetLanguageEnglishName}:\n\n${text}`,
    maxOutputTokens: 4000,
  })
  return out.trim()
}

export interface TranslateOptions {
  /** Target language codes (base language is always skipped). */
  targetLangs: string[]
  /** Injectable translator (defaults to the AI gateway). */
  translateFn?: TranslateFn
  /** Re-translate languages that already have content. */
  force?: boolean
}

export interface TranslateResult {
  added: string[]
  skipped: string[]
  /** The updated draft — translations, languages, and machineTranslated merged in. */
  draft: WorkDraft
}

/**
 * Translate a Work draft into the requested languages, returning an updated draft.
 * Pure orchestration — no Payload/IO beyond the injected translator.
 */
export async function translateWorkDraft(draft: WorkDraft, opts: TranslateOptions): Promise<TranslateResult> {
  const base = draft.defaultLanguage
  const translateFn = opts.translateFn ?? gatewayTranslate
  const translations: Record<string, Record<string, string>> = { ...(draft.translations ?? {}) }
  const machineSet = new Set(draft.machineTranslated ?? [])
  const langByCode = new Map<string, WorkLanguage>(draft.languages.map((l) => [l.code, l]))

  const added: string[] = []
  const skipped: string[] = []

  for (const code of opts.targetLangs) {
    if (code === base) {
      skipped.push(code)
      continue
    }
    const existing = translations[code]
    if (!opts.force && existing && Object.keys(existing).length > 0) {
      skipped.push(code)
      continue
    }

    const meta = PLATFORM_LANGUAGE_BY_CODE[code]
    const englishName = meta?.englishName ?? code
    const map: Record<string, string> = {}
    for (const p of draft.pages) {
      map[String(p.order)] = await translateFn(p.markdown ?? '', englishName)
    }
    translations[code] = map
    machineSet.add(code)
    if (!langByCode.has(code)) {
      langByCode.set(code, { code, name: meta?.name ?? code.toUpperCase(), rtl: meta?.rtl })
    }
    added.push(code)
  }

  const updated: WorkDraft = {
    ...draft,
    translations,
    machineTranslated: [...machineSet].filter((c) => c !== base).sort(),
    languages: [...langByCode.values()],
  }
  return { added, skipped, draft: updated }
}
