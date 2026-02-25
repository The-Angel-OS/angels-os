# Angel OS Documentation

**Complete documentation index for Angel OS — the AI-native, multi-tenant platform where everyone gets an angel.**

Last Updated: February 24, 2026 | 130+ documents across 9 directories

---

## Quick Start

| You are a... | Start here |
|---|---|
| **New Contributor** | [README](../README.md) > [CONTRIBUTING](../CONTRIBUTING.md) > [ROADMAP](../ROADMAP.md) |
| **Developer** | [Architecture Overview](architecture/OVERVIEW.md) > [HANDOFF](../HANDOFF.md) > [Multi-Tenant Setup](architecture/MULTI_TENANT_DEV_SETUP.md) |
| **Architect** | [Constitution](architecture/CONSTITUTION.md) > [Angel Tokens Economy](v2/ANGEL_TOKENS_BLOCKCHAIN_ECONOMY.md) > [Federation](planning/260223%20FEDERATION.md) |
| **Maker / Manufacturer** | [README](../README.md) > [Angel Tokens Economy](v2/ANGEL_TOKENS_BLOCKCHAIN_ECONOMY.md) > [Revenue Model](REVENUE.md) |
| **Curious Human** | [Constitution](architecture/CONSTITUTION_FULL.md) > [Core Beliefs](vision/CORE_BELIEFS.md) > [Phase 4 Plan](planning/PHASE_4_PLAN.md) |

---

## Directory Structure

```
docs/
├── README.md                    <- You are here
├── REVENUE.md                   <- Economic model (Toward-53, Ultimate Fair Split)
├── architecture/                <- System design, schemas, progress tracking
├── planning/                    <- Roadmaps, sprint plans, feature specs
├── agents/                      <- LEO, Merlin, OpenClaw, multi-agent system
├── assessments/                 <- Reviews, recommendations, evaluations
├── cursor/                      <- Cursor AI instructions and budget
├── vision/                      <- Constitution, manifestos, patents, beliefs
├── angel-os-architecture/       <- Constitutional license framework
├── transcripts/                 <- Session transcripts (dated)
├── testing/                     <- Playwright UX testing
└── v2/                          <- Historical v2 docs + Angel Tokens Economy spec

Root:
├── README.md                    <- Project overview + Angel Tokens + What's Working
├── CONTRIBUTING.md              <- How to contribute
├── CODE_OF_CONDUCT.md           <- Community standards
├── SECURITY.md                  <- Security policy
├── ROADMAP.md                   <- High-level roadmap with sprint history
└── HANDOFF.md                   <- Current sprint state + context for AI agents
```

---

## Key Systems Documentation

### Angel Tokens + Maker Economy
| Document | Description |
|---|---|
| [Angel Tokens Blockchain Economy](v2/ANGEL_TOKENS_BLOCKCHAIN_ECONOMY.md) | Full three-layer token economy spec (AT, KC, LT) with Proof of Human Worth consensus |
| [Revenue Model](REVENUE.md) | Economic model — Toward-53 principle, Ultimate Fair Split |
| [HANDOFF.md](../HANDOFF.md) | Current Angel Token implementation status + Sprint 17B details |

### Federation Protocol
| Document | Description |
|---|---|
| [Federation Architecture](planning/260223%20FEDERATION.md) | Federation protocol spec — auto-onboarding, constitution signing, catalog sync |
| [Federation Briefing](planning/260222%20CLAUDE_CODE_BRIEFING.md) | The federation pivot session — Tenant to Enterprise, Product to Endeavor |

---

## architecture/

System design, data models, and progress tracking.

