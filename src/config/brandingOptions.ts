/**
 * Canonical branding option catalogs — ONE source of truth for the font lists
 * that were copy-pasted (and had already drifted) across the ProvisionWizard,
 * Settings→General, and Settings→Endeavor editors. Add a font here and every
 * branding editor sees it. (53: the maker kept whole.)
 */
export interface FontOption {
  value: string
  label: string
}

/** Fonts suited to headings/display. */
export const HEADING_FONTS: FontOption[] = [
  { value: 'inter', label: 'Inter' },
  { value: 'playfair-display', label: 'Playfair Display' },
  { value: 'montserrat', label: 'Montserrat' },
  { value: 'raleway', label: 'Raleway' },
  { value: 'poppins', label: 'Poppins' },
]

/** Fonts suited to body copy. */
export const BODY_FONTS: FontOption[] = [
  { value: 'inter', label: 'Inter' },
  { value: 'open-sans', label: 'Open Sans' },
  { value: 'lato', label: 'Lato' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'source-sans-3', label: 'Source Sans 3' },
]

/** The full catalog (union, deduped) — for a single combined font picker. */
export const ALL_FONTS: FontOption[] = (() => {
  const seen = new Set<string>()
  return [...HEADING_FONTS, ...BODY_FONTS].filter((f) => (seen.has(f.value) ? false : (seen.add(f.value), true)))
})()
