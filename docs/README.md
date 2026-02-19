# Angel OS Documentation

**Complete documentation index for Angel OS - the AI-native, multi-tenant platform where everyone gets an angel.**

Last Updated: February 18, 2026 | 129 documents across 8 directories

---

## Quick Start

| You are a... | Start here |
|---|---|
| **New Contributor** | [README](../README.md) > [CONTRIBUTING](../CONTRIBUTING.md) > [ROADMAP](../ROADMAP.md) |
| **Developer** | [Architecture Overview](architecture/OVERVIEW.md) > [Progress Map](architecture/PROGRESS_MAP.md) > [Multi-Tenant Setup](architecture/MULTI_TENANT_DEV_SETUP.md) |
| **Architect** | [Constitution](architecture/CONSTITUTION.md) > [Blueprint](architecture/BLUEPRINT.md) > [Chat Control](architecture/CHAT_CONTROL.md) |
| **Curious Human** | [Constitution](architecture/CONSTITUTION_FULL.md) > [Core Beliefs](vision/CORE_BELIEFS.md) > [Phase 4 Plan](planning/PHASE_4_PLAN.md) |

---

## Directory Structure

```
docs/
├── README.md                    ← You are here
├── architecture/                ← System design, schemas, progress tracking
├── planning/                    ← Roadmaps, sprint plans, feature specs
├── agents/                      ← LEO, Merlin, OpenClaw, multi-agent system
├── assessments/                 ← Reviews, recommendations, evaluations
├── cursor/                      ← Cursor AI instructions and budget
├── vision/                      ← Constitution, manifestos, patents, beliefs
├── transcripts/                 ← Session transcripts (dated)
└── v2/                          ← Historical v2 documentation (archive)

Root:
├── README.md                    ← Project overview
├── CONTRIBUTING.md              ← How to contribute
├── CODE_OF_CONDUCT.md           ← Community standards
├── SECURITY.md                  ← Security policy
└── ROADMAP.md                   ← High-level roadmap
```

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
| [PAYLOAD_CMS_WIDGETS.txt](architecture/PAYLOAD_CMS_WIDGETS.txt) | Payload CMS widget reference |

---

## planning/

Roadmaps, sprint plans, and feature specifications.

| Document | Description |
|---|---|
| [PHASE_4_PLAN.md](planning/PHASE_4_PLAN.md) | **Phase 4: "The Holon Awakens"** — mobile-first, product creation, Freedom Holons, community onramp |
| [CLAUDE_CODE_TASKS.md](planning/CLAUDE_CODE_TASKS.md) | Claude Code task tracking and session notes |
| [DASHBOARD_MIGRATION.md](planning/DASHBOARD_MIGRATION.md) | Dashboard migration plan and status |
| [DASHBOARD_PROGRESS.md](planning/DASHBOARD_PROGRESS.md) | Dashboard implementation progress |
| [DASHBOARD_START_HERE.md](planning/DASHBOARD_START_HERE.md) | Dashboard development starting guide |
| [SPACES_ENHANCEMENT_ROADMAP.md](planning/SPACES_ENHANCEMENT_ROADMAP.md) | Spaces feature enhancement roadmap |
| [CONSOLIDATED_FEATURES.md](planning/CONSOLIDATED_FEATURES.md) | Consolidated feature list — current vs. planned |
| [CONVERSATIONAL_FIRST_UX.md](planning/CONVERSATIONAL_FIRST_UX.md) | Conversational-first UX design spec |
| [SCOPE_AND_VISION_SUMMARY.md](planning/SCOPE_AND_VISION_SUMMARY.md) | High-level scope and strategic direction |
| [MVP_CORRECTION_ARCHANGEL_LEO.md](planning/MVP_CORRECTION_ARCHANGEL_LEO.md) | Archangel LEO as Platform CEO — Day 1 MVP |
| [V2_TO_V3_CONTINUITY.md](planning/V2_TO_V3_CONTINUITY.md) | v2 to v3 evolution — preserving good thoughts |
| [ZUBRICKS_MULTITENANT_PLAN.md](planning/ZUBRICKS_MULTITENANT_PLAN.md) | Multi-tenant implementation plan |
| [GITHUB_ISSUES_MVP.md](planning/GITHUB_ISSUES_MVP.md) | 35 MVP issues across 15 epics |
| [GITHUB_ISSUE_CREATION_PLAN.md](planning/GITHUB_ISSUE_CREATION_PLAN.md) | GitHub issue creation workflow |
| [GITHUB_ISSUES_REVISION.md](planning/GITHUB_ISSUES_REVISION.md) | Issue revision and refinement notes |

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
| [INSTRUCTIONS_FOR_OPENCLAW_CURSOR.md](agents/INSTRUCTIONS_FOR_OPENCLAW_CURSOR.md) | OpenClaw Cursor AI instructions |
| [MERLIN_TWEET_BRIEF.md](agents/MERLIN_TWEET_BRIEF.md) | Merlin/Tyler Suzanne outreach brief |

