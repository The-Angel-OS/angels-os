import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

/**
 * Consolidated 260714 → /dashboard/admin/provision (the single "create a new
 * endeavor" surface, which also carries portal-maintenance and the broader
 * requirePortalManager guard). Kept as a redirect so existing links / the
 * membership-less landing still resolve.
 */
export default async function NewEndeavorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const prefix = locale === 'en' ? '' : `/${locale}`
  redirect(`${prefix}/dashboard/admin/provision`)
}
