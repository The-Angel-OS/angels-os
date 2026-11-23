import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { requirePortalManager } from '@/utilities/requirePortalManager'
import { getMembershipPlans } from '@/utilities/membershipPlans'
import { PLAN_LABEL, planOf, portalCan } from '@/utilities/portalPlan'
import { MembershipsManager, type SubscriberRow } from './MembershipsManager'

export const dynamic = 'force-dynamic'

export default async function DashboardMembershipsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })
  const { tenant, tenantId } = await resolveTenantFromHeaders()

  const [plans, subsResult] = await Promise.all([
    tenantId ? getMembershipPlans(payload, tenantId).catch(() => []) : Promise.resolve([]),
    tenantId
      ? payload
          .find({
            collection: 'memberships' as any,
            where: { tenant: { equals: tenantId } },
            limit: 100,
            sort: '-createdAt',
            depth: 1,
            overrideAccess: true,
          })
          .catch(() => ({ docs: [] }))
      : Promise.resolve({ docs: [] }),
  ])

  const subscribers: SubscriberRow[] = (subsResult.docs || []).map((doc: any) => ({
    id: String(doc.id),
    memberName:
      (typeof doc.member === 'object' ? doc.member?.name : '') ||
      doc.memberName ||
      doc.memberEmail ||
      'Member',
    memberEmail:
      doc.memberEmail || (typeof doc.member === 'object' ? doc.member?.email : '') || '',
    planName: doc.planName || doc.planId || 'Membership',
    amountCents: Number(doc.amountCents || 0),
    interval: doc.interval === 'year' ? 'year' : 'month',
    status: String(doc.status || 'active'),
    startedAt: doc.startedAt || doc.createdAt || null,
    currentPeriodEnd: doc.currentPeriodEnd || null,
  }))

  const currentPlan = planOf(tenant as { portalPlan?: string | null } | null)

  return (
    <MembershipsManager
      initialPlans={plans}
      subscribers={subscribers}
      tenantName={tenant?.branding?.siteName || tenant?.name || 'Your Site'}
      tenantSlug={tenant?.slug || ''}
      supportPath={locale === 'en' ? '/support' : `/${locale}/support`}
      canSellMemberships={portalCan(
        tenant as { portalPlan?: string | null } | null,
        'memberships',
      )}
      currentPlanLabel={PLAN_LABEL[currentPlan]}
    />
  )
}
