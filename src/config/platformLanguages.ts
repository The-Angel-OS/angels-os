/**
 * platformLanguages — the menu of languages a Work can be translated into.
 *
 * The base language of a Work is immutable (it anchors the signed identity); every
 * other language here is an OPTIONAL, additive translation an author can request now
 * or later. The 17 marked `proven` are the set already shipping live in WDEG; the
 * rest expand the platform toward a 30+ language default.
 *
 * `PLATFORM_DEFAULT_LANGUAGES` is the "translate into the platform defaults" set —
 * one click takes a Work multilingual without the author choosing codes by hand.
 */
export interface PlatformLanguage {
  code: string
  name: string
  /** English label, for menus shown to authors. */
  englishName: string
  rtl?: boolean
  /** Already proven live (WDEG). */
  proven?: boolean
}

export const PLATFORM_LANGUAGES: PlatformLanguage[] = [
  { code: 'en', name: 'English', englishName: 'English', proven: true },
  { code: 'es', name: 'Español', englishName: 'Spanish', proven: true },
  { code: 'fr', name: 'Français', englishName: 'French', proven: true },
  { code: 'de', name: 'Deutsch', englishName: 'German', proven: true },
  { code: 'it', name: 'Italiano', englishName: 'Italian', proven: true },
  { code: 'pt', name: 'Português', englishName: 'Portuguese', proven: true },
  { code: 'nl', name: 'Nederlands', englishName: 'Dutch', proven: true },
  { code: 'pl', name: 'Polski', englishName: 'Polish', proven: true },
  { code: 'sv', name: 'Svenska', englishName: 'Swedish', proven: true },
  { code: 'ru', name: 'Русский', englishName: 'Russian', proven: true },
  { code: 'zh', name: '中文', englishName: 'Chinese (Simplified)', proven: true },
  { code: 'ja', name: '日本語', englishName: 'Japanese', proven: true },
  { code: 'ko', name: '한국어', englishName: 'Korean', proven: true },
  { code: 'hi', name: 'हिन्दी', englishName: 'Hindi', proven: true },
  { code: 'ar', name: 'العربية', englishName: 'Arabic', rtl: true, proven: true },
  { code: 'he', name: 'עברית', englishName: 'Hebrew', rtl: true, proven: true },
  { code: 'ur', name: 'اردو', englishName: 'Urdu', rtl: true, proven: true },
  // ── Expansion toward 30+ ──
  { code: 'tr', name: 'Türkçe', englishName: 'Turkish' },
  { code: 'id', name: 'Bahasa Indonesia', englishName: 'Indonesian' },
  { code: 'vi', name: 'Tiếng Việt', englishName: 'Vietnamese' },
  { code: 'th', name: 'ไทย', englishName: 'Thai' },
  { code: 'uk', name: 'Українська', englishName: 'Ukrainian' },
  { code: 'el', name: 'Ελληνικά', englishName: 'Greek' },
  { code: 'cs', name: 'Čeština', englishName: 'Czech' },
  { code: 'ro', name: 'Română', englishName: 'Romanian' },
  { code: 'hu', name: 'Magyar', englishName: 'Hungarian' },
  { code: 'fi', name: 'Suomi', englishName: 'Finnish' },
  { code: 'da', name: 'Dansk', englishName: 'Danish' },
  { code: 'no', name: 'Norsk', englishName: 'Norwegian' },
  { code: 'fa', name: 'فارسی', englishName: 'Persian', rtl: true },
  { code: 'bn', name: 'বাংলা', englishName: 'Bengali' },
  { code: 'ta', name: 'தமிழ்', englishName: 'Tamil' },
  { code: 'tl', name: 'Filipino', englishName: 'Filipino' },
  { code: 'sw', name: 'Kiswahili', englishName: 'Swahili' },
]

/** Fast lookup by code. */
export const PLATFORM_LANGUAGE_BY_CODE: Record<string, PlatformLanguage> = Object.fromEntries(
  PLATFORM_LANGUAGES.map((l) => [l.code, l]),
)

/** The "platform defaults" set — what "translate into the defaults" produces. */
export const PLATFORM_DEFAULT_LANGUAGES: string[] = PLATFORM_LANGUAGES.filter((l) => l.proven).map((l) => l.code)

export function isRtl(code: string): boolean {
  return Boolean(PLATFORM_LANGUAGE_BY_CODE[code]?.rtl)
}

export function languageName(code: string): string {
  return PLATFORM_LANGUAGE_BY_CODE[code]?.name ?? code.toUpperCase()
}
