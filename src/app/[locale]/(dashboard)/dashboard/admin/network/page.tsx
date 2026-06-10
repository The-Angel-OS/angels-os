import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { NetworkConsole } from './NetworkConsole'

export const dynamic = 'force-dynamic'

/**
 * The Network — Central. Admin-only view of the emergent-network mockup
 * (GET /api/federation/simulate). Pure simulation; the testbed for the live
 * federation (spacesangels.com ⇄ kendev.co). See docs/FEDERATION_TESTBED.md.
 */
export default async function NetworkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const prefix = locale === 'en' ? '' : `/${locale}`

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect(`${prefix}/dashboard`) // loop-proof: never /login from a deep page
  if (!checkRole(ADMIN_ROLES, user)) redirect(`${prefix}/dashboard`)

  return (
    <div className="mx-auto max-w-5xl">
      <NetworkConsole />
    </div>
  )
}
