/**
 * guardianSlug — the single source of truth for guardian-angel slug rules.
 *
 * A guardian angel's slug is its PUBLIC ADDRESS: the subdomain Core acts through
 * when it sends invites, renders donation forms, or represents the user's
 * endeavor (a nail salon, a pressure-washing business, a ministry). So it must
 * be (a) opaque-and-safe by default — privacy, no enumeration — yet (b) freely
 * SELECTABLE to a presentable vanity handle, and (c) RENAMEABLE as the endeavor
 * changes shape, without breaking links already sent (see renamePortalSlug,
 * which preserves the old subdomain as an alias).
 *
 * Both the claim endpoint and the rename path import from here so the rules —
 * format, reserved words, opaque generation — never drift apart.
 *
 * @see src/endpoints/claim-guardian-angel.ts
 * @see src/utilities/renamePortalSlug.ts
 */
import { randomBytes } from 'crypto'

export const slugify = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)

/**
 * Reserved subdomains a self-serve VANITY handle must never claim — they'd shadow
 * platform routing or enable impersonation. Only screened on the opt-in vanity
 * path; the opaque default can't hit these.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'www', 'api', 'admin', 'app', 'apps', 'mail', 'email', 'blog', 'cdn', 'static',
  'assets', 'leo', 'merlin', 'nimue', 'federation', 'dashboard', 'auth', 'login',
  'account', 'accounts', 'portal', 'root', 'system', 'support', 'help', 'status',
  'kendev', 'angel', 'angels', 'angelos', 'test', 'dev', 'staging',
])

/**
 * PRIVACY BY DEFAULT: opaque, unguessable id. Crockford-ish base32 minus
 * ambiguous chars (no 0/o/1/i/l) so it's clean when spoken/typed.
 */
const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export function opaqueSlug(len = 12): string {
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += ID_ALPHABET[bytes[i]! % ID_ALPHABET.length]
  return out
}

/**
 * Is this a legal, non-reserved vanity slug? Returns a human reason when NOT
 * acceptable, or null when it's fine to use. (Availability is a separate, DB
 * check — this is pure format/policy.)
 */
export function vanitySlugRejection(slug: string): string | null {
  if (!slug || slug.length < 3) return 'Handle must be at least 3 characters.'
  if (slug.length > 50) return 'Handle must be 50 characters or fewer.'
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return 'Handle may use only lowercase letters, numbers, and hyphens (not at the ends).'
  }
  if (RESERVED_SLUGS.has(slug)) return 'That handle is reserved.'
  return null
}
