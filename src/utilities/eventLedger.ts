import type { PayloadHandler, PayloadRequest } from 'payload'

/** How much of a payload is worth keeping. Enough to read; not enough to bloat. */
const MAX_BODY = 16_000

/**
 * withEventLedger — record that something arrived, and how it went.
 *
 * Wraps a webhook handler at REGISTRATION (payload.config.ts), not inside it:
 * ten handlers, one behaviour, no edits to code that already works and is hard
 * to test. @see src/collections/SystemEvents.ts
 *
 * Fail-soft in both directions. A ledger that can't write must never turn a
 * good webhook into a 500 — the sender would retry forever over our bookkeeping.
 * And a handler that throws is re-thrown after recording, so nothing downstream
 * changes behaviour by being wrapped.
 *
 * ponytail: the body is read from a CLONE. Consuming `req` here would starve
 * every handler behind it, which is the one way this wrapper could break the
 * system it exists to observe.
 */
export function withEventLedger(source: string, handler: PayloadHandler): PayloadHandler {
  return async (req: PayloadRequest) => {
    const started = Date.now()
    let id: number | string | null = null

    try {
      let body = ''
      try {
        const clone = (req as unknown as Request).clone?.()
        if (clone) body = (await clone.text()).slice(0, MAX_BODY)
      } catch {
        /* an unclonable or already-consumed body is not worth failing over */
      }

      const doc = await req.payload.create({
        collection: 'system-events',
        data: {
          source,
          status: 'received',
          path: new URL(req.url || 'http://x/').pathname,
          externalId: externalIdFrom(body),
          eventType: eventTypeFrom(body),
          body: body || undefined,
        },
        overrideAccess: true,
        req,
      })
      id = (doc as { id: number | string }).id
    } catch (err) {
      req.payload.logger?.warn?.(
        `[event-ledger] could not record ${source}: ${err instanceof Error ? err.message : err}`,
      )
    }

    try {
      const res = await handler(req)
      void mark(req, id, { status: 'done', durationMs: Date.now() - started, statusCode: res?.status })
      return res
    } catch (err) {
      void mark(req, id, {
        status: 'failed',
        durationMs: Date.now() - started,
        error: err instanceof Error ? `${err.message}\n${err.stack ?? ''}`.slice(0, 4000) : String(err),
      })
      throw err
    }
  }
}

/** Close the row out. Never awaited by the response path — the sender is owed a reply, not our bookkeeping. */
async function mark(
  req: PayloadRequest,
  id: number | string | null,
  data: Record<string, unknown>,
): Promise<void> {
  if (id == null) return
  try {
    // Deliberately NOT threading `req`: the handler's transaction may already be
    // committed or rolled back by now, and a failed webhook must still leave a
    // 'failed' row behind. @see project_provisioning_transaction_fragility
    await req.payload.update({ collection: 'system-events', id, data, overrideAccess: true })
  } catch (err) {
    req.payload.logger?.warn?.(
      `[event-ledger] could not close event ${id}: ${err instanceof Error ? err.message : err}`,
    )
  }
}

/** Most senders name their event and their id in the JSON. Look; don't insist. */
function eventTypeFrom(body: string): string | undefined {
  return pick(body, ['type', 'event', 'eventType', 'event_type'])
}

function externalIdFrom(body: string): string | undefined {
  return pick(body, ['id', 'event_id', 'MessageSid', 'update_id'])
}

function pick(body: string, keys: string[]): string | undefined {
  if (!body) return undefined
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    for (const k of keys) {
      const v = parsed?.[k]
      if (typeof v === 'string' && v) return v.slice(0, 200)
      if (typeof v === 'number') return String(v)
    }
  } catch {
    /* form-encoded (Twilio) or not JSON at all — the raw body is still stored */
  }
  return undefined
}
