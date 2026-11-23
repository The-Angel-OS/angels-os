/**
 * Print-on-Demand (POD) Vendor Fulfillment Adapter — Sprint D + Model A Live Dispatch
 *
 * Bridges the pure `src/utilities/printOnDemandEngine.ts` and creator-owned
 * Printful / Printify credentials (`src/lib/fulfillment/config.ts`) into live
 * shop order fulfillment pipelines:
 *   - Assembles VendorPackages & pure Printful/Printify payload schemas
 *   - Dispatches paid orders to a creator's connected Printful/Printify store
 *   - Persists dispatch tracking metadata into Orders.fulfillment[].selectedConfiguration
 *   - Gracefully falls back to pure VendorPackage state transition when disconnected
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
import { getConnectedPODCredentials, getTenantPODSettings } from './config'
import { refreshPrintfulTokenIfNeeded, submitPrintfulOrder } from './providers/printful'
import { submitPrintifyOrder } from './providers/printify'
import type {
  PODOrderSubmitItem,
  PODOrderSubmitResult,
  PODRecipientAddress,
  PODSyncVariant,
} from './types'

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
      address1:
        typeof shippingAddress?.line1 === 'string'
          ? shippingAddress.line1
          : typeof shippingAddress?.address1 === 'string'
            ? shippingAddress.address1
            : undefined,
      city: typeof shippingAddress?.city === 'string' ? shippingAddress.city : undefined,
      state_code: typeof shippingAddress?.state === 'string' ? shippingAddress.state : undefined,
      country_code:
        typeof shippingAddress?.country === 'string' ? shippingAddress.country : 'US',
      zip:
        typeof shippingAddress?.postalCode === 'string'
          ? shippingAddress.postalCode
          : typeof shippingAddress?.zip === 'string'
            ? shippingAddress.zip
            : undefined,
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
      address1:
        typeof shippingAddress?.line1 === 'string'
          ? shippingAddress.line1
          : typeof shippingAddress?.address1 === 'string'
            ? shippingAddress.address1
            : undefined,
      city: typeof shippingAddress?.city === 'string' ? shippingAddress.city : undefined,
      country: typeof shippingAddress?.country === 'string' ? shippingAddress.country : 'US',
      region: typeof shippingAddress?.state === 'string' ? shippingAddress.state : undefined,
      zip:
        typeof shippingAddress?.postalCode === 'string'
          ? shippingAddress.postalCode
          : typeof shippingAddress?.zip === 'string'
            ? shippingAddress.zip
            : undefined,
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

function extractRecipientAddress(
  order: Record<string, any>,
): PODRecipientAddress | null {
  const addr = (order.shippingAddress || {}) as Record<string, unknown>
  const address1 =
    typeof addr.line1 === 'string'
      ? addr.line1
      : typeof addr.addressLine1 === 'string'
        ? addr.addressLine1
        : typeof addr.address1 === 'string'
          ? addr.address1
          : ''
  const city = typeof addr.city === 'string' ? addr.city : ''
  const zip =
    typeof addr.postalCode === 'string'
      ? addr.postalCode
      : typeof addr.zip === 'string'
        ? addr.zip
        : ''
  if (!address1 || !city || !zip) return null

  const first = typeof addr.firstName === 'string' ? addr.firstName : ''
  const last = typeof addr.lastName === 'string' ? addr.lastName : ''
  const customerObj = typeof order.customer === 'object' ? order.customer : null
  const name =
    (typeof addr.name === 'string' && addr.name.trim()) ||
    [first, last].filter(Boolean).join(' ').trim() ||
    customerObj?.name ||
    'Customer'

  return {
    name: String(name),
    email:
      typeof order.customerEmail === 'string'
        ? order.customerEmail
        : typeof customerObj?.email === 'string'
          ? customerObj.email
          : undefined,
    phone: typeof addr.phone === 'string' ? addr.phone : undefined,
    address1: address1.trim(),
    ...(typeof addr.line2 === 'string' && addr.line2
      ? { address2: addr.line2 }
      : typeof addr.address2 === 'string' && addr.address2
        ? { address2: addr.address2 }
        : {}),
    city: city.trim(),
    stateCode:
      typeof addr.state === 'string'
        ? addr.state
        : typeof addr.stateCode === 'string'
          ? addr.stateCode
          : undefined,
    countryCode:
      typeof addr.country === 'string'
        ? addr.country
        : typeof addr.countryCode === 'string'
          ? addr.countryCode
          : 'US',
    zip: zip.trim(),
  }
}

function matchPODVariant(
  product: Record<string, any> | null,
  variantName: string | undefined,
): PODSyncVariant | undefined {
  const podMeta = product?.configuratorOptions?.pod as
    | { variants?: PODSyncVariant[] }
    | undefined
  const variants = Array.isArray(podMeta?.variants) ? podMeta.variants : []
  if (variants.length === 0) return undefined
  if (variantName) {
    const lower = variantName.trim().toLowerCase()
    const exact = variants.find(
      (v) =>
        v.name?.toLowerCase() === lower ||
        v.sku?.toLowerCase() === lower ||
        `${v.color || ''} ${v.size || ''}`.trim().toLowerCase() === lower,
    )
    if (exact) return exact
  }
  return variants[0]
}

/**
 * Inspect an order, identify any Print-on-Demand line items (by `designAssets`
 * OR `product.productionType === 'print_on_demand'`), assemble vendor packages,
 * dispatch to creator's connected Printful/Printify account when configured,
 * and persist fulfillment state transitions.
 */
