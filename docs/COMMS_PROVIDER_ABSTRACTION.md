# Comms-Provider Abstraction — Design & Plan

**Status:** Sketch / design only. No runtime changes, no provider migration. (2026-06-05)
**Seam:** [`src/comms/types.ts`](../src/comms/types.ts) — the explicit `CommsProvider` contract (type-only).

> Goal: make VAPI and LiveKit (and the text channels) **interchangeable** behind one
> contract, with every inbound comms event landing on the per-tenant **AI Bus** through
> a single normalization path. The point is *not* a new system — Angel OS already has
> the abstraction; this formalizes it and brings LiveKit to parity.

---

## 1. What already exists (build on this, don't duplicate)

| Concern | Where | Notes |
|---|---|---|
| **Connector registry** | `src/collections/Connectors/index.ts` | Per-tenant rows: `type` (incl. `vapi`, `livekit`, `whatsapp`…), `config` (JSON secrets), `routingChannel`, `systemUser`, `enabled`, `priority`, `status`, `lastActivity`, `errorMessage`. |
| **Connector resolution** | `src/utilities/resolveConnector.ts` | `resolveConnector(payload, {type, tenantId, spaceId})` → space-level first, endeavor-level fallback; enabled + non-error only. |
| **Outbound sender pattern** | `src/utilities/resolveWhatsAppSender.ts` | Returns a bound interface (`sendText`, `sendTemplate`, `connectorId`) + activity/error helpers. The template for any provider. |
| **Inbound normalization** | `src/endpoints/whatsapp-webhook.ts`, `vapi-webhook.ts` | Webhook → `payload.create({ collection:'messages', data:{ space, channel, content, messageType, metadata, tenant }, overrideAccess:true })`. **Each webhook hand-writes this today.** |
| **AI Bus** | `src/endpoints/ai-bus-poll.ts`, `src/utilities/ai-bus-router.ts` | The AI Bus **is** the Messages collection, tenant-scoped, polled by `?since=&spaceId=&channel=&visibility=`. Routed by `visibility` (private/tenant/network). |
| **Health probes** | `src/utilities/connectorProbes.ts` | `runProbe(type, cfg)` — whatsapp/telegram/sms today. No vapi/livekit probe yet. |
| **VAPI (already live)** | `src/endpoints/vapi-webhook.ts` + `Tenants.vapi` group | Inbound calls → `messageType:'voice_call'`, `channel:'voice'`. Single-number routing (match dialed number, else fuzzy-match tenant from speech). |
| **LiveKit (partial)** | `src/components/ChatControl/LiveKit*.tsx`, `src/endpoints/livekit-token.ts` | UI + token generation only. Connectors `type:'livekit'` enum exists but unused. **No webhook, no AI Bus wiring.** |
| **Dedup** | `src/utilities/bridgeHelpers.ts`, `federation-message.ts` | Store provider `externalId` in `metadata`, check before create. |
| **Message content** | `src/utilities/messageContent.ts` | `wrapTextContent`, `createVoiceCallContent`, etc. |

**Conclusion:** VAPI and WhatsApp already conform to the contract *de facto*. The gaps are: (1) the contract is implicit/duplicated, and (2) LiveKit isn't wired.

---

## 2. The contract (the seam)

See [`src/comms/types.ts`](../src/comms/types.ts). Key shapes:

- **`InboundCommsEvent`** — the normalized event every provider emits. A webhook's only job becomes: *parse native payload → `InboundCommsEvent`*.
- **`NormalizeToAiBus`** — the **single** write path: `(event) => payload.create(... messages ...)` with consistent dedup + metadata. Replaces the per-webhook copies.
- **`CommsProvider`** — a tenant/space-bound instance with capability-gated `sendText` / `startSession` / `probe`. Same idea as `resolveWhatsAppSender`'s return value, generalized.
- **`ResolveCommsProvider`** — "give me the voice provider for this tenant" → returns VAPI **or** LiveKit, whichever is configured. This is what makes them interchangeable.

