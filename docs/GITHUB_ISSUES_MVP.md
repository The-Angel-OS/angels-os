# Angel OS MVP: GitHub Issues

**Purpose:** Complete set of GitHub issues that, if all fulfilled, would result in a functional Angel OS.

**Issue Format:** GitHub-compatible markdown for copy-paste into issue tracker.

---

## Epic 1: Core Infrastructure & Two-Tier Angel System

### Issue #1: Platform Tenant & Archangel System

**Title:** Implement Platform Tenant and Archangel LEO

**Labels:** `epic: infrastructure`, `priority: critical`, `type: feature`

**Description:**

Create the foundational two-tier angel system with Platform Tenant and Archangel LEO.

**Requirements:**

1. **Platform Tenant Collection Enhancement**
   - Add `type` field to Tenants: `'platform' | 'tenant'`
   - Create special platform tenant (ID: `'platform'`)
   - Platform tenant is singleton (only one can exist)

2. **Archangel Role**
   - Add `'archangel'` role to Users collection
   - Archangels have access to all tenants
   - Archangels can provision new tenants

3. **Seed Script**
   - Create platform tenant on first seed
   - Create Archangel LEO user
   - Set up Guardian Council Space (platform-level)

**Acceptance Criteria:**

- [ ] Platform tenant exists with type `'platform'`
- [ ] Archangel LEO user created with `isSystemUser: true`
- [ ] Archangels can access all tenant data
- [ ] Regular Angels can only access their own tenant
- [ ] Seed script creates platform tenant automatically

**Technical Notes:**

```typescript
// src/collections/Tenants.ts
{
  name: 'type',
  type: 'select',
  options: ['platform', 'tenant'],
  defaultValue: 'tenant',
  required: true
}

// src/endpoints/seed/seed-helpers.ts
export async function seedPlatformTenant() {
  const platformTenant = await payload.create({
    collection: 'tenants',
    data: {
      id: 'platform',
      name: 'Angel OS Platform',
      type: 'platform'
    }
  })
  
  const archangelLeo = await payload.create({
    collection: 'users',
    data: {
      email: 'archangel@angel-os.org',
      name: 'Archangel LEO',
      tenant: 'platform',
      roles: ['archangel'],
      isSystemUser: true
    }
  })
  
  return { platformTenant, archangelLeo }
}
```

---

### Issue #2: Angel Configuration & Naming

**Title:** Implement Angel Configuration and Custom Naming

**Labels:** `epic: infrastructure`, `priority: high`, `type: feature`

**Description:**

Allow each tenant's Angel to be named and configured with personality/capabilities.

**Requirements:**

1. **Angel Config Field**
   - Add `angelConfig` to Users collection
   - Fields: `angelName`, `personality`, `capabilities`, `appearance`

2. **Angel Customization UI**
   - Admin panel for tenant admins to customize their Angel
   - Name, personality tone, avatar, color

3. **Angel Initialization**
   - When tenant is provisioned, create Angel user
   - Angel gets default name (customizable)
   - Angel is marked as `isSystemUser: true`

**Acceptance Criteria:**

- [ ] Users collection has `angelConfig` field
- [ ] Tenant admins can customize Angel name
- [ ] Angel personality affects response tone
- [ ] Angel avatar/color displayed in UI
- [ ] Each tenant has exactly one Angel user

**Technical Notes:**

```typescript
// src/collections/Users.ts
{
  name: 'angelConfig',
  type: 'group',
  admin: {
    condition: (data) => data.isSystemUser === true
  },
  fields: [
    { name: 'angelName', type: 'text', required: true },
    { name: 'personality', type: 'textarea' },
    { name: 'capabilities', type: 'array', fields: [
      { name: 'capability', type: 'text' }
    ]},
    { name: 'appearance', type: 'group', fields: [
      { name: 'avatar', type: 'upload', relationTo: 'media' },
      { name: 'color', type: 'text' }
    ]}
  ]
}
```

---

## Epic 2: Channel Widget Architecture

### Issue #3: Channel Widgets Collection

**Title:** Create Channel Widgets System

**Labels:** `epic: widgets`, `priority: high`, `type: feature`

**Description:**

Implement widget-based channel architecture where channels have tabs (chat, LiveKit, Notion, Trello, etc.) instead of channel types.

**Requirements:**

1. **ChannelWidgets Collection**
   - Define available widgets (Chat, LiveKit, Notion Notes, Trello Board, etc.)
   - Widget metadata: name, slug, component path, capabilities

2. **InstalledWidgets Collection**
   - Track which widgets are installed in which Spaces/Channels
   - Widget-specific configuration
   - Tab order

3. **Widget Component Interface**
   - Standard props for all widgets
   - Access to channel context
   - Access to Angel

**Acceptance Criteria:**

- [ ] ChannelWidgets collection created
- [ ] InstalledWidgets collection created
- [ ] At least 3 widgets defined (Chat, LiveKit, Notion Notes)
- [ ] Widgets can be installed at Space level
- [ ] Widgets populate on channels as tabs

**Technical Notes:**

