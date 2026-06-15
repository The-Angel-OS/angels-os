import { redirect } from 'next/navigation'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

/**
 * Connectors moved to Account → Integrations so endeavor owners (tenant_admin /
 * tenant_manager), not just super_admins, can self-serve their integrations.
 * This redirect preserves old bookmarks and in-app links.
 */
export default async function LegacyConnectorsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  await requirePortalManager()
  // localePrefix is 'as-needed' (default 'en' has no prefix) — match that so the
  // English canonical URL doesn't take a second normalization hop.
  const prefix = locale === 'en' ? '' : `/${locale}`
  redirect(`${prefix}/dashboard/account/integrations`)
}
