import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Legacy /dashboard/spaces/settings route — redirects into the live Spaces view
 * and auto-opens the SpaceSettingsDialog modal (safe for non-manager space admins).
 */
export default async function SpaceSettingsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const prefix = locale === 'en' ? '' : `/${locale}`
  redirect(`${prefix}/dashboard/spaces?settings=1`)
}
