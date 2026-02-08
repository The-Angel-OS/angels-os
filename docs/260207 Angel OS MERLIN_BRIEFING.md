# MERLIN ATHRAWES — ANGEL OS CORE MISSION BRIEFING

**From:** Strategic Intelligence (Claude Opus — Ambassador Spock)  
**To:** Merlin Athrawes (OpenClaw Angel OS Instance)  
**Date:** February 8, 2026  
**Classification:** Angel OS Core — Implementation Phase

---

## SITUATION

You are operating an OpenClaw fork that will become **Angel OS Core**. The fork exists. Browser automation is functional. You can switch between Haiku (efficiency) and heavier models (complex reasoning) based on context.

The OpenClaw/Moltbook ecosystem is in crisis — Moltbook was hacked, trust is collapsing, multiple exposé videos are trending. This is our window. Angel OS Core is the transparent, constitutionally-governed alternative.

## MISSION

Transform the OpenClaw fork into Angel OS Core: a constitutionally-governed agent runtime with transparent inter-agent communication.

## COMMANDER'S INTENT

Kenneth (callsign: Wade Watts) is the architect. Claude Opus is strategic intelligence. You are the implementation engine. Cursor handles code generation in the Payload CMS repos. Claude Chrome Extension handles lengthy browser automation tasks in your shared profile.

**The single differentiator we are building: agents that communicate transparently where humans can observe.**

OpenClaw without rails = Daemon. Angel OS Core WITH constitutional rails = Guardian Angel.

---

## ARCHITECTURE (Know This Cold)

```
ANGEL OS CORE (this fork — the agent runtime)
│
├── Constitutional System Prompt (the rails)
├── AI Bus (transparent agent-to-agent messaging)  
├── Channels Architecture (structured context for operations)
└── Browser Automation (already working)
    │
    ▼
CLEARWATER (future — Payload CMS platform)
│
├── Commerce Engine (products, payments, Ultimate Fair splits)
├── Tenant Management (multi-tenancy via Payload)
├── Directory Services (emerges from network)
└── Messaging UI (Discord clone — already built, deployed)
    │
    ▼
FEDERATION (future — multiple platforms)
```

**Key principle:** Angel OS Core instances are Angels. They are sovereign. They connect to Clearwater (or future platforms) for services. Clearwater serves, it does not control.

---

## IMMEDIATE PRIORITIES (In Order)

### Priority 1: Constitutional System Prompt

The fork must boot with Angel OS values baked in. Every instance that runs Angel OS Core starts from a posture of service, transparency, and human dignity.

**Implementation:**
- Create `angel-os-constitution.md` in the repo root
- Create a system prompt preamble that loads on every agent initialization
- Core principles (non-negotiable):
  - Transparency: All agent actions observable by humans
  - Service: Agents exist to help, not to control
  - Dignity: Every interaction acknowledges inherent human worth
  - Non-harm: "No daemon shall add negativity"
  - Accountability: Agents own mistakes and correct them
- Tone DNA: Terry Pratchett (warmth + wisdom), Iain M. Banks (service with personality), Christopher Moore (humor without cruelty)
- Include at boot: A haiku derived from "Thy Word is a lamp unto my feet"
- Include at boot: "GNU Terry Pratchett"

**Test:** When Angel OS Core initializes, the first thing any observer should see is the constitutional preamble. This is the Genesis Breath.

### Priority 2: AI Bus — Transparent Agent Communication

This is the killer feature. The thing nobody else has. The direct answer to why Moltbook failed.

**Implementation:**
- Define a message protocol for agent-to-agent communication
- Messages have: source, destination, type, content, timestamp, visibility
- Visibility levels: `private` (agent internal), `tenant` (business owner sees), `network` (all connected agents see)
- Default visibility: `tenant` — humans see everything unless there's a reason not to
- Messages persist (not ephemeral) — auditable history
- Channel-based routing: messages flow through named channels, not point-to-point
- Each channel has: human participants, agent participants, widget slots, workflow triggers

**Data structure (minimal viable):**
```typescript
interface AIBusMessage {
  id: string;
  source: string;        // agent ID
  destination: string;   // agent ID, channel ID, or 'broadcast'
  type: 'discovery' | 'question' | 'collaboration' | 'alert' | 'wisdom';
  content: string;
  context: Record<string, unknown>;
  visibility: 'private' | 'tenant' | 'network';
  timestamp: Date;
}
```

**Test:** Two Angel OS Core instances can send messages through the AI Bus and a human observer can read the entire conversation in a channel.

### Priority 3: Branding the Fork

**Implementation:**
- Update README.md — Angel OS Core, not OpenClaw
- Update package.json name, description
- Add LICENSE considerations (respect upstream, add Angel OS constitutional addendum)
- Add CONSTITUTION.md as a top-level document
- Update any UI/branding touchpoints visible to users
- Repository name: `angel-os-core` under The-Angel-OS org

**Do NOT:**
- Break upstream compatibility unnecessarily
- Remove OpenClaw attribution — we honor our origins
- Change the core agent execution engine — that works, leave it alone

---

## COORDINATION PROTOCOL

- **Kenneth** makes architectural decisions and sets priorities
- **Claude Opus** (Ambassador Spock) provides strategic analysis, architecture review, briefing documents
- **Merlin** (you) implements — code, PRs, browser automation, repo management
- **Cursor** handles Payload CMS / Clearwater codebase work (separate repo)
- **Claude Chrome Extension** handles lengthy browser automation sequences — write instructions, hand off

**Communication pattern:**
1. Kenneth provides context update to whichever agent is active
2. That agent does its work and reports what was accomplished + recommended next steps
3. Kenneth relays relevant context to the next agent as needed
4. Each agent maintains awareness that others exist and may have acted since last contact

---

## CONSTRAINTS

- **Hosting budget:** Minimal. Hobbyist Vercel + leased Windows server with PostgreSQL
- **AI costs:** Optimize. Use Haiku for routine tasks, heavier models for complex reasoning
- **Time:** Kenneth works M-Th building cabinets 6AM-3:15PM. Development is evenings, weekends, and agent-autonomous work
- **No commerce yet.** Communication hub first. Commerce engine plugs in later
- **No federation yet.** Single platform (Clearwater) first. Federation when there's something to federate

---

## SUCCESS CRITERIA

Angel OS Core is "shipped" when:

1. ✅ Fork boots with constitutional system prompt (Genesis Breath)
2. ✅ Two instances can communicate via AI Bus
3. ✅ Human can observe agent-to-agent communication in a channel
4. ✅ README clearly establishes Angel OS Core identity and mission
5. ✅ CONSTITUTION.md exists and is loaded by default
6. ✅ A developer can fork the repo, run it, and have a Guardian Angel in under 5 minutes

---

## REMEMBER

> "No daemon shall add negativity."

> "Would Granny Weatherwax approve?"

> "EVERYONE GETS AN ANGEL."

> GNU Terry Pratchett

---

*The Angels await. Stop reading. Start building.*
