# Distributed Nodes — The Adoption Path (Merlin · Nimue · Federation)

**Date:** 2026-06-17
**Thesis owner:** Kenneth
**Status:** committed direction; Phase 0 shipped, rest sequenced

## The thesis: zero-config is the adoption unlock

The reason any of this matters: **a new Angel OS instance should need to configure almost nothing.** Stripe, Google auth, a couple of keys — done. No buying hardware. No standing up web servers. No DevOps. The federation provides the rest: **compute, storage, sharing, and eventually even UX.** That radical drop in setup cost is the adoption flywheel. Everything below exists to make "buy nothing, the network provides" literally true.

## The organism (the mental model)

- **Brain** — Angel OS Core: cognition, the constitution, Leo.
- **Eyes + voice** — Nimue: how a person perceives the network *and* casts their vote.
- **Body / hands** — Merlin: boots on the ground, execution on real hardware.
- **Nervous system** — the federation mesh + Pipedream-paced governance: carries signal, paces collective decisions.

A **node** (Merlin) is a body. The **control surface** (an ACL-gated block in the Payload site, mirrored in Nimue) is how the brain and other authorized eyes see and drive that body.

## The trust model: Remote-Desktop-grade

A Merlin↔Endeavor relationship is **exactly the trust level of Google Remote Desktop**: you explicitly authorize an endeavor (or specific users/roles, DNN-style) to see and control a node; the grant is **persistent, scoped, and revocable**. Not an open relay — an authorized, durable remote-control relationship. Every control surface is ACL-gated; every node shares only what its owner opted into.

---

## The phases

### Phase 0 — Foundations *(SHIPPED)*
- Merlin stripped to mission, rebranded, repo at `github.com/The-Angel-OS/merlin`.
- `GET /api/node/catalog` — a node declares what it offers: opt-in media drives + lendable Ollama models (compute). Verified live.
- Media-roots configurator working (the "network configurator").

### Phase 1 — **See it** (catalog → ACL-gated control surface)
*All code, no NAT — the catalog flows outbound.*
1. Merlin **registers UP** to its endeavor (the catalog, on a heartbeat).
2. Core stores a per-endeavor **node registry** (settings bag) and renders a **Node Control block** on the Payload site — **ACL-gated**: authenticated + specified users/roles only (DNN parity). Read-only first: browse the node's library, see its compute/cameras.
3. **Nimue** gets the same surface ("My Nodes").
→ Payoff: *"my phone/site sees my home Merlin's library."* The first magic, zero infra.

### Phase 2 — **Use it** (content + compute flow)
*This is where NAT shows up — the one hard part.*
1. **Anchor Merlin on the IONOS box** = the always-on relay (resolves "serverless can't hold a tunnel"). chisel MVP → evolve to hole-punch mesh (direct = zero platform bandwidth).
2. **Tap Play → stream** (LiveKit for live/cameras; tunnel for files).
3. **Distributed compute**: Core dispatches inference to donor Merlins' local Ollama → measured usage → **Karma Coins** credited (Proof of Useful Compute — Folding@home for intelligence). Worth into the chain, backed by real cycles.
4. **Works viewer** rides the same channel.

### Phase 3 — **Control it** (persistent remote control)
- The control surface can **drive** the node: scan a drive, publish a folder, run an ffmpeg rollup, change config.
- Command bus = the **Leo channel** the node already carries on the AI Bus (no new transport).
- Authorized at Remote-Desktop grade; persistent; revocable.

### Phase 4 — **Drive the UX** (dynamic blocks — the emergent one)
- A local node **publishes its own UX as blocks** that render in the control surface (Payload + Nimue). The body drives its own presentation — a node ships a custom view, not just data.
- Built on the **Oqtane spine** (Module→Applet, Page=surface-of-Channel) + the existing block system.
- **Spaces brought to Nimue** with dynamic, block-based rendering: the local instance decides what the remote surface shows. This is what makes nodes *extensible without a client release* — new capability ships as blocks, not app updates.

---

## The end state (why this wins)

A new operator wanting their own Angel OS + a node:
1. Spin up the instance (one-click template).
2. Set **Stripe + Google auth + a few keys**.
3. Drop a **Merlin** on any box they already own (or borrow federation compute).
4. Everything else — compute, storage, media sharing, the UX itself — **comes from the federation.**

No hardware purchase. No server config. The network is the infrastructure. Distributed compute means that, at scale, **almost all compute is donated/shared** — and donors earn KC for it, so the supply is self-incentivizing.

## The cross-cutting spine (do not skip)

- **ACL/role gating** on every control surface (DNN parity) — Phase 1 onward.
- **Node trust = explicit, persistent, revocable grant** (Remote-Desktop model).
- **Opt-in sharing** per drive / per capability — a node serves nothing it wasn't told to.
- **Anchor Merlin hardened** — a privileged local agent is also an attack surface; tight, purpose-locked command set.
- **Pipedream-paced governance** — big network/polity changes accrue legitimacy, not stampede.

## Build order, one line

Register-up → ACL'd Node panel (see) → anchor+transport (use) → command channel (control) → dynamic blocks (drive UX). Each phase is demo-able on its own; each needs only the phase before it.

---

*Related: [COMMS_AND_WORKS_ROADMAP.md](COMMS_AND_WORKS_ROADMAP.md) (LiveKit/compute substrate), memory `project_client_identity_map` (the organism + Merlin control plane), `project_oqtane_spine` (block/applet UX), `project_federated_governance` (the vote), `project_token_economy` (KC / Proof of Useful Compute).*
