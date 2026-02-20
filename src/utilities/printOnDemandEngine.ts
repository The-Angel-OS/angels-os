/**
 * Print-on-Demand Pipeline Engine — Sprint 5
 *
 * Pure utility for managing the full POD workflow:
 *   customer generates design → design approved → order created
 *   → order routed to vendor with designAssets → vendor downloads
 *   → production → shipping → delivery
 *
 * Zero Payload imports — fully testable and usable in edge functions.
 *
 * @see src/collections/Orders/index.ts — designAssets field on fulfillment
 * @see tests/unit/utilities/printOnDemandEngine.test.ts
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DesignStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'attached_to_order'

export type ProductSurface =
  | 'front'
  | 'back'
  | 'left_sleeve'
  | 'right_sleeve'
  | 'pocket'
  | 'all_over'
  | 'label'
  | 'custom'

export type PrintMethod =
  | 'screen_print'
  | 'dtg'          // Direct to garment
  | 'sublimation'
  | 'heat_transfer'
  | 'embroidery'
  | 'vinyl_cut'
  | 'laser_engrave'
  | 'uv_print'

export interface DesignFile {
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

export interface PrintSpecification {
  surface: ProductSurface
  printMethod: PrintMethod
  widthInches: number
  heightInches: number
  colors?: number
  notes?: string
}

export interface DesignAsset {
  designFile: DesignFile
  printSpec: PrintSpecification
  status: DesignStatus
  approvedAt?: string
  approvedBy?: string
  rejectionReason?: string
}

export interface PODOrderItem {
  productId: number
  productName: string
  variant?: string
  quantity: number
  designAssets: DesignAsset[]
  unitPrice: number
}

export interface PODOrder {
  orderId: string
  customerId: number
  items: PODOrderItem[]
  totalPrice: number
  createdAt: string
}

export interface VendorPackage {
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

/** Minimum DPI for print-quality designs. */
export const MIN_PRINT_DPI = 150

/** Recommended DPI for high-quality print. */
export const RECOMMENDED_DPI = 300

/** Maximum design file size (20MB). */
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

/** Supported print file formats. */
export const SUPPORTED_FORMATS = ['png', 'svg', 'pdf', 'tiff', 'ai', 'eps', 'psd']

/** Print method labels. */
export const PRINT_METHOD_LABELS: Record<PrintMethod, string> = {
  screen_print: 'Screen Print',
  dtg: 'Direct to Garment (DTG)',
  sublimation: 'Sublimation',
  heat_transfer: 'Heat Transfer',
  embroidery: 'Embroidery',
  vinyl_cut: 'Vinyl Cut',
  laser_engrave: 'Laser Engraving',
  uv_print: 'UV Print',
}

/** Surface labels. */
export const SURFACE_LABELS: Record<ProductSurface, string> = {
  front: 'Front',
  back: 'Back',
  left_sleeve: 'Left Sleeve',
  right_sleeve: 'Right Sleeve',
  pocket: 'Pocket',
  all_over: 'All Over',
  label: 'Label',
  custom: 'Custom Placement',
}

/** Valid status transitions for designs. */
export const VALID_DESIGN_TRANSITIONS: Record<DesignStatus, DesignStatus[]> = {
  draft: ['pending_approval'],
  pending_approval: ['approved', 'rejected'],
  approved: ['attached_to_order'],
  rejected: ['draft'], // Can revise and resubmit
  attached_to_order: [], // Terminal
}

// ---------------------------------------------------------------------------
// Design Validation
// ---------------------------------------------------------------------------

/** Validate a design file meets print requirements. */
export function validateDesignFile(
  file: Pick<DesignFile, 'format' | 'dpi' | 'fileSizeBytes' | 'widthPx' | 'heightPx'>,
): { valid: boolean; warnings: string[]; errors: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  // Format check
  if (!SUPPORTED_FORMATS.includes(file.format.toLowerCase())) {
    errors.push(
      `Unsupported format: ${file.format}. Supported: ${SUPPORTED_FORMATS.join(', ')}`,
    )
  }

  // DPI check
  if (file.dpi < MIN_PRINT_DPI) {
    errors.push(
      `DPI too low: ${file.dpi}. Minimum for print: ${MIN_PRINT_DPI} DPI.`,
    )
  } else if (file.dpi < RECOMMENDED_DPI) {
    warnings.push(
      `DPI is ${file.dpi}. Recommended: ${RECOMMENDED_DPI} DPI for best quality.`,
    )
  }

  // File size check
  if (file.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    errors.push(
      `File too large: ${(file.fileSizeBytes / 1024 / 1024).toFixed(1)}MB. Maximum: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`,
    )
  }

  // Dimension check
  if (file.widthPx <= 0 || file.heightPx <= 0) {
    errors.push('Design dimensions must be positive.')
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  }
}

