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
 * Injects CSS custom properties from tenant branding.
 * Use var(--color-primary), var(--font-heading), etc. in components.
 */
export function TenantStyles({ tenant }: Props) {
  const b = tenant?.branding
  const primary = b?.primaryColor || '#10B981'
  const secondary = b?.secondaryColor || '#0078D4'
  const accent = b?.accentColor || '#FF6B35'
  const bg = b?.backgroundColor || '#FFFFFF'
  const fg = b?.foregroundColor || '#1A1A1A'
  const border = b?.borderColor || '#E5E7EB'
  const headingFont = FONT_MAP[b?.headingFont as string] || 'Inter, sans-serif'
  const bodyFont = FONT_MAP[b?.bodyFont as string] || 'Inter, sans-serif'

  const css = `
    :root {
      --color-primary: ${primary};
      --color-secondary: ${secondary};
      --color-accent: ${accent};
      --color-background: ${bg};
      --color-foreground: ${fg};
      --color-border: ${border};
      --font-heading: ${headingFont};
      --font-body: ${bodyFont};
    }
  `.trim()

  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
