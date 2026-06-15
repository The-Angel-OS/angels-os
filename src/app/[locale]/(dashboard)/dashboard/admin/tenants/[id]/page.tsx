import { TenantDetailView } from './TenantDetail'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  await requirePortalManager()
  return <TenantDetailView paramsPromise={params} />
}
