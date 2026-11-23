/**
 * Unit Tests for Event Ticket Checkout & POD Fulfillment — Sprint D
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fulfillVerifiedPayment } from '@/lib/payments/fulfillment'
import {
  buildPrintfulOrderPayload,
  buildPrintifyOrderPayload,
  processOrderPODFulfillment,
} from '@/lib/fulfillment/podAdapter'
import { assembleVendorPackage, type PODOrder } from '@/utilities/printOnDemandEngine'

vi.mock('@/utilities/logError', () => ({ logError: vi.fn(async () => {}) }))
vi.mock('@/utilities/applyOrderInventory', () => ({
  markOrderPaidAndDecrementInventory: vi.fn(async () => {}),
}))
vi.mock('@/utilities/sendOrderConfirmationEmail', () => ({
  sendOrderConfirmationEmail: vi.fn(async () => {}),
}))
vi.mock('@/services/SettingService', () => ({
  getSetting: vi.fn(async () => null),
  setSetting: vi.fn(async () => {}),
  deleteSetting: vi.fn(async () => {}),
}))

describe('Sprint D: Event Ticket Payment Fulfillment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fulfills paid event ticket checkout and creates event-registration record', async () => {
    const createdRegistrations: any[] = []
    const allocations: any[] = []

    const payload = {
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'processed-stripe-events') return { docs: [] }
        if (collection === 'tenants') return { docs: [{ id: 42, type: 'creator', portalPlan: 'creator' }] }
        return { docs: [] }
      }),
      create: vi.fn(async ({ collection, data }: { collection: string; data: any }) => {
        if (collection === 'event-registrations') {
          const doc = { id: 999, ...data }
          createdRegistrations.push(doc)
          return doc
        }
        if (collection === 'justice-fund-transactions') {
          allocations.push(data)
          return { id: 888, ...data }
        }
        return { id: 1, ...data }
      }),
      update: vi.fn(async () => ({})),
    } as any

    const res = await fulfillVerifiedPayment(payload, {
      idempotencyKey: 'confirm:tkt_123',
      intent: {
        ref: 'tkt_123',
        provider: 'square',
        environment: 'production',
        kind: 'event_ticket',
        status: 'pending',
        amountCents: 5000,
        currency: 'USD',
        tenantId: 42,
        chargeModel: 'direct',
        applicationFeeCents: 200, // 4% platform fee for Creator plan
        eventId: 101,
        customerName: 'Jean-Luc Picard',
        customerEmail: 'picard@enterprise.starfleet',
        ticketCount: 2,
        createdAt: '2026-11-23T00:00:00Z',
      },
      verified: {
        verified: true,
        provider: 'square',
        externalId: 'sq_order_abc',
        transactionId: 'sq_txn_xyz',
        status: 'completed',
        amountCents: 5000,
        payerEmail: 'picard@enterprise.starfleet',
      },
    })

    expect(res.fulfilled).toBe(true)
    expect(res.registrationId).toBe(999)

    // Verify registration record
    expect(createdRegistrations).toHaveLength(1)
    const reg = createdRegistrations[0]
    expect(reg.event).toBe(101)
    expect(reg.name).toBe('Jean-Luc Picard')
    expect(reg.email).toBe('picard@enterprise.starfleet')
    expect(reg.status).toBe('registered')
    expect(reg.metadata.paid).toBe(true)
    expect(reg.metadata.provider).toBe('square')
    expect(reg.metadata.ticketCount).toBe(2)
    expect(reg.metadata.amountCents).toBe(5000)

    // Verify platform fee allocation was logged
    expect(allocations).toHaveLength(1)
    expect(allocations[0].amountCents).toBe(200)
    expect(allocations[0].sourceTotalCents).toBe(5000)
  })
})

describe('Sprint D: Print-on-Demand (POD) Adapter', () => {
  const samplePODOrder: PODOrder = {
    orderId: 'ORD_777',
    customerId: 55,
    totalPrice: 45.0,
    createdAt: '2026-11-23T00:00:00Z',
    items: [
      {
        productId: 10,
        productName: 'Starfleet Command Hoodie',
        variant: 'Large / Red',
        quantity: 1,
        unitPrice: 45.0,
        designAssets: [
          {
            designFile: {
              id: 'med_1',
              mediaId: 1,
              filename: 'insignia.png',
              format: 'png',
              widthPx: 3000,
              heightPx: 3000,
              dpi: 300,
              fileSizeBytes: 2_000_000,
              url: 'https://spacesangels.com/media/insignia.png',
              createdAt: '2026-11-23T00:00:00Z',
            },
            printSpec: {
              surface: 'front',
              printMethod: 'dtg',
              widthInches: 10,
              heightInches: 10,
            },
            status: 'approved',
          },
        ],
      },
    ],
  }

  it('formats Printful payload matching v2 schema', () => {
    const vendorPackage = assembleVendorPackage(samplePODOrder, 1, 'Printful')
    const payload = buildPrintfulOrderPayload(
      vendorPackage,
      {
        line1: '1701 Starfleet Way',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94129',
        country: 'US',
      },
      { name: 'Geordi La Forge', email: 'geordi@starfleet.org' },
    )

    expect(payload.external_id).toBe('ORD_777')
    expect(payload.recipient.name).toBe('Geordi La Forge')
    expect(payload.recipient.city).toBe('San Francisco')
    expect(payload.items).toHaveLength(1)
    expect(payload.items[0].name).toContain('Starfleet Command Hoodie')
    expect(payload.items[0].files[0].url).toBe('https://spacesangels.com/media/insignia.png')
    expect(payload.items[0].files[0].type).toBe('front')
  })

  it('formats Printify payload matching API schema', () => {
    const vendorPackage = assembleVendorPackage(samplePODOrder, 2, 'Printify')
    const payload = buildPrintifyOrderPayload(
      vendorPackage,
      {
        address1: '42 Deep Space Promenade',
        city: 'Bajor Station',
        state: 'Alpha Quadrant',
        zip: '00042',
      },
      { name: 'Miles O\'Brien', email: 'obrien@starfleet.org' },
    )

    expect(payload.external_id).toBe('ORD_777')
    expect(payload.address_to.first_name).toBe('Miles')
    expect(payload.address_to.last_name).toBe('O\'Brien')
    expect(payload.line_items).toHaveLength(1)
    expect(payload.line_items[0].print_areas.front).toBe('https://spacesangels.com/media/insignia.png')
  })

  it('processes shop order POD fulfillment when design assets are present', async () => {
    const orderUpdates: any[] = []

    const payload = {
      findByID: vi.fn(async () => ({
        id: 'ORD_999',
        amount: 3000,
        customer: 42,
        items: [
          {
            product: { id: 10, title: 'Creator Tee', priceInUSD: 3000 },
            quantity: 1,
            designAssets: [
              {
                media: {
                  id: 101,
                  url: 'https://spacesangels.com/media/tee.png',
                  filename: 'tee.png',
                  mimeType: 'image/png',
                  width: 2400,
                  height: 3200,
                },
                surface: 'front',
                printMethod: 'dtg',
                widthInches: 8,
                heightInches: 10,
              },
            ],
          },
        ],
        fulfillment: [],
      })),
      update: vi.fn(async ({ data }: { data: any }) => {
        orderUpdates.push(data)
        return { id: 'ORD_999', ...data }
      }),
    } as any

    const result = await processOrderPODFulfillment(payload, 'ORD_999')
    expect(result.processed).toBe(true)
    expect(result.packageCount).toBe(1)
    expect(result.vendorPackages[0].items[0].designs).toHaveLength(1)

    // Verify fulfillment was updated to in_production
    expect(orderUpdates).toHaveLength(1)
    expect(orderUpdates[0].fulfillment[0].fulfillmentStatus).toBe('in_production')
  })
})
