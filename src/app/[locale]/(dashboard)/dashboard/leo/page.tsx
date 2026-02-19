import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'

/**
 * /dashboard/leo — REDIRECT to /dashboard/spaces
 *
 * LEO is accessible everywhere via:
 * 1. The right-side sidebar toggle (SidebarChat) on any dashboard page
 * 2. The "general" channel in /dashboard/spaces
 * 3. The floating bubble on public pages
 *
 * A separate full-page LEO route is redundant. Redirect to spaces
 * where users can chat with LEO in the general channel alongside
 * other space channels.
 */
export default async function LEOPage() {
  const locale = await getLocale()
  const prefix = locale === 'en' ? '' : `/${locale}`
  redirect(`${prefix}/dashboard/spaces`)
}
