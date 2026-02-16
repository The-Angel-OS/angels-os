/**
 * Universal Message Structure (UMS) — Content Helpers
 *
 * The Messages collection `content` field is now JSON, supporting any data format.
 * These helpers ensure backward compatibility: plain strings are auto-wrapped into
 * the UMS envelope, and existing code can extract text from any content format.
 *
 * ## UMS Content Envelope
 *
 * ```json
 * {
 *   "type": "text",           // Content type discriminator
 *   "text": "Hello!",         // Primary text content
 *   "blocks": [],             // Optional: Payload CMS blocks (products, widgets, forms)
 *   "widgets": [],            // Optional: Dynamic widget configurations
 *   "metrics": {},            // Optional: BI metrics and insights
 *   "actions": [],            // Optional: System action records (ethical assessments, etc.)
 *   "richText": {},           // Optional: Lexical rich text root node
 *   "data": {}                // Optional: Arbitrary structured data (future-proof)
 * }
 * ```
 *
 * ## Content Types
 *
 * - `text`: Plain text message (most common)
 * - `rich_text`: Lexical rich text content
 * - `blocks`: Payload CMS block content (product cards, booking widgets)
 * - `widget`: Dynamic widget trigger
 * - `system_action`: Autonomous AI action record
 * - `form_submission`: Normalized form submittal
 * - `transaction`: E-commerce transaction record
 * - `bi_insight`: Business intelligence metric/recommendation
 *
 * @see Messages/index.ts — Collection definition
 * @see ConversationEngine.ts — LEO message creation
 * @see useChat.ts — Client-side message handling
 */

/**
 * The normalized UMS content envelope.
 * Every message in Angel OS ultimately resolves to this shape.
 */
export interface UMSContent {
  /** Content type discriminator */
  type: 'text' | 'rich_text' | 'blocks' | 'widget' | 'system_action' | 'form_submission' | 'transaction' | 'bi_insight'
  /** Primary text content (always present — even for non-text types, serves as summary/description) */
  text: string
  /** Payload CMS blocks (product displays, booking widgets, etc.) */
  blocks?: Array<Record<string, unknown>>
  /** Dynamic widget configurations */
  widgets?: Array<Record<string, unknown>>
  /** BI metrics and insights */
  metrics?: Record<string, unknown>
  /** System action records (ethical assessments, AI decisions, etc.) */
  actions?: Array<Record<string, unknown>>
  /** Lexical rich text root node */
  richText?: Record<string, unknown>
  /** Arbitrary structured data (future-proof extension point) */
  data?: Record<string, unknown>
}

/**
 * Extracts displayable text from any message content format.
 * Handles backward compatibility: strings, JSON objects, and null/undefined.
 *
 * @param content - The raw `content` field from a Messages document
 * @returns Plain text string suitable for display
 */
export function extractTextFromContent(content: unknown): string {
  if (!content) return ''

  // Plain string (legacy format or simple text)
  if (typeof content === 'string') return content

  // Number or boolean — stringify
  if (typeof content !== 'object') return String(content)

  // UMS envelope object
  const obj = content as Record<string, unknown>

  // Has `text` field — the standard UMS text
  if (typeof obj.text === 'string') return obj.text

  // Has `content` sub-field (e.g. nested structure)
  if (typeof obj.content === 'string') return obj.content

  // Has `message` field
  if (typeof obj.message === 'string') return obj.message

  // Array of blocks — try to extract text from first block
  if (Array.isArray(obj.blocks) && obj.blocks.length > 0) {
    const firstBlock = obj.blocks[0] as Record<string, unknown>
    if (typeof firstBlock.text === 'string') return firstBlock.text
    if (typeof firstBlock.label === 'string') return firstBlock.label
  }

  // Last resort: try JSON.stringify for debugging
  try {
    return JSON.stringify(content)
  } catch {
    return '[Message content]'
  }
}

/**
 * Wraps a plain text string into a UMS content envelope.
 * If the input is already a valid UMS object, returns it as-is.
 *
 * @param input - Plain text or existing UMS content
 * @returns UMS content envelope
 */
export function wrapTextContent(input: string | UMSContent | Record<string, unknown>): UMSContent {
  // Already a UMS envelope
  if (typeof input === 'object' && input !== null && 'type' in input && 'text' in input) {
    return input as UMSContent
  }

  // Plain string → wrap
  if (typeof input === 'string') {
    return { type: 'text', text: input }
  }

  // Unknown object — wrap with text extraction
  return {
    type: 'text',
    text: extractTextFromContent(input),
    data: input as Record<string, unknown>,
  }
}

/**
 * Creates a system action message content envelope.
 * Used for tracking autonomous AI actions, ethical assessments, and workflow events.
 *
 * @param text - Human-readable description of the action
 * @param actionData - Structured action data
 */
export function createSystemActionContent(
  text: string,
  actionData: Record<string, unknown>,
): UMSContent {
  return {
    type: 'system_action',
    text,
    actions: [{ ...actionData, timestamp: new Date().toISOString() }],
  }
}

/**
 * Creates a widget trigger message content.
 * Used for dynamic widget integration in the Spaces interface.
 *
 * @param text - Description shown alongside the widget
 * @param widgetConfig - Widget configuration object
 */
export function createWidgetContent(
  text: string,
  widgetConfig: Record<string, unknown>,
): UMSContent {
  return {
    type: 'widget',
    text,
    widgets: [widgetConfig],
  }
}

/**
 * Creates a normalized form submission message content.
 * Any form submittal is converted into a System Message for the priority queue.
 *
 * @param text - Summary of the submission
 * @param formData - The submitted form data
 * @param formId - The form's ID in the forms collection
 */
export function createFormSubmissionContent(
  text: string,
  formData: Record<string, unknown>,
  formId?: string | number,
): UMSContent {
  return {
    type: 'form_submission',
    text,
    data: { formId, fields: formData, submittedAt: new Date().toISOString() },
  }
}

/**
 * Creates a transaction record message content.
 * E-commerce transactions are normalized into the messaging hub.
 *
 * @param text - Summary of the transaction
 * @param transactionData - Transaction details
 */
export function createTransactionContent(
  text: string,
  transactionData: Record<string, unknown>,
): UMSContent {
  return {
    type: 'transaction',
    text,
    data: transactionData,
  }
}

/**
 * Creates a BI insight message content.
 * Business intelligence metrics embedded directly in the chat stream.
 *
 * @param text - Human-readable insight
 * @param metrics - Metric data
 */
export function createBIInsightContent(
  text: string,
  metrics: Record<string, unknown>,
): UMSContent {
  return {
    type: 'bi_insight',
    text,
    metrics,
  }
}
