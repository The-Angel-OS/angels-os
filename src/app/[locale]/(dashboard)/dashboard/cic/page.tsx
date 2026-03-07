import { setRequestLocale } from 'next-intl/server'
import CICDashboard from './CICDashboard'

/**
 * Command Information Center — /dashboard/cic
 *
 * The real-time operational dashboard for the ship (Endeavor).
 * Aggregates crew status, work queue, platform feeds, and federation
 * radar into one unified bridge viewscreen.
 *
 * Naval metaphor: The CIC is where the Captain and command staff
 * see everything that matters — all departments reporting.
 *
 * Sprint 40: Endeavor Crews + Universal Transport Bus
 */
export default async function CICPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return <CICDashboard />
}
