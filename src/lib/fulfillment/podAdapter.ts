/**
 * Print-on-Demand (POD) Vendor Fulfillment Adapter — Sprint D
 *
 * Bridges the pure `src/utilities/printOnDemandEngine.ts` into live shop order
 * fulfillment pipelines. Assembles vendor packages for external POD providers
 * (Printful API v2, Printify API v1, or generic webhook/dropship partners)
 * and tracks fulfillment state transitions.
 *
 * @see src/utilities/printOnDemandEngine.ts
 * @see src/collections/Orders/index.ts
 */
import type { Payload } from 'payload'
import {
  assembleVendorPackage,
  type DesignAsset,
  type PODOrder,
  type PODOrderItem,
  type ProductSurface,
  type PrintMethod,
  type VendorPackage,
} from '@/utilities/printOnDemandEngine'
import { logError } from '@/utilities/logError'

export type PODVendorType = 'printful' | 'printify' | 'generic'

export interface PrintfulOrderPayload {
  recipient: {
    name: string
    address1?: string
    city?: string
    state_code?: string
    country_code?: string
    zip?: string
    email?: string
  }
  items: Array<{
    name: string
    quantity: number
    sync_variant_id?: number
    files: Array<{
      type?: string
      url: string
    }>
  }>
  external_id: string
}

export interface PrintifyOrderPayload {
  external_id: string
  label: string
  line_items: Array<{
    product_name: string
    quantity: number
    print_areas: Record<string, string>
  }>
  shipping_method: number
  send_shipping_notification: boolean
  address_to: {
    first_name: string
    last_name: string
    email?: string
    address1?: string
    city?: string
    country?: string
    region?: string
    zip?: string
  }
}

/**
 * Format a POD Vendor Package for Printful API v2/v1 schema
 */
export function buildPrintfulOrderPayload(
  vendorPackage: VendorPackage,
  shippingAddress?: Record<string, unknown>,
  recipient?: { name?: string; email?: string },
): PrintfulOrderPayload {
  const nameParts = (recipient?.name || String(shippingAddress?.name || 'Customer')).trim()
  return {
    external_id: vendorPackage.orderId,
    recipient: {
      name: nameParts,
      address1: typeof shippingAddress?.line1 === 'string' ? shippingAddress.line1 : typeof shippingAddress?.address1 === 'string' ? shippingAddress.address1 : undefined,
      city: typeof shippingAddress?.city === 'string' ? shippingAddress.city : undefined,
      state_code: typeof shippingAddress?.state === 'string' ? shippingAddress.state : undefined,
      country_code: typeof shippingAddress?.country === 'string' ? shippingAddress.country : 'US',
      zip: typeof shippingAddress?.postalCode === 'string' ? shippingAddress.postalCode : typeof shippingAddress?.zip === 'string' ? shippingAddress.zip : undefined,
      email: recipient?.email,
    },
    items: vendorPackage.items.map((item) => ({
      name: item.productName + (item.variant ? ` (${item.variant})` : ''),
      quantity: item.quantity,
      files: item.designs.map((d) => ({
        type: d.surface || 'default',
        url: d.url,
      })),
    })),
  }
}

/**
 * Format a POD Vendor Package for Printify API schema
 */
export function buildPrintifyOrderPayload(
  vendorPackage: VendorPackage,
  shippingAddress?: Record<string, unknown>,
  recipient?: { name?: string; email?: string },
): PrintifyOrderPayload {
  const fullName = (recipient?.name || String(shippingAddress?.name || 'Customer')).trim()
  const [firstName = 'Valued', ...rest] = fullName.split(' ')
  const lastName = rest.join(' ') || 'Customer'

  return {
    external_id: vendorPackage.orderId,
    label: `Angel OS Order #${vendorPackage.orderId}`,
    shipping_method: 1,
    send_shipping_notification: true,
    address_to: {
      first_name: firstName,
      last_name: lastName,
      email: recipient?.email,
      address1: typeof shippingAddress?.line1 === 'string' ? shippingAddress.line1 : typeof shippingAddress?.address1 === 'string' ? shippingAddress.address1 : undefined,
      city: typeof shippingAddress?.city === 'string' ? shippingAddress.city : undefined,
      country: typeof shippingAddress?.country === 'string' ? shippingAddress.country : 'US',
      region: typeof shippingAddress?.state === 'string' ? shippingAddress.state : undefined,
      zip: typeof shippingAddress?.postalCode === 'string' ? shippingAddress.postalCode : typeof shippingAddress?.zip === 'string' ? shippingAddress.zip : undefined,
    },
    line_items: vendorPackage.items.map((item) => {
      const printAreas: Record<string, string> = {}
      for (const d of item.designs) {
        printAreas[d.surface || 'front'] = d.url
      }
      return {
        product_name: item.productName + (item.variant ? ` (${item.variant})` : ''),
        quantity: item.quantity,
        print_areas: printAreas,
      }
    }),
  }
}