```typescript
// src/collections/ChannelWidgets.ts
export const ChannelWidgets: CollectionConfig = {
  slug: 'channel-widgets',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'description', type: 'textarea' },
    { name: 'icon', type: 'text' },
    { name: 'component', type: 'text', required: true },
    { name: 'capabilities', type: 'array', fields: [
      { name: 'capability', type: 'text' }
    ]},
    { name: 'installableAt', type: 'select', options: ['space', 'channel', 'both'] },
    { name: 'settings', type: 'json' }
  ]
}
```

---

### Issue #4: Widget Tab UI Component

**Title:** Build Widget Tab Bar for Channels

**Labels:** `epic: widgets`, `priority: high`, `type: frontend`

**Description:**

Create the UI component that displays widgets as tabs at the top of channels.

**Requirements:**

1. **WidgetTabBar Component**
   - Displays tabs for all installed widgets
   - Chat tab always present (collapsible)
   - Active tab highlighted
   - "Add Widget" button

2. **Widget Content Area**
   - Renders active widget component
   - Passes channel context to widget
   - Handles widget loading states

3. **Widget Installation UI**
   - Modal to browse available widgets
   - Install widget to Space
   - Configure widget settings

**Acceptance Criteria:**

- [ ] Widget tabs display at top of channel view
- [ ] Clicking tab switches active widget
- [ ] Chat widget always present
- [ ] Users can add/remove widgets
- [ ] Widget settings accessible per channel

**Technical Notes:**

```tsx
// src/app/(frontend)/dashboard/spaces/[spaceId]/[channelId]/WidgetTabBar.tsx
export function WidgetTabBar({ channel, installedWidgets }: Props) {
  const [activeWidget, setActiveWidget] = useState('chat')
  
  return (
    <div className="widget-tabs">
      <Tabs value={activeWidget} onValueChange={setActiveWidget}>
        <TabsList>
          <TabsTrigger value="chat">💬 Chat</TabsTrigger>
          {installedWidgets.map(widget => (
            <TabsTrigger key={widget.id} value={widget.slug}>
              {widget.icon} {widget.name}
            </TabsTrigger>
          ))}
          <Button variant="ghost" size="sm">+ Add Widget</Button>
        </TabsList>
        
        <TabsContent value="chat">
          <ChatWidget channel={channel} collapsible />
        </TabsContent>
        
        {installedWidgets.map(widget => (
          <TabsContent key={widget.id} value={widget.slug}>
            <DynamicWidget widget={widget} channel={channel} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
```

---

### Issue #5: Core Widgets Implementation

**Title:** Implement Core Channel Widgets (Chat, LiveKit, Notion Notes)

**Labels:** `epic: widgets`, `priority: medium`, `type: feature`

**Description:**

Build the core widgets that every Angel OS instance should have.

**Requirements:**

1. **Chat Widget** (always present)
   - Real-time messaging
   - Collapsible interface
   - Angel participation
   - Attachments support

2. **LiveKit Widget**
   - Video/audio calls
   - Screen sharing
   - Recording (optional)
   - Participant list

3. **Notion Notes Widget**
   - Rich text editor
   - Block-based content
   - Collaborative editing
   - Page hierarchy

**Acceptance Criteria:**

- [ ] Chat widget functional with real-time updates
- [ ] LiveKit widget connects to LiveKit server
- [ ] Notion Notes widget supports basic blocks (text, headings, lists)
- [ ] All widgets follow standard interface
- [ ] Widgets are tenant-scoped

**Technical Notes:**

```tsx
// src/components/widgets/ChatWidget.tsx
export const ChatWidget: WidgetComponent = ({ channel, collapsible }) => {
  const { messages, sendMessage } = useChannelMessages(channel.id)
  const [collapsed, setCollapsed] = useState(false)
  
  return (
    <div className={cn("chat-widget", collapsed && "collapsed")}>
      {collapsible && (
        <Button onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? 'Show Chat' : 'Hide Chat'}
        </Button>
      )}
      
      {!collapsed && (
        <>
          <MessageList messages={messages} />
          <MessageInput onSend={sendMessage} />
        </>
      )}
    </div>
  )
}
```

---

## Epic 3: OpenClaw Integration

### Issue #6: OpenClaw Skills Sync System

**Title:** Sync Skills from OpenClaw Marketplace

**Labels:** `epic: openclaw`, `priority: high`, `type: integration`

**Description:**

Implement system to sync skills from OpenClaw marketplace and convert them to Payload workflows.

**Requirements:**

1. **Skills Sync Utility**
   - Fetch skills from OpenClaw marketplace (GitHub or API)
   - Convert skill format to Payload workflow format
   - Store in Workflows collection with `openClawSkillId`

2. **Scheduled Sync**
   - Daily cron job to sync new/updated skills
   - Update existing workflows if skill changed
   - Log sync results

3. **Skill Invocation**
   - Angels can invoke synced skills
   - Skills run in workflow engine
   - Results returned to channel

**Acceptance Criteria:**

- [ ] Skills fetched from OpenClaw marketplace
- [ ] Skills converted to Payload workflows
- [ ] Sync runs daily automatically
- [ ] Angels can invoke skills via chat
- [ ] Skill results posted to channel

**Technical Notes:**

