import { setRequestLocale } from 'next-intl/server'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { ensureSystemSpace } from '@/utilities/ensureSystemSpace'
import { SpacesChat } from '../../SpacesChat'

/**
 * Spaces deep link — /dashboard/spaces/<spaceSlug>/<channelSlug>.
 *
 * Same surface as the Spaces index, but opens the space + channel named in the
 * URL: shareable, bookmarkable, real Back/Forward to a specific conversation.
 * (The static `settings/` route and the bare `/dashboard/spaces` index take
 * priority over this dynamic segment, so they're unaffected.)
 */
export default async function SpaceDeepLinkPage({
  params,
}: {
  params: Promise<{ locale: string; space: string; channel?: string[] }>
}) {
  const { locale, space, channel } = await params
  setRequestLocale(locale)

  const { tenant } = await resolveTenantFromHeaders()
  if (tenant?.id) {
    await ensureSystemSpace(tenant.id)
  }

  const liveKitEnabled = Boolean(process.env.LIVEKIT_API_KEY && process.env.NEXT_PUBLIC_LIVEKIT_URL)

  return (
    <div className="-m-3 md:-m-6 flex h-[calc(100vh-3.5rem)] flex-col">
      <SpacesChat
        liveKitEnabled={liveKitEnabled}
        initialSpaceSlug={decodeURIComponent(space)}
        initialChannel={channel?.[0] ? decodeURIComponent(channel[0]) : undefined}
      />
    </div>
  )
}
