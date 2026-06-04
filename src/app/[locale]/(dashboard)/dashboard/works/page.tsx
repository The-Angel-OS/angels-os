import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { listWorks } from './actions'
import { WorkStudio } from './WorkStudio'

export const dynamic = 'force-dynamic'

/**
 * Works Studio — author + edit Works (books, case files, docs) in-app.
 * The mutable workshop of the Works Engine (docs/WORKS_ENGINE.md slice #6);
 * sealing into a signed content-addressed manifest is a later slice.
 */
export default async function WorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const prefix = locale === 'en' ? '' : `/${locale}`

  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) redirect(`${prefix}/login`)

  const { tenant, tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) redirect(`${prefix}/dashboard`)

  if (!checkRole(ADMIN_ROLES, user)) {
    const m = await payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [{ user: { equals: user.id } }, { tenant: { equals: tenantId } }, { status: { equals: 'active' } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc = m.docs?.[0] as any
    const ok = doc?.role === 'tenant_admin' || (Array.isArray(doc?.permissions) && doc.permissions.includes('manage_content'))
    if (!ok) redirect(`${prefix}/dashboard`)
  }

  const works = await listWorks()

  return (
    <div className="mx-auto max-w-5xl">
      <WorkStudio initialWorks={works} tenantName={(tenant as any)?.name || 'Library'} />
    </div>
  )
}
