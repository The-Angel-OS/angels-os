# The `req` Rule — nested Payload ops must share the request connection

**Status:** active law. Violations have caused multiple production incidents (LEO reply
vanish, attachment-message vanish, moderateMessage deadlock).

## The rule

> Any `payload.create/update/delete/find/findByID` that runs **inside a request**
> (an endpoint handler or a *synchronous* collection hook) **must pass `req`**.

```ts
await req.payload.create({ collection: 'messages', data, overrideAccess: true, req }) // ✅
await req.payload.create({ collection: 'messages', data, overrideAccess: true })       // ❌ second connection
```

Passing `req` makes the nested op reuse the request's already-acquired DB connection
(and its transaction). Omitting it forces Payload to acquire a **second** pooled
connection.

## Why it bites — connection pressure

Our Postgres runs behind a shared IONOS pool (and the PgBouncer `:6432` pooler). Under
load, acquiring a *second* connection mid-request **stalls or fails**. When it does:

- the nested op throws (`Failed query: …` in the error logs),
- which aborts the surrounding save,
- which **rolls the whole thing back** → the record silently vanishes.

The failure is **load-dependent and data-dependent**, which is why it looks
intermittent and "works on the healthy node":

- A **text** message create is light → usually survives the second connection.
- An **attachment** message create forces a relationship-populate (`media id in (N)`)
  + heavier `afterChange` hooks on that second connection → fails first.

## Confirmed incidents

| Path | Symptom | Fix |
|---|---|---|
| `Messages/hooks/setTenantFromSpace` | LEO reply vanish | pass `req` to the space lookup (79103de) |
| `endpoints/chat-send` | attachment message vanishes, media survives | pass `req` to the create (619efe3) |
| `Messages/hooks/moderateMessage` | message-send deadlock | pass `req` to the update (earlier) |

## The exception — fire-and-forget MUST NOT pass `req`

Work deliberately deferred past the response (via `setImmediate`, or fire-and-forget
from a layout) runs **after** the request transaction has committed/closed. Passing a
stale `req` there throws. These use `getPayload()` and **no** `req` on purpose:

- `utilities/mediaAnalysis.ts` (via `setImmediate`)
- `utilities/autoActivatePendingMembership.ts`

**Test:** does this op need to be part of the in-flight save? Yes → pass `req`.
Deferred/background → don't.

## Outstanding same-class candidates (review individually, not blanket-edited)

- `endpoints/leo-stream.ts` creates (3 sites) — pass `tenant` but not `req`. Streaming
  endpoint: passing `req` has transaction-visibility subtleties (placeholder must be
  pollable *before* the stream ends). Needs deliberate handling, not a blind edit.
- `endpoints/leo-chat.ts` create (batch fallback) — safe to add `req` (non-streaming).
- `utilities/ensureMainSpace.ts`, `utilities/creditQuestPayout.ts`,
  `utilities/workflowRunner.ts` — synchronous hook paths; confirm each runs inside the
  parent transaction before adding `req`.

## Durable fix direction

The scatter of persist sites is itself the risk (see the shared-brain refactor: one
cortex, one persist step). Until then, **this rule is the guardrail** — grep for
`payload.create`/`.update` in endpoints and hooks; every one inside a request needs
`req` unless it is explicitly fire-and-forget.
