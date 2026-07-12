import { setRequestLocale } from 'next-intl/server'
import { BackupsPanel } from './BackupsPanel'
import { listBackups } from './actions'

export const dynamic = 'force-dynamic'

/**
 * admin/backups — platform-admin control panel for the Core Postgres backups run by
 * Merlin on the IONOS node. Gating is inherited from the admin/ layout + the server
 * actions (which re-check super_admin before proxying to Merlin).
 */
export default async function BackupsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  // Fetch the current list server-side (the action gates + proxies to Merlin).
  const res = await listBackups()

  return (
    <BackupsPanel
      initialBackups={res.backups ?? []}
      configured={res.configured ?? false}
      initialError={res.ok ? undefined : res.error}
    />
  )
}
