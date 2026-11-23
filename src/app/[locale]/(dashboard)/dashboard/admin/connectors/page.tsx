import { redirect } from 'next/navigation'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

/**
 * Legacy /dashboard/admin/connectors route — redirects directly in a single hop
 * to /dashboard/admin/settings?tab=leo#integrations.
 */
export default async function LegacyConnectorsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  await requirePortalManager()
  const prefix = locale === 'en' ? '' : `/${locale}`
  redirect(`${prefix}/dashboard/admin/settings?tab=leo#integrations`)
}
