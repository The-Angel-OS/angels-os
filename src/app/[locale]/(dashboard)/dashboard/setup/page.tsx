import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

/**
 * Retired 260714. The 17-min conversational "Enterprise Setup" wizard was one of
 * three overlapping setup surfaces (see nav-config note). Creation now happens in
 * the fast ProvisionWizard (/dashboard/admin/provision) and ongoing configuration
 * in Settings. This route stays only as a redirect so any stale deep link lands
 * somewhere sensible instead of 404ing.
 */
export default async function SetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const prefix = locale === 'en' ? '' : `/${locale}`
  redirect(`${prefix}/dashboard`)
}
