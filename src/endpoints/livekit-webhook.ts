/**
 * LiveKit Webhook — POST /api/webhooks/livekit
 *
 * Receives LiveKit Cloud/Server webhook events (signed). On `room_finished` it
 * records a `telephony` cost-event into the Operating-Costs ledger from the
 * room's duration × participants × a per-participant-minute rate, so realtime/
 * voice cost shows up alongside AI and infra. This is also the seam for treating
 * LiveKit as a first-class realtime provider (vs VAPI).
 *
 * Tenant attribution: rooms are named `{tenantSlug}-{spaceSlug}-{channelSlug}`
 * (see livekit-token.ts). Slugs can contain hyphens, so we match the longest
 * known tenant slug that the room name starts with.
 *
 * Auth: the LiveKit WebhookReceiver verifies the signature with the API
 * key/secret — no other gate. Fail-soft; never 500s the sender on a cost hiccup.
 *
 * Rate: LIVEKIT_COST_CENTS_PER_PARTICIPANT_MINUTE (default 0.05 ≈ $0.50/1000 min).
 *
 * @see src/endpoints/livekit-token.ts — room naming + credentials
 * @see src/collections/CostEvents — the ledger
 */
import type { PayloadHandler } from 'payload'
import { WebhookReceiver } from 'livekit-server-sdk'
import { recordCostEvent } from '@/utilities/recordCostEvent'

function ratePerParticipantMinuteCents(): number {
  const raw = Number(process.env.LIVEKIT_COST_CENTS_PER_PARTICIPANT_MINUTE)
  return Number.isFinite(raw) && raw >= 0 ? raw : 0.05
}

/** Resolve a tenant id from a room name by longest-matching tenant slug. */
async function resolveTenantFromRoom(
  payload: Parameters<PayloadHandler>[0]['payload'],
  roomName?: string,
): Promise<number | null> {
  if (!roomName) return null
  try {
    const res = await payload.find({
      collection: 'tenants' as any,
      limit: 1000,
      depth: 0,
      select: { slug: true } as any,
      overrideAccess: true,
    })
    let best: { id: number; slug: string } | null = null
    for (const t of res.docs as Array<{ id: number; slug?: string }>) {
      const slug = t.slug
      if (!slug) continue
      if (roomName === slug || roomName.startsWith(`${slug}-`)) {
        if (!best || slug.length > best.slug.length) best = { id: t.id, slug }
      }
    }
    return best?.id ?? null
  } catch {
    return null
  }
}

export const livekitWebhookHandler: PayloadHandler = async (req) => {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!apiKey || !apiSecret) {
    return Response.json({ error: 'LiveKit not configured' }, { status: 503 })
  }

  let event: Awaited<ReturnType<WebhookReceiver['receive']>>
  try {
    const body = await (req as Request).text()
    const authHeader = req.headers.get('Authorization') || ''
    const receiver = new WebhookReceiver(apiKey, apiSecret)
    event = await receiver.receive(body, authHeader)
  } catch (err: any) {
    return Response.json({ error: 'Invalid webhook signature', detail: err?.message }, { status: 401 })
  }

  const { payload } = req

  try {
    if (event.event === 'room_finished' && event.room) {
      const room = event.room as { name?: string; sid?: string; creationTime?: number | bigint; numParticipants?: number; maxParticipants?: number }
      const creation = room.creationTime != null ? Number(room.creationTime) : 0
      // creationTime is unix seconds; duration to now in minutes.
      const durationMin = creation > 0 ? Math.max(0, (Date.now() / 1000 - creation) / 60) : 0
      const participants = Math.max(1, Number(room.maxParticipants || room.numParticipants || 1))
      const participantMinutes = Math.round(durationMin * participants * 1000) / 1000
      const rate = ratePerParticipantMinuteCents()
      const costCents = Math.round(participantMinutes * rate * 1000) / 1000

      const tenantId = await resolveTenantFromRoom(payload, room.name)

      await recordCostEvent(payload, {
        tenantId: tenantId ?? undefined,
        category: 'telephony',
        source: 'livekit-webhook',
        provider: 'livekit',
        costCents,
        costEstimated: true,
        quantity: participantMinutes,
        unit: 'minutes',
        metadata: {
          event: event.event,
          room: room.name,
          sid: room.sid,
          participants,
          durationMin: Math.round(durationMin * 1000) / 1000,
          rateCentsPerParticipantMinute: rate,
        },
      })
    }

    return Response.json({ received: true, event: event.event })
  } catch (err: any) {
    // Fail-soft — acknowledge so LiveKit doesn't retry-storm on a cost hiccup.
    return Response.json({ received: true, warning: err?.message || 'cost record failed' })
  }
}
