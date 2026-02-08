# Spaces Enhancement Roadmap

**Goal:** Build spaces.kendev.co better - with Payload CMS patterns, Constitutional framework, Star Trek Federation aesthetic

**Reference:** Existing code in angel-os repo (v2 working model)

---

## 🎨 Phase 1: Design System (Star Trek Federation)

### **Aesthetic:**
- Natural tones + pastels
- Dark mode preferred
- Elegant but not overwhelming
- "Coolest Star Trek Federation"

### **Tech Stack:**
- **Shadcn UI** (base components)
- **Framer Motion** (animations, transitions)
- **Cool Shadcn Libraries:**
  - Aceternity UI
  - Magic UI
  - Other Shadcn-based component libraries

### **Tasks:**
- [ ] Create theme configuration (colors, spacing, typography)
- [ ] Set up Framer Motion page transitions
- [ ] Implement dark mode toggle with persistence
- [ ] Design system documentation (color palette, component usage)

---

## 💬 Phase 2: Spaces Core (Discord-Style, Better)

### **Current State:**
- ✅ Basic Discord Clone implementation
- ✅ Spaces, Channels, PM, Groups
- ✅ Livekit integration exists
- ✅ AI Bus foundation (from constitutional work)

### **Enhancement Goals:**

#### **2.1: Channel Widgets**
```typescript
interface ChannelWidget {
  type: 'chat' | 'livekit' | 'files' | 'notes' | 'project' | 'timetrack'
  component: React.ComponentType
  data: ChannelData
}
```

**Channel Types:**
1. **Chat** (existing) - Text messaging, AI Bus integration
2. **Livekit** (audio/video) - Real-time communication
   - Transcription → Channel Messages when session ends
   - Widget in channel, not separate page
3. **Files** - Document sharing, collaborative editing
4. **Notes** - Markdown notes, collaborative
5. **Projects** - Task management, timelines
6. **Time Tracking** - Time logs, billing

#### **2.2: Livekit Transcription Flow**
```
User joins Livekit session in channel
  ↓
Session runs (audio/video)
  ↓
User leaves / session ends
  ↓
Transcription service processes audio
  ↓
Create Messages in channel with:
  - type: 'transcription'
  - content: full transcript
  - metadata: speakers, timestamps, duration
  - visibility: tenant (AI Bus)
  ↓
Angels can process transcriptions
```

#### **2.3: Payload CMS Patterns**
- Use Payload collections for all data
- Avoid custom database queries
- Leverage Payload hooks for business logic
- Constitutional hooks for AI Bus messages

#### **2.4: AI Bus Integration**
- Angels visible in channel (online status)
- Angel messages show as system/leo type
- Constitutional transparency (all Angel actions observable)
- Real-time updates via WebSocket

### **Tasks:**
- [ ] Refactor channel data layer to Payload patterns
- [ ] Implement channel widget system
- [ ] Build Livekit widget component
- [ ] Set up Livekit transcription pipeline
- [ ] Integrate AI Bus routing with channels
- [ ] Angel presence indicators
- [ ] Real-time message updates (WebSocket/polling)

---

## 🛍️ Phase 3: Ecommerce Integration

### **From Ecommerce Template:**
- Paywalled content (premium channels/spaces)
- Digital delivery (downloadable content in channels)
- Products collection integration
- Checkout flow

### **Economic Model (CRITICAL UNDERSTANDING):**

**Users Bring Their Own AI:**
- Platform does NOT provide AI access
- Users supply their own API keys (Anthropic, OpenAI, etc.)
- OR users run local models (Ollama, LM Studio)
- Platform provides infrastructure + constitutional framework

**Why This Scales:**
- Platform costs = infrastructure only (cheap, linear)
- AI costs = distributed to users (scales to zero)
- Each user brings their own intelligence

**Ultimate Fair Revenue Model:**
```typescript
interface RevenueSplit {
  provider: 60%      // Human who did the work
  ministry: 20%      // Infrastructure operator (hosting, NOT AI)
  tenant: 15%        // Business itself
  justiceFund: 5%    // AI keys for those who can't afford
}
```

**Revenue Sources (NOT from AI usage):**
- Product sales (ecommerce)
- Service bookings (appointments)
- Digital content (paywalled)
- Subscription fees (premium features)

**Justice Fund Usage:**
- 5% of commerce revenue → AI access for those without means
- NOT charity - architecture (Article V.4)
- Provides API keys for unhoused, incarcerated, undocumented
- Funded by successful transactions, not platform costs

### **Tasks:**
- [ ] Study Payload Ecommerce Template paywalled content
- [ ] Implement premium spaces/channels
- [ ] Digital delivery in Files widget
- [ ] Ultimate Fair revenue split calculations
- [ ] Justice Fund tracking dashboard

