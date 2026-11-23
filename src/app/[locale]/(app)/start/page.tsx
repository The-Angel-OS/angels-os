import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { StartPageClient } from './StartPageClient'

export const metadata: Metadata = {
  title: 'Start Your Portal — Launch Your Creator Universe in 60s',
  description:
    'Claim your handle, mirror your YouTube channel, launch your Print-on-Demand merchandise storefront, and set up memberships in 60 seconds.',
}

export default function StartPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-sm font-semibold text-muted-foreground animate-pulse">
            Loading Creator Onboarding...
          </div>
        </div>
      }
    >
      <StartPageClient />
    </Suspense>
  )
}
