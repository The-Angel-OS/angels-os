import { setRequestLocale } from 'next-intl/server'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { ensureSystemSpace } from '@/utilities/ensureSystemSpace'
import { SpacesChat } from './SpacesChat'

/**
 * Spaces page — multi-channel chat.
 *
 * Space list and active space come from DashboardContext (provided by layout).
 * This page only needs to ensure the AI Bus system space exists and check LiveKit.
 */
export default async function SpacesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  // Resolve tenant (cached, React.cache deduped)
  const { tenant } = await resolveTenantFromHeaders()

  // Ensure AI Bus system space exists for this tenant
  if (tenant?.id) {
    await ensureSystemSpace(tenant.id)
  }

  // Check if LiveKit is configured
  const liveKitEnabled = Boolean(process.env.LIVEKIT_API_KEY && process.env.NEXT_PUBLIC_LIVEKIT_URL)

  return (
    <div className="-m-3 md:-m-6 flex h-[calc(100vh-3.5rem)] flex-col">
      <SpacesChat liveKitEnabled={liveKitEnabled} />
    </div>
  )
}
