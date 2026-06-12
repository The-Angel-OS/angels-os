import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { OfferingConfigurator, type FieldDef } from '@/components/OfferingConfigurator'

const QUEST_FIELDS: FieldDef[] = [
  { name: 'title', label: 'Title', type: 'text', required: true },
  { name: 'status', label: 'Status', type: 'select', options: [
    { label: 'Draft', value: 'draft' }, { label: 'Posted', value: 'posted' },
    { label: 'Active', value: 'active' }, { label: 'Paused', value: 'paused' },
    { label: 'Completed', value: 'completed' }, { label: 'Expired', value: 'expired' },
    { label: 'Cancelled', value: 'cancelled' },
  ] },
  { name: 'questType', label: 'Type', type: 'text', placeholder: 'mystery-shop, challenge, field-research…' },
  { name: 'payout.amount', label: 'Payout (cents)', type: 'number', help: 'Paid in Angel Tokens from your float when a participation is approved.' },
  { name: 'payout.paymentMethod', label: 'Payout method', type: 'select', options: [
    { label: 'Angel Token', value: 'angel_token' }, { label: 'Stripe', value: 'stripe' },
    { label: 'Platform Credit', value: 'platform_credit' },
  ] },
]

export default async function DashboardQuestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })
  const { tenantId, tenantFilter } = await resolveTenantFromHeaders()

  let items: Record<string, unknown>[] = []
  try {
    const res = await payload.find({ collection: 'quests' as never, where: tenantFilter, limit: 200, depth: 0, sort: '-createdAt', overrideAccess: true })
    items = (res.docs as Record<string, unknown>[]).map((q) => ({
      id: q.id, title: q.title, status: q.status, questType: q.questType, payout: q.payout,
    }))
  } catch {
    /* defensive — render empty configurator */
  }

  return (
    <div className="container max-w-3xl py-8">
      <h1 className="mb-1 text-2xl font-bold">Quests</h1>
      <p className="mb-6 text-sm text-muted-foreground">Work + incentives your community can take on. Approving a participation pays the performer in Angel Tokens from your float.</p>
      {tenantId == null ? (
        <p className="text-sm text-muted-foreground">No tenant context.</p>
      ) : (
        <OfferingConfigurator
          kind="quest"
          collection="quests"
          titleField="title"
          fields={QUEST_FIELDS}
          items={items}
          tenantId={tenantId}
          newDefaults={{ status: 'draft', 'payout.paymentMethod': 'angel_token' }}
          note="Objectives, evidence requirements, and rich descriptions are configured in the admin panel."
        />
      )}
    </div>
  )
}
