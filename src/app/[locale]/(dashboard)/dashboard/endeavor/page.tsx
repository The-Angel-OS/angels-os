import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { checkIsAdmin } from '../setup/actions'
import EndeavorSetup from './EndeavorSetup'

/**
 * Endeavor Setup page — /dashboard/endeavor
 *
 * Admin-only page for viewing and editing the Enterprise's constitutional
 * identity (Endeavor). This is where admins define their mission, capabilities,
 * holon types, region, and federation visibility.
 */
export default async function EndeavorPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  // Role guard — admin only
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    const prefix = locale === 'en' ? '' : `/${locale}`
    redirect(`${prefix}/dashboard`)
  }

  return <EndeavorSetup />
}
