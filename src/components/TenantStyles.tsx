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
 * Injects tenant-scoped CSS custom properties from branding.
 *
 * IMPORTANT: These use --tenant-* namespace to avoid clobbering
 * the Tailwind/shadcn theme system (--color-primary, --color-background, etc.).
 * Use var(--tenant-primary), var(--tenant-heading-font), etc. in
 * tenant-branded components. The global theme stays intact for dark mode.
 */
export function TenantStyles({ tenant }: Props) {
  const b = tenant?.branding
  if (!b) return null

  const primary = b.primaryColor || '#10B981'
  const secondary = b.secondaryColor || '#0078D4'
  const accent = b.accentColor || '#FF6B35'
  const bg = b.backgroundColor || '#FFFFFF'
  const fg = b.foregroundColor || '#1A1A1A'
  const border = b.borderColor || '#E5E7EB'
  const headingFont = FONT_MAP[b.headingFont as string] || 'Inter, sans-serif'
  const bodyFont = FONT_MAP[b.bodyFont as string] || 'Inter, sans-serif'

  const css = `
    :root {
      --tenant-primary: ${primary};
      --tenant-secondary: ${secondary};
      --tenant-accent: ${accent};
      --tenant-bg: ${bg};
      --tenant-fg: ${fg};
      --tenant-border: ${border};
      --tenant-heading-font: ${headingFont};
      --tenant-body-font: ${bodyFont};
    }
  `.trim()

  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
