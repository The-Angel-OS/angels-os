import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { getWizardProgress, ensureWizardChannel, checkIsAdmin } from './actions'
import { SetupWizard } from './SetupWizard'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'

/**
 * Enterprise Setup page — /dashboard/setup
 *
 * Server component: resolves tenant context, ensures the wizard channel
 * exists, reads current wizard progress, then renders the SetupWizard
 * client component.
 *
 * Redirects to /dashboard if the wizard is already complete.
 */
export default async function SetupPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  // Redirect non-admins — only admins can access Enterprise Setup
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    const prefix = locale === 'en' ? '' : `/${locale}`
    redirect(`${prefix}/dashboard`)
  }

  // Redirect if wizard is already done
  const { progress, wizardComplete, tenantId } = await getWizardProgress()
  if (wizardComplete) {
    const prefix = locale === 'en' ? '' : `/${locale}`
    redirect(`${prefix}/dashboard`)
  }

  // Ensure the wizard-setup channel exists
  const { spaceId, channelSlug } = await ensureWizardChannel()

  // Resolve the tenant slug the apex-safe way (x-tenant-id → domain → default).
  const { tenant } = await resolveTenantFromHeaders()
  const tenantSlug = tenant?.slug || process.env.DEFAULT_TENANT_SLUG || 'default'

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Page header */}
      <div className="shrink-0 border-b bg-background px-6 py-4">
        <h1 className="text-xl font-semibold">Enterprise Setup</h1>
        <p className="text-sm text-muted-foreground">
          Leo will guide you through setting up your Angel OS Enterprise — takes about 17 minutes.
        </p>
      </div>

      {/* Wizard (flex-1 so it fills the remaining height) */}
      <div className="flex min-h-0 flex-1">
        <SetupWizard
          initialProgress={progress}
          spaceId={spaceId}
          channelSlug={channelSlug}
          tenantSlug={tenantSlug}
        />
      </div>
    </div>
  )
}