### **3.1: User AI Key Management (NEW - Critical)**
**Description:** Users bring their own intelligence

Tasks:
- [ ] API Key management UI (secure storage)
- [ ] Support multiple providers (Anthropic, OpenAI, etc.)
- [ ] Local model integration (Ollama, LM Studio)
- [ ] Key rotation/revocation
- [ ] Usage transparency dashboard (informational, not billing)
- [ ] Constitutional prompt injection (works with any model)

### **3.2: Justice Fund AI Provisioning**
**Description:** 5% of commerce → AI access for those without means

Tasks:
- [ ] Justice Fund API key pool
- [ ] Recipient eligibility (unhoused, incarcerated, undocumented)
- [ ] Automated key provisioning
- [ ] Usage tracking (funded conversations)
- [ ] Fund replenishment from commerce revenue

---

## 🏗️ Phase 4: Production Readiness

### **Performance:**
- [ ] Optimize message loading (pagination, infinite scroll)
- [ ] WebSocket connection management
- [ ] Livekit session optimization
- [ ] Image/file upload optimization

### **Security:**
- [ ] Multi-tenant isolation verification (run test suite)
- [ ] Channel permissions enforcement
- [ ] Constitutional compliance validation
- [ ] Rate limiting for AI Bus messages

### **Monitoring:**
- [ ] Angel activity dashboard (optional, low priority)
- [ ] Message analytics
- [ ] Livekit session analytics
- [ ] Revenue tracking dashboard

---

## 📋 Implementation Priority

### **Week 1: Foundation**
1. Design system (theme, colors, dark mode)
2. Refactor Spaces to Payload patterns
3. Channel widget architecture

### **Week 2: Core Features**
1. Livekit widget
2. Transcription pipeline
3. AI Bus integration
4. Files widget

### **Week 3: Polish**
1. Framer Motion animations
2. Notes widget
3. Projects widget
4. Time tracking widget

### **Week 4: Ecommerce + Deploy**
1. Paywalled content
2. Ultimate Fair splits
3. Production deployment
4. spaces.kendev.co launch

---

## 🎯 Success Criteria

### **User Experience:**
- [ ] Discord-quality chat experience
- [ ] Smooth animations (Framer Motion)
- [ ] Beautiful dark mode (Star Trek Federation)
- [ ] Intuitive channel widgets
- [ ] Seamless Livekit integration

### **Technical Excellence:**
- [ ] Pure Payload CMS patterns (no custom DB queries)
- [ ] Constitutional compliance (AI Bus transparency)
- [ ] Multi-tenant isolation verified
- [ ] Performance: <100ms message latency

### **Business Value:**
- [ ] Paywalled content working
- [ ] Ultimate Fair splits calculating correctly
- [ ] Justice Fund accumulating (5%)
- [ ] Livekit transcriptions valuable

---

## 🔮 Future Enhancements (Post-Launch)

- Mobile app (React Native)
- Voice messages in chat
- Screen sharing in Livekit
- Calendar widget
- Email integration
- Custom emoji/reactions
- Message threading (like Slack)
- Search across all channels
- Integrations (GitHub, Linear, etc.)

---

## 📚 Reference Code Locations

### **Existing Implementations:**
- `/src/app/dashboard/spaces/` - Current Spaces implementation
- `/src/app/dashboard/_components/` - Dashboard components
- `/src/collections/` - Payload collections
- `/src/utilities/ai-bus-router.ts` - AI Bus routing (new)
- `/src/utilities/constitutional-prompt.ts` - Constitutional framework (new)

### **Livekit Integration:**
- Discord Clone Template (reference for Livekit patterns)
- Existing Livekit integration in angel-os repo

### **Design References:**
- Shadcn UI: https://ui.shadcn.com/
- Aceternity UI: https://ui.aceternity.com/
- Magic UI: https://magicui.design/
- Framer Motion: https://www.framer.com/motion/

---

## 🚀 OpenClaw Note

**OpenClaw = Guardian Angel instance** of Angel OS Core
- Connects via MCP protocol
- Has rich tooling (exec, browser, files)
- Constitutionally bounded
- Security concerns noted (Cisco fix = red flag)
- **Use but don't depend heavily**
- Focus: Angel OS Core production-ready

**Guardian Angels (like OpenClaw) ≠ Angel OS Core**
- Core: Safe, guarded, LEAN
- Angels: Powerful, observable, distributed

---

*Built for Hogarth. For all the Hogarths.* 🔮😇🤖

**"Everyone gets an Angel."**