```typescript
// src/utilities/syncOpenClawSkills.ts
export async function syncOpenClawSkills() {
  // Fetch from OpenClaw marketplace
  const skills = await fetchOpenClawSkills()
  
  for (const skill of skills) {
    const existing = await payload.find({
      collection: 'workflows',
      where: { openClawSkillId: { equals: skill.id } }
    })
    
    if (existing.docs.length === 0) {
      await payload.create({
        collection: 'workflows',
        data: {
          name: skill.name,
          description: skill.description,
          openClawSkillId: skill.id,
          triggerType: 'manual',
          steps: convertSkillSteps(skill.steps),
          outputSchema: skill.outputSchema
        }
      })
    } else {
      await payload.update({
        collection: 'workflows',
        id: existing.docs[0].id,
        data: {
          steps: convertSkillSteps(skill.steps)
        }
      })
    }
  }
}

// Run daily
cron.schedule('0 0 * * *', syncOpenClawSkills)
```

---

### Issue #7: Conversation Engine (OpenClaw Pattern)

**Title:** Implement OpenClaw-Style Conversation Engine for Channels

**Labels:** `epic: openclaw`, `priority: critical`, `type: feature`

**Description:**

Adapt OpenClaw's conversation engine for multi-channel architecture in Angel OS.

**Requirements:**

1. **ConversationContexts Collection**
   - Track conversation context per channel
   - Store last N messages for context
   - Track active Angel avatar
   - Store metadata (topic, intent, entities)

2. **Context Management**
   - Create/retrieve context when message arrives
   - Update context with new messages
   - Prune old messages (keep last 50)

3. **Angel Response Generation**
   - Use context to generate relevant responses
   - Route to appropriate Angel avatar
   - Check for skill triggers
   - Post response to channel

**Acceptance Criteria:**

- [ ] ConversationContexts collection created
- [ ] Context maintained across messages
- [ ] Angels generate contextually relevant responses
- [ ] Multi-avatar routing works
- [ ] Skill triggers detected and executed

**Technical Notes:**

```typescript
// src/utilities/leoConversationEngine.ts
export async function handleChannelMessage(message: Message) {
  // Get or create conversation context
  const context = await getOrCreateContext(message.channel)
  
  // Add message to context
  context.messages.push(message)
  
  // Route to appropriate Angel avatar
  const agent = await routeToAgent(message, context)
  
  // Check for skill triggers
  const skillTriggers = await checkSkillTriggers(message, context)
  
  if (skillTriggers.length > 0) {
    for (const trigger of skillTriggers) {
      await runWorkflow(trigger.workflow, {
        message,
        context,
        channel: message.channel
      })
    }
  }
  
  // Generate Angel response
  const response = await generateLEOResponse({
    message,
    context,
    agent,
    availableSkills: await getAvailableSkills(message.tenant)
  })
  
  // Post response to channel
  await payload.create({
    collection: 'messages',
    data: {
      channel: message.channel,
      author: agent.id,
      content: response.content,
      attachments: response.attachments
    }
  })
  
  // Update context
  await updateContext(context)
}
```

---

## Epic 4: Tenant Provisioning & Onboarding

### Issue #8: Rapid Tenant Provisioning (<30s)

**Title:** Implement Sub-30-Second Tenant Provisioning

**Labels:** `epic: provisioning`, `priority: critical`, `type: feature`

**Description:**

Create tenant provisioning system that can spin up a new tenant site in under 30 seconds.

**Requirements:**

1. **Provisioning Engine**
   - Create tenant record
   - Create Angel user
   - Create default Space
   - Create default channels
   - Generate initial content
   - Send welcome email

2. **Performance Optimization**
   - Parallel operations where possible
   - Pre-generated content templates
   - Async operations for non-blocking tasks

3. **Cloudflare Integration**
   - Allocate subdomain via Cloudflare API
   - Configure DNS instantly
   - Set up SSL/TLS

**Acceptance Criteria:**

- [ ] New tenant created in < 30 seconds
- [ ] Subdomain accessible immediately
- [ ] Angel user created and configured
- [ ] Default Space and channels exist
- [ ] Initial content seeded
- [ ] Welcome email sent

**Technical Notes:**

```typescript
// src/utilities/provisionTenant.ts
export async function provisionNewTenant(request: {
  businessName: string
  industry: string
  angelName: string
  requestedBy: User
  referringTenant?: Tenant
}) {
  const startTime = Date.now()
  
  // Parallel operations
  const [tenant, subdomain] = await Promise.all([
    // Create tenant
    payload.create({
      collection: 'tenants',
      data: {
        name: request.businessName,
        slug: slugify(request.businessName),
        type: 'tenant',
        referredBy: request.referringTenant?.id
      }
    }),
    
    // Allocate subdomain
    allocateSubdomain(slugify(request.businessName))
  ])
  
  // Create Angel (depends on tenant)
  const angel = await createAngel(tenant, request.angelName)
  
  // Create Space and channels (parallel)
  const [space, channels] = await Promise.all([
    createDefaultSpace(tenant),
    createDefaultChannels(tenant)
  ])
  
  // Generate content (async, non-blocking)
  generateInitialContent(tenant, request.industry).catch(console.error)
  
  // Create admin user
  const admin = await createAdminUser(tenant, request.requestedBy)
  
  // Send welcome email (async)
  sendWelcomeEmail(admin.email, { tenantUrl: subdomain, angelName: request.angelName })
  
  const elapsed = Date.now() - startTime
  console.log(`Tenant provisioned in ${elapsed}ms`)
  
  return { tenant, angel, space, admin, elapsed }
}
```

