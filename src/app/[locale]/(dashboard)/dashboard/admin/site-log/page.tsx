import { setRequestLocale } from 'next-intl/server'
import { SiteLogViewer } from './SiteLogViewer'
import { requirePortalManager } from '@/utilities/requirePortalManager'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'

export const dynamic = 'force-dynamic'

export default async function SiteLogPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requirePortalManager()

  const { tenant } = await resolveTenantFromHeaders()

  return <SiteLogViewer tenantName={tenant?.name || 'this portal'} />
}