/**
 * Inspect an order, identify any Print-on-Demand line items, assemble vendor packages,
 * and advance fulfillment state.
 */
export async function processOrderPODFulfillment(
  payload: Payload,
  orderId: string | number,
): Promise<{
  processed: boolean
  packageCount: number
  vendorPackages: VendorPackage[]
}> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = (await (payload.findByID as any)({
      collection: 'orders',
      id: orderId,
      depth: 2,
      overrideAccess: true,
    })) as Record<string, any> | null

    if (!order || !Array.isArray(order.items) || order.items.length === 0) {
      return { processed: false, packageCount: 0, vendorPackages: [] }
    }

    const podItems: PODOrderItem[] = []
    const fulfillmentList = Array.isArray(order.fulfillment) ? [...order.fulfillment] : []

    order.items.forEach((item: Record<string, any>, idx: number) => {
      const product = typeof item.product === 'object' ? item.product : null
      const productName = product?.title || `Item #${idx + 1}`
      const variantName = typeof item.variant === 'object' ? item.variant?.title : undefined

      // Check item or corresponding fulfillment routing for designAssets
      const fItem = fulfillmentList.find((f: Record<string, any>) => f.orderItemIndex === idx)
      const rawAssets = Array.isArray(fItem?.designAssets)
        ? fItem.designAssets
        : Array.isArray(item.designAssets)
          ? item.designAssets
          : []

      if (rawAssets.length > 0) {
        const designAssets: DesignAsset[] = rawAssets.map((asset: Record<string, any>, aIdx: number) => {
          const media = typeof asset.media === 'object' ? asset.media : null
          const surface: ProductSurface = (asset.surface as ProductSurface) || 'front'
          const printMethod: PrintMethod = (asset.printMethod as PrintMethod) || 'dtg'

          return {
            designFile: {
              id: String(media?.id || `asset_${idx}_${aIdx}`),
              mediaId: Number(media?.id || 0),
              filename: String(media?.filename || `design_${idx}_${aIdx}.png`),
              format: String(media?.mimeType?.split('/')?.[1] || 'png'),
              widthPx: Number(media?.width || 3000),
              heightPx: Number(media?.height || 3000),
              dpi: Number(asset.dpi || 300),
              fileSizeBytes: Number(media?.filesize || 1024 * 1024),
              url: String(media?.url || ''),
              createdAt: String(media?.createdAt || new Date().toISOString()),
            },
            printSpec: {
              surface,
              printMethod,
              widthInches: Number(asset.widthInches || 10),
              heightInches: Number(asset.heightInches || 12),
              colors: asset.colors ? Number(asset.colors) : undefined,
              notes: asset.notes ? String(asset.notes) : undefined,
            },
            status: 'approved',
          }
        })

        podItems.push({
          productId: Number(product?.id || idx),
          productName,
          variant: variantName,
          quantity: Number(item.quantity) || 1,
          designAssets,
          unitPrice: Number(product?.priceInUSD || 0) / 100,
        })
      }
    })

    if (podItems.length === 0) {
      return { processed: false, packageCount: 0, vendorPackages: [] }
    }

    const podOrder: PODOrder = {
      orderId: String(orderId),
      customerId: Number(typeof order.customer === 'object' ? order.customer?.id : order.customer || 0),
      items: podItems,
      totalPrice: Number(order.amount || 0) / 100,
      createdAt: String(order.createdAt || new Date().toISOString()),
    }

    // Assemble vendor package
    const vendorPackage = assembleVendorPackage(
      podOrder,
      1,
      'Angel OS Print Network',
    )

    // Update fulfillment tracking on order if array exists
    let updatedFulfillment = fulfillmentList
    if (updatedFulfillment.length === 0) {
      updatedFulfillment = podItems.map((_, idx) => ({
        orderItemIndex: idx,
        fulfillmentStatus: 'in_production',
        matchedAt: new Date().toISOString(),
      }))
    } else {
      updatedFulfillment = updatedFulfillment.map((f: Record<string, any>) => ({
        ...f,
        fulfillmentStatus: f.fulfillmentStatus === 'pending_match' ? 'in_production' : f.fulfillmentStatus,
        matchedAt: f.matchedAt || new Date().toISOString(),
      }))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.update as any)({
      collection: 'orders',
      id: orderId,
      data: {
        fulfillment: updatedFulfillment,
      },
      overrideAccess: true,
    }).catch(() => {})

    return {
      processed: true,
      packageCount: 1,
      vendorPackages: [vendorPackage],
    }
  } catch (err) {
    void logError({
      level: 'warning',
      source: 'fulfillment/processOrderPODFulfillment',
      message: `Failed POD fulfillment for order ${orderId}: ${err instanceof Error ? err.message : String(err)}`,
    })
    return { processed: false, packageCount: 0, vendorPackages: [] }
  }
}