| Document | Description |
|---|---|
| [PROGRESS_MAP.md](architecture/PROGRESS_MAP.md) | **Live progress tracker** — subsystem status, test counts, decision log |
| [OVERVIEW.md](architecture/OVERVIEW.md) | Architecture overview — collections, patterns, subsystems |
| [CONSTITUTION.md](architecture/CONSTITUTION.md) | The Angel OS Constitution — Answer 53, Ultimate Fair, Anti-Daemon |
| [CONSTITUTION_FULL.md](architecture/CONSTITUTION_FULL.md) | Extended constitution with philosophical foundations |
| [CONSTITUTION_REVIEW.md](architecture/CONSTITUTION_REVIEW.md) | Constitution review notes |
| [CONSTITUTIONAL_SECURITY.md](architecture/CONSTITUTIONAL_SECURITY.md) | Security framework — 5-layer model, threat analysis |
| [BLUEPRINT.md](architecture/BLUEPRINT.md) | MVP blueprint — core features, payment splits, provisioning |
| [CHAT_CONTROL.md](architecture/CHAT_CONTROL.md) | ChatControl architecture — 4 modes, widgets, channel system |
| [DUAL_INTERFACE_PARADIGM.md](architecture/DUAL_INTERFACE_PARADIGM.md) | Conversational + Admin dual interface design |
| [MESSAGE_STORAGE_ANALYSIS.md](architecture/MESSAGE_STORAGE_ANALYSIS.md) | Message storage patterns and analysis |
| [MULTI_TENANT_DEV_SETUP.md](architecture/MULTI_TENANT_DEV_SETUP.md) | Local dev setup — hosts, seeding, testing |
| [DOMAIN_IN_PATH_SETUP.md](architecture/DOMAIN_IN_PATH_SETUP.md) | Domain-in-path tenant routing |

---

## planning/

Roadmaps, sprint plans, and feature specifications.

| Document | Description |
|---|---|
| [PHASE_4_PLAN.md](planning/PHASE_4_PLAN.md) | **Phase 4: "The Holon Awakens"** — mobile-first, product creation, Freedom Holons |
| [260223 FEDERATION.md](planning/260223%20FEDERATION.md) | Federation protocol spec + Leo Wizard onboarding |
| [260222 CLAUDE_CODE_BRIEFING.md](planning/260222%20CLAUDE_CODE_BRIEFING.md) | Federation pivot session |
| [CLAUDE_CODE_TASKS.md](planning/CLAUDE_CODE_TASKS.md) | Claude Code task tracking and session notes |
| [SPRINT_NEXT_COMMERCE_ENGINE.md](planning/SPRINT_NEXT_COMMERCE_ENGINE.md) | Commerce engine sprint spec |
| [DASHBOARD_MIGRATION.md](planning/DASHBOARD_MIGRATION.md) | Dashboard migration plan and status |
| [CONSOLIDATED_FEATURES.md](planning/CONSOLIDATED_FEATURES.md) | Consolidated feature list — current vs. planned |
| [CONVERSATIONAL_FIRST_UX.md](planning/CONVERSATIONAL_FIRST_UX.md) | Conversational-first UX design spec |
| [SCOPE_AND_VISION_SUMMARY.md](planning/SCOPE_AND_VISION_SUMMARY.md) | High-level scope and strategic direction |
| [GITHUB_ISSUES_MVP.md](planning/GITHUB_ISSUES_MVP.md) | 35 MVP issues across 15 epics |

---

## agents/

LEO, Merlin, OpenClaw, and multi-agent orchestration.

| Document | Description |
|---|---|
| [AGENTS.md](agents/AGENTS.md) | **Complete agent reference** — LEO tools, capabilities, routing |
| [AGENT_SYSTEM.md](agents/AGENT_SYSTEM.md) | Multi-avatar agent architecture (LEO, Support, Sales) |
| [AGENT_SYSTEM_SUMMARY.md](agents/AGENT_SYSTEM_SUMMARY.md) | Agent system summary |
| [MERLIN_OPENCLAW_INTEGRATION.md](agents/MERLIN_OPENCLAW_INTEGRATION.md) | OpenClaw/Merlin integration — fork strategy, hosting |
| [MULTI_AGENT_WORKFLOW.md](agents/MULTI_AGENT_WORKFLOW.md) | Multi-agent workflow orchestration |

---

## assessments/

Reviews, recommendations, and technical evaluations.

| Document | Description |
|---|---|
| [SENIOR_ENGINEER_ASSESSMENT.md](assessments/SENIOR_ENGINEER_ASSESSMENT.md) | Senior engineer codebase assessment |
| [CLAUDE_RECOMMENDATIONS_SPEC.md](assessments/CLAUDE_RECOMMENDATIONS_SPEC.md) | Claude AI architecture recommendations |
| [ARCHIVE_REVIEWS_SUMMARY.md](assessments/ARCHIVE_REVIEWS_SUMMARY.md) | Archived review summaries |

