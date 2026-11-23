import { Suspense } from 'react'
import { headers as nextHeaders } from 'next/headers'
import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { SettingsHub, type ConnectorSummary } from './SettingsHub'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { requirePortalManager } from '@/utilities/requirePortalManager'
import { getTenantPaymentSettings, isPayPalConfigured } from '@/lib/payments/config'
import { getAvailableProviders } from '@/lib/payments/registry'
import type { TenantPaymentSettings } from '@/lib/payments/types'
import { getPlatformFeeBps } from '@/utilities/platformFee'
import { getJusticeFundGrowth, getRevenueTimeSeries } from '@/utilities/chartData'
import { planOf } from '@/utilities/portalPlan'
import { leoSystemUserEmail, leoLegacyEmail } from '@/utilities/leoEmail'

export const dynamic = 'force-dynamic'

export default async function DashboardSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })
  const reqHeaders = await nextHeaders()
  const { user } = await payload.auth({ headers: reqHeaders }).catch(() => ({ user: null }))
  const isSuperAdmin = (((user as { roles?: string[] } | null)?.roles) || []).includes('super_admin')

  const { tenant, tenantId, tenantFilter } = await resolveTenantFromHeaders()

  const aiConfig = tenant?.aiConfig || {}
  const branding = tenant?.branding || {}
  const commerce = tenant?.commerce || {}
  const storefront = tenant?.storefront || {}
  const tenantSlug = tenant?.slug || ''

  const [
    paymentSettingsRes,
    availableRailsRes,
    platformFeeBpsRes,
    txResultRes,
    ordersResultRes,
    platformFeeGrowthRes,
    revDataRes,
    connectorsRes,
    leoUserRes,
    ragStatsRes,
  ] = await Promise.allSettled([
    tenantId
      ? getTenantPaymentSettings(payload, tenantId)
      : Promise.resolve({} as TenantPaymentSettings),
    getAvailableProviders(payload, tenantId ?? undefined),
    getPlatformFeeBps(payload, tenantId),
    payload.find({
      collection: 'transactions' as any,
      where: tenantFilter,
      limit: 10,
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'orders' as any,
      where: tenantFilter,
      limit: 20,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
    }),
    isSuperAdmin ? getJusticeFundGrowth(payload, 30) : Promise.resolve([]),
    getRevenueTimeSeries(payload, 30, tenantFilter),
    payload.find({
      collection: 'connectors' as any,
      where: tenantFilter,
      limit: 100,
      sort: '-priority',
      depth: 0,
      overrideAccess: true,
    }),
    tenantId
      ? payload.find({
          collection: 'users',
          where: {
            and: [
              { servesTenant: { equals: tenantId } },
              { 'agentConfig.agentType': { equals: 'leo' } },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
      : Promise.resolve({ docs: [] }),
    tenantId && (payload.db as any)?.pool?.query
      ? (payload.db as any).pool.query(
          `SELECT COUNT(*)::int AS chunks, COUNT(DISTINCT post_id)::int AS videos FROM "post_transcript_chunks" WHERE "tenant_id" = $1`,
          [Number(tenantId)],
        )
      : Promise.resolve(null),
  ])

  const paymentSettings =
    paymentSettingsRes.status === 'fulfilled'
      ? paymentSettingsRes.value
      : ({} as TenantPaymentSettings)
  const availableRails =
    availableRailsRes.status === 'fulfilled'
      ? availableRailsRes.value
      : { providers: [] }
  const platformFeePercent =
    (platformFeeBpsRes.status === 'fulfilled' ? platformFeeBpsRes.value : 500) / 100
  const txResult = txResultRes.status === 'fulfilled' ? txResultRes.value : null
  const ordersResult = ordersResultRes.status === 'fulfilled' ? ordersResultRes.value : null
  const platformFeeGrowth =
    platformFeeGrowthRes.status === 'fulfilled' ? platformFeeGrowthRes.value : []
  const revData = revDataRes.status === 'fulfilled' ? revDataRes.value : []
  const connectorsDocs =
    connectorsRes.status === 'fulfilled' ? connectorsRes.value?.docs || [] : []

  // Fallback lookup for legacy LEO system users matched by email convention
  let leoDoc =
    leoUserRes.status === 'fulfilled' ? (leoUserRes.value?.docs?.[0] as any) : null
  if (!leoDoc && tenantSlug) {
    for (const email of [leoSystemUserEmail(tenantSlug), leoLegacyEmail(tenantSlug)]) {
      const byEmail = await payload
        .find({
          collection: 'users',
          where: { email: { equals: email } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => null)
      if (byEmail?.docs?.[0]) {
        leoDoc = byEmail.docs[0]
        break
      }
    }
  }

  const ragRow =
    ragStatsRes.status === 'fulfilled' && ragStatsRes.value?.rows?.[0]
      ? ragStatsRes.value.rows[0]
      : null

  const sq = paymentSettings?.square

  const connectors: ConnectorSummary[] = connectorsDocs.map((doc: any) => ({
    id: String(doc.id),
    name: doc.name || '',
    type: doc.type || '',
    enabled: doc.enabled !== false,
    status: doc.status || 'active',
    lastActivity: doc.lastActivity || null,
    errorMessage: doc.errorMessage || null,
    priority: doc.priority || 0,
    config: (doc.config as Record<string, unknown>) || {},
  }))

  const aliases = ((tenant?.domains as { domain?: string; isPrimary?: boolean }[] | undefined) || [])
    .filter((d) => Boolean(d?.domain))
    .map((d) => ({ domain: d.domain as string, isPrimary: Boolean(d.isPrimary) }))

  return (
    <Suspense fallback={null}>
      <SettingsHub
        tenantId={tenantId || 0}
        isSuperAdmin={isSuperAdmin}
        portalPlan={planOf(tenant as { portalPlan?: string | null } | null)}
        branding={{
          logo:
            branding.logo && typeof branding.logo === 'object' && branding.logo.url
              ? { id: branding.logo.id, url: branding.logo.url }
              : null,
          siteName: branding.siteName || '',
          tagline: branding.tagline || '',
          primaryColor: branding.primaryColor || '',
          secondaryColor: branding.secondaryColor || '',
          accentColor: branding.accentColor || '',
          backgroundColor: branding.backgroundColor || '',
          foregroundColor: branding.foregroundColor || '',
          borderColor: branding.borderColor || '',
          headingFont: branding.headingFont || 'inter',
          bodyFont: branding.bodyFont || 'inter',
        }}
        features={
          tenant?.features as
            | { works?: boolean | null; pageComments?: boolean | null }
            | null
            | undefined
        }
        commerce={{
          currency: commerce.currency || 'usd',
          taxRate: commerce.taxRate ?? 0,
        }}
        domains={{
          slug: tenantSlug,
          domain: tenant?.domain || '',
          aliases,
          canonical: aliases.find((a) => a.isPrimary)?.domain || tenant?.domain || '',
        }}
        storefront={{
          coverImage:
            storefront.coverImage &&
            typeof storefront.coverImage === 'object' &&
            storefront.coverImage.url
              ? { id: storefront.coverImage.id, url: storefront.coverImage.url }
              : null,
        }}
        leoProfile={{
          angelName: leoDoc?.agentConfig?.angelName || 'LEO',
          displayName: leoDoc?.agentConfig?.displayName || '',
          personality: leoDoc?.agentConfig?.personality || '',
          ragChunkCount: Number(ragRow?.chunks ?? 0),
          ragVideoCount: Number(ragRow?.videos ?? 0),
          hasGoogleAiKey: Boolean((aiConfig as { googleAiApiKey?: string }).googleAiApiKey),
          hasOpenRouterKey: Boolean(aiConfig.openrouterApiKey),
          hasOpenAiKey: Boolean((aiConfig as { openaiApiKey?: string }).openaiApiKey),
          hasNvidiaKey: Boolean((aiConfig as { nvidiaApiKey?: string }).nvidiaApiKey),
          preferredImageProvider:
            (aiConfig as { preferredImageProvider?: string }).preferredImageProvider || 'auto',
        }}
        connectors={connectors}
        paymentsData={{
          platformFeePercent,
          tenantName: branding.siteName || tenant?.name || 'Your Site',
          squareConnected: Boolean(sq?.connected),
          squareMerchantId: sq?.merchantId || null,
          squareMerchantName: sq?.merchantName || null,
          squareLocationId: sq?.locationId || null,
          squareEnvironment: sq?.environment || 'production',
          squareConnectedAt: sq?.connectedAt || null,
          paypalConfigured: isPayPalConfigured(),
          availableProviders: availableRails.providers.map((p) => ({
            id: p.id,
            label: p.label,
            environment: p.environment,
          })),
          isSuperAdmin,
          recentTransactions: (txResult?.docs ?? []).map((doc: any) => ({
            id: doc.id,
            amount: doc.amount || 0,
            currency: doc.currency || 'USD',
            status: doc.status || 'unknown',
            paymentMethod: doc.paymentMethod || null,
            customerEmail: doc.customerEmail || null,
            createdAt: doc.createdAt,
          })),
          recentOrders: (ordersResult?.docs ?? []).map((doc: any) => ({
            id: String(doc.id),
            total: doc.total || doc.amount || 0,
            status: doc.status || 'unknown',
            createdAt: doc.createdAt || '',
            customerEmail:
              (typeof doc.orderedBy === 'object' ? doc.orderedBy?.email : '') ||
              doc.customerEmail ||
              '',
          })),
          revenueData: revData,
          platformFeeData: platformFeeGrowth,
        }}
      />
    </Suspense>
  )
}
