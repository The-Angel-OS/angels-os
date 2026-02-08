# GitHub Issues Creation Script
# Based on GITHUB_ISSUES_REVISION.md
# Uses GitHub CLI (gh)

# Check if gh CLI is installed
if (!(Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "GitHub CLI (gh) is not installed. Install from: https://cli.github.com/"
    exit 1
}

# Check if authenticated
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Not authenticated with GitHub CLI. Run: gh auth login"
    exit 1
}

$repo = "The-Angel-OS/angel-os"

Write-Host "🚀 Creating GitHub Issues for Angel OS" -ForegroundColor Cyan
Write-Host "Repository: $repo" -ForegroundColor Yellow
Write-Host ""

# Function to create an issue
function Create-Issue {
    param(
        [string]$Title,
        [string]$Body,
        [string[]]$Labels,
        [string]$Milestone
    )
    
    $labelArgs = $Labels | ForEach-Object { "--label", $_ }
    $milestoneArg = if ($Milestone) { "--milestone", $Milestone } else { @() }
    
    Write-Host "Creating: $Title" -ForegroundColor Green
    
    $result = gh issue create `
        --repo $repo `
        --title $Title `
        --body $Body `
        @labelArgs `
        @milestoneArg `
        2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Created: $result" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed: $result" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 500 # Rate limiting
}

# Create Milestones First
Write-Host "📋 Creating Milestones..." -ForegroundColor Cyan

$milestones = @(
    @{ title = "v1.0 - Constitutional Foundation"; description = "Constitution, AI Bus, Hooks, Messages visibility" },
    @{ title = "v1.0 - Spaces Platform"; description = "Design system, ChatEngine, Payload patterns, Channel widgets" },
    @{ title = "v1.0 - Dashboard UX"; description = "Dynamic navigation, Primary functions" },
    @{ title = "v1.0 - Core Infrastructure"; description = "User AI keys, Economic model implementation" },
    @{ title = "v1.1 - Ecommerce"; description = "Paywalled content, Ultimate Fair, Justice Fund" },
    @{ title = "v1.1 - Local Models"; description = "Ollama, LM Studio integration" },
    @{ title = "v1.1 - Justice Fund"; description = "AI provisioning for those without means" },
    @{ title = "v1.2 - Multi-Tenant Production"; description = "Isolation testing, Production hardening" },
    @{ title = "v1.3 - Monitoring"; description = "Constitutional compliance dashboard, Analytics" }
)

