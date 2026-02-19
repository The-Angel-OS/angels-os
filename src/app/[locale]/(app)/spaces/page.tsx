import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'

/**
 * /spaces — REDIRECT to /dashboard/spaces
 *
 * Spaces require authentication for full functionality (sending messages,
 * managing channels, member management). The public /spaces page was a
 * duplicate of the dashboard version wrapped in the brochure layout.
 *
 * Redirecting to the dashboard version provides:
 * - Proper auth gating
 * - Dashboard sidebar navigation
 * - LEO sidebar access
 * - Consistent UX
 */
export const metadata = {
  title: 'Spaces',
  description: 'Join the conversation.',
}

export default async function SpacesRoute() {
  const locale = await getLocale()
  const prefix = locale === 'en' ? '' : `/${locale}`
  redirect(`${prefix}/dashboard/spaces`)
}
