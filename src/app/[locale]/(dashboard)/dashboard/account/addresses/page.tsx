import { AddressListing } from '@/components/addresses/AddressListing'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'

/**
 * Dashboard Account — Addresses page.
 *
 * Manage shipping/billing addresses. Reuses existing address components
 * (they read from useAddresses context, no props needed).
 */
export default function DashboardAddressesPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Addresses</h1>
          <p className="text-sm text-muted-foreground">
            Manage your shipping and billing addresses.
          </p>
        </div>
        <CreateAddressModal />
      </div>

      <div className="border p-6 md:p-8 rounded-lg bg-card text-card-foreground">
        <AddressListing />
      </div>
    </div>
  )
}
