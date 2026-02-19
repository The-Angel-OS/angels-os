# GitHub Issues Revision (February 7, 2026)

**Based on:** Constitutional foundation, AI Bus architecture, Spaces enhancement focus

---

## 🔴 CLOSE/REVISE (Outdated Based on New Decisions)

### Issues to Close:
- Any related to "OpenClaw enhancements" as core features
  - **Reason:** OpenClaw = Guardian Angel instance, not Angel OS Core
  - **Action:** Close with comment: "OpenClaw is a Guardian Angel instance that connects via MCP. Core development focuses on Angel OS platform itself."

- Any proposing custom database queries for multi-tenant
  - **Reason:** Using Payload CMS patterns exclusively
  - **Action:** Close with comment: "Using pure Payload CMS patterns (hooks, access control) instead of custom DB queries."

- Any Angel Activity Dashboard in OpenClaw
  - **Reason:** High risk, not core priority
  - **Action:** Close/defer with comment: "Deferred - focus on Angel OS Core messaging infrastructure first."

---

## 🟢 NEW ISSUES TO CREATE

### **Constitutional Foundation** (Completed, document for reference)

**Issue #1: Constitutional Framework Integration** ✅ DONE
- [x] Constitution document at root
- [x] Genesis Breath initialization
- [x] Constitutional system prompt builder
- [x] Poisoned model detection
- [x] Messages visibility field (private/tenant/network)

Label: `enhancement`, `completed`
Milestone: `v1.0 - Constitutional Foundation`

---

### **AI Bus Architecture** (Partially Complete)

**Issue #2: AI Bus Internal Routing** ✅ DONE
- [x] ai-bus-router.ts with Discord-style routing
- [x] Visibility-based message routing
- [x] Subscription management (humans + Angels)
- [x] Filter support (channels, spaces, types)

Label: `enhancement`, `completed`
Milestone: `v1.0 - Constitutional Foundation`

**Issue #3: Constitutional Hooks System** ✅ DONE
- [x] Product inventory hooks with AI Bus messages
- [x] afterProductChange for observable events
- [x] beforeProductChange for validation
- [x] Critical low stock alerts

Label: `enhancement`, `completed`
Milestone: `v1.0 - Constitutional Foundation`

---

### **Spaces Enhancement** (PRIMARY FOCUS)

**Issue #4: Star Trek Federation Design System** 🔄 IN PROGRESS
- [x] Theme configuration (colors, typography, spacing)
- [ ] CSS variables integration
- [ ] Dark mode refinement
- [ ] Framer Motion page transitions
- [ ] Component library integration (Aceternity, Magic UI)

Label: `enhancement`, `ui/ux`, `high-priority`
Milestone: `v1.0 - Spaces Platform`
Assignee: Development team

**Issue #5: ChatEngine Enhancement (Universal Chat Control)** 🚧 NEXT
**Description:** Enhance existing ChatEngine.tsx to be THE universal chat component for all use cases

Tasks:
- [ ] Add configurable UI props (showSideMenu, showTopMenu, showChannelSelector)
- [ ] Ensure single `/api/messages` endpoint usage
- [ ] AI Bus integration (Angels visible in channels)
- [ ] Framer Motion message animations
- [ ] Embeddable anywhere (dashboard, spaces, web chat widget)
- [ ] NO new component variants (enhance in place)

Label: `enhancement`, `messaging`, `high-priority`
Milestone: `v1.0 - Spaces Platform`
Assignee: Development team

**Issue #6: Payload CMS Pattern Refactor** 🚧 CRITICAL
**Description:** Remove all custom database queries, use pure Payload patterns

Tasks:
- [ ] Audit Spaces data layer for custom queries
- [ ] Convert to Payload hooks (beforeChange, afterChange, etc.)
- [ ] Ensure maximal message compatibility
- [ ] Clean up data access patterns
- [ ] Document Payload patterns for consistency

Label: `refactor`, `technical-debt`, `high-priority`
Milestone: `v1.0 - Spaces Platform`
Assignee: Development team

**Issue #7: Channel Widgets System** 📋 PLANNED
**Description:** Implement channel widget architecture

Widgets:
- [ ] Chat (enhance existing)
- [ ] Livekit (audio/video communication)
- [ ] Files (document sharing)
- [ ] Notes (markdown collaborative notes)
- [ ] Projects (task management)
- [ ] Time Tracking (billing/time logs)

