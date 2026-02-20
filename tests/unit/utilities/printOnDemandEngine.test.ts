/**
 * Unit tests for Print-on-Demand Pipeline Engine — Sprint 5.
 *
 * Tests design validation, print spec validation, DPI calculations,
 * vendor package assembly, pipeline status tracking, and the full
 * POD workflow from design upload to delivery.
 *
 * Uses the project pattern of re-implementing pure logic
 * to avoid Payload-coupled imports.
 *
 * @see src/utilities/printOnDemandEngine.ts — POD engine
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Types (re-implemented to avoid Payload-coupled imports)
// ---------------------------------------------------------------------------

type DesignStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'attached_to_order'
type ProductSurface = 'front' | 'back' | 'left_sleeve' | 'right_sleeve' | 'pocket' | 'all_over' | 'label' | 'custom'
type PrintMethod = 'screen_print' | 'dtg' | 'sublimation' | 'heat_transfer' | 'embroidery' | 'vinyl_cut' | 'laser_engrave' | 'uv_print'

interface DesignFile {
  id: string
  mediaId: number
  filename: string
  format: string
  widthPx: number
  heightPx: number
  dpi: number
  fileSizeBytes: number
  url: string
  createdAt: string
}

interface PrintSpecification {
  surface: ProductSurface
  printMethod: PrintMethod
  widthInches: number
  heightInches: number
  colors?: number
  notes?: string
}

interface DesignAsset {
  designFile: DesignFile
  printSpec: PrintSpecification
  status: DesignStatus
  approvedAt?: string
  approvedBy?: string
  rejectionReason?: string
}

interface PODOrderItem {
  productId: number
  productName: string
  variant?: string
  quantity: number
  designAssets: DesignAsset[]
  unitPrice: number
}

interface PODOrder {
  orderId: string
  customerId: number
  items: PODOrderItem[]
  totalPrice: number
  createdAt: string
}

interface VendorPackage {
  orderId: string
  vendorId: number
  vendorName: string
  items: {
    productName: string
    variant?: string
    quantity: number
    designs: {
      filename: string
      url: string
      surface: ProductSurface
      printMethod: PrintMethod
      widthInches: number
      heightInches: number
      dpi: number
      colors?: number
      notes?: string
    }[]
  }[]
  totalItems: number
  totalDesigns: number
  instructions: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_PRINT_DPI = 150
const RECOMMENDED_DPI = 300
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024
const SUPPORTED_FORMATS = ['png', 'svg', 'pdf', 'tiff', 'ai', 'eps', 'psd']

const PRINT_METHOD_LABELS: Record<PrintMethod, string> = {
  screen_print: 'Screen Print',
  dtg: 'Direct to Garment (DTG)',
  sublimation: 'Sublimation',
  heat_transfer: 'Heat Transfer',
  embroidery: 'Embroidery',
  vinyl_cut: 'Vinyl Cut',
  laser_engrave: 'Laser Engraving',
  uv_print: 'UV Print',
}

const SURFACE_LABELS: Record<ProductSurface, string> = {
  front: 'Front',
  back: 'Back',
  left_sleeve: 'Left Sleeve',
  right_sleeve: 'Right Sleeve',
  pocket: 'Pocket',
  all_over: 'All Over',
  label: 'Label',
  custom: 'Custom Placement',
}

const VALID_DESIGN_TRANSITIONS: Record<DesignStatus, DesignStatus[]> = {
  draft: ['pending_approval'],
  pending_approval: ['approved', 'rejected'],
  approved: ['attached_to_order'],
  rejected: ['draft'],
  attached_to_order: [],
}

// ---------------------------------------------------------------------------
// Pure function re-implementations
// ---------------------------------------------------------------------------

function validateDesignFile(
  file: Pick<DesignFile, 'format' | 'dpi' | 'fileSizeBytes' | 'widthPx' | 'heightPx'>,
): { valid: boolean; warnings: string[]; errors: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  if (!SUPPORTED_FORMATS.includes(file.format.toLowerCase())) {
    errors.push(`Unsupported format: ${file.format}. Supported: ${SUPPORTED_FORMATS.join(', ')}`)
  }

  if (file.dpi < MIN_PRINT_DPI) {
    errors.push(`DPI too low: ${file.dpi}. Minimum for print: ${MIN_PRINT_DPI} DPI.`)
  } else if (file.dpi < RECOMMENDED_DPI) {
    warnings.push(`DPI is ${file.dpi}. Recommended: ${RECOMMENDED_DPI} DPI for best quality.`)
  }

  if (file.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    errors.push(`File too large: ${(file.fileSizeBytes / 1024 / 1024).toFixed(1)}MB. Maximum: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`)
  }

  if (file.widthPx <= 0 || file.heightPx <= 0) {
    errors.push('Design dimensions must be positive.')
  }

  return { valid: errors.length === 0, warnings, errors }
}

function validatePrintSpec(
  spec: PrintSpecification,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (spec.widthInches <= 0 || spec.heightInches <= 0) {
    errors.push('Print dimensions must be positive.')
  }

  if (spec.colors !== undefined && spec.colors < 1) {
    errors.push('Color count must be at least 1.')
  }

  if (spec.printMethod === 'embroidery' && spec.widthInches * spec.heightInches > 100) {
    errors.push('Embroidery area too large. Maximum practical area: 100 sq inches.')
  }

  return { valid: errors.length === 0, errors }
}

function validateDesignTransition(from: DesignStatus, to: DesignStatus): boolean {
  return VALID_DESIGN_TRANSITIONS[from]?.includes(to) ?? false
}

function calculatePrintSize(
  widthPx: number, heightPx: number, dpi: number,
): { widthInches: number; heightInches: number } {
  return {
    widthInches: Math.round((widthPx / dpi) * 100) / 100,
    heightInches: Math.round((heightPx / dpi) * 100) / 100,
  }
}

function calculateMinPixels(
  widthInches: number, heightInches: number, dpi: number = RECOMMENDED_DPI,
): { widthPx: number; heightPx: number } {
  return {
    widthPx: Math.ceil(widthInches * dpi),
    heightPx: Math.ceil(heightInches * dpi),
  }
}

function hasAdequateResolution(
  file: Pick<DesignFile, 'widthPx' | 'heightPx' | 'dpi'>,
  spec: PrintSpecification,
): { adequate: boolean; effectiveDpi: number; minimumDpi: number } {
  const effectiveDpiWidth = file.widthPx / spec.widthInches
  const effectiveDpiHeight = file.heightPx / spec.heightInches
  const effectiveDpi = Math.min(effectiveDpiWidth, effectiveDpiHeight)

  return {
    adequate: effectiveDpi >= MIN_PRINT_DPI,
    effectiveDpi: Math.round(effectiveDpi),
    minimumDpi: MIN_PRINT_DPI,
  }
}

function assembleVendorPackage(
  order: PODOrder, vendorId: number, vendorName: string,
): VendorPackage {
  let totalDesigns = 0

  const items = order.items.map((item) => {
    const approvedDesigns = item.designAssets.filter(
      (da) => da.status === 'approved' || da.status === 'attached_to_order',
    )

    const designs = approvedDesigns.map((da) => {
      totalDesigns++
      return {
        filename: da.designFile.filename,
        url: da.designFile.url,
        surface: da.printSpec.surface,
        printMethod: da.printSpec.printMethod,
        widthInches: da.printSpec.widthInches,
        heightInches: da.printSpec.heightInches,
        dpi: da.designFile.dpi,
        colors: da.printSpec.colors,
        notes: da.printSpec.notes,
      }
    })

    return {
      productName: item.productName,
      variant: item.variant,
      quantity: item.quantity,
      designs,
    }
  })

  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0)

  // Inline instruction generation
  const lines = [
    `Fulfillment Package: ${totalItems} item(s), ${totalDesigns} design file(s)`,
    '',
  ]
  for (const item of items) {
    lines.push(`${item.productName}${item.variant ? ` (${item.variant})` : ''} × ${item.quantity}`)
    for (const design of item.designs) {
      lines.push(`  → ${SURFACE_LABELS[design.surface]}: ${PRINT_METHOD_LABELS[design.printMethod]}`)
      lines.push(`    File: ${design.filename} (${design.dpi} DPI, ${design.widthInches}×${design.heightInches} in)`)
      if (design.colors) lines.push(`    Colors: ${design.colors}`)
      if (design.notes) lines.push(`    Notes: ${design.notes}`)
    }
  }

  return {
    orderId: order.orderId,
    vendorId,
    vendorName,
    items,
    totalItems,
    totalDesigns,
    instructions: lines.join('\n'),
  }
}

function validateOrderReadyForRouting(
  order: PODOrder,
): { ready: boolean; errors: string[] } {
  const errors: string[] = []

  if (order.items.length === 0) {
    errors.push('Order has no items.')
  }

  for (const item of order.items) {
    if (item.designAssets.length === 0) {
      errors.push(`${item.productName}: No design files attached.`)
    }

    const unapproved = item.designAssets.filter(
      (da) => da.status !== 'approved' && da.status !== 'attached_to_order',
    )
    if (unapproved.length > 0) {
      errors.push(`${item.productName}: ${unapproved.length} design(s) not yet approved.`)
    }
  }

  return { ready: errors.length === 0, errors }
}

function getPipelineStatus(
  order: PODOrder,
  fulfillmentStatus?: string,
): { stage: string; progress: number; nextStep: string } {
  const allDesigns = order.items.flatMap((i) => i.designAssets)
  const approvedCount = allDesigns.filter(
    (d) => d.status === 'approved' || d.status === 'attached_to_order',
  ).length
  const totalDesigns = allDesigns.length

  if (totalDesigns === 0) {
    return { stage: 'Design Upload', progress: 0, nextStep: 'Upload design files for your products.' }
  }

  if (approvedCount < totalDesigns) {
    return {
      stage: 'Design Approval',
      progress: 15 + (approvedCount / totalDesigns) * 15,
      nextStep: `${totalDesigns - approvedCount} design(s) pending approval.`,
    }
  }

  const statusProgress: Record<string, { stage: string; progress: number; nextStep: string }> = {
    pending_match: { stage: 'Finding Vendor', progress: 40, nextStep: 'Routing order to the best vendor.' },
    matched: { stage: 'Vendor Matched', progress: 50, nextStep: 'Waiting for vendor acceptance.' },
    accepted: { stage: 'Vendor Accepted', progress: 60, nextStep: 'Vendor is preparing your order.' },
    in_production: { stage: 'In Production', progress: 75, nextStep: 'Your item is being produced.' },
    shipped: { stage: 'Shipped', progress: 90, nextStep: 'Your order is on its way!' },
    delivered: { stage: 'Delivered', progress: 100, nextStep: 'Order complete.' },
  }

  if (fulfillmentStatus && statusProgress[fulfillmentStatus]) {
    return statusProgress[fulfillmentStatus]
  }

  return { stage: 'Ready to Route', progress: 35, nextStep: 'All designs approved. Ready to find a vendor.' }
}

function serializePipelineStatus(status: ReturnType<typeof getPipelineStatus>): string {
  const bar = '█'.repeat(Math.floor(status.progress / 10)) +
    '░'.repeat(10 - Math.floor(status.progress / 10))
  return `${status.stage} [${bar}] ${status.progress}%\n${status.nextStep}`
}

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function makeDesignFile(overrides?: Partial<DesignFile>): DesignFile {
  return {
    id: 'design_1',
    mediaId: 101,
    filename: 'angel-wings-front.png',
    format: 'png',
    widthPx: 3000,
    heightPx: 3600,
    dpi: 300,
    fileSizeBytes: 2 * 1024 * 1024, // 2MB
    url: 'https://cdn.angel-os.com/designs/angel-wings-front.png',
    createdAt: '2026-02-15T10:00:00Z',
    ...overrides,
  }
}

function makePrintSpec(overrides?: Partial<PrintSpecification>): PrintSpecification {
  return {
    surface: 'front',
    printMethod: 'screen_print',
    widthInches: 10,
    heightInches: 12,
    colors: 4,
    ...overrides,
  }
}

function makeDesignAsset(overrides?: Partial<DesignAsset>): DesignAsset {
  return {
    designFile: makeDesignFile(),
    printSpec: makePrintSpec(),
    status: 'approved',
    approvedAt: '2026-02-16T10:00:00Z',
    approvedBy: 'admin',
    ...overrides,
  }
}

function makePODOrder(overrides?: Partial<PODOrder>): PODOrder {
  return {
    orderId: 'order_pod_001',
    customerId: 42,
    items: [
      {
        productId: 1,
        productName: 'Custom T-Shirt',
        variant: 'XL Black',
        quantity: 25,
        designAssets: [makeDesignAsset()],
        unitPrice: 15.00,
      },
    ],
    totalPrice: 375.00,
    createdAt: '2026-02-17T12:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Print-on-Demand Pipeline Engine', () => {
  // =========================================================================
  // Design File Validation
  // =========================================================================
  describe('validateDesignFile', () => {
    it('accepts valid PNG at 300 DPI', () => {
      const result = validateDesignFile(makeDesignFile())
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('accepts SVG format', () => {
      const result = validateDesignFile(makeDesignFile({ format: 'svg' }))
      expect(result.valid).toBe(true)
    })

    it('accepts all supported formats', () => {
      for (const format of SUPPORTED_FORMATS) {
        const result = validateDesignFile(makeDesignFile({ format }))
        expect(result.valid).toBe(true)
      }
    })

    it('rejects unsupported formats', () => {
      const result = validateDesignFile(makeDesignFile({ format: 'bmp' }))
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Unsupported format')
    })

    it('rejects DPI below minimum (150)', () => {
      const result = validateDesignFile(makeDesignFile({ dpi: 72 }))
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('DPI too low')
    })

    it('warns when DPI below recommended (300)', () => {
      const result = validateDesignFile(makeDesignFile({ dpi: 200 }))
      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('Recommended')
    })

    it('accepts DPI at exactly 150 (minimum)', () => {
      const result = validateDesignFile(makeDesignFile({ dpi: 150 }))
      expect(result.valid).toBe(true)
    })

    it('rejects files over 20MB', () => {
      const result = validateDesignFile(makeDesignFile({
        fileSizeBytes: 25 * 1024 * 1024,
      }))
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('File too large')
    })

    it('accepts files at exactly 20MB', () => {
      const result = validateDesignFile(makeDesignFile({
        fileSizeBytes: 20 * 1024 * 1024,
      }))
      expect(result.valid).toBe(true)
    })

    it('rejects zero dimensions', () => {
      const result = validateDesignFile(makeDesignFile({ widthPx: 0, heightPx: 0 }))
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('dimensions')
    })

    it('rejects negative dimensions', () => {
      const result = validateDesignFile(makeDesignFile({ widthPx: -100, heightPx: 100 }))
      expect(result.valid).toBe(false)
    })

    it('collects multiple errors', () => {
      const result = validateDesignFile({
        format: 'gif',
        dpi: 50,
        fileSizeBytes: 30 * 1024 * 1024,
        widthPx: 0,
        heightPx: 0,
      })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('validatePrintSpec', () => {
    it('accepts valid print specification', () => {
      const result = validatePrintSpec(makePrintSpec())
      expect(result.valid).toBe(true)
    })

    it('rejects zero dimensions', () => {
      const result = validatePrintSpec(makePrintSpec({ widthInches: 0 }))
      expect(result.valid).toBe(false)
    })

    it('rejects zero color count', () => {
      const result = validatePrintSpec(makePrintSpec({ colors: 0 }))
      expect(result.valid).toBe(false)
    })

    it('accepts undefined colors (full color methods)', () => {
      const result = validatePrintSpec(makePrintSpec({ colors: undefined }))
      expect(result.valid).toBe(true)
    })

    it('rejects oversized embroidery area', () => {
      const result = validatePrintSpec(makePrintSpec({
        printMethod: 'embroidery',
        widthInches: 12,
        heightInches: 12, // 144 sq inches > 100
      }))
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Embroidery')
    })

    it('accepts large area for non-embroidery methods', () => {
      const result = validatePrintSpec(makePrintSpec({
        printMethod: 'sublimation',
        widthInches: 20,
        heightInches: 20,
      }))
      expect(result.valid).toBe(true)
    })
  })

  // =========================================================================
  // Design Status Transitions
  // =========================================================================
  describe('validateDesignTransition', () => {
    it('allows draft → pending_approval', () => {
      expect(validateDesignTransition('draft', 'pending_approval')).toBe(true)
    })

    it('allows pending_approval → approved', () => {
      expect(validateDesignTransition('pending_approval', 'approved')).toBe(true)
    })

    it('allows pending_approval → rejected', () => {
      expect(validateDesignTransition('pending_approval', 'rejected')).toBe(true)
    })

    it('allows approved → attached_to_order', () => {
      expect(validateDesignTransition('approved', 'attached_to_order')).toBe(true)
    })

    it('allows rejected → draft (revision)', () => {
      expect(validateDesignTransition('rejected', 'draft')).toBe(true)
    })

    it('disallows draft → approved (must go through approval)', () => {
      expect(validateDesignTransition('draft', 'approved')).toBe(false)
    })

    it('disallows attached_to_order → anything (terminal)', () => {
      expect(validateDesignTransition('attached_to_order', 'draft')).toBe(false)
      expect(validateDesignTransition('attached_to_order', 'approved')).toBe(false)
    })

    it('disallows backward transitions except rejected → draft', () => {
      expect(validateDesignTransition('approved', 'draft')).toBe(false)
      expect(validateDesignTransition('approved', 'pending_approval')).toBe(false)
    })
  })

  // =========================================================================
  // DPI & Dimension Calculations
  // =========================================================================
  describe('calculatePrintSize', () => {
    it('calculates print size from pixels and DPI', () => {
      const size = calculatePrintSize(3000, 3600, 300)
      expect(size.widthInches).toBe(10)
      expect(size.heightInches).toBe(12)
    })

    it('handles non-integer results', () => {
      const size = calculatePrintSize(1000, 1500, 300)
      expect(size.widthInches).toBeCloseTo(3.33, 1)
      expect(size.heightInches).toBe(5)
    })

    it('handles low DPI', () => {
      const size = calculatePrintSize(720, 720, 72)
      expect(size.widthInches).toBe(10)
      expect(size.heightInches).toBe(10)
    })
  })

  describe('calculateMinPixels', () => {
    it('calculates minimum pixels at recommended DPI', () => {
      const pixels = calculateMinPixels(10, 12)
      expect(pixels.widthPx).toBe(3000)
      expect(pixels.heightPx).toBe(3600)
    })

    it('uses custom DPI', () => {
      const pixels = calculateMinPixels(10, 12, 150)
      expect(pixels.widthPx).toBe(1500)
      expect(pixels.heightPx).toBe(1800)
    })

    it('rounds up to ensure minimum resolution', () => {
      const pixels = calculateMinPixels(3.33, 3.33, 300)
      expect(pixels.widthPx).toBe(999) // ceil(3.33 * 300)
      expect(pixels.heightPx).toBe(999)
    })
  })

  describe('hasAdequateResolution', () => {
    it('returns adequate for high-res file', () => {
      const file = makeDesignFile({ widthPx: 3000, heightPx: 3600, dpi: 300 })
      const spec = makePrintSpec({ widthInches: 10, heightInches: 12 })
      const result = hasAdequateResolution(file, spec)
      expect(result.adequate).toBe(true)
      expect(result.effectiveDpi).toBe(300)
    })

    it('returns inadequate for low-res file', () => {
      const file = makeDesignFile({ widthPx: 500, heightPx: 600, dpi: 72 })
      const spec = makePrintSpec({ widthInches: 10, heightInches: 12 })
      const result = hasAdequateResolution(file, spec)
      expect(result.adequate).toBe(false)
      expect(result.effectiveDpi).toBe(50)
    })

    it('uses minimum of width/height DPI', () => {
      const file = makeDesignFile({ widthPx: 3000, heightPx: 1200, dpi: 300 })
      const spec = makePrintSpec({ widthInches: 10, heightInches: 12 })
      const result = hasAdequateResolution(file, spec)
      // width DPI: 3000/10 = 300, height DPI: 1200/12 = 100
      expect(result.effectiveDpi).toBe(100)
      expect(result.adequate).toBe(false)
    })
  })

  // =========================================================================
  // Vendor Package Assembly
  // =========================================================================
  describe('assembleVendorPackage', () => {
    it('creates package with correct order and vendor info', () => {
      const order = makePODOrder()
      const pkg = assembleVendorPackage(order, 10, 'HIT Promotional')
      expect(pkg.orderId).toBe('order_pod_001')
      expect(pkg.vendorId).toBe(10)
      expect(pkg.vendorName).toBe('HIT Promotional')
    })

    it('counts total items and designs', () => {
      const order = makePODOrder()
      const pkg = assembleVendorPackage(order, 10, 'HIT')
      expect(pkg.totalItems).toBe(25) // 25 shirts
      expect(pkg.totalDesigns).toBe(1) // 1 design
    })

    it('includes only approved/attached designs', () => {
      const order = makePODOrder({
        items: [{
          productId: 1,
          productName: 'T-Shirt',
          quantity: 10,
          designAssets: [
            makeDesignAsset({ status: 'approved' }),
            makeDesignAsset({ status: 'draft' }),
            makeDesignAsset({ status: 'rejected' }),
          ],
          unitPrice: 15,
        }],
      })
      const pkg = assembleVendorPackage(order, 10, 'HIT')
      expect(pkg.totalDesigns).toBe(1) // only approved
      expect(pkg.items[0].designs).toHaveLength(1)
    })

    it('includes attached_to_order designs', () => {
      const order = makePODOrder({
        items: [{
          productId: 1,
          productName: 'T-Shirt',
          quantity: 10,
          designAssets: [
            makeDesignAsset({ status: 'attached_to_order' }),
          ],
          unitPrice: 15,
        }],
      })
      const pkg = assembleVendorPackage(order, 10, 'HIT')
      expect(pkg.totalDesigns).toBe(1)
    })

    it('carries print spec details into designs', () => {
      const order = makePODOrder()
      const pkg = assembleVendorPackage(order, 10, 'HIT')
      const design = pkg.items[0].designs[0]
      expect(design.surface).toBe('front')
      expect(design.printMethod).toBe('screen_print')
      expect(design.widthInches).toBe(10)
      expect(design.heightInches).toBe(12)
      expect(design.dpi).toBe(300)
    })

    it('generates fulfillment instructions', () => {
      const order = makePODOrder()
      const pkg = assembleVendorPackage(order, 10, 'HIT')
      expect(pkg.instructions).toContain('Fulfillment Package')
      expect(pkg.instructions).toContain('Custom T-Shirt')
      expect(pkg.instructions).toContain('Screen Print')
    })

    it('handles multi-item orders', () => {
      const order = makePODOrder({
        items: [
          {
            productId: 1, productName: 'T-Shirt', variant: 'L Black',
            quantity: 25, designAssets: [makeDesignAsset()], unitPrice: 15,
          },
          {
            productId: 2, productName: 'Mug', variant: '11oz White',
            quantity: 50,
            designAssets: [
              makeDesignAsset({
                printSpec: makePrintSpec({ surface: 'front', printMethod: 'sublimation' }),
              }),
              makeDesignAsset({
                designFile: makeDesignFile({ filename: 'back-design.png' }),
                printSpec: makePrintSpec({ surface: 'back', printMethod: 'sublimation' }),
              }),
            ],
            unitPrice: 8,
          },
        ],
      })
      const pkg = assembleVendorPackage(order, 10, 'HIT')
      expect(pkg.totalItems).toBe(75) // 25 + 50
      expect(pkg.totalDesigns).toBe(3) // 1 + 2
      expect(pkg.items).toHaveLength(2)
    })
  })

  // =========================================================================
  // Order Routing Validation
  // =========================================================================
  describe('validateOrderReadyForRouting', () => {
    it('accepts order with all designs approved', () => {
      const order = makePODOrder()
      const result = validateOrderReadyForRouting(order)
      expect(result.ready).toBe(true)
    })

    it('rejects order with no items', () => {
      const order = makePODOrder({ items: [] })
      const result = validateOrderReadyForRouting(order)
      expect(result.ready).toBe(false)
      expect(result.errors[0]).toContain('no items')
    })

    it('rejects items with no design files', () => {
      const order = makePODOrder({
        items: [{
          productId: 1, productName: 'T-Shirt', quantity: 10,
          designAssets: [], unitPrice: 15,
        }],
      })
      const result = validateOrderReadyForRouting(order)
      expect(result.ready).toBe(false)
      expect(result.errors[0]).toContain('No design files')
    })

    it('rejects items with unapproved designs', () => {
      const order = makePODOrder({
        items: [{
          productId: 1, productName: 'T-Shirt', quantity: 10,
          designAssets: [makeDesignAsset({ status: 'draft' })],
          unitPrice: 15,
        }],
      })
      const result = validateOrderReadyForRouting(order)
      expect(result.ready).toBe(false)
      expect(result.errors[0]).toContain('not yet approved')
    })

    it('accepts attached_to_order as valid', () => {
      const order = makePODOrder({
        items: [{
          productId: 1, productName: 'T-Shirt', quantity: 10,
          designAssets: [makeDesignAsset({ status: 'attached_to_order' })],
          unitPrice: 15,
        }],
      })
      const result = validateOrderReadyForRouting(order)
      expect(result.ready).toBe(true)
    })
  })

  // =========================================================================
  // Pipeline Status
  // =========================================================================
  describe('getPipelineStatus', () => {
    it('shows Design Upload when no designs', () => {
      const order = makePODOrder({
        items: [{ productId: 1, productName: 'Shirt', quantity: 1, designAssets: [], unitPrice: 10 }],
      })
      const status = getPipelineStatus(order)
      expect(status.stage).toBe('Design Upload')
      expect(status.progress).toBe(0)
    })

    it('shows Design Approval when designs pending', () => {
      const order = makePODOrder({
        items: [{
          productId: 1, productName: 'Shirt', quantity: 1,
          designAssets: [
            makeDesignAsset({ status: 'approved' }),
            makeDesignAsset({ status: 'pending_approval' }),
          ],
          unitPrice: 10,
        }],
      })
      const status = getPipelineStatus(order)
      expect(status.stage).toBe('Design Approval')
      expect(status.progress).toBeGreaterThan(15)
      expect(status.progress).toBeLessThan(30)
    })

    it('shows Ready to Route when all approved', () => {
      const order = makePODOrder()
      const status = getPipelineStatus(order)
      expect(status.stage).toBe('Ready to Route')
      expect(status.progress).toBe(35)
    })

    it('shows fulfillment stages correctly', () => {
      const order = makePODOrder()
      expect(getPipelineStatus(order, 'pending_match').stage).toBe('Finding Vendor')
      expect(getPipelineStatus(order, 'matched').stage).toBe('Vendor Matched')
      expect(getPipelineStatus(order, 'accepted').stage).toBe('Vendor Accepted')
      expect(getPipelineStatus(order, 'in_production').stage).toBe('In Production')
      expect(getPipelineStatus(order, 'shipped').stage).toBe('Shipped')
      expect(getPipelineStatus(order, 'delivered').stage).toBe('Delivered')
    })

    it('shows 100% progress when delivered', () => {
      const order = makePODOrder()
      expect(getPipelineStatus(order, 'delivered').progress).toBe(100)
    })
  })

  describe('serializePipelineStatus', () => {
    it('includes progress bar', () => {
      const order = makePODOrder()
      const status = getPipelineStatus(order, 'in_production')
      const text = serializePipelineStatus(status)
      expect(text).toContain('█')
      expect(text).toContain('░')
      expect(text).toContain('75%')
    })

    it('includes stage name', () => {
      const order = makePODOrder()
      const status = getPipelineStatus(order, 'shipped')
      const text = serializePipelineStatus(status)
      expect(text).toContain('Shipped')
    })

    it('includes next step', () => {
      const order = makePODOrder()
      const status = getPipelineStatus(order, 'shipped')
      const text = serializePipelineStatus(status)
      expect(text).toContain('on its way')
    })
  })

  // =========================================================================
  // Constants Verification
  // =========================================================================
  describe('Constants', () => {
    it('MIN_PRINT_DPI is 150', () => {
      expect(MIN_PRINT_DPI).toBe(150)
    })

    it('RECOMMENDED_DPI is 300', () => {
      expect(RECOMMENDED_DPI).toBe(300)
    })

    it('MAX_FILE_SIZE is 20MB', () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(20 * 1024 * 1024)
    })

    it('supports all expected print methods', () => {
      const methods: PrintMethod[] = [
        'screen_print', 'dtg', 'sublimation', 'heat_transfer',
        'embroidery', 'vinyl_cut', 'laser_engrave', 'uv_print',
      ]
      for (const method of methods) {
        expect(PRINT_METHOD_LABELS[method]).toBeDefined()
      }
    })

    it('supports all expected surfaces', () => {
      const surfaces: ProductSurface[] = [
        'front', 'back', 'left_sleeve', 'right_sleeve',
        'pocket', 'all_over', 'label', 'custom',
      ]
      for (const surface of surfaces) {
        expect(SURFACE_LABELS[surface]).toBeDefined()
      }
    })

    it('attached_to_order is terminal state', () => {
      expect(VALID_DESIGN_TRANSITIONS.attached_to_order).toEqual([])
    })
  })
})
