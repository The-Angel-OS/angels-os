# Gotify Connector

Gotify (`https://gotify.kendev.co`) is a first-class Angel OS **Connector**: it
mirrors inbound Gotify messages (e.g. Uptime-Kuma up/down alerts) onto the AI Bus
and pushes Angel OS events out as notifications. Multiple Gotify connectors are
supported per tenant — each carries its **own** server URL + tokens in its
`config` (the env vars are only a node-level bootstrap fallback).

## Two-token rule (Gotify prefixes tell them apart)

| Token | Prefix | Direction | Used for |
|-------|--------|-----------|----------|
| **App token**    | `A…` | SEND    | `POST /message` (transmit + escalation) |
| **Client token** | `C…` | RECEIVE | `GET /message` (inbound poll) |

## Configure (endeavor owners self-serve)

Dashboard → **Account → Integrations** → add a **Gotify** connector
(`tenant_admin`/`tenant_manager`/owner or super_admin):

- **Server URL** — `https://gotify.kendev.co`
- **App Token (`A…`)** — from Gotify → Apps (send)
- **Client Token (`C…`)** — from Gotify → Clients (receive)
- **Poll Limit** — messages fetched per poll (1–200, default 50)
- **Escalation** — master switch + per-event toggles + min priority + rate limit
  + dedupe cooldown (stored in `config.escalation`)

All of the above live in the connector `config` jsonb. The only schema change for
Gotify is the `connectors.type` enum value `gotify` (already added to both prod
DBs via `scripts/_local/add_gotify_connector_enum.mjs`).

## Receive (inbound → AI Bus)

`GET /api/gotify/poll` (Vercel cron `*/5`, `Authorization: Bearer CRON_SECRET`):
for each enabled gotify connector it fetches recent messages with the client
token, keeps `id > config.lastSeenMessageId`, dedupes by `metadata.gotifyMessageId`,
and writes each as a `system` message into the AI Bus `gotify` channel (or the
connector's `routingChannel`), then advances `lastSeenMessageId`.
Source: [`src/endpoints/gotify-poll.ts`](../../src/endpoints/gotify-poll.ts).

## Transmit

`pushNotify({ title, message, priority?, extras? }, { payload, tenantId })` —
fail-soft `POST /message`. Resolution: explicit opts → connector `config` → env.
Source: [`src/utilities/pushNotify.ts`](../../src/utilities/pushNotify.ts).

## Escalation

Policy in `config.escalation`:

```jsonc
{
  "enabled": true,
  "rateLimitPerMin": 10,      // per connector, rolling 60s — caps flap-storms
  "cooldownSeconds": 300,     // per (eventType + dedupeKey), suppresses repeats
  "events": {
    "error":           { "enabled": true, "minPriority": 8 },
    "warning":         { "enabled": true, "minPriority": 5 },
    "user_registered": { "enabled": true, "minPriority": 7 },
    "form_submission": { "enabled": true, "minPriority": 5 }
  }
}
```

`dispatchEscalation(payload, event)` fans an event out to **every** matching
connector for the tenant, each using its own token, gated by the policy +
rate-limit + cooldown. **Wired today:** `error` / `warning` (via the `logError`
tap), `user_registered` (Users afterChange — the operator's pulse on a quiet
node: who just signed up), and `form_submission` (`routeFormToAIBus` — a new
contact/lead-capture submission lights up the operator's phone; deduped per
form via `dedupeKey: form:<id>`). **Seam (stored, not yet emitted):**
`conversation_started`, `budget_exceeded`, `provider_failover`, `vercel_spend`,
`federation`, `order`, `donation`, `booking`, `itsm_incident` — enable one by
calling `dispatchEscalation` at its source (see the backlog in the comms-layer
memory note).
Source: [`src/utilities/escalation.ts`](../../src/utilities/escalation.ts).

## Health / Test

The `*/30` `connector-health-cron` runs `probeGotify` (non-destructive): validates
the client token via `GET /message?limit=1`, or `GET /health` for app-only
connectors. The on-demand **Test** button does the same probe **and then sends a
real test notification** via the app token (`POST /message`) — so you get a
visible round-trip in the Gotify client and the send path is validated, not just
receive. (The cron never sends, so it won't spam.)

## Going live (per node)

1. Create a Gotify connector (above) **or** set `GOTIFY_*` Vercel env on the node.
2. Set the escalation toggles.
3. Point Gotify / Uptime-Kuma at the node's app token.
