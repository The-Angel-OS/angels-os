import { AuthProvider } from '@/providers/Auth'
import { EcommerceProvider } from '@payloadcms/plugin-ecommerce/client/react'
import { stripeAdapterClient } from '@payloadcms/plugin-ecommerce/payments/stripe'
import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { SonnerProvider } from '@/providers/Sonner'
import { ClientReliability } from '@/components/ClientReliability'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HeaderThemeProvider>
          <SonnerProvider />
          <EcommerceProvider
            enableVariants={true}
            api={{
              // The provider's baseQuery injects a field-level `populate` allow-list
              // (`populate.products = { priceInUSD: true }`) alongside depth. In Payload a
              // populate allow-list OVERRIDES depth for that relationship, so a bare
              // `{ depth: 2 }` here is silently ineffective — the product comes back with
              // ONLY priceInUSD, no `slug`, and CartModal treats every item as orphaned
              // ("This item is no longer available."). deepMergeSimple unions our keys into
              // that allow-list, so we must enumerate every field the cart drawer reads:
              // slug (link), title, priceInUSD, meta.image, gallery (+variantOption),
              // enableVariants, inventory; and for variants: options, priceInUSD, inventory.
              // depth:2 still governs nested uploads (gallery.image / meta.image).
              cartsFetchQuery: {
                depth: 2,
                populate: {
                  products: {
                    slug: true,
                    title: true,
                    priceInUSD: true,
                    enableVariants: true,
                    gallery: true,
                    meta: true,
                    inventory: true,
                  },
                  variants: {
                    options: true,
                    priceInUSD: true,
                    inventory: true,
                  },
                },
              },
            }}
            paymentMethods={[
              stripeAdapterClient({
                publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
              }),
            ]}
          >
            <ClientReliability>{children}</ClientReliability>
          </EcommerceProvider>
        </HeaderThemeProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
