/**
 * Print-on-Demand Engine — Edge-Case Tests (Sprint 36 D2)
 *
 * Boundary tests for design validation, resolution adequacy, embroidery limits,
 * vendor packaging with mixed statuses, and pipeline progress calculations.
 *
 * Uses the project pattern of re-implementing pure logic
 * to avoid Payload-coupled imports.
 *
 * @see src/utilities/printOnDemandEngine.ts
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DesignStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'attached_to_order'

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
  surface: string
  printMethod: string
  widthInches: number
  heightInches: number
  colors?: number
}

interface DesignAsset {
  designFile: DesignFile
  printSpec: PrintSpecification
  status: DesignStatus
  approvedAt?: string
  approvedBy?: string
}

interface PODOrderItem {
  productId: number
  productName: string
  variant: string
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
  vendorId: number
  vendorName: string
  orderId: string
  items: {
    productName: string
    variant: string
    quantity: number
    designs: {
      filename: string
      format: string
      url: string
      printSpec: PrintSpecification
    }[]
  }[]
  totalItems: number
  totalDesigns: number
  instructions: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_PRINT_DPI = 150
const RECOMMENDED_DPI = 300
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const VALID_FORMATS = ['png', 'svg', 'pdf', 'tiff', 'ai', 'eps', 'psd']
const MAX_EMBROIDERY_AREA_SQ_IN = 100

// ---------------------------------------------------------------------------
// Design Status Machine
// ---------------------------------------------------------------------------

const DESIGN_TRANSITIONS: Record<DesignStatus, DesignStatus[]> = {
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

  if (!VALID_FORMATS.includes(file.format.toLowerCase())) {
    errors.push(`Unsupported format: ${file.format}. Supported: ${VALID_FORMATS.join(', ')}`)
  }
  if (file.dpi < MIN_PRINT_DPI) {
    errors.push(`DPI too low: ${file.dpi}. Minimum: ${MIN_PRINT_DPI}`)
  } else if (file.dpi < RECOMMENDED_DPI) {
    warnings.push(`DPI below recommended: ${file.dpi}. Recommended: ${RECOMMENDED_DPI}`)
  }
  if (file.fileSizeBytes > MAX_FILE_SIZE) {
    errors.push(`File too large: ${(file.fileSizeBytes / 1024 / 1024).toFixed(1)}MB. Max: ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }
  if (file.widthPx <= 0 || file.heightPx <= 0) {
    errors.push('Image dimensions must be greater than 0')
  }

  return { valid: errors.length === 0, warnings, errors }
}

function validatePrintSpec(
  spec: PrintSpecification,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (spec.widthInches <= 0 || spec.heightInches <= 0) {
    errors.push('Print dimensions must be greater than 0')
  }
  if (spec.colors !== undefined && spec.colors < 1) {
    errors.push('Color count must be at least 1')
  }
  if (spec.printMethod === 'embroidery') {
    const area = spec.widthInches * spec.heightInches
    if (area > MAX_EMBROIDERY_AREA_SQ_IN) {
      errors.push(`Embroidery area too large: ${area.toFixed(1)} sq in. Max: ${MAX_EMBROIDERY_AREA_SQ_IN} sq in`)
    }
  }
  return { valid: errors.length === 0, errors }
}

function validateDesignTransition(from: DesignStatus, to: DesignStatus): boolean {
  return DESIGN_TRANSITIONS[from]?.includes(to) ?? false
}

function calculatePrintSize(
  widthPx: number, heightPx: number, dpi: number,
): { widthInches: number; heightInches: number } {
  return {
    widthInches: Math.round((widthPx / dpi) * 100) / 100,
    heightInches: Math.round((heightPx / dpi) * 100) / 100,
  }
}

function hasAdequateResolution(
  file: Pick<DesignFile, 'widthPx' | 'heightPx' | 'dpi'>,
  spec: PrintSpecification,
): { adequate: boolean; effectiveDpi: number; minimumDpi: number } {
  const effectiveDpiW = file.widthPx / spec.widthInches
  const effectiveDpiH = file.heightPx / spec.heightInches
  const effectiveDpi = Math.round(Math.min(effectiveDpiW, effectiveDpiH))
  return { adequate: effectiveDpi >= MIN_PRINT_DPI, effectiveDpi, minimumDpi: MIN_PRINT_DPI }
}

function assembleVendorPackage(
  order: PODOrder, vendorId: number, vendorName: string,
): VendorPackage {
  const items = order.items.map((item) => {
    const approvedDesigns = item.designAssets
      .filter((d) => d.status === 'approved' || d.status === 'attached_to_order')
    return {
      productName: item.productName,
      variant: item.variant,
      quantity: item.quantity,
      designs: approvedDesigns.map((d) => ({
        filename: d.designFile.filename,
        format: d.designFile.format,
        url: d.designFile.url,
        printSpec: d.printSpec,
      })),
    }
  })
  const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0)
  const totalDesigns = items.reduce((sum, i) => sum + i.designs.length, 0)
  const instructions = items.map((i) =>
    `${i.productName} (${i.variant}) x${i.quantity}: ${i.designs.length} design(s)`,
  ).join('\n')
  return {
    vendorId, vendorName, orderId: order.orderId, items,
    totalItems, totalDesigns, instructions, createdAt: new Date().toISOString(),
  }
}

function validateOrderReadyForRouting(
  order: PODOrder,
): { ready: boolean; errors: string[] } {
  const errors: string[] = []
  if (order.items.length === 0) errors.push('Order has no items')
  for (const item of order.items) {
    if (item.designAssets.length === 0) {
      errors.push(`Item "${item.productName}" has no design assets`)
    }
    const unapproved = item.designAssets.filter(
      (d) => d.status !== 'approved' && d.status !== 'attached_to_order',
    )
    if (unapproved.length > 0) {
      errors.push(`Item "${item.productName}" has ${unapproved.length} unapproved design(s)`)
    }
  }
  return { ready: errors.length === 0, errors }
}

function getPipelineStatus(
  order: PODOrder, fulfillmentStatus?: string,
): { stage: string; progress: number; nextStep: string } {
  const allDesigns = order.items.flatMap((i) => i.designAssets)
  if (allDesigns.length === 0) return { stage: 'Design Upload', progress: 0, nextStep: 'Upload design files' }
  const approved = allDesigns.filter((d) => d.status === 'approved' || d.status === 'attached_to_order')
  if (approved.length < allDesigns.length) {
    const pct = 15 + (approved.length / allDesigns.length) * 15
    return { stage: 'Design Approval', progress: Math.round(pct), nextStep: 'Approve remaining designs' }
  }
  if (!fulfillmentStatus) return { stage: 'Ready to Route', progress: 35, nextStep: 'Route to vendor' }
  const stages: Record<string, { stage: string; progress: number; nextStep: string }> = {
    pending_match: { stage: 'Vendor Matching', progress: 40, nextStep: 'Wait for vendor assignment' },
    matched: { stage: 'Vendor Assigned', progress: 50, nextStep: 'Wait for production start' },
    in_production: { stage: 'In Production', progress: 60, nextStep: 'Wait for production completion' },
    quality_check: { stage: 'Quality Check', progress: 75, nextStep: 'Pass quality inspection' },
    shipped: { stage: 'Shipped', progress: 90, nextStep: 'Track delivery' },
    delivered: { stage: 'Delivered', progress: 100, nextStep: 'Complete' },
  }
  return stages[fulfillmentStatus] || { stage: 'Unknown', progress: 0, nextStep: 'Contact support' }
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeDesignFile(overrides?: Partial<DesignFile>): DesignFile {
  return {
    id: 'design_1', mediaId: 101, filename: 'angel-wings-front.png', format: 'png',
    widthPx: 3000, heightPx: 3600, dpi: 300, fileSizeBytes: 2 * 1024 * 1024,
    url: 'https://cdn.angel-os.com/designs/angel-wings-front.png', createdAt: '2026-02-15T10:00:00Z',
    ...overrides,
  }
}

function makePrintSpec(overrides?: Partial<PrintSpecification>): PrintSpecification {
  return { surface: 'front', printMethod: 'screen_print', widthInches: 10, heightInches: 12, colors: 4, ...overrides }
}

function makeDesignAsset(overrides?: Partial<DesignAsset>): DesignAsset {
  return {
    designFile: makeDesignFile(), printSpec: makePrintSpec(), status: 'approved',
    approvedAt: '2026-02-16T10:00:00Z', approvedBy: 'admin', ...overrides,
  }
}

function makePODOrder(overrides?: Partial<PODOrder>): PODOrder {
  return {
    orderId: 'order_pod_001', customerId: 42,
    items: [{ productId: 1, productName: 'Custom T-Shirt', variant: 'XL Black', quantity: 25, designAssets: [makeDesignAsset()], unitPrice: 15.00 }],
    totalPrice: 375.00, createdAt: '2026-02-17T12:00:00Z', ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Edge-Case Tests
// ---------------------------------------------------------------------------

describe('Print-on-Demand Engine — Edge Cases', () => {
  // =========================================================================
  // 1. DPI at Exact Boundaries
  // =========================================================================
  describe('DPI boundary conditions', () => {
    it('accepts 150 DPI as valid but warns (below recommended 300)', () => {
      const result = validateDesignFile({ format: 'png', dpi: 150, fileSizeBytes: 1024, widthPx: 1000, heightPx: 1000 })
      expect(result.valid).toBe(true)
      // 150 >= MIN_PRINT_DPI(150) so valid, but 150 < RECOMMENDED_DPI(300) → warning
      expect(result.warnings.length).toBeGreaterThanOrEqual(1)
      expect(result.warnings[0]).toContain('Recommended')
    })

    it('rejects at DPI 149 (below minimum)', () => {
      const result = validateDesignFile({ format: 'png', dpi: 149, fileSizeBytes: 1024, widthPx: 1000, heightPx: 1000 })
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('DPI too low')
    })

    it('accepts 300 DPI with no warnings', () => {
      const result = validateDesignFile({ format: 'png', dpi: 300, fileSizeBytes: 1024, widthPx: 1000, heightPx: 1000 })
      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })
  })

  // =========================================================================
  // 2. File Size at Exact MAX_FILE_SIZE Boundary
  // =========================================================================
  describe('file size boundary', () => {
    it('accepts file at exactly MAX_FILE_SIZE (20MB)', () => {
      const result = validateDesignFile({ format: 'png', dpi: 300, fileSizeBytes: MAX_FILE_SIZE, widthPx: 1000, heightPx: 1000 })
      expect(result.valid).toBe(true)
    })

    it('rejects file at MAX_FILE_SIZE + 1 byte', () => {
      const result = validateDesignFile({ format: 'png', dpi: 300, fileSizeBytes: MAX_FILE_SIZE + 1, widthPx: 1000, heightPx: 1000 })
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('File too large')
    })
  })

  // =========================================================================
  // 3. Tiny Dimensions — Resolution Inadequacy
  // =========================================================================
  describe('tiny image dimensions', () => {
    it('validates 1x1px image as valid file (positive dimensions)', () => {
      const result = validateDesignFile({ format: 'png', dpi: 300, fileSizeBytes: 100, widthPx: 1, heightPx: 1 })
      expect(result.valid).toBe(true)
    })

    it('1x1px image fails resolution check for any real print size', () => {
      const result = hasAdequateResolution(
        { widthPx: 1, heightPx: 1, dpi: 300 },
        { surface: 'front', printMethod: 'screen_print', widthInches: 10, heightInches: 10 },
      )
      expect(result.adequate).toBe(false)
      expect(result.effectiveDpi).toBeLessThan(1)
    })
  })

  // =========================================================================
  // 4. Embroidery Area at Exact 100 sq in Boundary
  // =========================================================================
  describe('embroidery area boundary', () => {
    it('accepts embroidery at exactly 100 sq in (10x10)', () => {
      const result = validatePrintSpec({ surface: 'front', printMethod: 'embroidery', widthInches: 10, heightInches: 10 })
      expect(result.valid).toBe(true)
    })

    it('rejects embroidery at 100.01 sq in', () => {
      const result = validatePrintSpec({ surface: 'front', printMethod: 'embroidery', widthInches: 10.001, heightInches: 10 })
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Embroidery area too large')
    })

    it('non-embroidery ignores area limit', () => {
      const result = validatePrintSpec({ surface: 'front', printMethod: 'screen_print', widthInches: 50, heightInches: 50 })
      expect(result.valid).toBe(true)
    })
  })

  // =========================================================================
  // 5. Format Case Sensitivity
  // =========================================================================
  describe('format case sensitivity', () => {
    it('accepts uppercase format "PNG"', () => {
      const result = validateDesignFile({ format: 'PNG', dpi: 300, fileSizeBytes: 1024, widthPx: 1000, heightPx: 1000 })
      expect(result.valid).toBe(true)
    })

    it('accepts mixed-case format "Tiff"', () => {
      const result = validateDesignFile({ format: 'Tiff', dpi: 300, fileSizeBytes: 1024, widthPx: 1000, heightPx: 1000 })
      expect(result.valid).toBe(true)
    })
  })

  // =========================================================================
  // 6. Vendor Package with Zero Approved Designs
  // =========================================================================
  describe('vendor package with unapproved designs', () => {
    it('includes item but no designs when all designs are draft', () => {
      const order = makePODOrder({
        items: [{
          productId: 1, productName: 'T-Shirt', variant: 'M Red', quantity: 10,
          designAssets: [makeDesignAsset({ status: 'draft' }), makeDesignAsset({ status: 'rejected' })],
          unitPrice: 10,
        }],
      })
      const pkg = assembleVendorPackage(order, 1, 'PrintVendor')
      expect(pkg.items).toHaveLength(1)
      expect(pkg.items[0].designs).toHaveLength(0)
      expect(pkg.totalDesigns).toBe(0)
    })

    it('mixes approved and unapproved across multiple items', () => {
      const order = makePODOrder({
        items: [
          { productId: 1, productName: 'Shirt', variant: 'S', quantity: 5, designAssets: [makeDesignAsset({ status: 'approved' })], unitPrice: 10 },
          { productId: 2, productName: 'Hat', variant: 'OS', quantity: 3, designAssets: [makeDesignAsset({ status: 'draft' })], unitPrice: 8 },
        ],
      })
      const pkg = assembleVendorPackage(order, 1, 'Vendor')
      expect(pkg.totalDesigns).toBe(1) // Only the shirt has an approved design
    })
  })

  // =========================================================================
  // 7. Pipeline Progress with Fractional Approval
  // =========================================================================
  describe('pipeline progress fractional approval', () => {
    it('calculates progress for 1 of 3 approved (33%)', () => {
      const order = makePODOrder({
        items: [{
          productId: 1, productName: 'Shirt', variant: 'M', quantity: 1,
          designAssets: [
            makeDesignAsset({ status: 'approved' }),
            makeDesignAsset({ status: 'draft' }),
            makeDesignAsset({ status: 'pending_approval' }),
          ],
          unitPrice: 10,
        }],
      })
      const status = getPipelineStatus(order)
      expect(status.stage).toBe('Design Approval')
      // 15 + (1/3)*15 = 15 + 5 = 20
      expect(status.progress).toBe(20)
    })

    it('calculates progress for 2 of 3 approved (67%)', () => {
      const order = makePODOrder({
        items: [{
          productId: 1, productName: 'Shirt', variant: 'M', quantity: 1,
          designAssets: [
            makeDesignAsset({ status: 'approved' }),
            makeDesignAsset({ status: 'approved' }),
            makeDesignAsset({ status: 'draft' }),
          ],
          unitPrice: 10,
        }],
      })
      const status = getPipelineStatus(order)
      // 15 + (2/3)*15 = 15 + 10 = 25
      expect(status.progress).toBe(25)
    })
  })

  // =========================================================================
  // 8. Order Routing Readiness — Multiple Error Types
  // =========================================================================
  describe('order routing readiness with multiple errors', () => {
    it('reports errors for empty items', () => {
      const order = makePODOrder({ items: [] })
      const result = validateOrderReadyForRouting(order)
      expect(result.ready).toBe(false)
      expect(result.errors).toContain('Order has no items')
    })

    it('reports both missing and unapproved design errors', () => {
      const order = makePODOrder({
        items: [
          { productId: 1, productName: 'Shirt', variant: 'S', quantity: 1, designAssets: [], unitPrice: 10 },
          { productId: 2, productName: 'Hat', variant: 'OS', quantity: 1, designAssets: [makeDesignAsset({ status: 'draft' })], unitPrice: 8 },
        ],
      })
      const result = validateOrderReadyForRouting(order)
      expect(result.ready).toBe(false)
      expect(result.errors.length).toBe(2) // missing + unapproved
    })
  })
})
