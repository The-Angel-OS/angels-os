import type { Tenant } from '@/payload-types'

import { getTenantCachedDoc } from '@/utilities/getTenantCachedDoc'

import './index.css'
import { HeaderClient } from './index.client'

type Props = {
  tenant: Tenant | null
}

export async function Header({ tenant }: Props) {
  const tenantId = tenant?.id ?? null
  let header = null
  try {
    header = tenantId
      ? await getTenantCachedDoc('header', tenantId, 1)()
      : null
  } catch (err) {
    console.error('[Header] Failed to fetch header doc:', err)
  }

  if (!header && tenantId) {
    console.warn(`[Header] No header doc found for tenant ${tenantId} (slug: ${tenant?.slug ?? 'none'})`)
  }

  return <HeaderClient header={header} tenant={tenant} />
}
