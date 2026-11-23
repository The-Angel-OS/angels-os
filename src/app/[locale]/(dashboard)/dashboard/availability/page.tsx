import { redirect } from 'next/navigation'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

/**
 * Legacy availability route — consolidated into /dashboard/admin/bookings
 * alongside the interactive Weekly Hours editor, appointments, and services.
 */
export default async function DashboardAvailabilityRedirect({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  await requirePortalManager()
  const prefix = locale === 'en' ? '' : `/${locale}`
  redirect(`${prefix}/dashboard/admin/bookings`)
}