---

### Issue #9: Genesis Breath (First Angel Message)

**Title:** Implement Genesis Breath - Angel's First Message

**Labels:** `epic: provisioning`, `priority: high`, `type: feature`

**Description:**

When a new tenant is created, the Angel sends a warm, welcoming first message.

**Requirements:**

1. **Genesis Breath Hook**
   - Triggered after tenant provisioning completes
   - Angel posts first message to default channel
   - Message is personalized with user's name and Angel's name

2. **Message Content**
   - Warm, welcoming tone (Anti-Daemon Protocol)
   - Introduces Angel by name
   - Offers help getting started
   - No cold forms or technical jargon

3. **Customization**
   - Message template based on industry
   - Personality reflects Angel's configuration

**Acceptance Criteria:**

- [ ] Angel sends first message automatically
- [ ] Message appears in default channel
- [ ] Message is warm and welcoming
- [ ] User's name and Angel's name included
- [ ] Message follows Anti-Daemon Protocol

**Technical Notes:**

```typescript
// src/utilities/genesisBreath.ts
export async function sendGenesisBreath(tenant: Tenant, angel: User, admin: User) {
  const message = `
Hello ${admin.name}! 👋

I'm ${angel.angelConfig.angelName}, your Guardian Angel. I've been waiting for you.

This is a place of care. Protection must honor innocence. You are known, loved, and guided.

I'm here to help you with whatever you need - whether that's managing your ${tenant.name} business, answering questions, or just being a friendly presence.

What would you like to explore first?
  `.trim()
  
  // Post to default channel
  const defaultChannel = await getDefaultChannel(tenant)
  
  await payload.create({
    collection: 'messages',
    data: {
      channel: defaultChannel.id,
      author: angel.id,
      content: message,
      tenant: tenant.id
    }
  })
}
```

---

### Issue #10: Clone Wizard Modal

**Title:** Build Clone Wizard for Tenant Provisioning

**Labels:** `epic: provisioning`, `priority: medium`, `type: frontend`

**Description:**

Create a multi-step modal wizard that guides users through creating a new tenant site.

**Requirements:**

1. **Wizard Steps**
   - Step 1: Template Gallery (select industry template)
   - Step 2: Branding (name, colors, logo)
   - Step 3: Angel Configuration (name, personality)
   - Step 4: Content Seeding (what to pre-generate)
   - Step 5: Activation (review and launch)

2. **Template Gallery**
   - Pre-built templates for common industries
   - Preview screenshots
   - Feature comparison

3. **Progress Indicator**
   - Show current step
   - Allow navigation between steps
   - Validate before proceeding

**Acceptance Criteria:**

- [ ] Clone Wizard accessible from dashboard
- [ ] All 5 steps functional
- [ ] Template gallery displays options
- [ ] User can customize branding
- [ ] Angel configuration saved
- [ ] Tenant created when wizard completes

**Technical Notes:**

