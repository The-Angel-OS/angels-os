# Roadmap — Comms (LiveKit IP-PBX) + Works Distribution & Offline

**Date:** 2026-06-17
**Decision owner:** Kenneth
**Status:** committed direction, not yet fully built
**Related:** [docs/COMMS_PROVIDER_ABSTRACTION.md](../COMMS_PROVIDER_ABSTRACTION.md), memory `project_comms_layer`, `project_nimue_offline_works`, `project_works_canonical_syndication`, `project_federated_identity_catalog`

Two arcs that make the Nimue client a showpiece: **voice that answers your number** and **a Works library that works offline**. Both build on pieces that already exist — this doc marks what's done, names the real gaps, and orders them.

Governing decision: **retire VAPI, make LiveKit the single comms substrate** (rooms + telephony + AI agents = one vendor, one SDK, one auth). VAPI never ran in testing; consolidating reduces integration points rather than adding them.

---

## PART A — Comms: LiveKit as the IP-PBX substrate

### Honest scope line
LiveKit gives you the **media + signaling + AI-bridge substrate**. It is **not a carrier** — PSTN numbers come from a SIP trunk provider (Telnyx / Twilio SIP / Flowroute). "Full PBX" features (voicemail, IVR, transfer, hunt groups) are a **product layer on top**, and most map onto things Angel OS already has (channels ≈ extensions/queues, Messages ≈ voicemail+transcript, LEO ≈ auto-attendant/IVR). Ship it as **"AI-native voice that answers your number,"** not "full PBX," until the feature layer exists.

### What EXISTS (verified 2026-06-17, live on dev)
| Piece | File | State |
|-------|------|-------|
| Token endpoint `POST /api/livekit/token` | `src/endpoints/livekit-token.ts` | ✅ auth + space-membership gated, 2h JWT, room=`{tenant}-{space}-{channel}`, returns `{token,roomName,url}` |
| Webhook `POST /api/webhooks/livekit` | `src/endpoints/livekit-webhook.ts` | ⚠️ verifies signature, but **only** handles `room_finished` → cost to CostEvents |
| Client room UI | `src/components/ChatControl/LiveKitButton.tsx`, `LiveKitRoom.tsx` | ✅ floating / fullscreen / embedded; mic/cam/screen-share/device-select |
| Voice applet wiring | `src/components/ChatControl/MultiChannelChat.tsx` | ✅ `activeApplet==='voice'` mounts embedded room |
| SDKs | `package.json` | ✅ `livekit-server-sdk`, `livekit-client`, `@livekit/components-react` |
| Credentials | `.env` / `.env.local` | ✅ set locally — ⚠️ **confirm present in Vercel prod env** (token endpoint 503s without them) |
| Comms contract (type-only) | `src/comms/types.ts` | ✅ `CommsProvider`, `InboundCommsEvent`, capability flags — zero runtime |
| Connector enum | `src/collections/Connectors/index.ts` | ✅ `livekit` value exists, JSON config |
| VAPI (to retire) | `src/endpoints/vapi-webhook.ts` | live code, never validated in tests |

**Bottom line:** peer-to-peer voice/video in a channel **works today**. The gaps are telephony + AI-in-the-room.

### The IP-PBX ladder (ordered — stop-and-ship at each rung)

**Rung 0 — Turn it on for beta (no code).**
Confirm the three `LIVEKIT_*` vars in Vercel prod. Smoke-test the Voice applet in a real space. This unblocks Nimue beta voice immediately.

