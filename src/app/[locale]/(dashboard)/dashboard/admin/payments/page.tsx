import { redirect } from 'next/navigation'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

/**
 * Legacy /dashboard/admin/payments route — consolidated into
 * /dashboard/admin/settings?tab=payments. Preserves OAuth callback query params
 * (?square=connected, ?square_error=...).
 */
export default async function LegacyPaymentsRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  await requirePortalManager()
  const sp = await searchParams
  const qs = new URLSearchParams()
  qs.set('tab', 'payments')
  for (const [k, v] of Object.entries(sp || {})) {
    if (k === 'tab') continue
    if (Array.isArray(v)) {
      for (const item of v) if (item != null) qs.append(k, item)
    } else if (v != null) {
      qs.set(k, v)
    }
  }
  const prefix = locale === 'en' ? '' : `/${locale}`
  redirect(`${prefix}/dashboard/admin/settings?${qs.toString()}`)
}
