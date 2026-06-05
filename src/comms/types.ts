/**
 * comms/types — the explicit Comms-Provider contract.
 *
 * ⚠️ DESIGN SEAM ONLY (sketch). These are type declarations — zero runtime, not
 * yet wired into any handler. They FORMALIZE the pattern Angel OS already follows
 * implicitly:
 *   • inbound:  a provider webhook normalizes an external event into a row in the
 *               Messages collection (the per-tenant "AI Bus") — see
 *               src/endpoints/vapi-webhook.ts and whatsapp-webhook.ts.
 *   • outbound: a tenant/space-scoped resolver returns a bound sender — see
 *               src/utilities/resolveWhatsAppSender.ts (resolveConnector + config).
 *   • config:   per-connector secrets live in the Connectors collection
 *               (Connectors.config JSON), resolved by src/utilities/resolveConnector.ts.
 *   • health:   a non-destructive probe validates credentials — see
 *               src/utilities/connectorProbes.ts.
 *
 * Making this contract explicit lets VAPI and LiveKit (and the text channels) be
 * INTERCHANGEABLE: every provider speaks the same shape, and every inbound event
 * lands on the AI Bus through ONE normalization path instead of each webhook
 * hand-writing its own payload.create().
 *
 * @see docs/COMMS_PROVIDER_ABSTRACTION.md — the design + phased plan.
 */

/** The external systems we integrate. Mirrors the Connectors collection `type` enum. */
export type CommsProviderId =
  | 'vapi'
  | 'livekit'
  | 'whatsapp'
  | 'sms'
  | 'telegram'
  | 'slack'
  | 'email'
  | 'discord'

/** Messages-collection messageType values produced by comms providers. */
export type CommsMessageType =
  | 'voice_call'
  | 'whatsapp_message'
  | 'sms_message'
  | 'telegram_message'
  | 'discord_message'
  | 'email_message'

/** What a provider can do — capability flags gate the optional contract methods. */
export interface CommsCapabilities {
  /** Receives inbound async text (webhook → AI Bus). */
  inboundText: boolean
  /** Can send outbound text on demand. */
  outboundText: boolean
  /** Can place/receive telephony voice calls. */
  voiceCall: boolean
  /** Can host a multi-party realtime audio/video room. */
  realtimeRoom: boolean
  /** Can provision/own E.164 phone numbers. */
  phoneNumbers: boolean
  /** Speaks SIP. */
  sip: boolean
}

/**
 * The normalized inbound event EVERY provider emits toward the AI Bus. A provider
 * webhook's only job is to turn its native payload into this shape; a single
 * normalizer (Phase 1) writes it to the Messages collection with consistent
 * dedup + metadata. This is exactly the data vapi-webhook/whatsapp-webhook already
 * assemble before calling payload.create() — just named.
 */
export interface InboundCommsEvent {
  providerId: CommsProviderId
  /** The Connectors row that received this (observability + routing). */
  connectorId: string
  tenantId: number | string
  /** Resolved target space (e.g. a per-contact DM space, or the voice space). */
  spaceId: number
  /** Channel slug: 'voice', `whatsapp-${phone}`, etc. */
  channel: string
  messageType: CommsMessageType
  /** Plain text payload (wrapped into UMS content by the normalizer). */
  text: string
  /** Provider-native id used for idempotent dedup (callId / waMessageId / jti). */
  externalId: string
  /** Sender identity (caller phone / handle), when applicable. */
  from?: string
  /** For voice transcripts: who spoke. */
  role?: 'caller' | 'assistant' | 'system' | 'user'
  /** Provider-specific extras merged into Messages.metadata. */
  metadata?: Record<string, unknown>
}

/** Result of writing an inbound event to the AI Bus. */
export interface AiBusWriteResult {
  messageId: number | string | null
  /** True when the event was a duplicate (externalId already seen) and skipped. */
  deduped: boolean
}

/** Outbound text request (mirrors resolveWhatsAppSender.sendText args). */
export interface OutboundTextRequest {
  to: string
  text: string
  metadata?: Record<string, unknown>
}

/** Options for opening a realtime/voice session (LiveKit room / VAPI call). */
export interface StartSessionOptions {
  tenantId: number | string
  spaceId?: number | string | null
  /** E.164 to dial for outbound voice; omit for inbound/room sessions. */
  dialTo?: string
  /** Room name for realtime sessions. */
  room?: string
  metadata?: Record<string, unknown>
}

/** Handle to an open realtime/voice session. */
export interface CommsSession {
  sessionId: string
  /** Join token / dial info, provider-specific. */
  join?: Record<string, unknown>
  end: () => Promise<void>
}

/**
 * A tenant/space-bound provider instance. Optional methods are present only when
 * the matching capability is true. A resolver (resolveCommsProvider) returns this,
 * the same way resolveWhatsAppSender returns a bound sender today.
 */
export interface CommsProvider {
  readonly id: CommsProviderId
  readonly connectorId: string
  readonly capabilities: CommsCapabilities
  /** outboundText capability */
  sendText?: (req: OutboundTextRequest) => Promise<void>
  /** voiceCall | realtimeRoom capability */
  startSession?: (opts: StartSessionOptions) => Promise<CommsSession>
  /** non-destructive credential check (→ connectorProbes) */
  probe?: () => Promise<{ ok: boolean; message: string }>
}

/**
 * Resolve the configured provider for a tenant/space + channel kind. This is the
 * seam that makes VAPI/LiveKit interchangeable: the rest of the system asks for
 * "the voice provider for this tenant" and gets whichever is configured.
 */
export type ResolveCommsProvider = (ctx: {
  payload: unknown
  tenantId: number | string
  spaceId?: number | string | null
  type: CommsProviderId
}) => Promise<CommsProvider | null>

/** The single inbound write path: provider event → AI Bus (with dedup). */
export type NormalizeToAiBus = (event: InboundCommsEvent) => Promise<AiBusWriteResult>