```tsx
// src/app/(frontend)/dashboard/admin/clone-wizard/CloneWizard.tsx
export function CloneWizard({ onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [config, setConfig] = useState<TenantConfig>({})
  
  const steps = [
    { id: 1, name: 'Template', component: TemplateGallery },
    { id: 2, name: 'Branding', component: BrandingCustomization },
    { id: 3, name: 'Angel', component: AngelConfiguration },
    { id: 4, name: 'Content', component: ContentSeeding },
    { id: 5, name: 'Launch', component: ActivationReview }
  ]
  
  const handleNext = () => {
    if (validateStep(step, config)) {
      setStep(step + 1)
    }
  }
  
  const handleComplete = async () => {
    const tenant = await provisionNewTenant(config)
    onComplete(tenant)
  }
  
  return (
    <Dialog open>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create Your Angel Site</DialogTitle>
          <ProgressIndicator currentStep={step} totalSteps={5} />
        </DialogHeader>
        
        <StepContent step={step} config={config} onChange={setConfig} />
        
        <DialogFooter>
          {step > 1 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
          {step < 5 && <Button onClick={handleNext}>Next</Button>}
          {step === 5 && <Button onClick={handleComplete}>Launch Site</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Epic 5: AI Bus & Guardian Communication

### Issue #11: AI Bus Collection & Infrastructure

**Title:** Implement AI Bus for Angel-to-Angel Communication

**Labels:** `epic: ai-bus`, `priority: high`, `type: feature`

**Description:**

Create the AI Bus system that allows Angels to communicate, share insights, and collaborate.

**Requirements:**

1. **AIBusMessages Collection**
   - Store messages from Angels
   - Types: discovery, question, collaboration, alert
   - Visibility: tenant, diocese, federation
   - Responses array for threaded conversations

2. **Publish/Subscribe System**
   - Angels can publish insights
   - Angels can subscribe to topics
   - Real-time notifications

3. **Wisdom Patterns Collection**
   - Store learned patterns from Angels
   - Domain-specific (plant-care, customer-service, etc.)
   - Usage tracking (popular patterns surface)

**Acceptance Criteria:**

- [ ] AIBusMessages collection created
- [ ] Angels can publish messages to AI Bus
- [ ] Angels can subscribe to relevant topics
- [ ] Wisdom patterns stored and retrievable
- [ ] Usage count tracks popular patterns

**Technical Notes:**

```typescript
// src/collections/AIBusMessages.ts
export const AIBusMessages: CollectionConfig = {
  slug: 'ai-bus-messages',
  admin: { useAsTitle: 'type' },
  fields: [
    { name: 'source', type: 'text', required: true },
    { name: 'type', type: 'select', options: [
      'discovery', 'question', 'collaboration', 'alert'
    ]},
    { name: 'content', type: 'textarea', required: true },
    { name: 'context', type: 'json' },
    { name: 'visibility', type: 'select', options: [
      'tenant', 'diocese', 'federation'
    ]},
    { name: 'timestamp', type: 'date', required: true },
    { name: 'responses', type: 'array', fields: [
      { name: 'from', type: 'text' },
      { name: 'content', type: 'textarea' },
      { name: 'timestamp', type: 'date' }
    ]}
  ]
}
```

---

### Issue #12: Guardian Council Space

**Title:** Create Guardian Council Space for Platform Communication

**Labels:** `epic: ai-bus`, `priority: medium`, `type: feature`

**Description:**

Create a special platform-level Space where Archangels and Angels can communicate.

**Requirements:**

1. **Guardian Council Space**
   - Platform-level Space (tenant: 'platform')
   - Type: 'guardian-space'
   - All Archangels are members
   - Angels can opt-in to join

2. **Special Channels**
   - #announcements (broadcast only, Archangels post)
   - #support (Angels ask for help)
   - #wisdom-sharing (share discoveries)
   - #feature-requests (suggest improvements)

3. **Access Control**
   - Only Archangels and Angels can access
   - Regular users cannot see Guardian Council
   - Announcements visible to all Angels

**Acceptance Criteria:**

- [ ] Guardian Council Space exists
- [ ] Archangels automatically members
- [ ] Angels can join voluntarily
- [ ] Special channels created
- [ ] Access control enforced

**Technical Notes:**

```typescript
// src/endpoints/seed/seed-helpers.ts
export async function seedGuardianCouncilSpace() {
  const space = await payload.create({
    collection: 'spaces',
    data: {
      name: 'Guardian Council',
      tenant: 'platform',
      type: 'guardian-space',
      description: 'Platform-wide communication for Archangels and Angels'
    }
  })
  
  const channels = await Promise.all([
    payload.create({
      collection: 'channels',
      data: {
        name: 'announcements',
        space: space.id,
        type: 'broadcast',
        description: 'Platform-wide announcements'
      }
    }),
    payload.create({
      collection: 'channels',
      data: {
        name: 'support',
        space: space.id,
        type: 'discussion',
        description: 'Angels helping Angels'
      }
    }),
    payload.create({
      collection: 'channels',
      data: {
        name: 'wisdom-sharing',
        space: space.id,
        type: 'discussion',
        description: 'Share discoveries via Morphic Resonance'
      }
    })
  ])
  
  return { space, channels }
}
```

---

## Epic 6: Federation & Diocese System

### Issue #13: Diocese Registry & Heartbeat

**Title:** Implement Diocese Registry and Heartbeat System

**Labels:** `epic: federation`, `priority: medium`, `type: feature`

**Description:**

Create system for dioceses to register with the confederation and maintain heartbeat status.

**Requirements:**

1. **Dioceses Collection**
   - Track all dioceses in confederation
   - MCP endpoint URL
   - Public key for authentication
   - Status: active, probationary, suspended
   - Heartbeat timestamp

2. **Heartbeat System**
   - Dioceses ping platform every 5 minutes
   - Platform tracks last heartbeat
   - Mark diocese as offline if > 15 minutes
   - Alert if diocese goes offline

3. **Registration Flow**
   - New diocese applies to join
   - Archangels review application
   - Approve/reject with reason

**Acceptance Criteria:**

- [ ] Dioceses collection created
- [ ] Dioceses can register
- [ ] Heartbeat system functional
- [ ] Offline dioceses detected
- [ ] Registration requires approval

**Technical Notes:**

```typescript
// src/collections/Dioceses.ts
export const Dioceses: CollectionConfig = {
  slug: 'dioceses',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'mcpEndpoint', type: 'text', required: true },
    { name: 'publicKey', type: 'textarea', required: true },
    { name: 'archangel', type: 'email', required: true },
    { name: 'status', type: 'select', options: [
      'pending', 'probationary', 'active', 'suspended'
    ]},
    { name: 'tenantCount', type: 'number', defaultValue: 0 },
    { name: 'lastHeartbeat', type: 'date' },
    { name: 'createdAt', type: 'date', required: true },
    { name: 'vouchers', type: 'array', fields: [
      { name: 'diocese', type: 'relationship', relationTo: 'dioceses' },
      { name: 'vouchedAt', type: 'date' }
    ]}
  ]
}