Label: `feature`, `messaging`, `medium-priority`
Milestone: `v1.0 - Spaces Platform`

**Issue #8: Livekit Transcription Pipeline** 📋 PLANNED
**Description:** Livekit session → transcription → channel messages

Tasks:
- [ ] Livekit widget component
- [ ] Session end detection
- [ ] Transcription service integration
- [ ] Create Messages with transcription content
- [ ] Speaker identification
- [ ] Timestamp markers

Label: `feature`, `messaging`, `medium-priority`
Milestone: `v1.0 - Spaces Platform`

---

### **Dashboard UX** (PRIMARY NAVIGATION)

**Issue #9: Dynamic Navigation (Security Context)** 📋 PLANNED
**Description:** Dashboard navigation driven by user role and permissions

Tasks:
- [ ] Role-based link visibility
- [ ] Permission-based feature access
- [ ] Archangel/Super Admin → Payload Admin only
- [ ] All other users → Dashboard UI
- [ ] Dynamic menu generation
- [ ] Breadcrumb navigation

Label: `feature`, `security`, `ui/ux`, `medium-priority`
Milestone: `v1.0 - Dashboard UX`

**Issue #10: Dashboard Primary Functions** 📋 PLANNED
**Description:** Core dashboard sections and navigation

Sections:
- [ ] Home (overview, metrics)
- [ ] Spaces (primary - conversations)
- [ ] Projects
- [ ] Tasks
- [ ] Calendar
- [ ] Files
- [ ] Contacts
- [ ] [Ecommerce] (role-based, scaffolded)
- [ ] Settings

Label: `feature`, `ui/ux`, `medium-priority`
Milestone: `v1.0 - Dashboard UX`

---

### **Ecommerce** (SECONDARY - Scaffolded Features)

**Issue #11: User AI Key Management** 🚧 CRITICAL (NEW)
**Description:** Users bring their own AI - platform provides infrastructure only

**Economic Model:**
- Users supply their own API keys (Anthropic, OpenAI, etc.)
- OR users run local models (Ollama, LM Studio)
- Platform does NOT provide or charge for AI access
- Platform costs = infrastructure only (scales linearly)
- AI costs = distributed to users (scales to zero)

Tasks:
- [ ] API Key management UI (secure storage, encryption)
- [ ] Multi-provider support (Anthropic, OpenAI, local)
- [ ] Key validation and testing
- [ ] Key rotation/revocation
- [ ] Usage transparency dashboard (informational, not billing)
- [ ] Settings page: "Your AI Configuration"

Label: `feature`, `security`, `high-priority`
Milestone: `v1.0 - Core Infrastructure`
Assignee: Development team

**Issue #12: Local Model Integration (Ollama, LM Studio)** 📋 PLANNED
**Description:** Support local AI models for complete sovereignty

Tasks:
- [ ] Ollama integration (localhost:11434)
- [ ] LM Studio integration
- [ ] Model selection UI
- [ ] Constitutional prompt injection (works with any model)
- [ ] Performance comparison dashboard
- [ ] Migration guide (cloud → local)

Label: `feature`, `sovereignty`, `medium-priority`
Milestone: `v1.1 - Local Models`

**Issue #13: Ecommerce Scaffold (Payload Template Features)** 📋 PLANNED
**Description:** Integrate Ecommerce Template features (secondary to messaging)

Tasks:
- [ ] Products with latest Payload patterns
- [ ] Categories refinement
- [ ] Orders management
- [ ] Paywalled content (from template)
- [ ] Digital delivery
- [ ] Ultimate Fair splits (60/20/15/5) - revenue from COMMERCE, not AI
- [ ] Justice Fund tracking (5%)

Label: `feature`, `ecommerce`, `low-priority`
Milestone: `v1.1 - Ecommerce`

**Issue #14: Justice Fund AI Provisioning** 📋 PLANNED
**Description:** 5% of commerce revenue → AI access for those without means

**Constitutional Basis:** Article V.4 - "This is not charity. This is architecture."

