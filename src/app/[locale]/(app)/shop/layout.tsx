import { Categories } from '@/components/layout/search/Categories'
import { FilterList } from '@/components/layout/search/filter'
import { sorting } from '@/lib/constants'
import { Search } from '@/components/Search'
import React, { Suspense } from 'react'

/**
 * Shop chrome — search + category/sort rail. The HERO lives in page.tsx, beside
 * this rail, matching Posts and Events.
 *
 * It used to render a CollectionHero here too, so /shop showed two of them: a
 * full-bleed one above the search box and a second inside the results column,
 * each with different subtitle copy. Both read the same tenant image, so the
 * duplicate looked deliberate rather than broken. One page, one hero.
 */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <div className="container flex flex-col gap-8 py-8 pb-4">
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