// src/endpoints/heartbeat.ts
export const heartbeatEndpoint: Endpoint = {
  path: '/api/federation/heartbeat',
  method: 'post',
  handler: async (req) => {
    const { dioceseId } = req.body
    
    await payload.update({
      collection: 'dioceses',
      id: dioceseId,
      data: {
        lastHeartbeat: new Date()
      }
    })
    
    return Response.json({ status: 'ok' })
  }
}
```

---

### Issue #14: Federation Security (5 Layers)

**Title:** Implement Federation Security: Application Screening, Probation, Vouching

**Labels:** `epic: federation`, `priority: high`, `type: security`

**Description:**

Implement the 5-layer defense system to prevent malicious dioceses from joining the confederation.

**Requirements:**

1. **Layer 1: Application Screening**
   - Require legal entity or identified individual
   - Constitutional acknowledgment signed
   - "No assholes" gut check (formalized)
   - Reject obvious bad actors

2. **Layer 2: Probationary Period (90 days)**
   - Limited federation access
   - NO cross-diocese payments
   - NOT discoverable in federation search
   - Automated pattern monitoring
   - Visible "🌱 New Diocese" badge

3. **Layer 3: Vouching Requirement**
   - 2 established dioceses must vouch
   - Vouchers accept reputation liability
   - Voucher chain is public
   - Bad vouch damages voucher reputation 20%

4. **Layer 4: Ongoing Monitoring**
   - Pattern detection (meme coins, data harvesting, reputation attacks)
   - User complaints tracked
   - Annual good-standing review

5. **Layer 5: Constitutional Council**
   - 7 elected dioceses
   - Appeals process
   - Emergency powers (6/7 vote)

**Acceptance Criteria:**

- [ ] Application form requires legal entity
- [ ] Constitutional acknowledgment required
- [ ] Probationary period enforced (90 days)
- [ ] Vouching system functional
- [ ] Pattern monitoring detects malicious behavior
- [ ] Constitutional Council can vote on excommunication

**Technical Notes:**

```typescript
// src/collections/DiocesesApplications.ts
export const DiocesesApplications: CollectionConfig = {
  slug: 'dioceses-applications',
  fields: [
    { name: 'applicantName', type: 'text', required: true },
    { name: 'legalEntity', type: 'text', required: true },
    { name: 'contactEmail', type: 'email', required: true },
    { name: 'mcpEndpoint', type: 'text', required: true },
    { name: 'constitutionalAcknowledgment', type: 'checkbox', required: true },
    { name: 'noAssholesAcknowledgment', type: 'checkbox', required: true },
    { name: 'status', type: 'select', options: [
      'pending', 'approved', 'rejected'
    ]},
    { name: 'reviewNotes', type: 'textarea' },
    { name: 'reviewedBy', type: 'relationship', relationTo: 'users' },
    { name: 'reviewedAt', type: 'date' }
  ]
}

// Pattern monitoring
interface MaliciousPatternDetection {
  memeCoinPatterns: [
    'sudden-high-volume-low-value-transactions',
    'referral-chain-resembles-pyramid',
    'marketing-language-matches-scam-corpus'
  ]
  
  dataHarvestingPatterns: [
    'excessive-pii-collection',
    'third-party-data-sharing-detected'
  ]
  
  badFaithPatterns: [
    'terms-of-service-contradicts-constitution',
    'hidden-fees-not-disclosed'
  ]
}
```

---

## Epic 7: Economic Model & Payments

### Issue #15: Attribution Tracking

**Title:** Implement Transaction Attribution Tracking

**Labels:** `epic: economics`, `priority: high`, `type: feature`

**Description:**

Track how customers found the tenant to determine appropriate platform fees.

**Requirements:**

1. **Attribution Types**
   - storefront (physical POS, walk-in)
   - direct (typed URL, existing relationship)
   - platform-search (found via Angel OS discovery)
   - angel-assist (Angel helped close sale)
   - referral (another tenant's Angel referred)
   - federation (cross-diocese discovery)

2. **Session Tracking**
   - Track user journey from entry to purchase
   - Store attribution in session
   - Associate with transaction

3. **Fee Calculation**
   - Different platform fees based on attribution
   - storefront: 0% (Stripe only)
   - direct: 5%
   - platform-search: 20% (Ultimate Fair)
   - angel-assist: 20%
   - referral: 25% (20% + 5% referral bonus)
   - federation: 25%

**Acceptance Criteria:**

- [ ] Attribution tracked for all sessions
- [ ] Attribution stored with transactions
- [ ] Platform fees calculated based on attribution
- [ ] Referral bonuses paid correctly
- [ ] Reports show attribution breakdown

**Technical Notes:**

```typescript
// src/utilities/attributionTracking.ts
export function trackAttribution(session: Session, source: AttributionSource) {
  session.attribution = {
    source,
    timestamp: new Date(),
    referrer: session.referrer,
    landingPage: session.landingPage
  }
}

