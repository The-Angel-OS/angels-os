/**
 * Workflow runner – executes channel workflows on messages.
 * Phase 2 scaffolding: supports message attachments, runs simple workflows
 * (e.g. image → product draft). Full vision/LLM integration is future.
 *
 * @see src/collections/Workflows/index.ts
 * @see src/collections/Messages/index.ts (attachments, messageType)
 */
import type { Payload, PayloadRequest } from 'payload'

/**
 * A relationship read off a document is an id at depth 0 and an OBJECT at any
 * greater depth. Reading `doc.tenant` straight into a query worked in tests
 * (depth 0) and produced `tenant_id = NaN` in production, where the afterChange
 * hook sees a populated doc. The failure was swallowed by the hook's catch, so
 * message workflows have simply never run for a tenant.
 */
const relId = (v: unknown): number | undefined => {
  const raw = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export interface WorkflowMessage {
  id: number | string
  content: string
  messageType?: string
  attachments?: Array<{ media: number | string }>
  channel?: string
  space?: number | string
}

export interface WorkflowResult {
  workflowSlug: string
  success: boolean
  output?: Record<string, unknown>
  productDraftId?: number | string
  error?: string
}

/**
 * Run workflows for a message. Finds workflows matching channel type and attachments,
 * executes them, and returns results.
 */
export async function runWorkflowsForMessage(
  payload: Payload,
  message: WorkflowMessage,
  tenantId?: number | string | { id?: number | string } | null,
  opts: { req?: PayloadRequest } = {},
): Promise<WorkflowResult[]> {
  const results: WorkflowResult[] = []
  const { req } = opts
  const tenant = relId(tenantId)

  // Find active workflows that match this message
  const workflows = await payload.find({
    collection: 'workflows',
    where: {
      and: [
        { isActive: { equals: true } },
        { tenant: tenant ? { equals: tenant } : { exists: false } },
      ],
    },
    depth: 0,
    limit: 0, // every matching workflow, not the default page of 10
    overrideAccess: true,
    req,
  })

  for (const workflow of workflows.docs ?? []) {
    const w = workflow as { slug?: string; triggerType?: string; channelTypes?: string[]; attachmentTypes?: string[] }
    if (!w.slug) continue

    // Check trigger
    const hasAttachments = message.attachments && message.attachments.length > 0
    if (w.triggerType === 'message_attachments' && !hasAttachments) continue

    // Run workflow based on slug
    try {
      const result = await runWorkflow(payload, w.slug, message, tenant, req)
      results.push(result)
    } catch (err) {
      results.push({
        workflowSlug: w.slug,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return results
}

async function runWorkflow(
  payload: Payload,
  slug: string,
  message: WorkflowMessage,
  tenantId?: number,
  req?: PayloadRequest,
): Promise<WorkflowResult> {
  switch (slug) {
    case 'inventory_from_image':
      return runInventoryFromImage(payload, message, tenantId, req)
    default:
      return {
        workflowSlug: slug,
        success: false,
        error: `Unknown workflow: ${slug}`,
      }
  }
}

/**
 * Inventory from image – creates a provisional product draft from attached images.
 * Scaffold: creates minimal product draft. Full implementation would use vision model
 * to extract product details (title, category, etc.) and populate fields.
 */
async function runInventoryFromImage(
  payload: Payload,
  message: WorkflowMessage,
  tenantId?: number,
  req?: PayloadRequest,
): Promise<WorkflowResult> {
  const attachments = message.attachments ?? []
  if (attachments.length === 0) {
    return {
      workflowSlug: 'inventory_from_image',
      success: false,
      error: 'No image attachments',
    }
  }

  const firstMediaId = typeof attachments[0].media === 'object' ? (attachments[0].media as { id?: number }).id : attachments[0].media
  if (!firstMediaId) {
    return {
      workflowSlug: 'inventory_from_image',
      success: false,
      error: 'Invalid media attachment',
    }
  }

  const title = `Provisional from message ${message.id} (review required)`
  const slug = `provisional-${message.id}-${Date.now()}`

  const product = await payload.create({
    collection: 'products',
    data: {
      title,
      slug,
      _status: 'draft',
      ...(tenantId && { tenant: tenantId }),
      gallery: [{ image: firstMediaId }],
    } as any,
    overrideAccess: true,
    req,
  })

  return {
    workflowSlug: 'inventory_from_image',
    success: true,
    output: { message: 'Provisional product draft created – review and complete in admin' },
    productDraftId: product.id,
  }
}
