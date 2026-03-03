/**
 * Zod validation schemas for LEO mutation/outbound tools.
 *
 * These schemas provide a safety net between the LLM-generated tool inputs
 * and the handler functions. They catch malformed or missing fields before
 * the handler runs, returning a descriptive error so the LLM can self-correct.
 *
 * Only the 8 mutation/outbound tools are validated here — read-only query
 * tools are low-risk and don't need pre-validation.
 *
 * @see src/utilities/leo-data-tools.ts — executeToolCall() uses these
 */
import { z } from 'zod'

// ─── Schema Definitions ─────────────────────────────────────

export const sendEmailSchema = z.object({
  to: z.string().min(1, 'Recipient email address (to) is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Email body is required'),
  replyTo: z.string().optional(),
})

export const sendWhatsAppSchema = z.object({
  to: z.string().min(1, 'Recipient phone number (to) is required'),
  text: z.string().optional(),
  templateName: z.string().optional(),
  templateParameters: z.array(z.string()).optional(),
}).refine(
  (data) => data.text || data.templateName,
  { message: 'Either text or templateName is required' },
)

export const sendTelegramSchema = z.object({
  chatId: z.string().min(1, 'chatId is required'),
  text: z.string().min(1, 'text is required'),
})

export const sendSmsSchema = z.object({
  to: z.string().min(1, 'Recipient phone number (to) is required'),
  body: z.string().min(1, 'Message body is required').max(1600, 'SMS body must be 1600 characters or fewer'),
})

export const createProductSchema = z.object({
  title: z.string().min(1, 'Product title is required'),
  price: z.number().positive('Price must be greater than 0'),
  description: z.string().optional(),
  category: z.string().optional(),
  inventory: z.number().int().min(0).optional(),
  status: z.enum(['draft', 'published']).optional(),
})

export const updateProductSchema = z.object({
  productId: z.number().positive('productId is required'),
  title: z.string().min(1).optional(),
  price: z.number().positive('Price must be greater than 0').optional(),
  description: z.string().optional(),
  inventory: z.number().int().min(0).optional(),
  status: z.enum(['draft', 'published']).optional(),
})

export const createBookingSchema = z.object({
  title: z.string().min(1, 'Booking title is required'),
  bookingType: z.enum(['service', 'consultation', 'rental', 'class', 'event', 'custom']),
  startDateTime: z.string().min(1, 'startDateTime is required'),
  providerId: z.number().optional(),
  duration: z.number().positive().optional(),
  description: z.string().optional(),
})

export const createPostSchema = z.object({
  title: z.string().min(1, 'Post title is required'),
  content: z.string().optional(),
  excerpt: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  categories: z.array(z.string()).optional(),
})

/** Domain format validator — rejects IPs, localhost, and invalid chars */
const safeDomain = z
  .string()
  .min(1)
  .max(253, 'Domain too long')
  .regex(
    /^(?!localhost)(?!\d+\.\d+\.\d+\.\d+$)[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/,
    'Must be a valid domain (e.g., "partner.angelos.app"). No IPs or localhost.',
  )

/** URL safety validator — blocks javascript:, data:, and vbscript: URIs */
const safeUrl = z
  .string()
  .min(1)
  .max(2000, 'URL too long')
  .refine(
    (url) => !/^(javascript|data|vbscript):/i.test(url.trim()),
    'Dangerous URL protocol detected (javascript:, data:, vbscript: are not allowed)',
  )

export const sendFederationMessageSchema = z.object({
  peerDomain: safeDomain,
  message: z.string().min(1, 'Message text is required').max(10_000, 'Message must be under 10 000 characters'),
  conversationId: z.string().optional(),
})

// ─── Sprint 36: Federation Broadcast & Handoff ──────────────

export const broadcastFederationMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(10_000, 'Message must be under 10 000 characters'),
  filter: z.enum(['all_active', 'vouched_or_higher', 'full_trust_only']).optional(),
  conversationId: z.string().optional(),
})

