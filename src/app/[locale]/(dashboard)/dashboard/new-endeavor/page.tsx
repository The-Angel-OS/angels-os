import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ProvisionWizard } from '../admin/provision/ProvisionWizard'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

/**
 * New Endeavor page — /dashboard/new-endeavor
 *
 * Admin-only. Angel OS is invite-only / admin-provisioned: the platform owner
 * stands up each enterprise, rather than letting any signed-up user self-serve.
 * Non-admins are redirected to the dashboard.
 *
 * Reuses the existing ProvisionWizard component from admin/provision.
 */
export default async function NewEndeavorPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  // Verify user is authenticated
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })
  const prefix = locale === 'en' ? '' : `/${locale}`

  if (!user) {
    redirect(`${prefix}/login?redirect=${encodeURIComponent(`${prefix}/dashboard/new-endeavor`)}`)
  }

  // Invite-only: provisioning is admin-only.
  if (!checkRole(ADMIN_ROLES, user)) {
    redirect(`${prefix}/dashboard`)
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Welcome to Angel OS</h1>
        <p className="mt-2 text-muted-foreground">
          Let&apos;s set up your first endeavor. This takes about 2 minutes.
        </p>
      </div>
      <ProvisionWizard />
    </div>
  )
}