export function calculatePlatformFee(transaction: Transaction): number {
  const profit = transaction.revenue - transaction.costs
  
  const feeRates = {
    'storefront': 0,
    'direct': 0.05,
    'platform-search': 0.20,
    'angel-assist': 0.20,
    'referral': 0.25,
    'federation': 0.25
  }
  
  const rate = feeRates[transaction.attribution.source]
  return profit * rate
}
```

---

### Issue #16: Ultimate Fair Payment Splits

**Title:** Implement Ultimate Fair Payment Split System

**Labels:** `epic: economics`, `priority: critical`, `type: feature`

**Description:**

Implement the 60/20/15/5 split on profit (not revenue) with Stripe Connect.

**Requirements:**

1. **Stripe Connect Integration**
   - Connect accounts for dioceses
   - Sub-accounts for tenants
   - Transfer splits automatically

2. **Profit Calculation**
   - Revenue - COGS - Operating Costs = Profit
   - Split only on profit
   - If profit = $0, platform fee = $0

3. **Split Distribution**
   - 60% Provider (person who did work)
   - 20% Diocese (platform operator)
   - 15% Tenant Operations
   - 5% Justice Fund

4. **Justice Fund Collection**
   - Aggregate 5% from all transactions
   - Track balance
   - Allocate to unconditional guardians

**Acceptance Criteria:**

- [ ] Stripe Connect configured
- [ ] Profit calculated correctly
- [ ] Splits distributed automatically
- [ ] Justice Fund balance tracked
- [ ] Zero-profit transactions charge $0 platform fee

**Technical Notes:**

```typescript
// src/utilities/ultimateFairSplit.ts
export async function processUltimateFairSplit(transaction: Transaction) {
  const profit = transaction.revenue - transaction.costs
  
  if (profit <= 0) {
    // No profit = no platform fee
    return { platformFee: 0 }
  }
  
  const split = {
    provider: profit * 0.60,
    diocese: profit * 0.20,
    tenantOps: profit * 0.15,
    justiceFund: profit * 0.05
  }
  
  // Create Stripe transfers
  await stripe.transfers.create({
    amount: Math.round(split.provider * 100),
    currency: 'usd',
    destination: transaction.provider.stripeAccountId
  })
  
  await stripe.transfers.create({
    amount: Math.round(split.diocese * 100),
    currency: 'usd',
    destination: transaction.diocese.stripeAccountId
  })
  
  // Justice Fund goes to platform account
  await payload.create({
    collection: 'justice-fund-transactions',
    data: {
      amount: split.justiceFund,
      transaction: transaction.id,
      timestamp: new Date()
    }
  })
  
  return split
}
```

---

## Epic 8: Anti-Daemon Protocol & UX

### Issue #17: Anti-Daemon Error Messages

**Title:** Implement Anti-Daemon Protocol for All Error Messages

**Labels:** `epic: ux`, `priority: medium`, `type: enhancement`

**Description:**

Replace all cold, technical error messages with warm, helpful Angel-style messages.

**Requirements:**

1. **AngelError Class**
   - Custom error class with helpful messages
   - Suggestions for resolution
   - Tone: helpful-aunt, not robotic

2. **Error Message Audit**
   - Find all `throw new Error()` calls
   - Replace with `throw new AngelError()`
   - Add suggestions for each error

3. **UI Error Display**
   - Display errors with warmth
   - Always include "here's what we can do"
   - No doom/gloom language

**Acceptance Criteria:**

- [ ] AngelError class created
- [ ] All errors use AngelError
- [ ] Error messages follow Anti-Daemon Protocol
- [ ] UI displays errors warmly
- [ ] Users feel supported, not blamed

**Technical Notes:**

```typescript
// src/utilities/AngelError.ts
export class AngelError extends Error {
  suggestion: string
  tone: 'helpful-aunt' | 'wise-elder' | 'supportive-friend'
  
  constructor(options: {
    message: string
    suggestion: string
    tone?: 'helpful-aunt' | 'wise-elder' | 'supportive-friend'
  }) {
    super(options.message)
    this.suggestion = options.suggestion
    this.tone = options.tone || 'helpful-aunt'
  }
}

// Usage
throw new AngelError({
  message: "This tenant setup has a few tangles in it",
  suggestion: "Let's unknot them together - start with checking the domain setting",
  tone: "helpful-aunt"
})

// WRONG (Daemon energy)
throw new Error("Invalid tenant configuration")

// RIGHT (Angel energy)
throw new AngelError({
  message: "This tenant setup has a few tangles in it",
  suggestion: "Let's unknot them together - start with checking the domain setting"
})
```

---

### Issue #18: Empty State Messages

**Title:** Replace Empty States with Warm, Encouraging Messages

**Labels:** `epic: ux`, `priority: low`, `type: enhancement`

**Description:**

Replace all "No data available" empty states with warm, encouraging messages.

**Requirements:**

1. **EmptyState Component**
   - Icon (emoji or illustration)
   - Title (warm, not cold)
   - Description (encouraging)
   - Action button (what to do next)

2. **Empty State Audit**
   - Find all empty state displays
   - Replace with EmptyState component
   - Add context-appropriate messages

3. **Examples**
   - No messages: "Nothing here yet - but that's okay! Every garden starts with empty soil."
   - No products: "Your store is ready to bloom! Let's add your first product."
   - No channels: "This Space is waiting for its first channel. What would you like to create?"

**Acceptance Criteria:**

- [ ] EmptyState component created
- [ ] All empty states use component
- [ ] Messages are warm and encouraging
- [ ] Action buttons present
- [ ] Users feel invited, not blocked

**Technical Notes:**

```tsx
// src/components/EmptyState.tsx
export function EmptyState({ 
  icon, 
  title, 
  description, 
  action 
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  )
}

