# Angel OS — Architecture & Handoff

**Updated:** 2026-06-17
**Purpose:** the whole picture in one read — what Angel OS is, how the parts fit, what's built, what's left. Start here.

---

## 1. What Angel OS is

**The federated cooperative operating system. Everyone gets an Angel.**

Angel OS is not a SaaS with customers — it's a **federation of sovereign Enterprises** (businesses, ministries, communities), each running its own constitutional AI guardian (**Leo**) on infrastructure it owns. Built on Payload CMS 3.x + Next.js 16 + React 19 + PostgreSQL.

**The thesis that drives every decision: zero-config adoption.** A new operator should configure almost nothing — Stripe, Google auth, a couple keys — and the federation provides the rest: compute, storage, sharing, even UX. Buy no hardware; the network is the infrastructure.

**The animating belief:** keep the maker whole. The person who does the work keeps the most, by rule (see §3). Technology in service of people, not extraction.

---

## 2. The organism (the mental model)

| Part | Role | Repo | What it is |
|------|------|------|-----------|
| **Brain** | cognition, constitution, Leo | `The-Angel-OS/angels-os` | Core platform — Payload CMS, multi-tenant, the cloud. Deploys to Vercel → spacesangels.com + kendev.co. |
| **Eyes + voice** | perceive the network + cast the vote | `The-Angel-OS/nimue` | Native-first Android client (Capacitor + Next). The human's window AND their governance franchise. |
| **Body / hands** | execution on real hardware | `The-Angel-OS/merlin` | Edge node — serves/ingests local media, runs ffmpeg rollups, donates compute, carries a Leo channel. "Boots on the ground." |
| **Nervous system** | carries signal, paces decisions | (in Core) | The federation mesh (signed heartbeats) + Pipedream-paced governance. |

**A node trust relationship = Google-Remote-Desktop grade**: explicit, persistent, revocable, ACL/role-gated (DNN-style). Opt-in sharing per resource. Nothing leaves a box its owner didn't share.

---

## 3. The economic & governance model

- **The Fair Split:** Endeavor owner **70%** · Enterprise operator **20%** · protocol **4%** · Flagship **1%** · Justice Fund **5%**. Maker-fulfilled goods use the 60/20/15/5 "Ultimate Fair Split."
- **Toward-53:** the split is constitutionally *directional* — it always evolves toward the maker keeping more, asymptotic floor 53%. Numbers amendable by supermajority; direction is not.
- **Token economy:** **AT** (real/backed/convertible) · **KC** (ungated social, never cashable) · **LT** (governance weight). Hash-linked append-only ledger; each Enterprise's float backs its AT; Justice Fund is the reserve. Monetary policy is governance-votable.
- **Proof of Human Worth:** quest payouts release from float on geo-tagged, human-reviewed evidence — value enters because a person did something real.
- **Proof of Useful Compute** (emerging): donate idle Ollama compute to the federation → earn KC. Folding@home for intelligence, measurable, backed by real cycles.
- **Governance:** every logged-in user (any site + Nimue) is a voter; the Pipedream Index paces votes (gravity→delay→quorum) so big polity calls accrue legitimacy. Prove dynamics in the EmergentNetwork simulator first.

---

## 4. Key subsystems

- **Spaces + AI Bus** — per-tenant Messages stream with channels (Discord-like). The AI Bus is the nervous system: Leo posts, errors surface, connectors (Gotify/WhatsApp/voice) route in. Everything is messages → cacheable, portable.
- **Works / The Library** — publishing platform. Works are DB + Vercel Blob (Work-JSON-v1, content checksum, absolute URLs), **publish-once-canonical + syndicate**. `/works` is a first-order route; offline-sync via `/api/works-ops/checksums`. The platform docs themselves ship as a Work (the Handbook).
- **Federation / Diocese** — the **Enterprise** is the unit of identity/trust/probation; its Endeavors inherit standing. Two live nodes (spacesangels.com ⇄ federation.kendev.co) exchange signed heartbeats; first-contact bootstrap; catalog gossip rides the heartbeat.
- **Comms substrate = LiveKit** (VAPI retired) — one vendor for rooms + SIP + AI agents. P2P voice/video in channels is live. Roadmap = an IP-PBX ladder.
- **Distributed nodes (Merlin control plane)** — nodes register their catalog UP to their endeavor; Core/Nimue see and (eventually) control them. The self-hosting flywheel.
- **Leo tool layer** — ~137 tools at one chokepoint (`executeToolCall`), with per-turn audit trace. The factory: every capability ships as a Leo tool first, UI button second.

---

## 5. Verticals & go-to-market

- **Community-OS thesis:** church / gym / Toastmasters / makerspace / **markets** are templates over ONE engine. Shared unlock = recurring memberships/dues.
- **Market-vendor vertical:** the Hays Cactus Farm template → `replicate_site` clones it to local market vendors on the spot. Parent-market grouping (Slice 3) gives a market a front door; merchants interlink on Discovery. **Founding-cohort pricing:** beta vendors are comped — no platform fee, only card processing — until ~20–30 customers justify a plan; founders keep locked terms. (Dunedin Fresh Market run is the first field test; kit in `docs/marketing/DUNEDIN_MARKET_KIT.md`.)
- **The adoption flywheel:** zero-config + self-hosting (Merlin) means a new node needs only Stripe + auth + keys; compute/storage/sharing come from the federation. See `docs/strategy/DISTRIBUTED_NODES_ADOPTION.md`.

