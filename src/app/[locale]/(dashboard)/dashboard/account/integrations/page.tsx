import { redirect } from 'next/navigation'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

/**
 * Legacy /dashboard/account/integrations route — consolidated into
 * /dashboard/admin/settings?tab=leo#integrations.
 */
export default async function LegacyIntegrationsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  await requirePortalManager()
  const prefix = locale === 'en' ? '' : `/${locale}`
  redirect(`${prefix}/dashboard/admin/settings?tab=leo#integrations`)
}
