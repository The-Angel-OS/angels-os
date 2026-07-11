import { setRequestLocale } from 'next-intl/server'
import { requirePortalManager } from '@/utilities/requirePortalManager'
import { EndeavorBrowser } from './EndeavorBrowser'

export const dynamic = 'force-dynamic'

export default async function DashboardEndeavorsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  // Any portal member can browse the federation directory (public data anyway);
  // requirePortalManager keeps it inside the authenticated dashboard shell.
  await requirePortalManager()
  return <EndeavorBrowser />
}
