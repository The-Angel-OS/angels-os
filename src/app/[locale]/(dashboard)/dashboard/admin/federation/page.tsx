import { setRequestLocale } from 'next-intl/server'
import FederationDashboard from './FederationDashboard'

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

  return <FederationDashboard />
}
