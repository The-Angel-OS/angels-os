import { redirect } from 'next/navigation'

/**
 * Legacy /dashboard/endeavor route — redirects into the Advanced tab of the
 * consolidated Settings Hub.
 */
export default async function EndeavorPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const prefix = locale === 'en' ? '' : `/${locale}`
  redirect(`${prefix}/dashboard/admin/settings?tab=advanced`)
}
