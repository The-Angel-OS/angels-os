import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { requirePortalManager } from '@/utilities/requirePortalManager'
import { FEATURES } from '@/config/features'
import { EndeavorBrowser } from './EndeavorBrowser'

export const dynamic = 'force-dynamic'

export default async function DashboardEndeavorsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  // Dormant while we run single-node — the flag is authoritative, not just the nav.
  if (!FEATURES.endeavorBrowser) notFound()
  // Any portal member can browse the federation directory (public data anyway);
  // requirePortalManager keeps it inside the authenticated dashboard shell.
  await requirePortalManager()
  return <EndeavorBrowser />
}
