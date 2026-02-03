import React from 'react'
import type { Tenant } from '@/payload-types'

const FONT_IDS: Record<string, string> = {
  inter: 'Inter:wght@400;600;700',
  'playfair-display': 'Playfair+Display:wght@400;600;700',
  montserrat: 'Montserrat:wght@400;600;700',
  raleway: 'Raleway:wght@400;600;700',
  poppins: 'Poppins:wght@400;600;700',
  'open-sans': 'Open+Sans:wght@400;600;700',
  lato: 'Lato:wght@400;600;700',
  roboto: 'Roboto:wght@400;600;700',
  'source-sans-3': 'Source+Sans+3:wght@400;600;700',
}

type Props = { tenant: Tenant | null }

/**
 * Loads Google Fonts for tenant typography (heading + body).
 */
export function TenantFonts({ tenant }: Props) {
  const b = tenant?.branding
  const headingId = FONT_IDS[b?.headingFont as string] || 'Inter:wght@400;600;700'
  const bodyId = FONT_IDS[b?.bodyFont as string] || 'Inter:wght@400;600;700'

  const families = [...new Set([headingId, bodyId])]
  const href = `https://fonts.googleapis.com/css2?family=${families.join('&family=')}&display=swap`

  return React.createElement('link', { rel: 'stylesheet', href })
}