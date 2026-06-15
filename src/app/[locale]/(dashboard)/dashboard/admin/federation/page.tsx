import { setRequestLocale } from 'next-intl/server'
import FederationDashboard from './FederationDashboard'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

/**
 * Federation Admin Dashboard — /dashboard/admin/federation
 *
 * Surfaces federation health, active proposals, street signs,
 * and suitcase operations for Enterprise operators.
 *
 * Sprint 20: Federation Launch Campaign
 */
export default async function FederationPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requirePortalManager()

  return <FederationDashboard />
}
