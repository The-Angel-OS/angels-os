import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { resumeOnboardingStep } from '@/utilities/onboardingFlow'
import { WelcomeWizard } from './WelcomeWizard'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { tenant } = await resolveTenantFromHeaders()
  const siteName =
    (tenant as { branding?: { siteName?: string }; name?: string })?.branding?.siteName ||
    (tenant as { name?: string })?.name ||
    'your endeavor'
  return {
    title: `Welcome | ${siteName}`,
    description: `Get ${siteName} set up — say who you are, invite your people, and do your first real thing.`,
  }
}

/**
 * Reception route — the host-authoritative onboarding home.
 *
 * Served on the endeavor's own FQDN (e.g. https://<slug>.payloadnuke.com/welcome).
 * Because it's on the tenant host, resolveTenantFromHeaders() already resolves the
 * correct endeavor with zero extra work. Owner-only: anyone else (or a signed-out
 * visitor) is sent to the endeavor's public home. The flow itself is the shared
 * flat spec in onboardingFlow.ts, rendered here as a wizard and as cards in Nimue.
 *
 * @see docs/HANDOFF_260718.md (focus area 1) · src/utilities/onboardingFlow.ts
 */
export default async function WelcomePage() {
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })

  // Signed-out → send to login, then back here. The reception flow is owner work.
  if (!user) redirect('/login?redirect=/welcome')

  const { tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) redirect('/')

  // Owner/admin gate — a member or stranger who lands here just sees the home page.
  if (!checkRole(ADMIN_ROLES, user)) redirect('/')

  const endeavorRes = await payload.find({
    collection: 'endeavors',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const endeavor = endeavorRes.docs[0] as
    | { id: number | string; name?: string; tagline?: string; onboardingStep?: string | null }
    | undefined

  const startAt = resumeOnboardingStep(endeavor?.onboardingStep)

  return (
    <WelcomeWizard
      startStep={startAt}
      endeavorName={endeavor?.name || ''}
      endeavorTagline={endeavor?.tagline || ''}
      userName={(user as { name?: string; email?: string }).name || undefined}
    />
  )
}