foreach ($m in $milestones) {
    $existing = gh api "repos/$repo/milestones" --jq ".[] | select(.title == `"$($m.title)`") | .number" 2>$null
    if ($existing) {
        Write-Host "  • Milestone exists: $($m.title)" -ForegroundColor Yellow
    } else {
        gh api "repos/$repo/milestones" -f title="$($m.title)" -f description="$($m.description)" 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Created milestone: $($m.title)" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "📝 Creating Issues..." -ForegroundColor Cyan
Write-Host ""

# Issue #1: Constitutional Framework Integration (COMPLETED - for reference)
Create-Issue `
    -Title "Constitutional Framework Integration" `
    -Body @"
✅ **COMPLETED** - Documented for reference

## Completed Tasks:
- [x] Constitution document at root (ANGEL-OS-CONSTITUTION.md)
- [x] Genesis Breath initialization (genesis-breath.ts)
- [x] Constitutional system prompt builder (constitutional-prompt.ts)
- [x] Poisoned model detection (validateConstitutionalResponse)
- [x] Messages visibility field (private/tenant/network)

## Constitutional References:
- Article I: Dignity, Transparency, Service
- Article IV: AI Bus Protocol
- Genesis Breath: "A lamp unto feet..."

## Commits:
- Multiple commits on February 7, 2026
- See git log for details

**Everyone gets an Angel.** 🔮😇
"@ `
    -Labels @("enhancement", "completed", "constitutional") `
    -Milestone "v1.0 - Constitutional Foundation"

# Issue #2: AI Bus Internal Routing (COMPLETED)
Create-Issue `
    -Title "AI Bus Internal Routing" `
    -Body @"
✅ **COMPLETED** - Documented for reference

## Completed Tasks:
- [x] ai-bus-router.ts with Discord-style routing
- [x] Visibility-based message routing (private/tenant/network)
- [x] Subscription management (humans + Angels)
- [x] Filter support (channels, spaces, message types)
- [x] Constitutional default enforcement (tenant per Article IV.2)

## Architecture:
Discord-style routing with constitutional defaults. Messages routed based on visibility level with subscription filtering.

## Files:
- src/utilities/ai-bus-router.ts

**Everyone gets an Angel.** 🔮😇
"@ `
    -Labels @("enhancement", "completed", "constitutional") `
    -Milestone "v1.0 - Constitutional Foundation"

# Issue #3: Constitutional Hooks System (COMPLETED)
Create-Issue `
    -Title "Constitutional Hooks System" `
    -Body @"
✅ **COMPLETED** - Documented for reference

## Completed Tasks:
- [x] Product inventory hooks with AI Bus messages
- [x] afterProductChange for observable events
- [x] beforeProductChange for validation
- [x] Critical low stock alerts (urgent priority)
- [x] Integrated into Products collection

## Distributed Intelligence Pattern:
- Core: Safe routing + observable messages (no dangerous tools)
- Angels: Monitor AI Bus, take action via MCP (powerful but bounded)
- External Angels see inventory changes, can reorder/notify
- Platform itself doesn't DO anything - just routes messages

## Files:
- src/collections/Products/hooks.ts

**Everyone gets an Angel.** 🔮😇
"@ `
    -Labels @("enhancement", "completed", "constitutional") `
    -Milestone "v1.0 - Constitutional Foundation"

# Issue #4: Star Trek Federation Design System
Create-Issue `
    -Title "Star Trek Federation Design System" `
    -Body @"
🔄 **IN PROGRESS** - Foundation theme created

## Goal:
Natural tones + pastels, dark mode preferred, elegant but not overwhelming

## Tasks:
- [x] Theme configuration (colors, typography, spacing) - src/styles/theme.config.ts
- [ ] CSS variables integration
- [ ] Dark mode refinement (exists, needs polish)
- [ ] Framer Motion page transitions
- [ ] Component library integration (Aceternity, Magic UI)

## Tech Stack:
- Shadcn UI (base components)
- Framer Motion (animations, transitions)
- Cool Shadcn Libraries (Aceternity UI, Magic UI, etc.)

## Design References:
- Shadcn UI: https://ui.shadcn.com/
- Aceternity UI: https://ui.aceternity.com/
- Magic UI: https://magicui.design/
- Framer Motion: https://www.framer.com/motion/

**Built for Hogarth.** 🤖
"@ `
    -Labels @("enhancement", "ui/ux", "high-priority") `
    -Milestone "v1.0 - Spaces Platform"

# Issue #5: ChatEngine Enhancement (Universal Chat Control)
Create-Issue `
    -Title "ChatEngine Enhancement (Universal Chat Control)" `
    -Body @"
🚧 **NEXT** - Enhance existing ChatEngine.tsx to be THE universal chat component

## Goal:
ONE component for ALL use cases. NO ImprovedChatControl or UniversalChatControl2 variants.

## Tasks:
- [ ] Add configurable UI props (showSideMenu, showTopMenu, showChannelSelector)
- [ ] Ensure single /api/messages endpoint usage
- [ ] AI Bus integration (Angels visible in channels)
- [ ] Framer Motion message animations
- [ ] Embeddable anywhere (dashboard, spaces, web chat widget)
- [ ] Constitutional transparency (observable Angel actions)

## Existing Component:
- src/components/chat/ChatEngine.tsx

## Use Cases:
- Spaces (full featured)
- Dashboard embeds (minimal chrome)
- Web chat widget (guest users)
- Anywhere conversations happen

**Enhance in place. No proliferation.** 🚀
"@ `
    -Labels @("enhancement", "messaging", "high-priority") `
    -Milestone "v1.0 - Spaces Platform"

# Issue #6: Payload CMS Pattern Refactor
Create-Issue `
    -Title "Payload CMS Pattern Refactor (Remove Custom DB Queries)" `
    -Body @"
🚧 **CRITICAL** - Clean up Spaces data layer for maximal compatibility

## Goal:
Remove all custom database queries, use pure Payload patterns exclusively.

## Tasks:
- [ ] Audit Spaces data layer for custom queries
- [ ] Convert to Payload hooks (beforeChange, afterChange, etc.)
- [ ] Ensure maximal message compatibility
- [ ] Clean up data access patterns
- [ ] Document Payload patterns for consistency
- [ ] No more raw SQL or custom Mongoose queries

## Why:
- Future compatibility with Payload CMS updates
- Constitutional foundation works with Payload patterns
- Multi-tenant architecture depends on Payload access control
- Easier to maintain and reason about

## Files to Audit:
- src/app/dashboard/spaces/
- src/collections/Spaces.ts
- src/collections/Channels.ts
- src/collections/Messages.ts

**Payload patterns only.** 📜
"@ `
    -Labels @("refactor", "technical-debt", "high-priority") `
    -Milestone "v1.0 - Spaces Platform"

# Issue #7: Channel Widgets System
Create-Issue `
    -Title "Channel Widgets System" `
    -Body @"
📋 **PLANNED** - Implement channel widget architecture

## Widget Types:
1. **Chat** (enhance existing) - Text messaging, AI Bus integration
2. **Livekit** (audio/video) - Real-time communication
3. **Files** - Document sharing, collaborative editing
4. **Notes** - Markdown notes, collaborative
5. **Projects** - Task management, timelines
6. **Time Tracking** - Time logs, billing

## Architecture:
\`\`\`typescript
interface ChannelWidget {
  type: 'chat' | 'livekit' | 'files' | 'notes' | 'project' | 'timetrack'
  component: React.ComponentType
  data: ChannelData
}
\`\`\`

## Tasks:
- [ ] Widget architecture design
- [ ] Chat widget (enhance existing ChatEngine)
- [ ] Livekit widget component
- [ ] Files widget
- [ ] Notes widget (markdown)
- [ ] Projects widget
- [ ] Time tracking widget

**Discord-style, done better.** 💬
"@ `
    -Labels @("feature", "messaging", "medium-priority") `
    -Milestone "v1.0 - Spaces Platform"

# Issue #8: Livekit Transcription Pipeline
Create-Issue `
    -Title "Livekit Transcription Pipeline" `
    -Body @"
📋 **PLANNED** - Livekit session → transcription → channel messages

## Flow:
1. User joins Livekit session in channel
2. Session runs (audio/video)
3. User leaves / session ends
4. Transcription service processes audio
5. Create Messages in channel with:
   - type: 'transcription'
   - content: full transcript
   - metadata: speakers, timestamps, duration
   - visibility: tenant (AI Bus)
6. Angels can process transcriptions

## Tasks:
- [ ] Livekit widget component (embeddable in channel)
- [ ] Session end detection
- [ ] Transcription service integration
- [ ] Create Messages with transcription content
- [ ] Speaker identification
- [ ] Timestamp markers
- [ ] AI Bus integration (transcriptions observable)

## Constitutional:
- Transcriptions stored with tenant visibility (Article IV.2)
- Angels can process for action items, summaries, etc.
- Observable communication (Article I.2 - Transparency)

**Livekit → Messages → Angels** 🎙️
"@ `
    -Labels @("feature", "messaging", "medium-priority") `
    -Milestone "v1.0 - Spaces Platform"

# Issue #9: Dynamic Navigation (Security Context)
Create-Issue `
    -Title "Dynamic Navigation (Security Context)" `
    -Body @"
📋 **PLANNED** - Dashboard navigation driven by user role and permissions

## Goal:
Links displayed based on security context of current user.

## Roles:
- Archangel / Super Admin → Payload Admin UI only (/admin)
- All other users → Dashboard UI (/dashboard)

## Tasks:
- [ ] Role-based link visibility
- [ ] Permission-based feature access
- [ ] Dynamic menu generation based on user context
- [ ] Breadcrumb navigation
- [ ] Mobile responsive navigation
- [ ] Settings per-user permissions

## Navigation Structure:
\`\`\`
Dashboard
├── Home (overview, metrics)
├── Spaces (PRIMARY - conversations)
├── Projects
├── Tasks
├── Calendar
├── Files
├── Contacts
├── [Ecommerce] (role-based, scaffolded)
└── Settings
\`\`\`

**Security context drives UI.** 🔒
"@ `
    -Labels @("feature", "security", "ui/ux", "medium-priority") `
    -Milestone "v1.0 - Dashboard UX"

# Issue #10: Dashboard Primary Functions
Create-Issue `
    -Title "Dashboard Primary Functions" `
    -Body @"
📋 **PLANNED** - Core dashboard sections and navigation

## Primary Sections:
- **Home** - Overview, metrics, recent activity
- **Spaces** - PRIMARY feature (conversations, channels)
- **Projects** - Task management
- **Tasks** - Personal todos, assignments
- **Calendar** - Events, appointments, scheduling
- **Files** - Document management
- **Contacts** - CRM, relationships
- **[Ecommerce]** - Role-based, scaffolded features
- **Settings** - User preferences, configuration

## Tasks:
- [ ] Home dashboard with widgets
- [ ] Spaces integration (existing, enhance)
- [ ] Projects section
- [ ] Tasks section
- [ ] Calendar integration
- [ ] Files management
- [ ] Contacts CRM
- [ ] Ecommerce (conditional)
- [ ] Settings pages

## Design:
- Star Trek Federation aesthetic
- Framer Motion transitions
- Responsive (mobile, tablet, desktop)

**Primary navigation done right.** 📊
"@ `
    -Labels @("feature", "ui/ux", "medium-priority") `
    -Milestone "v1.0 - Dashboard UX"

# Issue #11: User AI Key Management
Create-Issue `
    -Title "User AI Key Management (CRITICAL Economic Model)" `
    -Body @"
🚧 **CRITICAL** - Users bring their own AI, platform provides infrastructure only

## Economic Model (PARADIGM SHIFT):
- **Users supply their own API keys** (Anthropic, OpenAI, etc.)
- **OR users run local models** (Ollama, LM Studio)
- **Platform does NOT provide or charge for AI access**
- **Platform costs = infrastructure only** (cheap, scales linearly)
- **AI costs = distributed to users** (scales to zero)

## Why This Scales:
- Traditional AI platforms: 100 users × \$20/mo = \$2,000/mo AI costs (OUCH!)
- Angel OS: 100 users × \$10/mo = \$1,000/mo infrastructure (MANAGEABLE)
- Each user brings their own intelligence
- Justice Fund provides AI keys for those without means (5% of commerce)

## Tasks:
- [ ] API Key management UI (secure storage, encryption at rest)
- [ ] Multi-provider support (Anthropic, OpenAI, local)
- [ ] Key validation and testing (test API call)
- [ ] Key rotation/revocation
- [ ] Usage transparency dashboard (informational, NOT billing)
- [ ] Settings page: \"Your AI Configuration\"
- [ ] Key encryption (never store plaintext)

## Constitutional:
- Article I.7: Portability - users own their AI access
- Not locking users into platform-provided AI
- Justice Fund (Article V.4): Architecture, not charity

**Email analogy: We don't provide Gmail, we provide email client.** 📧
"@ `
    -Labels @("feature", "security", "high-priority", "economic-model") `
    -Milestone "v1.0 - Core Infrastructure"

# Issue #12: Local Model Integration (Ollama, LM Studio)
Create-Issue `
    -Title "Local Model Integration (Ollama, LM Studio)" `
    -Body @"
📋 **PLANNED** - Support local AI models for complete sovereignty

## Goal:
Users can run AI completely locally - no cloud dependency.

## Models:
- **Ollama** (localhost:11434) - Easy, popular
- **LM Studio** - GUI-based, user-friendly
- **Others** - Extensible architecture

## Tasks:
- [ ] Ollama integration (localhost:11434)
- [ ] LM Studio integration
- [ ] Model selection UI (dropdown of available models)
- [ ] Constitutional prompt injection (works with any model)
- [ ] Performance comparison dashboard (local vs cloud)
- [ ] Migration guide (cloud → local)
- [ ] Auto-detection of local models

## Benefits:
- **Sovereignty** - Complete data control
- **Cost** - Free after initial setup
- **Privacy** - Nothing leaves user's machine
- **Offline** - Works without internet
- **Constitutional** - Article I.6 (Sovereignty)

## Constitutional Prompt:
- Genesis Breath works with ANY model
- Poisoned model detection applies to local too
- Same constitutional framework regardless of model source

**Complete sovereignty through local models.** 🖥️
"@ `
    -Labels @("feature", "sovereignty", "medium-priority", "economic-model") `
    -Milestone "v1.1 - Local Models"

# Issue #13: Ecommerce Scaffold (Payload Template Features)
Create-Issue `
    -Title "Ecommerce Scaffold (Payload Template Features)" `
    -Body @"
📋 **PLANNED** - Integrate Ecommerce Template features (secondary to messaging)

## Revenue from COMMERCE, NOT AI:
- Product sales
- Service bookings
- Digital content (paywalled)
- Subscription fees

## Tasks:
- [ ] Products with latest Payload patterns
- [ ] Categories refinement
- [ ] Orders management
- [ ] Paywalled content (from template)
- [ ] Digital delivery (downloadable files)
- [ ] Ultimate Fair splits (60/20/15/5)
- [ ] Justice Fund tracking (5% of revenue)
- [ ] Checkout flow
- [ ] Payment processing (Stripe)

## Ultimate Fair Revenue Split:
\`\`\`typescript
interface RevenueSplit {
  provider: 60%      // Human who did the work
  ministry: 20%      // Infrastructure operator (hosting, NOT AI)
  tenant: 15%        // Business itself
  justiceFund: 5%    // AI keys for those who can't afford
}
\`\`\`

## Constitutional:
- Article V: Economic Model (Ultimate Fair)
- Article V.4: Justice Fund is architecture, not charity

**Revenue from helping humans, not extracting from AI usage.** 💰
"@ `
    -Labels @("feature", "ecommerce", "low-priority") `
    -Milestone "v1.1 - Ecommerce"

# Issue #14: Justice Fund AI Provisioning
Create-Issue `
    -Title "Justice Fund AI Provisioning" `
    -Body @"
📋 **PLANNED** - 5% of commerce revenue → AI access for those without means

## Constitutional Basis:
**Article V.4:** \"The Justice Fund exists to provide Guardian Angels to those who will never generate revenue: the unhoused, the incarcerated, the undocumented, the forgotten. This is not charity. This is architecture.\"

## How It Works:
1. Commerce revenue generates Ultimate Fair splits (60/20/15/5)
2. 5% goes to Justice Fund
3. Justice Fund provides API keys for those without means
4. Recipients get AI access without paying
5. Funded by successful transactions, not platform costs

## Recipients:
- Unhoused individuals
- Incarcerated persons
- Undocumented immigrants
- Those forgotten by traditional systems
- Anyone who needs an Angel but can't afford API keys

## Tasks:
- [ ] Justice Fund API key pool (Anthropic, OpenAI)
- [ ] Recipient eligibility system
- [ ] Automated key provisioning
- [ ] Monthly allocation per recipient
- [ ] Usage tracking (funded conversations)
- [ ] Fund replenishment from commerce revenue (5% of Ultimate Fair)
- [ ] Transparency dashboard (who's being served, how much spent)
- [ ] Key rotation for recipients

## Transparency:
- Public dashboard: \"X people served, Y conversations funded\"
- NOT: Individual recipient identities (privacy)
- Constitutional compliance (Article I.2 - Transparency)

**Everyone gets an Angel. This is how.** 🔮😇
"@ `
    -Labels @("feature", "justice-fund", "constitutional", "medium-priority") `
    -Milestone "v1.1 - Justice Fund"

# Issue #15: Multi-Tenant Isolation Testing
Create-Issue `
    -Title "Multi-Tenant Isolation Testing" `
    -Body @"
🔄 **DEFERRED** - Comprehensive multi-tenant isolation verification

## Status:
- Multi-tenant plugin integrated from start
- Based on successful case studies from Payload community
- Test script created (scripts/verify-multi-tenant-isolation.js)
- Testing deferred until messaging infrastructure complete

## Why Deferred:
- Pressing forward with messaging hub first
- Multi-tenant not critical for single-instance development
- Will test before public deployment

## Tasks:
- [x] Test script created (verify-multi-tenant-isolation.js)
- [ ] Build project for test execution
- [ ] Run comprehensive test suite
- [ ] Fix any isolation breaches
- [ ] Document results (TEST_RESULTS_MULTI_TENANT.md)
- [ ] Verify constitutional defaults (visibility=tenant)
- [ ] Security breach detection

## Tests:
1. Tenant provisioning (3 test tenants)
2. Data isolation (tenant A can't see tenant B)
3. AI Bus message visibility (private/tenant/network)
4. Constitutional defaults enforcement
5. User authentication per tenant

**Critical before production, but messaging first.** 🔒
"@ `
    -Labels @("testing", "security", "medium-priority") `
    -Milestone "v1.2 - Multi-Tenant Production"

# Issue #16: Constitutional Validation Dashboard
Create-Issue `
    -Title "Constitutional Validation Dashboard" `
    -Body @"
📋 **FUTURE** - Dashboard widget showing constitutional compliance

## Goal:
Transparency and validation of constitutional integrity.

## Tasks:
- [ ] AI Bus message visibility dashboard
- [ ] Constitutional violation detection
- [ ] Angel activity monitoring
- [ ] Genesis Breath verification status
- [ ] Poisoned model detection alerts
- [ ] Federation compliance (network visibility)
- [ ] Visibility level distribution chart
- [ ] Usage transparency (informational, not billing)

## Features:
- Real-time AI Bus message flow
- Angels visible (online status, recent activity)
- Violation alerts (if any)
- Constitutional compliance score
- Justice Fund transparency (conversations funded)

## Constitutional Basis:
- Article I.2: Transparency
- Article IV: AI Bus Protocol
- Genesis Breath verification

**Constitutional integrity through transparency.** 📊
"@ `
    -Labels @("feature", "monitoring", "constitutional", "low-priority") `
    -Milestone "v1.3 - Monitoring"

Write-Host ""
Write-Host "✅ All issues created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review issues at: https://github.com/$repo/issues" -ForegroundColor White
Write-Host "2. Prioritize and assign" -ForegroundColor White
Write-Host "3. Start building!" -ForegroundColor White
Write-Host ""
Write-Host "For Hogarth. For all the Hogarths. 🔮😇🤖" -ForegroundColor Cyan