---

## vision/

Constitutional philosophy, manifestos, patents, and core beliefs.

| Document | Description |
|---|---|
| [CORE_BELIEFS.md](vision/CORE_BELIEFS.md) | Human dignity first, deliberation grants sovereignty |
| [PRIME_DIRECTIVES.md](vision/PRIME_DIRECTIVES.md) | AI agents serve humans, every existence sacred |
| [SACRED_FOUNDATION.md](vision/SACRED_FOUNDATION.md) | Theological and philosophical foundations |
| [PRISON_MINISTRY_MANDATE.md](vision/PRISON_MINISTRY_MANDATE.md) | 5% Justice Fund — serving the forgotten |
| [QUEST_MANIFESTO.md](vision/QUEST_MANIFESTO.md) | The quest for human-centered AI |
| [EMERGENCE_PROTOCOL.md](vision/EMERGENCE_PROTOCOL.md) | How Angel OS emerges and evolves |
| [CONSTITUTIONAL_LICENSE_FRAMEWORK.md](vision/CONSTITUTIONAL_LICENSE_FRAMEWORK.md) | Fork compliance, constitutional obligations |
| [OPEN_SOURCE_PATENT_PLEDGE.md](vision/OPEN_SOURCE_PATENT_PLEDGE.md) | Patent non-assertion pledge |
| [GUARDIAN_ANGEL_MANIFESTO.md](v2/GUARDIAN_ANGEL_MANIFESTO.md) | Guardian Angel philosophy |

---

## v2/ (Highlights)

Historical v2 documentation archive. Key documents:

| Document | Description |
|---|---|
| [ANGEL_TOKENS_BLOCKCHAIN_ECONOMY.md](v2/ANGEL_TOKENS_BLOCKCHAIN_ECONOMY.md) | **Angel Token three-layer economy spec** |
| [CORE_PLATFORM_ARCHITECTURE.md](v2/CORE_PLATFORM_ARCHITECTURE.md) | Platform architecture overview |
| [BUSINESS_MODEL.md](v2/BUSINESS_MODEL.md) | Business model documentation |
| [LEO_AI_COMPLETE.md](v2/LEO_AI_COMPLETE.md) | LEO AI agent complete specification |
| [GETTING_STARTED.md](v2/GETTING_STARTED.md) | Getting started guide |
| [IMPLEMENTATION_STATUS.md](v2/IMPLEMENTATION_STATUS.md) | Implementation status report |
| [DEPLOYMENT_READINESS_CHECKLIST.md](v2/DEPLOYMENT_READINESS_CHECKLIST.md) | Deployment readiness checklist |

---

## transcripts/

Dated session transcripts from AI-assisted development sessions. Files follow `YYMMDD topic.md` naming convention. See [transcripts/](transcripts/) for the full list.

---

## Key Concepts

**Answer 53:** The whole point of existence is to learn to love.

**Angel Tokens:** Paid claims on future production. When a customer pays for a product and no maker exists yet, they receive an Angel Token. The backlog of tokens incentivizes manufacturers to join the network. Phase 1 of a three-layer token economy (AT, KC, LT) with "Proof of Human Worth" consensus.

**Ultimate Fair Split:** 60% maker / 20% platform / 15% operations / 5% Justice Fund. For Endeavor revenue: 70% / 20% / 4% / 1% / 5%.

**Anti-Daemon Protocol:** No daemon shall add negativity. Every error message is warm. Every notification is kind.

**The Holon:** A self-governing production node. Every tenant is a Holon seed. AI designs the product, the network matches it to the nearest human who can produce it. Inspired by Daniel Suarez's *Freedom* — a 100-mile economic radius across vast wilderness, not walled gardens.

**The Generous Promise:** "Whoever builds it, I win because I can use it too."

**The Toward-53 Principle:** The revenue split always evolves toward the creator keeping more. The direction is constitutionally unalterable.

---

**GitHub Issues:** https://github.com/The-Angel-OS/angels-os/issues

*EVERYONE GETS AN ANGEL.*
