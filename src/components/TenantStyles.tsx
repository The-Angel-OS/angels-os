import type { Tenant } from '@/payload-types'

const FONT_MAP: Record<string, string> = {
  inter: 'Inter, sans-serif',
  'playfair-display': "'Playfair Display', serif",
  montserrat: 'Montserrat, sans-serif',
  raleway: 'Raleway, sans-serif',
  poppins: 'Poppins, sans-serif',
  'open-sans': "'Open Sans', sans-serif",
  lato: 'Lato, sans-serif',
  roboto: 'Roboto, sans-serif',
  'source-sans-3': "'Source Sans 3', sans-serif",
}

type Props = { tenant: Tenant | null }

/**
 * A branding value reaches a raw <style> tag, so anything that is not plainly a
 * hex colour is dropped rather than escaped — `red; } body { display: none` is a
 * legal-looking string in a text field and would otherwise be live CSS.
 */
function safeHex(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
    ? value.trim()
    : fallback
}

/**
 * Black or white, whichever is readable on `hex`. Relative luminance per WCAG.
 *
 * The split is 0.179, not the eyeballed 0.5 — that is where the two contrast
 * ratios actually cross (sqrt(1.05 * 0.05) - 0.05). Half-way looks reasonable
 * and is wrong for exactly the mid-tone brand colours trades pick: a #C8A16B
 * gold sits at L 0.39 and gets white text at 2.4:1, which fails AA outright.
 */
export function readableOn(hex: string): string {
  const h =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex
  const channel = (i: number) => {
    const c = parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
  return L > 0.179 ? '#111111' : '#FFFFFF'
}

/**
 * Build the tenant stylesheet. Exported for testing — the component is a thin
 * wrapper so the interesting part is checkable without rendering React.
 */
export function buildTenantCss(b: NonNullable<Tenant['branding']>): string {
  const primary = safeHex(b.primaryColor, '#10B981')
  const secondary = safeHex(b.secondaryColor, '#0078D4')
  const accent = safeHex(b.accentColor, '#FF6B35')
  const bg = safeHex(b.backgroundColor, '#FFFFFF')
  const fg = safeHex(b.foregroundColor, '#1A1A1A')
  const border = safeHex(b.borderColor, '#E5E7EB')
  const headingFont = FONT_MAP[b.headingFont as string] || 'Inter, sans-serif'
  const bodyFont = FONT_MAP[b.bodyFont as string] || 'Inter, sans-serif'

  // The --tenant-* namespace stays exactly as it was — five blocks read it
  // directly and Showcase colour-mixes against it.
  //
  // The theme mapping below is the part that gives the other nineteen blocks
  // tenant colour without touching them: every block already styles itself with
  // `bg-primary` / `text-primary` / `ring-*`, which resolve through these
  // tokens. Tailwind v4 holds plain colour values here (not HSL triplets), so a
  // hex drops straight in.
  //
  // ponytail: only --primary and --ring are remapped. In shadcn, --secondary and
  // --accent are SURFACE colours (muted card and hover backgrounds), not brand
  // colours — pointing them at a saturated brand hex turns every hover state
  // into a colour block. Tenant secondary/accent stay in the --tenant-* space
  // for blocks that deliberately want them.
  const brand = `
      --tenant-primary: ${primary};
      --tenant-secondary: ${secondary};
      --tenant-accent: ${accent};
      --tenant-bg: ${bg};
      --tenant-fg: ${fg};
      --tenant-border: ${border};
      --tenant-heading-font: ${headingFont};
      --tenant-body-font: ${bodyFont};
      --primary: ${primary};
      --primary-foreground: ${readableOn(primary)};
      --ring: ${primary};`

  // Emitted for the dark selector too. `[data-theme='dark']` redefines --primary
  // further down globals.css, so a :root-only rule loses to it and the whole
  // mapping silently does nothing on every dark-theme portal — which is most of
  // the trade demos.
  return `
    :root {${brand}
    }
    [data-theme='dark'] {${brand}
    }
    body {
      font-family: var(--tenant-body-font);
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: var(--tenant-heading-font);
    }
  `.trim()
}

/**
 * Injects tenant-scoped CSS custom properties from branding.
 *
 * Two layers: the --tenant-* namespace (opt-in, read explicitly by branded
 * blocks) and a narrow remap of the shadcn brand tokens (--primary, --ring) so
 * that unmodified blocks pick up tenant colour on their own.
 */
export function TenantStyles({ tenant }: Props) {
  const b = tenant?.branding
  if (!b) return null

  return <style dangerouslySetInnerHTML={{ __html: buildTenantCss(b) }} />
}
