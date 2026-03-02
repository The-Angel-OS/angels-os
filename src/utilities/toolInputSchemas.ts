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
