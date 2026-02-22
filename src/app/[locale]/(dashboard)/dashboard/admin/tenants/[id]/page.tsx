import { TenantDetailView } from './TenantDetail'

export default function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  return <TenantDetailView paramsPromise={params} />
}