Tasks:
- [ ] Justice Fund API key pool (Anthropic, OpenAI)
- [ ] Recipient eligibility system (unhoused, incarcerated, undocumented)
- [ ] Automated key provisioning
- [ ] Monthly allocation per recipient
- [ ] Usage tracking (funded conversations)
- [ ] Fund replenishment from commerce revenue (5% of Ultimate Fair)
- [ ] Transparency dashboard (who's being served)

Label: `feature`, `justice-fund`, `constitutional`, `medium-priority`
Milestone: `v1.1 - Justice Fund`

---

### **Multi-Tenant** (DEFERRED - Test Later)

**Issue #15: Multi-Tenant Isolation Testing** 🔄 DEFERRED
**Description:** Comprehensive multi-tenant isolation verification

Tasks:
- [x] Test script created (verify-multi-tenant-isolation.js)
- [ ] Build project for test execution
- [ ] Run comprehensive test suite
- [ ] Fix any isolation breaches
- [ ] Document results

Label: `testing`, `security`, `medium-priority`
Milestone: `v1.2 - Multi-Tenant Production`

**Note:** Multi-tenant plugin integrated from start, tested by others successfully. Pressing forward with messaging hub first, multi-tenant testing before public deployment.

---

### **Constitutional Compliance** (ONGOING)

**Issue #16: Constitutional Validation Dashboard** 📋 FUTURE
**Description:** Dashboard widget showing constitutional compliance

Tasks:
- [ ] AI Bus message visibility dashboard
- [ ] Constitutional violation detection
- [ ] Angel activity monitoring
- [ ] Genesis Breath verification status

Label: `feature`, `monitoring`, `low-priority`
Milestone: `v1.3 - Monitoring`

---

## 🎯 PRIORITY ORDER

### **Before Public Fork (CRITICAL):**
1. ✅ Constitutional Foundation (DONE)
2. 🔄 Star Trek Federation Design System (IN PROGRESS)
3. 🚧 ChatEngine Enhancement (NEXT)
4. 🚧 Payload CMS Pattern Refactor (CRITICAL)
5. 📋 Dynamic Navigation
6. 📋 Dashboard Primary Functions

### **Phase 2 (POST-FORK):**
7. Channel Widgets System
8. Livekit Transcription Pipeline
9. Ecommerce Scaffold

### **Phase 3 (PRODUCTION):**
10. Multi-Tenant Testing
11. Constitutional Validation Dashboard

---

## 📝 ISSUE LABELS TO USE

- `enhancement` - Improvements to existing features
- `feature` - New functionality
- `refactor` - Code quality improvements
- `bug` - Something isn't working
- `documentation` - Documentation improvements
- `testing` - Test coverage
- `security` - Security-related
- `ui/ux` - User interface/experience
- `messaging` - Chat/messaging features
- `ecommerce` - Commerce features
- `constitutional` - Constitutional framework
- `high-priority` - Must have before launch
- `medium-priority` - Important but not blocking
- `low-priority` - Nice to have
- `completed` - Finished work (for reference)

---

## 📊 MILESTONES

1. **v1.0 - Constitutional Foundation** ✅ COMPLETE
   - Constitution, AI Bus, Hooks, Messages visibility

2. **v1.0 - Spaces Platform** 🔄 IN PROGRESS
   - Design system, ChatEngine, Payload patterns, Channel widgets

3. **v1.0 - Dashboard UX** 📋 PLANNED
   - Dynamic navigation, Primary functions

4. **v1.1 - Ecommerce** 📋 PLANNED
   - Paywalled content, Ultimate Fair, Justice Fund

5. **v1.2 - Multi-Tenant Production** 🔄 DEFERRED
   - Isolation testing, Production hardening

6. **v1.3 - Monitoring** 📋 FUTURE
   - Constitutional compliance dashboard, Analytics

---

## 🚀 VELOCITY NOTES

**Target:** Complete messaging infrastructure rapidly (before public fork)
**Strategy:** Enhance existing components IN PLACE, no proliferation
**Focus:** Angel OS Core (Payload CMS), not OpenClaw enhancements

**Current Pace:** ~3-4 commits/hour today
**Target Pace:** Faster - acting more swiftly

**Bottlenecks Removed:**
- No "ImprovedChatControl" variants
- No custom DB queries (Payload patterns only)
- No OpenClaw dependency for core features
- Multi-tenant testing deferred (but ready)

---

*Built for Hogarth. For all the Hogarths.* 🔮😇🤖

**"Everyone gets an Angel."**