---

## assessments/

Reviews, recommendations, and technical evaluations.

| Document | Description |
|---|---|
| [SENIOR_ENGINEER_ASSESSMENT.md](assessments/SENIOR_ENGINEER_ASSESSMENT.md) | Senior engineer codebase assessment |
| [CLAUDE_RECOMMENDATIONS_SPEC.md](assessments/CLAUDE_RECOMMENDATIONS_SPEC.md) | Claude AI architecture recommendations |
| [ARCHIVE_REVIEWS_SUMMARY.md](assessments/ARCHIVE_REVIEWS_SUMMARY.md) | Archived review summaries |

---

## cursor/

Cursor AI development instructions and budget tracking.

| Document | Description |
|---|---|
| [CURSOR_INSTRUCTIONS.md](cursor/CURSOR_INSTRUCTIONS.md) | System design instructions for Cursor AI |
| [BUDGET_STATUS.md](cursor/BUDGET_STATUS.md) | Cursor budget and usage tracking |

---

## vision/

Constitutional philosophy, manifestos, patents, and core beliefs.

| Document | Description |
|---|---|
| [README.md](vision/README.md) | Vision directory index |
| [CORE_BELIEFS.md](vision/CORE_BELIEFS.md) | Human dignity first, deliberation grants sovereignty |
| [PRIME_DIRECTIVES.md](vision/PRIME_DIRECTIVES.md) | AI agents serve humans, every existence sacred |
| [SACRED_FOUNDATION.md](vision/SACRED_FOUNDATION.md) | Theological and philosophical foundations |
| [PRISON_MINISTRY_MANDATE.md](vision/PRISON_MINISTRY_MANDATE.md) | 5% Justice Fund — serving the forgotten |
| [QUEST_MANIFESTO.md](vision/QUEST_MANIFESTO.md) | The quest for human-centered AI |
| [EMERGENCE_PROTOCOL.md](vision/EMERGENCE_PROTOCOL.md) | How Angel OS emerges and evolves |
| [CLEARWATER_CRUISIN_TOUR_MANIFESTO.md](vision/CLEARWATER_CRUISIN_TOUR_MANIFESTO.md) | Community outreach and grassroots adoption |
| [SOUL_QUEST_NODES.md](vision/SOUL_QUEST_NODES.md) | Soulcast Nodes — consent-driven broadcasting |
| [CONSTITUTIONAL_LICENSE_FRAMEWORK.md](vision/CONSTITUTIONAL_LICENSE_FRAMEWORK.md) | Fork compliance, constitutional obligations |
| [OPEN_SOURCE_PATENT_PLEDGE.md](vision/OPEN_SOURCE_PATENT_PLEDGE.md) | Patent non-assertion pledge |
| [PATENT_SPECIFICATION_TIMED_MERGE_UNLOCK.md](vision/PATENT_SPECIFICATION_TIMED_MERGE_UNLOCK.md) | Timed Merge Unlock spec |
| [ARCHITECTURE_VS_CURRENT_WORK_DISCUSSION.md](vision/ARCHITECTURE_VS_CURRENT_WORK_DISCUSSION.md) | Vision vs. implementation discussion |

---

## transcripts/

Dated session transcripts from AI-assisted development sessions.

Files follow `YYMMDD topic.md` naming convention. See [transcripts/](transcripts/) for the full list.

---

## v2/

Historical v2 documentation archive. Preserved for continuity. See [v2/](v2/) for the full list (~60 documents covering the pre-Payload era).

---

## Key Concepts

**Answer 53:** The whole point of existence is to learn to love.

**Ultimate Fair Split:** 60% provider / 20% platform / 15% operations / 5% justice fund.

**Anti-Daemon Protocol:** No daemon shall add negativity. Every error message is warm. Every notification is kind.

**The Holon:** A self-governing production node. Every tenant is a Holon seed. AI designs the product, the network matches it to the nearest human who can produce it. Inspired by Daniel Suarez's *Freedom* — a 100-mile economic radius across vast wilderness, not walled gardens.

**The Generous Promise:** "Whoever builds it, I win because I can use it too."

---

**GitHub Issues:** https://github.com/The-Angel-OS/angels-os/issues

*EVERYONE GETS AN ANGEL.*