export const leoHandoffSchema = z.object({
  targetDomain: safeDomain,
  handoffType: z.enum(['provisioning_welcome', 'delegation', 'escalation', 'collaboration']),
  context: z.string().min(1, 'Context is required').max(5_000, 'Context must be under 5 000 characters'),
  userId: z.number().optional(),
  userName: z.string().max(200).optional(),
  userEmail: z.string().email('Must be a valid email').optional(),
  returnTo: safeUrl.optional(),
})

// ─── Sprint 36: Generic Payload CRUD Schemas ────────────────

/**
 * Whitelist of collections Leo can access via generic CRUD tools.
 *
 * EXCLUDED (sensitive):
 *   users, tenants, processed-stripe-events, connectors (API keys!),
 *   agent-configs, federation-audit-log, orders, payments, sessions
 */
export const PAYLOAD_CRUD_ALLOWED_COLLECTIONS = new Set([
  'header',
  'footer',
  'categories',
  'contacts',
  'workflows',
  'spaces',
  'channels',
  'events',
  'event-registrations',
  'pages',
  'posts',
  'products',
  'bookings',
  'availability',
  'reviews',
  'comments',
  'media',
  'endeavors',
  'quests',
  'quest-participations',
  'board-members',
  'projects',
  'street-signs',
  'holon-capabilities',
  'space-memberships',
  'media-meta',
])

export const payloadFindSchema = z.object({
  collection: z.string().min(1, 'collection slug is required'),
  where: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  sort: z.string().optional(),
  depth: z.number().int().min(0).max(3).optional(),
})

export const payloadUpdateSchema = z.object({
  collection: z.string().min(1, 'collection slug is required'),
  id: z.number().positive('document id is required'),
  data: z.record(z.string(), z.unknown()).refine((d) => Object.keys(d).length > 0, 'data must not be empty'),
})

export const payloadCreateSchema = z.object({
  collection: z.string().min(1, 'collection slug is required'),
  data: z.record(z.string(), z.unknown()).refine((d) => Object.keys(d).length > 0, 'data must not be empty'),
})

export const payloadDeleteSchema = z.object({
  collection: z.string().min(1, 'collection slug is required'),
  id: z.number().positive('document id is required'),
})

export const updateNavigationSchema = z.object({
  target: z.enum(['header', 'footer']),
  action: z.enum(['add', 'remove', 'reorder', 'replace_all']),
  label: z.string().max(100, 'Label must be under 100 characters').optional(),
  url: safeUrl.optional(),
  pageId: z.number().optional(),
  newTab: z.boolean().optional(),
  navItems: z.array(z.record(z.string(), z.unknown())).max(6, 'Maximum 6 nav items allowed').optional(),
})

// ─── Schema Registry ────────────────────────────────────────

/**
 * Map of tool names to their Zod schemas.
 * Only includes mutation/outbound tools that benefit from pre-validation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TOOL_INPUT_SCHEMAS: Record<string, z.ZodType<any>> = {
  send_email: sendEmailSchema,
  send_whatsapp: sendWhatsAppSchema,
  send_telegram: sendTelegramSchema,
  send_sms: sendSmsSchema,
  create_product: createProductSchema,
  update_product: updateProductSchema,
  create_booking: createBookingSchema,
  create_post: createPostSchema,
  send_federation_message: sendFederationMessageSchema,
  // Sprint 36: Federation Broadcast & Handoff
  broadcast_federation_message: broadcastFederationMessageSchema,
  leo_handoff: leoHandoffSchema,
  // Sprint 36: Generic Payload CRUD
  payload_find: payloadFindSchema,
  payload_update: payloadUpdateSchema,
  payload_create: payloadCreateSchema,
  payload_delete: payloadDeleteSchema,
  update_navigation: updateNavigationSchema,
}

/**
 * Validate tool input against its schema.
 * Returns null if valid or no schema exists, error message string if invalid.
 */
export function validateToolInput(
  toolName: string,
  input: Record<string, unknown>,
): string | null {
  const schema = TOOL_INPUT_SCHEMAS[toolName]
  if (!schema) return null // No schema = no validation (read-only tools)

  const result = schema.safeParse(input)
  if (result.success) return null

  // Build a descriptive error message the LLM can understand and self-correct
  const issues = result.error.issues
    .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')

  return `Input validation failed for ${toolName}:\n${issues}\n\nPlease fix the inputs and try again.`
}
