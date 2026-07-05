import { redirect } from 'next/navigation'

/**
 * Legacy Endeavor Setup route — /dashboard/endeavor
 *
 * Endeavor Setup now lives as a tab inside the consolidated Settings hub. This
 * route is kept as a permanent redirect so existing links — notably LEO's
 * navDirective('/dashboard/endeavor') tool responses and the OnboardingGuide —
 * continue to land on the right pane.
 */
export default async function EndeavorPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const prefix = locale === 'en' ? '' : `/${locale}`
  redirect(`${prefix}/dashboard/admin/settings?tab=endeavor`)
}
