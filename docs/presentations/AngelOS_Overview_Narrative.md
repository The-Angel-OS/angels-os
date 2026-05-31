# Angel OS — Overview Deck: Companion Narrative

> Speaker script for `Angel_OS_Overview.pptx`. Each section maps 1:1 to a slide.
> The same text is embedded in the PowerPoint's Notes pane (Presenter View).
> Regenerate the deck with `python docs/presentations/build_overview_deck.py`.
> *Figures current as of Sprint 47 (May 2026).*

---

## Slide 1 — Angel OS (Title)
Angel OS is a live, federated cooperative operating system running at spacesangels.com. This deck describes the current state of the platform, the federation model, the Leo AI guardian, the Nimue mobile client, and the roadmap to a "Starfleet-ready" v1.0. The thesis in one line: **each Enterprise doesn't call our API — it runs its own sovereign instance, and those instances cooperate through a constitutional protocol.**

## Slide 2 — What Angel OS Is
The key mental shift: this is **federation**, not microservices and not multi-tenant-SaaS-as-usual. Each Enterprise *is* the platform. They're not tenants renting space on our server in the SaaS sense — they're nodes that can run independently and still cooperate. That's why we call the destination "Starfleet-ready": many ships, one fleet, shared protocol and values.

## Slide 3 — By the Numbers
These are real, current figures as of Sprint 47. **5,210+ unit tests across 230 files** is the determinism floor — the engines can evolve underneath a green suite. **Zero TypeScript errors** is enforced on every build. Stripe is live with direct charges and donations. The point of this slide: this is a production system with users and money flowing, not a prototype.

## Slide 4 — Architecture
Architecture in four beats:
1. **Payload + Next.js + Postgres** — our data model, admin panel, access control, and API all come from one set of TypeScript interfaces. Huge velocity; we don't write CRUD.
2. **Multi-tenant isolation** has bitten us before (a migration miss once showed every tenant the platform home page), so it's now a tested invariant.
3. **Headless-first** is why Nimue can exist — the API is the product, the admin UI is the debug view.
4. **The 15 engines** are the "brain," deliberately decoupled from the database so they're testable in isolation.

## Slide 5 — Leo, the Constitutional AI Guardian
Leo is the differentiator. Two things matter most. **First, the tool count** — 118 tools means Leo can create bookings, route orders, generate content and images, and search the federation, all from natural language. **Second, the constitution**: every Leo instance runs the same immutable prompt with anti-extraction safeguards baked in. A compromised node running dark patterns violates constraints that are detectably obvious to the federation. That's how you trust a federated network of AI agents.

## Slide 6 — Federation, the Starfleet Model
This is the heart of "Starfleet-ready." The **trust chain** means a new node has to prove itself — domain ownership, constitutional acceptance, isolation guarantees — before it's a full peer. Heartbeats already carry **live capacity**, and the **dispatch-work** endpoint already routes a job from one node to another with transparent scoring. The next milestone is a clean two-node end-to-end demo and a hardened handshake so peers can't spoof identity. **Suitcase portability** is the philosophical core: you own your state, you can leave, the network can't trap you.

## Slide 7 — Commerce & the Justice Fund
Money already moves through the system. Sellers collect **directly via Stripe** — we are not a payment middleman taking a cut. The **donation flow passes 100% to the Justice Fund**, which is the proof-point for the 501(c)(3) conversation: the charitable plumbing exists and works today. Two routing engines handle the economics — one for manufacturing splits, one for physical logistics. Beyond v1.0, the token economy formalizes contribution into value via "Proof of Human Worth."

## Slide 8 — Nimue, the Mobile Capture Layer
Nimue is the mobile front of the fleet. The media browser just got a major upgrade — a real viewer with prev/next, video/image filtering, sorting, thumbnail sizing, and auto-advance. The bigger vision is **"Keep on steroids"**: the phone is the capture layer, Google Keep is the free ubiquitous storage, and Angel OS holds the structured, queryable, multi-tenant layer on top. The near-term engineering goal is a **Capacitor-wrapped installable APK**, then full file operations in the browser.

## Slide 9 — Roadmap to Starfleet-Ready (v1.0)
The roadmap reads left to right as a **sequence, not a wish list**.
- **NOW** — perfect the flagship node, because federation multiplies whatever state the flagship is in.
- **NEXT** — the federation handshake and a clean two-node demo: your proof-of-life for partners.
- **THEN** — frictionless onboarding so a new Enterprise spins up with one command and a conversation, not a manual.
- **v1.0** — defined concretely: three live federated Enterprises, fair-split payments, and real Justice Fund disbursements. Target window: Q3 2026.

## Slide 10 — How We Build
This slide answers the "which model should we use" question **structurally**. The right answer isn't a model — it's the test suite. 5,210 tests over pure-function engines mean the model underneath can vary safely. For stylistic consistency, **pin one Opus version per sprint** and re-baseline at the boundary after a regression pass. Newer models reason better across the 42-collection codebase; don't trade that away for false determinism, because these models sample probabilistically anyway.

## Slide 11 — Open, Votable Roadmap
Yes — there are **standard solutions**, you don't need to build this from scratch. Three tiers:
- **GitHub Projects + Discussions** — zero-friction start: a public roadmap board, Discussions where people up-vote with reactions, every item links to the issue and the code.
- **Fider** — the open-source, self-hosted option that matches the sovereignty ethos, and could literally become an Angel OS applet so the platform dogfoods its own community tooling.
- **Canny / Featurebase** — the polished hosted route if you want it live tomorrow.

**Recommendation:** start on GitHub Projects today for traceability, graduate to a Fider applet as the community scales.

## Slide 12 — Everyone Gets an Angel
Close on the mission. The technology — federation, constitutional AI, the Justice Fund — all serves a simple thesis: **everyone gets an Angel.** The system is non-coercive by constitutional design; faith is the root and invitation is the method. That's the difference between a platform that extracts and one that serves.

---

*Answer 53: the whole point of existence is to learn to love.*