---

## 3. Phased plan

Each phase is independently shippable, build- + test-gated, and (until Phase 4) keeps VAPI fully live.

### Phase 0 — this sketch ✅
Explicit contract (`src/comms/types.ts`) + this doc. Zero runtime impact.

### Phase 1 — DRY the inbound seam (refactor, no behavior change)
Extract `normalizeToAiBus(event: InboundCommsEvent): Promise<AiBusWriteResult>` into `src/comms/aiBus.ts` from the duplicated `payload.create()` logic in `vapi-webhook.ts`, `whatsapp-webhook.ts` (and align `federation-message.ts`). Each webhook becomes *parse → event → normalize*.
- **Risk:** low — pure refactor; build + existing webhook behavior unchanged. Add a unit test that a given `InboundCommsEvent` produces the expected create() args + dedups on `externalId`.
- **Win:** one write path → consistent dedup, metadata, visibility, and a single place to evolve.

### Phase 2 — LiveKit to parity (additive, VAPI untouched)
- Use Connectors `type:'livekit'`; **store LiveKit secrets in `Connectors.config` JSON** (api key/secret, SIP trunk, room defaults) — **not** a new `Tenants.livekit` group, to avoid a schema migration (see Risks).
- Add `src/endpoints/livekit-webhook.ts` — verify LiveKit webhook signature; on SIP/room events, build an `InboundCommsEvent` (`messageType:'voice_call'`, `channel:'voice'`) → `normalizeToAiBus`.
- Add `resolveLiveKitProvider(payload, tenantId, spaceId)` returning a `CommsProvider` (capabilities: voiceCall + realtimeRoom + sip + phoneNumbers).
- **LEO as the brain:** LiveKit Agents handles media (STT/TTS/turn-taking); the agent loop calls our existing `leoProcessMessage()`. This is the largest piece — spec it as its own sub-task.
- Add `connectorProbes` entries for `livekit` (and backfill `vapi`).
- **Risk:** medium, but isolated — runs in parallel on the free/test number; VAPI keeps the live number.

### Phase 3 — interchangeability
Implement `resolveCommsProvider({type:'voice'…})` that returns the tenant's configured voice provider (vapi **or** livekit). Voice-using code (and a future `send_voice`/outbound-call tool) asks for "the voice provider" and is provider-agnostic.
- **Risk:** low — additive selection layer.

### Phase 4 — consolidation decision (gated, NOT automatic)
Only after LiveKit voice is validated on quality, latency, cost, and **number-porting feasibility**, decide whether to port the assigned VAPI number to LiveKit. Explicit human go/no-go. Never before.

---

## 4. Risks & constraints

- **No migration yet** (Kenneth's standing instruction). Phases 1–3 are additive/refactor; Phase 4 is gated.
- **Number porting is a real process** with downtime/coverage implications — validate LiveKit telephony on a *test* number first; keep VAPI's number live throughout.
- **Schema-field deploy rule:** adding a `Tenants` field needs the prod column before/with deploy or all tenants fall back to the platform home page. → **Prefer `Connectors.config` JSON for LiveKit secrets** (no migration). Only add a `Tenants.livekit` group if a first-class UI is required, and then column-before-deploy.
- **Don't boot dev against prod:** local `.env DATABASE_URI` points at the production `angels` DB. Verify with `pnpm build` + unit tests, never `pnpm dev`.
- **LiveKit Agents is newer/more DIY** than VAPI's managed loop — budget build time for the voice agent (STT/turn-detection/TTS), but the brain (LEO) already exists.

---

## 5. Why this is the elegant path (Answer 53)

Every external channel — text, voice, federation — collapses to **one inbound contract → one AI Bus write**, and **one resolver** that hands back whichever provider a tenant configured. No parallel telephony stack: VAPI and LiveKit are two implementations of the same seam, and the maker (the working VAPI flow) is kept whole while LiveKit grows up beside it.
