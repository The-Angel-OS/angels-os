import { Categories } from '@/components/layout/search/Categories'
import { FilterList } from '@/components/layout/search/filter'
import { sorting } from '@/lib/constants'
import { Search } from '@/components/Search'
import { CollectionHero } from '@/components/CollectionHero'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { tenantHeroImage } from '@/utilities/tenantHeroImage'
import React, { Suspense } from 'react'

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const { tenant } = await resolveTenantFromHeaders()
  return (
    <Suspense fallback={null}>
      <div className="container flex flex-col gap-8 py-8 pb-4">
        <CollectionHero
          title="Shop"
          subtitle="Products crafted with care"
          icon="🛍️"
          image={tenantHeroImage(tenant)}
        />
        <Search className="mb-4" />

        <div className="flex flex-col md:flex-row items-start justify-between gap-16 md:gap-4">
          <div className="w-full flex-none flex flex-col gap-4 md:gap-8 basis-1/5">
            <Categories />
            <FilterList list={sorting} title="Sort by" />
          </div>
          <div className="min-h-screen w-full">{children}</div>
        </div>
      </div>
    </Suspense>
  )
}
