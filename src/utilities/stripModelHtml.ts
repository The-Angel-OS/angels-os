/**
 * Normalise HTML a model emitted into the markdown the Lexical converter expects.
 *
 * `create_post` asks for plain text with blank lines between paragraphs, and the
 * model periodically answers with `<p>…</p><strong>…</strong>` anyway. That went
 * through markdownToLexical untouched and the tags rendered as literal text in
 * the published post. Asking the prompt more firmly does not fix this — the
 * conversion has to be defensive, because the input is a language model.
 *
 * Deliberately NOT an HTML parser: this handles the small set of tags a model
 * actually produces in prose and drops the rest. Anything richer belongs in a
 * real converter, not here.
 */
const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&rdquo;': '”',
  '&ldquo;': '“',
}

/** True when the text carries block/inline tags rather than incidental angle brackets. */
export function looksLikeHtml(text: string): boolean {
  return /<\/?(p|br|strong|b|em|i|ul|ol|li|h[1-6]|div|span|a)\b[^>]*>/i.test(text)
}

export function stripModelHtml(input: string): string {
  if (!input || !looksLikeHtml(input)) return input
  let s = input

  // Block boundaries become blank lines before any tag is dropped, or the
  // paragraphs run together into one wall of text.
  s = s.replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote)\s*>/gi, '\n\n')
  s = s.replace(/<br\s*\/?>/gi, '\n')

  // Headings and list items carry their markdown marker in.
  s = s.replace(/<h([1-6])[^>]*>/gi, (_m, n: string) => '\n\n' + '#'.repeat(Number(n)) + ' ')
  s = s.replace(/<li[^>]*>/gi, '\n- ')

  // Emphasis → markdown, so the converter keeps the formatting instead of losing it.
  s = s.replace(/<\/?(strong|b)\s*>/gi, '**')
  s = s.replace(/<\/?(em|i)\s*>/gi, '*')

  // Links: keep the text and the href.
  s = s.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')

  // Whatever tags remain are structural noise.
  s = s.replace(/<[^>]+>/g, '')

  for (const [entity, char] of Object.entries(ENTITIES)) s = s.split(entity).join(char)
  s = s.replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))

  // Collapse the runs of blank lines the substitutions above create.
  return s
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