**Rung 1 — Inbound SIP (answer a number).**
- Provision a SIP trunk + DID at a provider (Telnyx recommended: cheapest, cleanest SIP).
- Point the trunk at LiveKit SIP; configure a LiveKit dispatch rule → room.
- Extend `livekit-webhook.ts` to handle `sip_inbound_call` (today it only does `room_finished`): create/resolve the room, map the DID → tenant (reuse VAPI's fuzzy number→tenant match in `vapi-webhook.ts` as the pattern).
- Acceptance: call the number → land in a LiveKit room → a human in that channel can answer.

**Rung 2 — Calls onto the AI Bus.**
- In the webhook, call the existing `normalizeToAiBus()` seam (Phase 1 of COMMS_PROVIDER_ABSTRACTION — extract it from `vapi-webhook.ts` so VAPI and LiveKit share one inbound normalizer).
- A call becomes a Message (`messageType:'voice_call'`, channel `voice`) like VAPI did — so the call shows up in chat, gets logged, escalates.
- Acceptance: an inbound call posts a "call started/ended" message + duration into the bound channel.

**Rung 3 — LEO voice agent (make it talk). The big piece.**
- Stand up a **LiveKit Agents worker** (separate Node/Python process, not a Next route): joins the room as `LEO`, runs STT → LEO's existing LLM/tool loop → TTS, with turn detection + barge-in.
- Reuse `executeToolCall` / the LEO tool layer so voice-LEO has the same 125 tools as text-LEO.
- This is the showpiece moment: call your endeavor's number, LEO answers, books an appointment by voice.
- Acceptance: phone a number with no human present → LEO converses → completes a real action (booking/lookup) → transcript lands in the channel.
- ⚠️ Biggest effort + a new deployable (the agent worker). Scope it as its own slice.

**Rung 4 — PBX feature layer (only as demand appears).**
Voicemail (= transcript Message when unanswered), IVR/auto-attendant (= LEO routing or a menu), transfer/hold (room move), hunt groups (channel membership). Each is small *given* rungs 1–3. Don't pre-build.

**Rung 5 — Retire VAPI.**
Once rungs 1–3 are validated, port the number off VAPI to the SIP trunk, delete `vapi-webhook.ts` + VAPI env/keys. One comms vendor remains.

### Net integration-point math (the thing you care about)
Before: VAPI (voice) + LiveKit (rooms) + future video = 2–3 opinionated vendors.
After: LiveKit (rooms+SIP+agents) + one dumb SIP trunk = **1 smart vendor + 1 commodity**. Fewer seams, more capability.

---

## PART B — Works: distribution + offline

### The goal
An **Audible-like library**: a subscriber can download a Work (text/audio) once and read/listen **offline**, and a Work published on one node can **propagate to other nodes** that subscribe. Author keeps canonical/SEO; subscribers get faithful copies.

### What EXISTS
| Piece | Where | State |
|-------|-------|-------|
| Works as portable data | `Works` collection — Work JSON v1, content **checksum**, absolute Blob URLs, per-endeavor scoping | ✅ shipped (other thread). The content-addressed format offline+distribution both need. |
| Availability / subscription map | `src/souls/subscriptions.ts` (`WORK_SUBSCRIPTIONS`, `isWorkAvailable`, `homeForWork`) | ✅ home + subscribers per Work, keyed by tenant slug |
| Canonical-at-home doctrine | memory `project_works_canonical_syndication` | ✅ decided: publish-once-canonical, copies emit `rel=canonical` home |
| Catalog gossip index | federation heartbeat `endeavors[].catalog[]` (content-addressed) | ✅ producer ships; consumer surfacing is the gap |
| Reader + `/works` route | `/works`, `/learn`, `WorksGrid` | ✅ renders the Library, tenant-scoped |
| Nimue offline spine | memory `project_nimue_offline_works` (Dexie cache, everything-is-messages) | partial — chat caching exists; Works download/cache is the gap |

### The gap = the sync loop (not the data model)
The data model is done (checksummed Blob-backed Work JSON). What's missing is the **pull/sync path**, both node↔node and node→client:

**B1 — Node→node distribution (consume the gossip).**
- Discovery already *advertises* a peer's catalog in the heartbeat. Build the **consumer**: read `endeavors[].catalog[]`, show subscribable Works from peers, and a lazy `GET /federation/item/:checksum` fetch that pulls a Work by content hash into the local node as a subscriber copy (emitting `rel=canonical` home).
- Acceptance: Node B subscribes to a Work canonical on Node A → it appears in B's `/works`, served locally, canonical pointing at A.

**B2 — Node→client offline (the Audible part).**
- Nimue downloads a Work's JSON + Blob assets (text now, audio later) into its local cache (Dexie/filesystem), keyed by **checksum** so it knows when a cached copy is stale (refetch only on checksum change — Works "rarely change").
- A downloaded Work reads fully offline; the library shows downloaded vs streamable state.
- Acceptance: download a Work in Nimue → airplane mode → still readable; author edits + republishes → checksum changes → client offers update.
- (Nimue client work = the Nimue repo / other thread. The backend pieces — Work JSON, checksum, Blob URLs, a "give me this Work" endpoint — live here.)

**B3 — Audio Works (later).**
Same loop, audio asset on the Blob. Ties to the daily-rollup / Suno soundtrack pipeline for generated narration.

### Distribution ≠ events/cart
Works distribution is the federation/catalog path, **not** commerce — a Work is free-to-read by doctrine (Prime Directive). Monetization, if any, is subscription/membership around the library, not per-Work checkout.

---

## PART C — Nimue as Jarvis: the visual echo

### The idea
Nimue → voice/text → LEO → the 125-tool layer is **already remote control of Angel OS**. What's missing isn't power, it's **trust feedback**: when LEO changes something, *show* it. After a content mutation, the client displays a miniature **before ▸ after** of the affected surface. Pairs with the Article III human-confirmation rule — see the diff, then confirm.

### Decision: client-side echo, integration-light
Do the snapshotting **in the client**, not with a server-side headless-browser/screenshot vendor (that's a new integration point we don't want). Nimue already renders any Angel OS URL in a webview:
- **"After" is free** — reload the affected URL.
- **"Before"** — Nimue snapshots that same URL right before sending the command, holds it, shows them side-by-side.
- The backend's only job: tell the client **which URL changed**.

### Backend enabler — SHIPPED 2026-06-17
`affectedUrl` enrichment at the single tool chokepoint (`executeToolCall` in `src/utilities/leo-data-tools.ts`):
- Every `CONTENT_MUTATION_TOOLS` result now gets an appended `<!--affectedUrl:{"url":"…"}-->` directive, mapped from collection+slug → public surface (`affectedPublicUrl`): products→`/products/<slug>`, posts→`/posts/<slug>`, pages→`/` or `/<slug>`, branding/nav/endeavor→`/`. Media/unknown → none.
- `src/endpoints/leo-stream.ts` extracts these from tool results (deterministic, same path as image-URL extraction — NOT the fragile fullText echo) and emits a new SSE event in both stream paths:
  **`event: affectedUrl` · `data: { "urls": ["/products/foo"] }`**
- The directive is stripped from persisted/displayed text (`stripNavDirective` now also strips `affectedUrl`).

### Client contract (for the Nimue thread)
Listen for the SSE `affectedUrl` event during a LEO turn. On receipt: you have the public path(s) LEO just changed. Snapshot-before (captured when the command was sent) + reload-after → render the before/after card. No new endpoint, no auth change. v2: LEO also returns a one-line "what changed and why" to caption the echo.

## Suggested execution order
1. **Rung 0** — flip LiveKit on in prod (minutes) → Nimue beta gets voice.
2. **B2 backend bits** — ensure a clean "fetch this Work by checksum" endpoint exists for Nimue to cache against (small; unblocks the offline showpiece).
3. **Rung 3** — LEO voice agent worker (the showpiece "call and LEO answers"). Largest, highest-wow.
4. **B1** — node→node Works distribution (federation consumer).
5. **Rungs 1–2** then **4–5** — SIP inbound → AI Bus → PBX features → retire VAPI, as telephony demand justifies.

Rationale: 0 and the B2 backend are near-free and directly serve the beta clients. Rung 3 and B1 are the two "showpiece" builds. Telephony/PBX (rungs 1–2, 4–5) is real but follows demand, not speculation.

---

## Caveats kept honest
- LiveKit SIP still needs a **SIP trunk provider** for real numbers — not zero-integration, but a commodity one.
- The **LEO voice agent is a new deployable** (an Agents worker), not a Next.js route — plan hosting for it.
- Call it **"AI-native voice,"** not "full PBX," until the feature layer (voicemail/IVR/transfer) exists.
- Works are **free-to-read by doctrine** — distribution is federation, not commerce.
