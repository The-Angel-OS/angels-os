import type { Tenant } from '@/payload-types'

import { getTenantCachedDoc } from '@/utilities/getTenantCachedDoc'

import './index.css'
import { HeaderClient } from './index.client'

type Props = {
  tenant: Tenant | null
}

export async function Header({ tenant }: Props) {
  const tenantId = tenant?.id ?? null
  const header = tenantId
    ? await getTenantCachedDoc('header', tenantId, 1)()
    : null

  return <HeaderClient header={header} tenant={tenant} />
}
