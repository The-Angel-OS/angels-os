import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import LearnExperience from '@/components/Learn/LearnExperience'
import { hasFeature } from '@/utilities/tenantFeatures'
import { getAvailableWorks } from '@/works/registry'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'

export const metadata = {
  title: 'Learn — Angel OS',
  description:
    'Understand Angel OS: a federated cooperative operating system with a constitutional AI guardian. Start here.',
}

export const dynamic = 'force-dynamic'

export default async function LearnPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const { tenant } = await resolveTenantFromHeaders()
  const souls = hasFeature(tenant, 'works') ? await getAvailableWorks(tenant?.slug) : []

  // The Library section hides when empty for non-managers (admins manage it via
  // the dashboard control panel, so an empty public block is just noise).
  let canManageWorks = false
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: await headers() })
    const roles = (user as { roles?: string[] } | null)?.roles ?? []
    canManageWorks = roles.includes('super_admin') || roles.includes('admin')
  } catch {
    /* anonymous → not a manager */
  }

  return <LearnExperience souls={souls} canManageWorks={canManageWorks} />
}
