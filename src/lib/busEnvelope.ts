/**
 * busEnvelope — the ONE typed builder for `{space, channel, message}` bus messages.
 *
 * Extends the "sacred contract" from the brain to the BUS itself. Every producer
 * (chat-send, node-ops node-commands, LEO dispatch, future jobs) must post through
 * here so the envelope is validated + normalized in exactly one place:
 *   - content is ALWAYS `{ text }` (Messages.content is a required JSON field; a bare
 *     string → Payload 500 "field is invalid: Content" — the recurring bug class this kills)
 *   - space is coerced to a number (integer FK; a string → "field is invalid: Space")
 *   - channel is a non-empty slug
 *   - metadata.kind carries the message discriminator (no messageType enum migration)
 *
 * @see docs/architecture/NODE_BUS_COMMS.md · docs/planning/PARALLEL_LANES_260623.md (L0)
 */
import type { Payload, PayloadRequest } from 'payload'

/** Message discriminator (rides metadata.kind — open set, no enum migration). */
export type BusMessageKind =
  | 'chat'
  | 'node-command'
  | 'node-result'
  | 'system'
  | 'error'
  | (string & {})

export interface BusMessageInput {
  space: number | string
  channel: string
  /** Human/agent text. Stored as content `{ text }`. May be empty when attachments exist. */
  text?: string
  author: number | string
  tenant: number | string
  /** Payload Messages.messageType (defaults to 'user'). */
  messageType?: string
  /** Convenience for metadata.kind. */
  kind?: BusMessageKind
  /** Extra metadata (merged; `kind` wins if both set). */
  metadata?: Record<string, unknown>
  /** Messages.visibility (defaults to 'tenant'). */
  visibility?: string
  attachments?: unknown[]
  /** Skip the empty-text guard — for callers that validated upstream or write
   *  attachments in a later phase (e.g. chat-send's two-phase image write). */
  allowEmpty?: boolean
}

/** Coerce + validate a space id to the integer FK Payload requires. */
export function normalizeSpaceId(space: number | string): number {
  const n = typeof space === 'string' ? Number(space) : space
  if (!Number.isFinite(n)) throw new Error(`bus: invalid space id "${space}" (must be numeric)`)
  return n
}

/**
 * Build the validated Messages create payload. Throws on a bad envelope BEFORE the DB
 * call, so a shape error is a clear local exception instead of an opaque Payload 500.
 */
export function buildBusMessageData(input: BusMessageInput): Record<string, unknown> {
  const space = normalizeSpaceId(input.space)
  if (!input.channel || typeof input.channel !== 'string') {
    throw new Error('bus: channel is required (non-empty slug)')
  }
  const hasAttachments = Array.isArray(input.attachments) && input.attachments.length > 0
  const text = typeof input.text === 'string' ? input.text : ''
  if (!input.allowEmpty && !text.trim() && !hasAttachments) {
    throw new Error('bus: message text is empty (and no attachments)')
  }

  const metadata =
    input.kind || input.metadata ? { ...(input.metadata || {}), ...(input.kind ? { kind: input.kind } : {}) } : undefined

  return {
    content: { text }, // <-- the contract: always {text}, never a bare string
    space,
    channel: input.channel,
    messageType: input.messageType || 'user',
    author: input.author,
    tenant: input.tenant,
    visibility: input.visibility || 'tenant',
    ...(metadata ? { metadata } : {}),
    ...(hasAttachments ? { attachments: input.attachments } : {}),
  }
}

/**
 * Create a bus message via the local API (overrideAccess — tenant is resolved + passed by
 * the caller). Returns the created doc. Pass `req` for in-request ops (shared connection,
 * the PASS_REQ_RULE); omit for fire-and-forget.
 */
export async function postBusMessage(
  payload: Payload,
  input: BusMessageInput,
  opts: { req?: PayloadRequest } = {},
): Promise<Record<string, unknown>> {
  const data = buildBusMessageData(input)
  return (await payload.create({
    collection: 'messages',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- validated by buildBusMessageData
    data: data as any,
    overrideAccess: true,
    req: opts.req,
    depth: 0,
  })) as unknown as Record<string, unknown>
}