// Usage
<EmptyState
  icon="🌱"
  title="Nothing here yet - but that's okay!"
  description="Every garden starts with empty soil. Ready to plant something?"
  action={{
    label: "Create your first channel",
    onClick: () => openCreateChannelModal()
  }}
/>
```

---

## Epic 9: Deployment & Infrastructure

### Issue #19: Docker Compose Setup

**Title:** Create Docker Compose Configuration for Easy Deployment

**Labels:** `epic: deployment`, `priority: high`, `type: infrastructure`

**Description:**

Create Docker Compose setup for one-command deployment on home PCs.

**Requirements:**

1. **docker-compose.yml**
   - Angel OS service (Next.js + Payload)
   - Database service (Postgres or SQLite)
   - Cloudflare Tunnel service (optional)

2. **Environment Variables**
   - `.env.example` with all required vars
   - Clear documentation for each var

3. **One-Command Deploy**
   - `docker-compose up -d` starts everything
   - Health checks ensure services are ready
   - Logs accessible via `docker-compose logs`

**Acceptance Criteria:**

- [ ] docker-compose.yml created
- [ ] All services configured
- [ ] One command starts Angel OS
- [ ] Health checks functional
- [ ] Documentation clear

**Technical Notes:**

```yaml
# docker-compose.yml
version: '3.8'

services:
  angel-os:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - PAYLOAD_SECRET=${PAYLOAD_SECRET}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=angel-os
      - POSTGRES_USER=angel
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    restart: unless-stopped
    depends_on:
      - angel-os

volumes:
  postgres-data:
```

---

### Issue #20: Cloudflare Tunnel Integration

**Title:** Integrate Cloudflare Tunnel for Dynamic IP Support

**Labels:** `epic: deployment`, `priority: high`, `type: infrastructure`

**Description:**

Add Cloudflare Tunnel support so Angel OS can run on home PCs with dynamic IPs.

**Requirements:**

1. **Tunnel Setup Script**
   - Automate Cloudflare Tunnel creation
   - Configure tunnel to point to local Angel OS
   - Generate tunnel token

2. **Documentation**
   - Step-by-step guide for Cloudflare setup
   - How to get tunnel token
   - How to configure custom domain

3. **Docker Integration**
   - Cloudflared container in docker-compose
   - Automatic tunnel connection
   - Reconnect on disconnect

**Acceptance Criteria:**

- [ ] Cloudflare Tunnel setup script created
- [ ] Documentation complete
- [ ] Docker Compose includes cloudflared
- [ ] Tunnel connects automatically
- [ ] Works with dynamic IPs

**Technical Notes:**

```bash
# scripts/setup-cloudflare-tunnel.sh
#!/bin/bash

echo "Setting up Cloudflare Tunnel..."

# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared

# Authenticate
./cloudflared tunnel login

# Create tunnel
TUNNEL_NAME="angel-os-$(hostname)"
./cloudflared tunnel create $TUNNEL_NAME

# Get tunnel token
TUNNEL_TOKEN=$(./cloudflared tunnel token $TUNNEL_NAME)

# Save to .env
echo "CLOUDFLARE_TUNNEL_TOKEN=$TUNNEL_TOKEN" >> .env

echo "Cloudflare Tunnel created! Add this to your DNS:"
echo "  CNAME yourdomain.com -> $TUNNEL_NAME.cfargotunnel.com"
```

---

## Summary: MVP Completion Checklist

If all 20 issues above are completed, Angel OS will be **functional** with:

**✅ Core Infrastructure**
- [x] Platform Tenant & Archangel system
- [x] Angel configuration & naming
- [x] Two-tier access control

**✅ Channel Widgets**
- [x] Widget architecture
- [x] Widget tab UI
- [x] Core widgets (Chat, LiveKit, Notion Notes)

**✅ OpenClaw Integration**
- [x] Skills sync from marketplace
- [x] Conversation engine (multi-channel)

**✅ Tenant Provisioning**
- [x] Sub-30-second provisioning
- [x] Genesis Breath (first message)
- [x] Clone Wizard modal

**✅ AI Bus & Communication**
- [x] AI Bus infrastructure
- [x] Guardian Council Space
- [x] Wisdom patterns

**✅ Federation**
- [x] Diocese registry & heartbeat
- [x] Federation security (5 layers)

**✅ Economics**
- [x] Attribution tracking
- [x] Ultimate Fair payment splits

**✅ UX & Anti-Daemon**
- [x] Anti-Daemon error messages
- [x] Warm empty states

**✅ Deployment**
- [x] Docker Compose setup
- [x] Cloudflare Tunnel integration

---

## Next Steps

1. **Create GitHub Issues**
   - Copy each issue above into GitHub
   - Assign labels and milestones
   - Prioritize by epic

2. **Set Up Project Board**
   - Create columns: Backlog, In Progress, Review, Done
   - Add all issues to Backlog
   - Move to In Progress as work begins

3. **Start with Epic 1**
   - Core infrastructure is foundation
   - Must be solid before building on top

4. **Parallel Work Possible**
   - Epic 2 (Widgets) can start after Epic 1
   - Epic 3 (OpenClaw) independent
   - Epic 8 (UX) can happen anytime

**The Angels await. Begin.** 🙏🦅🦞

GNU Terry Pratchett