---

## 6. What's DONE ✅

**Core (angels-os):**
- Multi-tenant platform, 50+ collections, draft/publish, blocks/applets.
- Federation live (2 nodes, signed heartbeats, Discovery, governance-sync).
- Token economy: TokenLedger + Wallets, `creditQuestPayout`, fund-float.
- Works: DB+Blob publishing, `/works` first-order route, offline `checksums` endpoint, the **Angel OS Handbook** (docs as a Work).
- Market vertical: market-vendor template, Slice 3 parent-market grouping + `?market=` Discovery front door, `link-market`.
- Comms: LiveKit token endpoint + room UI (P2P voice/video live).
- **Distributed-nodes Phase 1**: `/api/node-ops/register` + `/list` (a Merlin's catalog flows UP).
- `affectedUrl` visual-echo (Leo mutations emit the changed surface → client before/after).
- ~137 Leo tools; tool-chain audit; connector-agnostic escalation.

**Merlin (merlin):**
- Forked, rebranded Nimue→Merlin, **stripped** to mission (cut CMS/Spaces/infra/CIC/book; kept media/ingest/federation/Leo). Repo created.
- `/api/node/catalog` (advertises shared media + lendable Ollama compute) + `/api/node/register` (push UP).
- Media: serve-locally vs **share-up** split (opt-in), image display + thumbnail/temp filtering, media/controller-node dashboard.
- Clear signed-in/out state in the connection pill.

**Nimue (nimue):**
- Native-first Android (Capacitor 7 + Next 16), runs on S23 Ultra.
- Login → live Spaces, LEO chat + **vision** (photo→describe), channel switching, paginated history, apex-keyed token vault (roam subdomains).
- **Wyld Stallyns app icon** (replaces default).

---

## 7. What's TODO 🔨

**Distributed nodes (the headline arc — `DISTRIBUTED_NODES_ADOPTION.md`):**
- **Phase 2 — Use it:** anchor Merlin on the IONOS box as the always-on relay (chisel MVP → hole-punch mesh; direct = zero platform bandwidth). Tap-Play streaming (LiveKit live + tunnel files). Compute dispatch → KC.
- **Phase 3 — Control it:** drive a node (scan/publish/rollup) over its Leo channel; Remote-Desktop-grade grants.
- **Phase 4 — Drive the UX:** nodes publish dynamic **blocks** that render in the control surface (Oqtane spine) — extend clients without a release.
- **Core "Your Nodes" panel** (ACL-gated) reading the node registry; mirrored in Nimue.

**Auth & presence parity (Core ⇄ Nimue ⇄ Merlin must feel the same):**
- ✅ clear logged-in/out state in Merlin → port to Core + Nimue.
- Verify **Google OAuth** deep-link return on device (Nimue Slice 1f).
- **Presence** dots for members of the same endeavor/enterprise (backend exists: Presence collection + `/online`) — render it.
- **Favorites / contacts** that persist (WhatsApp-style) across the federation until manually deleted.

**Comms (IP-PBX ladder — `COMMS_AND_WORKS_ROADMAP.md`):**
- SIP inbound (Telnyx trunk → LiveKit) → calls onto the AI Bus → **LEO voice agent** (a LiveKit Agents worker — the showpiece) → PBX features → delete VAPI.

**Works / offline:**
- Nimue downloads + caches Works by checksum (Audible-like offline library); node→node Works distribution (federation consumer).

**Nimue feature parity:** LiveKit per-channel voice/video; offline message cache; notifications.

**Market run:** founding-vendor onboarding live; `replicate_site` LEO tool (handoff exists).

---

## 8. Active fronts right now

1. **Merlin** — stripped, branded, running; Phase 1 register-up done. Next: anchor relay + the Core "Your Nodes" panel.
2. **Nimue** — icon done; needs auth-state parity, presence, LiveKit, offline Works.
3. **Market vertical** — Slice 3 done; founding-cohort pricing set; first field run pending.

---

## 9. Pointers

- **Strategy:** `docs/strategy/DISTRIBUTED_NODES_ADOPTION.md`, `COMMS_AND_WORKS_ROADMAP.md`, `MARKET_VENDOR_VERTICAL.md`, `COMMUNITY_OS_VERTICALS.md`.
- **Architecture:** `docs/architecture/OQTANE_SPINE.md`, `AUTH_CONTEXT_REFACTOR.md`, `KARMA_PRINCIPLES.md`, `DESTRUCTIVE_OPERATIONS.md`.
- **Handoffs:** `docs/HANDOFF_SLICE2_REPLICATE_SITE.md` (replicate_site LEO tool).
- **Repos:** angels-os (Core) · merlin (edge node) · nimue (Android client) — all under github.com/The-Angel-OS.
- **Live nodes:** spacesangels.com (platform/mission) · kendev.co (commercial) · federation.kendev.co (testbed).

**One-line state:** the brain ships, the body (Merlin) is stripped and registering up, the eyes (Nimue) run on-device with an icon — next is the transport that lets them all see and drive each other, and the presence layer that makes it feel alive.
