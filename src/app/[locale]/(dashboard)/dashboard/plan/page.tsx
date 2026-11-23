import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Legacy /dashboard/plan route — consolidated into
 * /dashboard/admin/settings?tab=plan. Preserves checkout return query params
 * (?upgraded=1&ref=..., ?cancelled=1).
 */
export default async function LegacyPlanRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  const sp = await searchParams
  const qs = new URLSearchParams()
  qs.set('tab', 'plan')
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
