import { setRequestLocale } from 'next-intl/server'
import { SiteLogViewer } from './SiteLogViewer'
import { requirePortalManager } from '@/utilities/requirePortalManager'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

export const dynamic = 'force-dynamic'

export default async function SiteLogPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requirePortalManager()

  const { tenant } = await resolveTenantFromHeaders()

  // Only a platform admin may widen the log past this portal. Decided here, so
  // the control never renders for anyone else — the endpoint re-checks anyway.
  let canSeeWholeNode = false
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await headers() })
    canSeeWholeNode = Boolean(user && checkRole(ADMIN_ROLES, user))
  } catch {
    /* not a platform admin — the portal-scoped log is the whole story */
  }

  return (
    <SiteLogViewer tenantName={tenant?.name || 'this portal'} canSeeWholeNode={canSeeWholeNode} />
  )
}
