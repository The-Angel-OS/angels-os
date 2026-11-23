/**
 * Printify Provider Adapter (Secondary Model A Creator-Owned Account)
 *
 * Implements the parallel creator-owned POD contract for Printify API v1:
 *   - Connection & shop discovery (`/v1/shops.json`)
 *   - Product catalog sync (`/v1/shops/{shopId}/products.json`)
 *   - Live shipping estimation (`/v1/shops/{shopId}/orders/shipping.json`)
 *   - Order dispatch (`/v1/shops/{shopId}/orders.json`)
 *   - HMAC-SHA256 `x-pfy-signature` webhook verification & event normalization
 */
import crypto from 'node:crypto'
import type {
  PODNormalizedWebhookEvent,
  PODOrderSubmitRequest,
  PODOrderSubmitResult,
  PODRecipientAddress,
  PODShippingRateOption,
  PODShippingRateRequestItem,
  PODSyncProduct,
} from '../types'

const PRINTIFY_API_BASE = 'https://api.printify.com/v1'

async function printifyFetch<T = Record<string, unknown>>(
  apiToken: string,
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; data: T; errorText?: string }> {
  const res = await fetch(`${PRINTIFY_API_BASE}${path}`, {
    method: opts.method || 'GET',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    signal: AbortSignal.timeout(15_000),
  })
  const text = await res.text()
  let parsed = {} as T
  try {
    parsed = (text ? JSON.parse(text) : {}) as T
  } catch {
    parsed = {} as T
  }
  if (!res.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = (parsed as any)?.message || (parsed as any)?.error || text.slice(0, 240)
    return {
      ok: false,
      status: res.status,
      data: parsed,
      errorText: typeof msg === 'string' && msg ? msg : `Printify HTTP ${res.status}`,
    }
  }
  return { ok: true, status: res.status, data: parsed }
}

export async function verifyPrintifyConnection(
  apiToken: string,
  preferredShopId?: string,
): Promise<{
  ok: boolean
  shopId?: string
  shopTitle?: string
  salesChannel?: string
  error?: string
}> {
  const res = await printifyFetch<
    Array<{ id?: number | string; title?: string; sales_channel?: string }>
  >(apiToken, '/shops.json')

  if (!res.ok) {
    return { ok: false, error: res.errorText || 'Printify authentication failed' }
  }

  const shops = Array.isArray(res.data) ? res.data : []
  if (shops.length === 0) {
    return { ok: false, error: 'No Printify shops found on this account.' }
  }

  const chosen =
    (preferredShopId ? shops.find((s) => String(s.id) === String(preferredShopId)) : undefined) ||
    shops[0]!

  return {
    ok: true,
    shopId: String(chosen.id),
    shopTitle: chosen.title || `Printify Shop #${chosen.id}`,
    salesChannel: chosen.sales_channel,
  }
}

export async function fetchPrintifyProducts(
  apiToken: string,
  shopId: string,
  limit = 40,
): Promise<PODSyncProduct[]> {
  const res = await printifyFetch<{
    data?: Array<{
      id?: string
      title?: string
      images?: Array<{ src?: string; is_default?: boolean }>
      variants?: Array<{
        id?: number
        sku?: string
        title?: string
        price?: number
        is_enabled?: boolean
        is_available?: boolean
      }>
    }>
  }>(apiToken, `/shops/${encodeURIComponent(shopId)}/products.json?limit=${Math.min(Math.max(limit, 1), 50)}`)

  if (!res.ok) {
    throw new Error(`Printify catalog fetch failed: ${res.errorText}`)
  }

  const docs = Array.isArray(res.data?.data) ? res.data.data : []
  return docs
    .filter((p) => Boolean(p?.id))
    .map((p) => {
      const defImg = p.images?.find((img) => img.is_default)?.src || p.images?.[0]?.src
      const enabledVariants = (p.variants || []).filter((v) => v.is_enabled !== false)
      return {
        provider: 'printify' as const,
        externalProductId: String(p.id),
        title: p.title || `Printify Product ${p.id}`,
        thumbnailUrl: defImg,
        variants: enabledVariants.map((v) => ({
          externalVariantId: String(v.id || ''),
          sku: v.sku,
          name: v.title || 'Variant',
          retailPriceCents: Number(v.price || 0),
          currency: 'USD',
          inStock: v.is_available !== false,
        })),
      }
    })
}

