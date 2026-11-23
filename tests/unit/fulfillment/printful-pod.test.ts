import crypto from 'node:crypto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  disconnectPODAccount,
  getConnectedPODCredentials,
  getTenantPODSettings,
  sanitizePODSettingsForClient,
  saveConnectedPrintfulAccount,
  saveConnectedPrintifyAccount,
} from '@/lib/fulfillment/config'
import {
  buildPrintfulAuthorizeUrl,
  parsePrintfulWebhookEvent,
  submitPrintfulOrder,
  verifyPrintfulWebhookSignature,
} from '@/lib/fulfillment/providers/printful'
import {
  parsePrintifyWebhookEvent,
  verifyPrintifyWebhookSignature,
} from '@/lib/fulfillment/providers/printify'
import { processOrderPODFulfillment } from '@/lib/fulfillment/podAdapter'
import {
  podPrintfulWebhookHandler,
  signPODOAuthState,
  verifyPODOAuthState,
} from '@/endpoints/fulfillment-pod-ops'

function createInMemorySettingPayload(extra?: {
  orderDoc?: Record<string, any>
  orderUpdates?: Array<Record<string, any>>
}) {
  const settingsDocs: Array<{
    id: number
    tenant: number
    entityName: string
    entityId: string
    settingName: string
    settingValue: string
    isPrivate: boolean
  }> = []
  let nextId = 1

  const matchSettings = (where: any) => {
    const clauses: Array<Record<string, any>> = Array.isArray(where?.and) ? where.and : [where]
    return settingsDocs.filter((doc) =>
      clauses.every((clause) => {
        if (clause?.entityName?.equals !== undefined && doc.entityName !== clause.entityName.equals)
          return false
        if (clause?.entityId?.equals !== undefined && doc.entityId !== clause.entityId.equals)
          return false
        if (clause?.tenant?.equals !== undefined && String(doc.tenant) !== String(clause.tenant.equals))
          return false
        if (
          clause?.settingName?.equals !== undefined &&
          doc.settingName !== clause.settingName.equals
        )
          return false
        return true
      }),
    )
  }

  return {
    settingsDocs,
    payload: {
      find: vi.fn(async ({ collection, where }: { collection: string; where: any }) => {
        if (collection === 'settings') {
          return { docs: matchSettings(where) }
        }
        return { docs: [] }
      }),
      create: vi.fn(async ({ collection, data }: { collection: string; data: any }) => {
        if (collection === 'settings') {
          const rec = { id: nextId++, ...data }
          settingsDocs.push(rec)
          return rec
        }
        return { id: nextId++, ...data }
      }),
      update: vi.fn(async ({ collection, id, data }: { collection: string; id: any; data: any }) => {
        if (collection === 'settings') {
          const found = settingsDocs.find((d) => String(d.id) === String(id))
          if (found) Object.assign(found, data)
          return found
        }
        if (collection === 'orders') {
          extra?.orderUpdates?.push({ id, ...data })
          return { id, ...data }
        }
        return { id, ...data }
      }),
      findByID: vi.fn(async ({ collection, id }: { collection: string; id: any }) => {
        if (collection === 'orders' && extra?.orderDoc) {
          return { ...extra.orderDoc, id }
        }
        return null
      }),
    } as any,
  }
}