export async function processOrderPODFulfillment(
  payload: Payload,
  orderId: string | number,
): Promise<{
  processed: boolean
  packageCount: number
  vendorPackages: VendorPackage[]
  liveDispatch?: PODOrderSubmitResult
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
    const submitItems: PODOrderSubmitItem[] = []
    const matchedItemIndices: number[] = []
    let primaryExternalProductId: string | undefined
    const fulfillmentList = Array.isArray(order.fulfillment) ? [...order.fulfillment] : []

    order.items.forEach((item: Record<string, any>, idx: number) => {
      const product = typeof item.product === 'object' ? item.product : null
      const productName = product?.title || `Item #${idx + 1}`
      const variantName = typeof item.variant === 'object' ? item.variant?.title : undefined

      // Check item or corresponding fulfillment routing for designAssets OR print_on_demand product
      const fItem = fulfillmentList.find((f: Record<string, any>) => f.orderItemIndex === idx)
      const rawAssets = Array.isArray(fItem?.designAssets)
        ? fItem.designAssets
        : Array.isArray(item.designAssets)
          ? item.designAssets
          : []

      const podConfig = product?.configuratorOptions?.pod as
        | { provider?: string; externalProductId?: string }
        | undefined
      const isCatalogPOD =
        product?.productionType === 'print_on_demand' || Boolean(podConfig?.externalProductId)

      if (rawAssets.length > 0 || isCatalogPOD) {
        matchedItemIndices.push(idx)
        if (!primaryExternalProductId && podConfig?.externalProductId) {
          primaryExternalProductId = String(podConfig.externalProductId)
        }

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

        const matchedVariant = matchPODVariant(product, variantName)
        const qty = Number(item.quantity) || 1
        const priceCents = Number(product?.priceInUSD || 0)

        podItems.push({
          productId: Number(product?.id || idx),
          productName,
          variant: variantName || matchedVariant?.name,
          quantity: qty,
          designAssets,
          unitPrice: priceCents / 100,
        })

        submitItems.push({
          ...(matchedVariant?.syncVariantId != null
            ? { syncVariantId: matchedVariant.syncVariantId }
            : {}),
          ...(matchedVariant?.externalVariantId
            ? { externalVariantId: matchedVariant.externalVariantId }
            : {}),
          ...(matchedVariant?.sku ? { sku: matchedVariant.sku } : {}),
          name: productName + (variantName ? ` (${variantName})` : ''),
          quantity: qty,
          ...(priceCents > 0 ? { retailPriceCents: priceCents } : {}),
          ...(designAssets.length > 0
            ? {
                files: designAssets
                  .filter((d) => Boolean(d.designFile.url))
                  .map((d) => ({
                    type: d.printSpec.surface || 'front',
                    url: d.designFile.url,
                  })),
              }
            : {}),
        })
      }
    })

    if (podItems.length === 0) {
      return { processed: false, packageCount: 0, vendorPackages: [] }
    }

    const podOrder: PODOrder = {
      orderId: String(orderId),
      customerId: Number(
        typeof order.customer === 'object' ? order.customer?.id : order.customer || 0,
      ),
      items: podItems,
      totalPrice: Number(order.amount || 0) / 100,
      createdAt: String(order.createdAt || new Date().toISOString()),
    }

    // Attempt live creator-owned POD dispatch if connected & shipping address present
    let liveDispatch: PODOrderSubmitResult | undefined
    const orderTenantId =
      typeof order.tenant === 'object' ? order.tenant?.id : order.tenant

    if (orderTenantId != null) {
      try {
        const creds = await getConnectedPODCredentials(payload, orderTenantId)
        const recipient = extractRecipientAddress(order)
        if (creds && recipient) {
          const settings = await getTenantPODSettings(payload, orderTenantId)
          const externalOrderId = `aos-order-${orderId}`
          const packingSlip =
            settings.packingSlipMessage || settings.packingSlipPhone || recipient.email
              ? {
                  message: settings.packingSlipMessage || undefined,
                  phone: settings.packingSlipPhone || undefined,
                  email: recipient.email,
                }
              : undefined

          if (creds.provider === 'printful') {
            const accessToken = await refreshPrintfulTokenIfNeeded(
              payload,
              orderTenantId,
              creds,
            )
            liveDispatch = await submitPrintfulOrder(accessToken, creds.storeId, {
              externalOrderId,
              recipient,
              items: submitItems,
              autoConfirm: settings.autoConfirmOrders === true,
              packingSlip,
            })
          } else if (creds.provider === 'printify' && creds.shopId) {
            liveDispatch = await submitPrintifyOrder(
              creds.apiToken,
              creds.shopId,
              {
                externalOrderId,
                recipient,
                items: submitItems,
                autoConfirm: settings.autoConfirmOrders === true,
                packingSlip,
              },
              primaryExternalProductId,
            )
          }
        }
      } catch (err) {
        void logError({
          level: 'warning',
          source: 'fulfillment/processOrderPODFulfillment/liveDispatch',
          message: `POD live dispatch error on order ${orderId}: ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    }

    const vendorLabel = liveDispatch
      ? liveDispatch.provider === 'printful'
        ? 'Printful'
        : 'Printify'
      : 'Angel OS Print Network'

    const vendorPackage = assembleVendorPackage(podOrder, 1, vendorLabel)

    const targetStatus =
      liveDispatch && !liveDispatch.ok ? 'pending_match' : 'in_production'
    const dispatchMeta = liveDispatch
      ? {
          podProvider: liveDispatch.provider,
          externalOrderId: liveDispatch.externalOrderId,
          providerOrderId: liveDispatch.providerOrderId ?? null,
          podStatus: liveDispatch.status,
          autoConfirmed: liveDispatch.autoConfirmed,
          dispatchedAt: new Date().toISOString(),
          ...(liveDispatch.error ? { error: liveDispatch.error } : {}),
        }
      : undefined

    let updatedFulfillment = fulfillmentList
    if (updatedFulfillment.length === 0) {
      updatedFulfillment = matchedItemIndices.map((itemIdx) => ({
        orderItemIndex: itemIdx,
        fulfillmentStatus: targetStatus,
        matchedAt: new Date().toISOString(),
        ...(dispatchMeta ? { selectedConfiguration: dispatchMeta } : {}),
      }))
    } else {
      updatedFulfillment = updatedFulfillment.map((f: Record<string, any>) => ({
        ...f,
        fulfillmentStatus:
          f.fulfillmentStatus === 'pending_match' ? targetStatus : f.fulfillmentStatus,
        matchedAt: f.matchedAt || new Date().toISOString(),
        ...(dispatchMeta
          ? {
              selectedConfiguration: {
                ...(typeof f.selectedConfiguration === 'object' && f.selectedConfiguration
                  ? f.selectedConfiguration
                  : {}),
                ...dispatchMeta,
              },
            }
          : {}),
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
      ...(liveDispatch ? { liveDispatch } : {}),
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
