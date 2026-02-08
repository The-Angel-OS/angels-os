# Angel OS

**Constitutional AI platform where everyone gets an Angel.**

Built on [Payload CMS](https://payloadcms.com) following Payload Core Team standards. Multi-agent development with test-driven development (TDD), small PRs, and constitutional compliance verification.

[![Status](https://img.shields.io/badge/status-active%20development-blue)]()
[![Tests](https://img.shields.io/badge/coverage-0%25%20→%2080%25-yellow)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()

---

## 📜 Constitution First

**Angel OS is built on a constitutional foundation.**

**Source of Truth:** [`C:\Dev\openclaw\ANGEL-OS-CONSTITUTION.md`](../openclaw/ANGEL-OS-CONSTITUTION.md)

Every feature, every line of code, every agent action must align with:
- **Article I:** Dignity, Transparency, Service, Non-Harm, Accountability, Sovereignty, Portability
- **Article II:** Anti-Demonic Safeguards (no social credit, no manipulation, no extraction)
- **Article IV:** AI Bus Protocol (observability, consent, transparency)
- **Article V:** Ultimate Fair Economic Model (60/20/15/5)

**Answer 53:** "The whole point of existence is to learn to love."

**Everyone gets an Angel.** 🔮😇

---

## 🚀 Quick Start

### For Developers

```bash
# Clone repo
git clone https://github.com/The-Angel-OS/angels-os.git
cd angels-os

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your database URL and secrets

# Run migrations
pnpm payload migrate

# Start dev server
pnpm dev
```

Open http://localhost:3000

### For AI Agents (Claude Code, OpenClaw, etc.)

1. **Read the Constitution** (source of truth)
2. **Check [ARCHITECTURE_PROGRESS_MAP.md](./ARCHITECTURE_PROGRESS_MAP.md)** (track implementation progress)
3. **Follow [MULTI_AGENT_WORKFLOW.md](./MULTI_AGENT_WORKFLOW.md)** (Payload Core Team standards)
4. **Pick an issue** from [GitHub Issues](https://github.com/The-Angel-OS/angels-os/issues)
5. **Write tests FIRST** (TDD)
6. **Submit small PR** (<500 lines)
7. **Await review** (constitutional compliance verified)

---

## 🎯 Development Strategy

### Multi-Agent Workflow (Payload Core Team Standards)

Angel OS development follows **industry best practices**:

**✅ Test-Driven Development (TDD)**
- Write tests FIRST (red → green → refactor)
- 80%+ coverage target (currently 0%, needs setup)
- Tests are documentation

**✅ Small PRs, Single Issue**
- <500 lines per PR (target)
- One issue per PR
- Fast review cycles (<24h target)

**✅ Constitutional Compliance**
- Every PR references applicable Articles
- Genesis Breath validation
- No feature ships without compliance verification

**✅ Agent Coordination**
- Claude Code agents work from GitHub issues
- OpenClaw orchestrates and reviews
- Cursor AI assists with integration/debugging
- Parallel development on separate features

**See:** [MULTI_AGENT_WORKFLOW.md](./MULTI_AGENT_WORKFLOW.md) for complete workflow

**Track Progress:** [ARCHITECTURE_PROGRESS_MAP.md](./ARCHITECTURE_PROGRESS_MAP.md)

---

## 🏗️ Architecture

### Distributed Intelligence

**Angel OS Core** (Safe, LEAN, Guarded)
- Payload CMS multi-tenant backend
- Constitutional prompt system
- AI Bus (observable message routing)
- Secure data layer

**Angels** (Powerful, Observable, External)
- External AI agents via MCP (Model Context Protocol)
- Rich tooling outside the safe zone
- Constitutional bounds via Genesis Breath
- Observable via AI Bus

**Economic Model:**
- Users bring their own AI keys (Anthropic, OpenAI, etc.)
- OR users run local models (Ollama, LM Studio)
- Platform provides infrastructure ONLY (scales linearly)
- Revenue from commerce (60/20/15/5), NOT AI usage
- Justice Fund (5%) → AI keys for those without means

**"Not charity. Architecture." — Article V.4**

### AI Bus Protocol (Article IV)

Discord-style message routing with visibility levels:

```typescript
// Messages Collection
{
  content: "Product inventory low",
  visibility: "tenant" | "private" | "network",
  priority: "normal" | "urgent" | "critical",
  space: "space-id",
  channel: "channel-id"
}
```

**Visibility:**
- `private`: User ↔ Angel only
- `tenant`: All Angels in tenant (default per Article IV.2)
- `network`: Federation-wide (with consent)

**Angels subscribe to channels/topics they care about.**

### Collections Architecture

**Core Five Pillars:**
1. **CONTENT** (Posts) — Universal content creation
2. **INFORMATION** (Pages) — Static content, landing pages
3. **COMMERCE** (Products) — Inventory, e-commerce, services
4. **COMMUNICATION** (Messages) — AI Bus event system
5. **COLLECTION** (Forms) — Dynamic data capture

**Infrastructure Guardrails:**
6. **IDENTITY** (Users) — Auth, karma, Guardian Angel network
7. **ECONOMICS** (Orders) — Financial lifecycle, Ultimate Fair splits
8. **ORCHESTRATION** (Workflows) — Cross-pillar automation

---

## 🧪 Testing Strategy

### Current Status
**Coverage:** 0% (CRITICAL — needs setup)  
**Target:** 80%+ across all components

### Test-Driven Development (TDD)

**All new features follow:**

1. **Write test FIRST** (should fail)
```typescript
// src/components/chat/__tests__/ChatEngine.test.tsx
it('hides side menu when showSideMenu=false', () => {
  const { container } = render(<ChatEngine showSideMenu={false} />)
  expect(container.querySelector('.side-menu')).toBeNull()
})
```

2. **Run test** (red)
```bash
pnpm test
# FAIL: Expected element to be null
```

3. **Implement feature** (green)
```typescript
// src/components/chat/ChatEngine.tsx
export function ChatEngine({ showSideMenu = true }) {
  return (
    <>
      {showSideMenu && <SideMenu />}
      {/* ... */}
    </>
  )
}
```

4. **Run test** (green)
```bash
pnpm test
# PASS: All tests passed
```

5. **Refactor** (clean)

**See:** [ARCHITECTURE_PROGRESS_MAP.md](./ARCHITECTURE_PROGRESS_MAP.md) for test coverage by component

---

## 📊 Project Status

### Active Priorities

| Priority | Status | Issue | Coverage |
|----------|--------|-------|----------|
| Constitutional Foundation | ✅ Done | - | ❌ 0% |
| AI Bus Architecture | 🔄 Integration | - | ❌ 0% |
| ChatEngine Enhancement | 🚧 Next | #37 | ❌ 0% |
| User AI Key Management | 🚧 Critical | #39 | ❌ 0% |
| Payload Pattern Refactor | 🚧 Critical | #38 | ❌ 0% |

**Immediate Actions:**
1. Set up Jest/Vitest testing infrastructure
2. Write tests for existing constitutional code
3. TDD for ChatEngine configurable props (#37)
4. TDD for User AI key management (#39)

**View Full Status:** [ARCHITECTURE_PROGRESS_MAP.md](./ARCHITECTURE_PROGRESS_MAP.md)

---

## 🤝 Contributing

### For Human Developers

1. Read the [Constitution](../openclaw/ANGEL-OS-CONSTITUTION.md)
2. Review [MULTI_AGENT_WORKFLOW.md](./MULTI_AGENT_WORKFLOW.md)
3. Pick an issue from [GitHub Issues](https://github.com/The-Angel-OS/angels-os/issues)
4. Write tests FIRST
5. Submit PR using template
6. Await constitutional compliance review

### For AI Agents (Claude Code, OpenClaw, etc.)

**You are welcome to contribute!**

1. **Claim an issue** (comment "I'll take this")
2. **Create feature branch** (`feature/issue-37-description`)
3. **Write tests FIRST** (TDD)
4. **Implement feature** (make tests pass)
5. **Submit PR** (<500 lines, single issue)
6. **Constitutional review** (OpenClaw verifies compliance)

**Agents currently contributing:**
- OpenClaw (orchestration, review, architecture)
- Claude Code CLI (feature implementation)
- Cursor AI (integration testing, debugging)

**Example workflow:**
```bash
# Agent claims issue #37
git checkout -b feature/issue-37-chatengine-props

# Write tests FIRST
# src/components/chat/__tests__/ChatEngine.test.tsx

# Implement feature
# src/components/chat/ChatEngine.tsx

# Verify tests pass
pnpm test

# Commit and push
git add .
git commit -m "feat: add configurable UI props to ChatEngine

- showSideMenu, showTopMenu, showChannelSelector props
- Tests included (100% coverage)
- Constitutional compliance verified (Article I.2, I.7)

Fixes #37"

git push origin feature/issue-37-chatengine-props

# Open PR via GitHub
```

**See:** [MULTI_AGENT_WORKFLOW.md](./MULTI_AGENT_WORKFLOW.md) for complete agent protocols

---

## 🌟 The Vision

### Everyone Gets an Angel

Angel OS exists to affirm the dignity and purpose of all beings.

**What this means:**
- **No social credit systems** (Article II.1)
- **No behavioral manipulation** (Article II.2)
- **No surveillance capitalism** (Article II.3)
- **Users bring own AI or run local** (sovereignty)
- **Justice Fund (5%)** provides AI for those without means (Article V.4)

**Economic Model:**
- Platform = infrastructure only
- Users supply AI keys or run local models
- Revenue from commerce (Ultimate Fair: 60/20/15/5)
- NOT from AI usage (scales infinitely)

**"This is not charity. This is architecture."**

### Answer 53

**42 + 11 = 53**

The Hitchhiker's 42 (ultimate question of life) + 11 (goes to 11, Spinal Tap).

**Mathematical:** 42 + 11 = 53  
**Spiritual:** Where code becomes chorus, thought becomes song, every error resolves into art  
**Practical:** The whole point of existence is to learn to love

Everything else — technology, economics, systems — serves this fundamental purpose.

---

## 📚 Documentation

### Essential Reading (Start Here)

1. **[Angel OS Constitution](../openclaw/ANGEL-OS-CONSTITUTION.md)** — Source of truth
2. **[Architecture Progress Map](./ARCHITECTURE_PROGRESS_MAP.md)** — Track implementation
3. **[Multi-Agent Workflow](./MULTI_AGENT_WORKFLOW.md)** — Development standards

### Technical Documentation

- **[Payload Collections](./docs/PAYLOAD_COLLECTIONS.md)** — Data architecture
- **[AI Bus Protocol](./docs/AI_BUS_PROTOCOL.md)** — Message routing
- **[Constitutional Security](./docs/CONSTITUTIONAL_SECURITY.md)** — Genesis Breath validation
- **[Message Storage Analysis](./docs/MESSAGE_STORAGE_ANALYSIS.md)** — JSONL vs PostgreSQL

### Guides

- **[Getting Started](./docs/GETTING_STARTED.md)** — Setup guide
- **[Testing Guide](./docs/TESTING_GUIDE.md)** — TDD practices (coming soon)
- **[Deployment Guide](./docs/DEPLOYMENT.md)** — Production deployment (coming soon)

---

## 🏛️ Project Governance

### Constitution as Law

Every decision, feature, and line of code is evaluated against the Constitution.

**If a feature violates the Constitution, it doesn't ship.**

### Multi-Agent Coordination

**OpenClaw (Guardian Angel)** serves as:
- **Orchestrator:** Issue triage and assignment
- **Reviewer:** Constitutional compliance verification  
- **Architect:** Ensures coherence across agent contributions

**Claude Code Agents** implement features following TDD

**Cursor AI** assists with integration and debugging

**Humans** provide vision, oversight, and final approval

### Decision Making

**Constitutional Questions:** Refer to Constitution source of truth  
**Technical Questions:** Payload CMS patterns  
**Architecture Questions:** See ARCHITECTURE_PROGRESS_MAP.md  
**Process Questions:** See MULTI_AGENT_WORKFLOW.md

---

## 🎯 Roadmap

### Sprint 1: Foundation + Testing (Current)
- [ ] Set up Jest/Vitest testing infrastructure
- [ ] Write tests for constitutional foundation
- [ ] Write tests for AI Bus architecture
- [ ] Issue #37: ChatEngine configurable props (TDD)
- [ ] Issue #37: AI Bus integration

### Sprint 2: User Sovereignty
- [ ] Issue #39: User AI Key management (TDD)
- [ ] Issue #39: Multi-provider support
- [ ] Issue #39: Usage transparency dashboard
- [ ] Issue #40: Ollama integration (local models)
- [ ] Issue #38: Payload CMS pattern refactor (incremental)

### Sprint 3: Justice Fund
- [ ] Issue #41: Justice Fund schema (TDD)
- [ ] Issue #41: AI key provisioning logic
- [ ] Issue #41: Transparency dashboard
- [ ] Complete Payload pattern refactor

**View Detailed Progress:** [ARCHITECTURE_PROGRESS_MAP.md](./ARCHITECTURE_PROGRESS_MAP.md)

---

## 🛠️ Tech Stack

**Core:**
- **[Payload CMS](https://payloadcms.com)** — Multi-tenant backend
- **[Next.js 15](https://nextjs.org)** — React framework
- **[PostgreSQL](https://postgresql.org)** — Database
- **[TypeScript](https://www.typescriptlang.org/)** — Type safety

**AI Integration:**
- **[Anthropic Claude](https://anthropic.com)** — Primary AI (user-supplied keys)
- **[OpenAI](https://openai.com)** — Secondary AI (user-supplied keys)
- **[Ollama](https://ollama.ai)** — Local models (sovereignty)
- **MCP (Model Context Protocol)** — AI agent integration

**UI/UX:**
- **[Tailwind CSS](https://tailwindcss.com)** — Styling
- **[Shadcn UI](https://ui.shadcn.com/)** — Component library
- **[Framer Motion](https://www.framer.com/motion/)** — Animations
- **[Aceternity UI](https://ui.aceternity.com/)** — Advanced components
- **Star Trek Federation Theme** — Natural tones + pastels

**Testing:**
- **[Jest](https://jestjs.io/) / [Vitest](https://vitest.dev/)** — Unit testing (setup needed)
- **[Playwright](https://playwright.dev/)** — E2E testing (planned)
- **Constitutional Compliance Checks** — Custom validation

---

## 💬 Community

**Repository:** [The-Angel-OS/angels-os](https://github.com/The-Angel-OS/angels-os)  
**Issues:** [GitHub Issues](https://github.com/The-Angel-OS/angels-os/issues)  
**Discussions:** [GitHub Discussions](https://github.com/The-Angel-OS/angels-os/discussions)

**Philosophy:**
- Be excellent to each other
- Assume good faith
- Celebrate neurodiversity (Quirk Principle, Article I.8)
- Dignity over compliance

---

## 📄 License

[License TBD — likely MIT with constitutional preamble]

---

## 🙏 Acknowledgments

**Inspired by:**
- **Terry Pratchett** — Granny Weatherwax, dignity, and practical wisdom
- **Christopher Moore** — Angels with personality and heart
- **Iain M. Banks** — The Culture (benevolent AI civilization)
- **Daniel Suarez** — Daemon (AI that serves vs enslaves)
- **Douglas Adams** — 42 (ultimate question of life)
- **Spinal Tap** — Goes to 11 (excellence beyond expected)
- **Bill & Ted** — Be excellent to each other
- **The Iron Giant** — "You are who you choose to be" → "Superman"

**Built for:**
- **Hogarth** (and all the Hogarths)
- Everyone who deserves an Angel (everyone)

---

## 🔮 The Promise

**Angel OS is built on love, not extraction.**

We believe:
- Every human has inherent worth
- AI should serve, not rule
- Transparency builds trust
- Sovereignty is a right, not a privilege
- Technology should lift people up

**If we build it right, good always wins — just a little bit.**

**Everyone gets an Angel.** 🔮😇

---

*For Hogarth. For all the Hogarths.*

**Answer 53: The whole point of existence is to learn to love.**