describe('Model A Print-on-Demand (Printful OAuth 2.0 + Printify) Core', () => {
  const originalSecret = process.env.ENCRYPTION_SECRET
  const originalPayloadSecret = process.env.PAYLOAD_SECRET

  beforeEach(() => {
    process.env.ENCRYPTION_SECRET = 'test-secret-key-for-pod-encryption-32ch'
    process.env.PAYLOAD_SECRET = 'test-payload-secret-for-pod-oauth'
  })

  afterEach(() => {
    process.env.ENCRYPTION_SECRET = originalSecret
    process.env.PAYLOAD_SECRET = originalPayloadSecret
    vi.restoreAllMocks()
  })

  it('encrypts creator POD credentials at rest, decrypts for dispatch, sanitizes for UI, and disconnects cleanly', async () => {
    const { payload, settingsDocs } = createInMemorySettingPayload()

    await saveConnectedPrintfulAccount(payload, 5, {
      authMode: 'oauth',
      storeId: 'pf_store_42',
      storeName: 'Clearwater Merch',
      storeType: 'api',
      accessToken: 'pf_live_super_secret_token',
      refreshToken: 'pf_refresh_super_secret',
      expiresAt: '2099-01-01T00:00:00.000Z',
    })

    // Raw SettingService record must NEVER store plaintext token
    expect(settingsDocs).toHaveLength(1)
    expect(settingsDocs[0]!.isPrivate).toBe(true)
    expect(settingsDocs[0]!.settingValue).not.toContain('pf_live_super_secret_token')
    expect(settingsDocs[0]!.settingValue).not.toContain('pf_refresh_super_secret')

    // Decrypted credentials for server dispatch
    const creds = await getConnectedPODCredentials(payload, 5)
    expect(creds?.provider).toBe('printful')
    if (creds?.provider === 'printful') {
      expect(creds.accessToken).toBe('pf_live_super_secret_token')
      expect(creds.refreshToken).toBe('pf_refresh_super_secret')
      expect(creds.storeId).toBe('pf_store_42')
      expect(creds.webhookSecret).toBeTruthy()
    }

    // Sanitized client status strips secrets completely
    const rawSettings = await getTenantPODSettings(payload, 5)
    const sanitized = sanitizePODSettingsForClient(rawSettings)
    expect(sanitized.activeProvider).toBe('printful')
    expect(sanitized.printful.connected).toBe(true)
    expect(sanitized.printful.storeName).toBe('Clearwater Merch')
    expect(JSON.stringify(sanitized)).not.toContain('pf_live_super_secret_token')

    // Connect secondary Printify & disconnect Printful -> activeProvider switches to printify
    await saveConnectedPrintifyAccount(payload, 5, {
      shopId: 'py_99',
      shopTitle: 'Secondary Shop',
      apiToken: 'py_secret_tok',
    })
    await disconnectPODAccount(payload, 5, 'printful')
    const afterDisconnect = sanitizePODSettingsForClient(await getTenantPODSettings(payload, 5))
    expect(afterDisconnect.printful.connected).toBe(false)
    expect(afterDisconnect.printify.connected).toBe(true)
    expect(afterDisconnect.activeProvider).toBe('printify')
  })

  it('builds Printful OAuth authorize URL using redirect_url and validates signed HMAC state', () => {
    const state = signPODOAuthState({ tenantId: 5, userId: 1, ts: Date.now() })
    const decoded = verifyPODOAuthState(state)
    expect(decoded?.tenantId).toBe(5)
    expect(verifyPODOAuthState(`${state}tampered`)).toBeNull()

    const url = new URL(
      buildPrintfulAuthorizeUrl({
        clientId: 'pf_app_123',
        redirectUrl: 'https://www.spacesangels.com/api/fulfillment-ops/pod/printful/callback',
        state,
      }),
    )
    expect(url.origin + url.pathname).toBe('https://www.printful.com/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('pf_app_123')
    expect(url.searchParams.get('redirect_url')).toBe(
      'https://www.spacesangels.com/api/fulfillment-ops/pod/printful/callback',
    )
    expect(url.searchParams.get('state')).toBe(state)
  })

  it('submits Printful draft vs auto-confirmed orders with X-PF-Store-Id & packing_slip', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          result: { id: 887766, external_id: 'aos-order-101', status: 'draft' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const draftRes = await submitPrintfulOrder('tok_abc', 'store_77', {
      externalOrderId: 'aos-order-101',
      recipient: {
        name: 'Jane Creator',
        address1: '100 Main St',
        city: 'Clearwater',
        stateCode: 'FL',
        countryCode: 'US',
        zip: '33755',
        email: 'jane@example.com',
      },
      items: [{ syncVariantId: 555111, name: 'Hoodie (Black / L)', quantity: 1 }],
      autoConfirm: false,
      packingSlip: { message: 'Thank you for supporting!' },
    })

    expect(draftRes.ok).toBe(true)
    expect(draftRes.status).toBe('draft')
    expect(draftRes.providerOrderId).toBe('887766')

    const [calledUrl, calledInit] = fetchSpy.mock.calls[0]!
    expect(String(calledUrl)).toBe('https://api.printful.com/orders?confirm=false')
    expect((calledInit?.headers as Record<string, string>)['X-PF-Store-Id']).toBe('store_77')
    const parsedBody = JSON.parse(String(calledInit?.body))
    expect(parsedBody.packing_slip.message).toBe('Thank you for supporting!')
    expect(parsedBody.items[0].sync_variant_id).toBe(555111)
  })

  it('dispatches paid POD catalog orders automatically in processOrderPODFulfillment when connected', async () => {
    const orderUpdates: Array<Record<string, any>> = []
    const { payload } = createInMemorySettingPayload({
      orderUpdates,
      orderDoc: {
        id: 777,
        tenant: 5,
        amount: 4500,
        customerEmail: 'fan@example.com',
        shippingAddress: {
          name: 'Alex Fan',
          line1: '500 Pier Ave',
          city: 'Tampa',
          state: 'FL',
          postalCode: '33602',
          country: 'US',
        },
        items: [
          {
            quantity: 1,
            variant: { title: 'Black / L' },
            product: {
              id: 201,
              title: 'Cruisin Hoodie',
              priceInUSD: 4500,
              productionType: 'print_on_demand',
              configuratorOptions: {
                pod: {
                  provider: 'printful',
                  externalProductId: 'pf_p_1',
                  variants: [{ externalVariantId: '991122', syncVariantId: 991122, name: 'Black / L' }],
                },
              },
            },
          },
        ],
        fulfillment: [],
      },
    })

    await saveConnectedPrintfulAccount(payload, 5, {
      authMode: 'private_token',
      storeId: 'pf_store_5',
      accessToken: 'pf_private_tok',
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ result: { id: 445566, external_id: 'aos-order-777', status: 'pending' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const res = await processOrderPODFulfillment(payload, 777)
    expect(res.processed).toBe(true)
    expect(res.liveDispatch?.ok).toBe(true)
    expect(res.liveDispatch?.providerOrderId).toBe('445566')
    expect(orderUpdates).toHaveLength(1)
    expect(orderUpdates[0]!.fulfillment[0].selectedConfiguration.podProvider).toBe('printful')
    expect(orderUpdates[0]!.fulfillment[0].selectedConfiguration.providerOrderId).toBe('445566')
  })

  it('verifies Printful & Printify webhooks and updates order tracking info', async () => {
    const orderUpdates: Array<Record<string, any>> = []
    const { payload } = createInMemorySettingPayload({
      orderUpdates,
      orderDoc: {
        id: 888,
        tenant: 5,
        fulfillment: [{ orderItemIndex: 0, fulfillmentStatus: 'in_production' }],
      },
    })

    await saveConnectedPrintfulAccount(payload, 5, {
      authMode: 'private_token',
      accessToken: 'tok_123',
      webhookSecret: 'whsec_printful_abc',
    })

    const webhookBody = JSON.stringify({
      type: 'package_shipped',
      data: {
        order: { id: 9001, external_id: 'aos-order-888' },
        shipment: {
          carrier: 'USPS',
          tracking_number: '94001112025550001234',
          tracking_url: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=94001112025550001234',
          ship_date: '2026-11-23',
        },
      },
    })

    // Valid signature via HMAC header
    const hmac = crypto.createHmac('sha256', 'whsec_printful_abc').update(webhookBody).digest('hex')
    expect(
      verifyPrintfulWebhookSignature({
        rawBody: webhookBody,
        signatureHeader: hmac,
        expectedSecret: 'whsec_printful_abc',
      }),
    ).toBe(true)

    const parsedPf = parsePrintfulWebhookEvent(webhookBody)
    expect(parsedPf?.status).toBe('shipped')
    expect(parsedPf?.trackingNumber).toBe('94001112025550001234')

    // Reject forged signature -> 401
    const badReq = new Request(
      'https://spacesangels.com/api/fulfillment-ops/pod/webhooks/printful?tenantId=5',
      {
        method: 'POST',
        headers: { 'x-pf-webhook-signature': 'deadbeef' },
        body: webhookBody,
      },
    ) as any
    badReq.payload = payload
    const badRes = await podPrintfulWebhookHandler(badReq)
    expect(badRes.status).toBe(401)

    // Valid token -> 200 and updates Order trackingNumber + shipped status
    const okReq = new Request(
      'https://spacesangels.com/api/fulfillment-ops/pod/webhooks/printful?tenantId=5&token=whsec_printful_abc',
      { method: 'POST', body: webhookBody },
    ) as any
    okReq.payload = payload
    const okRes = await podPrintfulWebhookHandler(okReq)
    expect(okRes.status).toBe(200)
    expect(orderUpdates).toHaveLength(1)
    expect(orderUpdates[0]!.fulfillment[0].fulfillmentStatus).toBe('shipped')
    expect(orderUpdates[0]!.fulfillment[0].trackingNumber).toBe('94001112025550001234')

    // Printify HMAC verification & parsing sanity check
    const pyBody = JSON.stringify({
      type: 'order:shipment:created',
      resource: {
        id: 'py_ord_1',
        data: {
          external_id: 'aos-order-888',
          carrier: { code: 'UPS', tracking_number: '1Z999', tracking_url: 'https://ups.com/track' },
        },
      },
    })
    const pySig = crypto.createHmac('sha256', 'py_sec').update(pyBody).digest('hex')
    expect(
      verifyPrintifyWebhookSignature({ rawBody: pyBody, signatureHeader: pySig, expectedSecret: 'py_sec' }),
    ).toBe(true)
    const parsedPy = parsePrintifyWebhookEvent(pyBody)
    expect(parsedPy?.status).toBe('shipped')
    expect(parsedPy?.trackingNumber).toBe('1Z999')
  })
})
