import { setRequestLocale } from 'next-intl/server'
import FederationNetworkLCARS from './FederationNetworkLCARS'

/**
 * Federation Network — /dashboard/federation-network
 *
 * LCARS-style visualization of the Angel OS Federation mesh.
 * Available to ALL dashboard users (not admin-only) — this is the
 * "window into the federation" that gets everyone excited.
 *
 * Sprint 24: Federation Readiness
 */
export default async function FederationNetworkPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return <FederationNetworkLCARS />
}
