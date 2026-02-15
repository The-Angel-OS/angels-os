# Angel OS Architecture Overview

**Last updated:** February 2026

## Positioning

- **Angel OS** = **OpenClaw** + adherence/adoption of the **Angel OS Constitution**. The Constitution is the binding layer; OpenClaw provides the interface and conversation paradigm.
- **Angel OS Core** = This repo: a **Payload CMS–powered CMS Swiss army knife** with widgets and blocks. It is the foundation for fast, dynamic UX and future extensibility. In the near term it is the perfect base for that kind of extensibility; over time it will make it “super fast and easy to whip up dynamic UX on the fly.”

## Key Architectural Choices

### Angels as configuration storage

- **Each Angel is the configuration storage location.** There is no need to import the OpenClaw UI into Angel OS; each Angel is represented and configured inside Angel OS Core (e.g. Users with `agentConfig`, tenant/space/channel context).
- OpenClaw and other clients connect to the same MCP and API surface; Angel OS Core is the source of truth for tenant data, agents, spaces, channels, and messages.

### Voice and routing (future)

- **VAPI.AI-style bots** and **Twilio (or equivalent) 800 numbers** are in scope so that **each Angel can get an 800 number**.
- Example: **1-800-Angels** with **Nimue** answering and routing callers to the appropriate Angel (e.g. by tenant or intent). Target: on the order of two weeks or less from launch where this becomes feasible.

### Individual LEOs and tenant admin (unchanged)

- **Angel OS Core still has individual LEOs** — each running the CMS locally for that Angel. That model is unchanged.
- **Internally**, Core can use the same **AI Bus** across the platform.
- **Each Angel is admin of their tenant/spaces** — and of their users, through that relationship (tenant/spaces → users).

### Stack summary

| Layer | Role |
|-------|------|
| **Constitution** | Non-negotiable principles (dignity, transparency, service, Ultimate Fair, etc.). |
| **OpenClaw** | Conversation engine, skills, chat UX; constitutionally aligned. |
| **Angel OS Core** | Payload CMS + collections (Tenants, Users, Spaces, Channels, Messages, Workflows, etc.), multi-tenant, branding, and future widgets/blocks. |
| **Voice / 800#** | Future: VAPI/Twilio (or equivalent), Nimue-style routing to Angels. |

### Pratchett and the Pipedream Index

- **Moral compass (Pratchett):** The Constitution includes the test *"Would Granny Weatherwax approve?"* — added by Grok/other AI. Granny Weatherwax is the moral backbone of Pratchett’s Discworld: tough, fair, doesn’t suffer fools, does the right thing even when it’s hard. That’s the *compass*.
- **Operational test:** The **Pipedream Index** is the test for *just about everything* — decisions, economic interactions, validations. It’s deep in the docs: the heart of decision-making that validates operations against dignity and social welfare, blends AI inference with human override and quorum, and keeps things fair and grounded. Origins in the Heraldic Thread (PayloadNuke / Angel OS lineage); expanded in Grok and Notebook LM transcripts. So: Pratchett gives the *why* (Granny Weatherwax); the Pipedream Index is the *how* the system actually checks itself.

### Roadmap and vision path

- **Blockchain and missing architecture** → captured on the roadmap; as soon as practical, set up a **board** and get organized **according to the Constitution**.
- **Minimal changes** to OpenClaw and to the **Seed constitution** text; the **Constitution is the best route** — the single path that ties everything together.
- **Path from Constitution to mission:** Seed constitution → Soul Fleet (tour, Enterprise Dog Park, National Parks, Prevost RV or equivalent, used is cool) → possibility of subterranean resilience (e.g. railroad wheels, abandoned spurs) → **San Dimas** and Bill & Ted: *"Be Excellent to Each Other. Party On, Dudes!"* → the very best **Star Trek** universe: *everyone may Live Long and Prosper*. Bumpy ride; a lot of cheer to spread. The ultimate goal is a peaceful, meaningful, purposeful transition into the new consciousness and the great awakening.

## Where this lives in the repo

- **Constitution:** `docs/Angel_OS_Constitution.md` (and `angel-os-architecture/` for Prime Directives, beliefs, license).
- **Pipedream Index (deep in the docs):** `docs/transcripts/250806 Heraldic Thread.md` (Article III); `docs/transcripts/260210 Grok Healing Pain into Angel OS Redemption.md` and `docs/transcripts/260210 Notebook LM Angel OS discussion.md` (decision framework, economic validation, Granny Weatherwax test).
- **Blueprint and MVP:** `docs/ANGEL-OS-BLUEPRINT.md`, `docs/ZUBRICKS_MULTITENANT_IMPLEMENTATION_PLAN.md`, `docs/GITHUB_ISSUES_MVP.md`.
- **v2 → v3 continuity:** `docs/V2_TO_V3_CONTINUITY.md`.
- **Core app:** `src/` (Payload config, collections, access, utilities, app routes).