export async function fetchPrintifyShippingRates(
  apiToken: string,
  shopId: string,
  recipient: PODRecipientAddress,
  items: PODShippingRateRequestItem[],
  productIdMap?: Record<string, string>,
): Promise<PODShippingRateOption[]> {
  const lineItems = items
    .map((i) => ({
      product_id: i.externalVariantId && productIdMap ? productIdMap[i.externalVariantId] : undefined,
      variant_id: Number(i.variantId || i.externalVariantId),
      quantity: Math.max(1, Number(i.quantity) || 1),
    }))
    .filter((i) => Number.isFinite(i.variant_id) && Boolean(i.product_id))

  if (lineItems.length === 0) return []

  const nameParts = recipient.name.trim().split(/\s+/)
  const firstName = nameParts[0] || 'Customer'
  const lastName = nameParts.slice(1).join(' ') || 'Customer'

  const res = await printifyFetch<{
    standard?: number
    express?: number
    priority?: number
  }>(apiToken, `/shops/${encodeURIComponent(shopId)}/orders/shipping.json`, {
    method: 'POST',
    body: {
      line_items: lineItems,
      address_to: {
        first_name: firstName,
        last_name: lastName,
        email: recipient.email,
        country: recipient.countryCode || 'US',
        region: recipient.stateCode || '',
        address1: recipient.address1,
        city: recipient.city,
        zip: recipient.zip,
      },
    },
  })

  if (!res.ok) {
    throw new Error(`Printify shipping rate lookup failed: ${res.errorText}`)
  }

  const options: PODShippingRateOption[] = []
  if (typeof res.data?.standard === 'number') {
    options.push({
      id: 'standard',
      name: 'Printify Standard Shipping',
      rateCents: res.data.standard,
      currency: 'USD',
    })
  }
  if (typeof res.data?.express === 'number') {
    options.push({
      id: 'express',
      name: 'Printify Express Shipping',
      rateCents: res.data.express,
      currency: 'USD',
    })
  }
  return options
}

export async function submitPrintifyOrder(
  apiToken: string,
  shopId: string,
  req: PODOrderSubmitRequest,
  externalProductId?: string,
): Promise<PODOrderSubmitResult> {
  const nameParts = req.recipient.name.trim().split(/\s+/)
  const firstName = nameParts[0] || 'Customer'
  const lastName = nameParts.slice(1).join(' ') || 'Customer'

  const res = await printifyFetch<{ id?: string; status?: string }>(
    apiToken,
    `/shops/${encodeURIComponent(shopId)}/orders.json`,
    {
      method: 'POST',
      body: {
        external_id: req.externalOrderId,
        label: `Angel OS ${req.externalOrderId}`,
        line_items: req.items.map((item) => ({
          ...(externalProductId ? { product_id: externalProductId } : {}),
          variant_id: item.variantId || Number(item.externalVariantId || 0),
          quantity: Math.max(1, Number(item.quantity) || 1),
        })),
        shipping_method: 1,
        send_shipping_notification: true,
        address_to: {
          first_name: firstName,
          last_name: lastName,
          email: req.recipient.email,
          phone: req.recipient.phone,
          country: req.recipient.countryCode || 'US',
          region: req.recipient.stateCode || '',
          address1: req.recipient.address1,
          address2: req.recipient.address2 || '',
          city: req.recipient.city,
          zip: req.recipient.zip,
        },
      },
    },
  )

  if (!res.ok) {
    return {
      ok: false,
      provider: 'printify',
      externalOrderId: req.externalOrderId,
      status: 'failed',
      autoConfirmed: req.autoConfirm === true,
      error: res.errorText || 'Printify order submission failed',
      raw: res.data,
    }
  }

  return {
    ok: true,
    provider: 'printify',
    externalOrderId: req.externalOrderId,
    providerOrderId: res.data?.id,
    status: 'in_production',
    autoConfirmed: req.autoConfirm === true,
    raw: res.data,
  }
}

export function verifyPrintifyWebhookSignature(opts: {
  rawBody: string
  signatureHeader?: string | null
  expectedSecret?: string
}): boolean {
  if (!opts.expectedSecret) return false
  const sig = (opts.signatureHeader || '').trim().replace(/^sha256=/i, '')
  if (!sig) return false
  const digest = crypto
    .createHmac('sha256', opts.expectedSecret)
    .update(opts.rawBody)
    .digest('hex')
  const a = Uint8Array.from(Buffer.from(sig))
  const b = Uint8Array.from(Buffer.from(digest))
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function parsePrintifyWebhookEvent(rawBody: string): PODNormalizedWebhookEvent | null {
  try {
    const body = JSON.parse(rawBody) as {
      type?: string
      resource?: {
        id?: string
        data?: {
          external_id?: string
          carrier?: { code?: string; tracking_number?: string; tracking_url?: string }
          shipped_at?: string
        }
      }
    }
    const eventType = String(body.type || '')
    const resData = body.resource?.data
    let status: PODNormalizedWebhookEvent['status'] = 'in_production'
    if (eventType.includes('shipped') || resData?.carrier?.tracking_number) {
      status = 'shipped'
    } else if (eventType.includes('delivered')) {
      status = 'delivered'
    } else if (eventType.includes('canceled')) {
      status = 'cancelled'
    }

    return {
      provider: 'printify',
      eventType,
      externalOrderId: resData?.external_id,
      providerOrderId: body.resource?.id,
      status,
      carrier: resData?.carrier?.code,
      trackingNumber: resData?.carrier?.tracking_number,
      trackingUrl: resData?.carrier?.tracking_url,
      shippedAt: resData?.shipped_at,
    }
  } catch {
    return null
  }
}