/** Validate a print specification. */
export function validatePrintSpec(
  spec: PrintSpecification,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (spec.widthInches <= 0 || spec.heightInches <= 0) {
    errors.push('Print dimensions must be positive.')
  }

  if (spec.colors !== undefined && spec.colors < 1) {
    errors.push('Color count must be at least 1.')
  }

  // Embroidery has stitch count limits
  if (spec.printMethod === 'embroidery' && spec.widthInches * spec.heightInches > 100) {
    errors.push('Embroidery area too large. Maximum practical area: 100 sq inches.')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/** Validate a design status transition. */
export function validateDesignTransition(
  from: DesignStatus,
  to: DesignStatus,
): boolean {
  return VALID_DESIGN_TRANSITIONS[from]?.includes(to) ?? false
}

// ---------------------------------------------------------------------------
// DPI & Dimension Calculations
// ---------------------------------------------------------------------------

/** Calculate the print size in inches from pixel dimensions and DPI. */
export function calculatePrintSize(
  widthPx: number,
  heightPx: number,
  dpi: number,
): { widthInches: number; heightInches: number } {
  return {
    widthInches: Math.round((widthPx / dpi) * 100) / 100,
    heightInches: Math.round((heightPx / dpi) * 100) / 100,
  }
}

/** Calculate minimum pixel dimensions for a target print size and DPI. */
export function calculateMinPixels(
  widthInches: number,
  heightInches: number,
  dpi: number = RECOMMENDED_DPI,
): { widthPx: number; heightPx: number } {
  return {
    widthPx: Math.ceil(widthInches * dpi),
    heightPx: Math.ceil(heightInches * dpi),
  }
}

/** Check if a design file has sufficient resolution for a print specification. */
export function hasAdequateResolution(
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

// ---------------------------------------------------------------------------
// Vendor Package Assembly
// ---------------------------------------------------------------------------

/** Assemble a vendor fulfillment package from a POD order. */
export function assembleVendorPackage(
  order: PODOrder,
  vendorId: number,
  vendorName: string,
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

  const instructions = generateVendorInstructions(items, totalItems, totalDesigns)

  return {
    orderId: order.orderId,
    vendorId,
    vendorName,
    items,
    totalItems,
    totalDesigns,
    instructions,
  }
}

/** Generate vendor fulfillment instructions. */
function generateVendorInstructions(
  items: VendorPackage['items'],
  totalItems: number,
  totalDesigns: number,
): string {
  const lines = [
    `Fulfillment Package: ${totalItems} item(s), ${totalDesigns} design file(s)`,
    '',
  ]

  for (const item of items) {
    lines.push(`${item.productName}${item.variant ? ` (${item.variant})` : ''} × ${item.quantity}`)
    for (const design of item.designs) {
      lines.push(
        `  → ${SURFACE_LABELS[design.surface]}: ${PRINT_METHOD_LABELS[design.printMethod]}`,
      )
      lines.push(
        `    File: ${design.filename} (${design.dpi} DPI, ${design.widthInches}×${design.heightInches} in)`,
      )
      if (design.colors) {
        lines.push(`    Colors: ${design.colors}`)
      }
      if (design.notes) {
        lines.push(`    Notes: ${design.notes}`)
      }
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Pipeline Validation
// ---------------------------------------------------------------------------

/** Validate that a POD order is ready for routing (all designs approved). */
export function validateOrderReadyForRouting(
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
      errors.push(
        `${item.productName}: ${unapproved.length} design(s) not yet approved.`,
      )
    }
  }

  return {
    ready: errors.length === 0,
    errors,
  }
}

/** Calculate the full pipeline status of a POD order. */
export function getPipelineStatus(
  order: PODOrder,
  fulfillmentStatus?: string,
): {
  stage: string
  progress: number
  nextStep: string
} {
  // Check design approval
  const allDesigns = order.items.flatMap((i) => i.designAssets)
  const approvedCount = allDesigns.filter(
    (d) => d.status === 'approved' || d.status === 'attached_to_order',
  ).length
  const totalDesigns = allDesigns.length

  if (totalDesigns === 0) {
    return {
      stage: 'Design Upload',
      progress: 0,
      nextStep: 'Upload design files for your products.',
    }
  }

  if (approvedCount < totalDesigns) {
    return {
      stage: 'Design Approval',
      progress: 15 + (approvedCount / totalDesigns) * 15,
      nextStep: `${totalDesigns - approvedCount} design(s) pending approval.`,
    }
  }

  // All designs approved — check fulfillment
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

  return {
    stage: 'Ready to Route',
    progress: 35,
    nextStep: 'All designs approved. Ready to find a vendor.',
  }
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Format a vendor package for LEO responses. */
export function serializeVendorPackage(pkg: VendorPackage): string {
  const lines = [
    `Order ${pkg.orderId} → ${pkg.vendorName}`,
    `${pkg.totalItems} item(s), ${pkg.totalDesigns} design file(s)`,
    '',
    ...pkg.items.map((item) => {
      const designList = item.designs.map(
        (d) => `  ${SURFACE_LABELS[d.surface]}: ${d.filename} (${d.printMethod})`,
      )
      return [
        `${item.productName}${item.variant ? ` [${item.variant}]` : ''} × ${item.quantity}`,
        ...designList,
      ].join('\n')
    }),
  ]
  return lines.join('\n')
}

/** Format a pipeline status for LEO responses. */
export function serializePipelineStatus(status: ReturnType<typeof getPipelineStatus>): string {
  const bar = '█'.repeat(Math.floor(status.progress / 10)) +
    '░'.repeat(10 - Math.floor(status.progress / 10))
  return `${status.stage} [${bar}] ${status.progress}%\n${status.nextStep}`
}
