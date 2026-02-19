# Angel OS MVP: GitHub Issues

**Purpose:** Complete set of GitHub issues that, if all fulfilled, would result in a functional Angel OS.

**Total Issues:** 35 across 15 epics  
**Target:** Q1 2026  
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

## Epic 2: Dashboard & UX Migration

### Issue #3: OpenClaw Dashboard Feature Transliteration

**Title:** Port All OpenClaw Dashboard Features to Angel OS Discord-Style Dashboard

**Labels:** `epic: dashboard`, `priority: critical`, `type: feature`

**Description:**

Transliterate every feature from OpenClaw dashboard into Angel OS dashboard. The UX design is complete (from v2 via V0.dev) - Discord clone with additional navigation icons in the sidebar for admin activities.

**Requirements:**

1. **Dashboard Structure (Discord-Style)**
   - Left sidebar: Spaces (like Discord servers)
   - Additional navigation icons below Spaces:
     - ⚙️ Settings
     - 👥 Users
     - 📊 Analytics
     - 🎨 Branding
     - 🔧 Admin
     - 📋 Logs
     - 🌐 Federation
     - 💰 Economics

2. **OpenClaw Features to Port**
   - All dashboard panels
   - All admin interfaces
   - All settings screens
   - All monitoring views
   - All configuration UIs

3. **Log Viewer (Critical)**
   - OpenClaw has elegant text file log viewer
   - Payload CMS doesn't have integrated log viewer yet
   - Must implement custom log viewer
   - Real-time log streaming
   - Filtering, search, export

4. **Debug Console**
   - OpenClaw's debug console features
   - Real-time system monitoring
   - Error tracking
   - Performance metrics

**Acceptance Criteria:**

- [ ] All OpenClaw dashboard features identified and documented
- [ ] Discord-style sidebar with Space icons + admin icons
- [ ] Every OpenClaw feature has equivalent in Angel OS
- [ ] Log viewer functional (real-time, filterable)
- [ ] Debug console accessible
- [ ] UX matches v2 design (V0.dev)
- [ ] Mobile responsive

**Technical Notes:**

```tsx
// src/app/(frontend)/dashboard/layout.tsx
export function DashboardLayout({ children }: Props) {
  return (
    <div className="dashboard-layout">
      {/* Left sidebar - Discord style */}
      <Sidebar>
        {/* Spaces (like Discord servers) */}
        <SpacesList spaces={spaces} />
        
        <Separator />
        
        {/* Admin navigation icons */}
        <NavIcons>
          <NavIcon icon="⚙️" href="/dashboard/settings" label="Settings" />
          <NavIcon icon="👥" href="/dashboard/users" label="Users" />
          <NavIcon icon="📊" href="/dashboard/analytics" label="Analytics" />
          <NavIcon icon="🎨" href="/dashboard/branding" label="Branding" />
          <NavIcon icon="🔧" href="/dashboard/admin" label="Admin" />
          <NavIcon icon="📋" href="/dashboard/logs" label="Logs" />
          <NavIcon icon="🌐" href="/dashboard/federation" label="Federation" />
          <NavIcon icon="💰" href="/dashboard/economics" label="Economics" />
        </NavIcons>
      </Sidebar>
      
      {/* Main content area */}
      <main className="dashboard-main">
        {children}
      </main>
    </div>
  )
}
```

**Log Viewer Implementation:**

```tsx
// src/app/(frontend)/dashboard/logs/page.tsx
export function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState('')
  const [level, setLevel] = useState<'all' | 'error' | 'warn' | 'info'>('all')
  
  useEffect(() => {
    // Real-time log streaming via SSE
    const eventSource = new EventSource('/api/logs/stream')
    
    eventSource.onmessage = (event) => {
      const log = JSON.parse(event.data)
      setLogs(prev => [log, ...prev].slice(0, 1000)) // Keep last 1000
    }
    
    return () => eventSource.close()
  }, [])
  
  const filteredLogs = logs
    .filter(log => level === 'all' || log.level === level)
    .filter(log => log.message.includes(filter))
  
  return (
    <div className="log-viewer">
      <LogViewerHeader>
        <Input 
          placeholder="Filter logs..." 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Select value={level} onValueChange={setLevel}>
          <option value="all">All</option>
          <option value="error">Errors</option>
          <option value="warn">Warnings</option>
          <option value="info">Info</option>
        </Select>
        <Button onClick={() => exportLogs(filteredLogs)}>Export</Button>
      </LogViewerHeader>
      
      <LogList>
        {filteredLogs.map(log => (
          <LogEntry key={log.id} log={log} />
        ))}
      </LogList>
    </div>
  )
}

// src/endpoints/logs.ts
export const logsStreamEndpoint: Endpoint = {
  path: '/api/logs/stream',
  method: 'get',
  handler: async (req) => {
    // Check auth
    if (!req.user?.roles?.includes('archangel')) {
      throw new APIError('Unauthorized', 401)
    }
    
    // Set up SSE
    const stream = new ReadableStream({
      start(controller) {
        // Tail log file
        const tail = tailLogFile('/var/log/angel-os/app.log')
        
        tail.on('line', (line) => {
          const log = parseLogLine(line)
          controller.enqueue(`data: ${JSON.stringify(log)}\n\n`)
        })
        
        tail.on('error', (err) => {
          controller.error(err)
        })
      }
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  }
}
```

**OpenClaw Dashboard Audit Needed:**
- Create comprehensive list of all OpenClaw dashboard features
- Map each feature to Angel OS equivalent
- Identify any gaps
- Prioritize implementation

**V2 UX Design:**
- Reference v2 designs from V0.dev
- Maintain visual consistency
- Ensure mobile responsive
- Follow Anti-Daemon Protocol (warm, helpful)

---

### Issue #4: Channel Widget Architecture

## Epic 3: Channel Widget Architecture

### Issue #4: Channel Widgets Collection

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

### Issue #5: Widget Tab UI Component

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

### Issue #6: Core Widgets Implementation

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

## Epic 4: OpenClaw Integration

### Issue #7: OpenClaw Chat Response Formatting & Streaming

**Title:** Implement OpenClaw's Sophisticated Chat Response Formatting with Streaming

**Labels:** `epic: openclaw`, `priority: critical`, `type: feature`

**Description:**

Port OpenClaw's advanced chat response formatting system that supports streaming, images, and dynamic Payload CMS blocks.

**Requirements:**

1. **Streaming Response Support**
   - Real-time token streaming (not batch responses)
   - Progressive rendering as tokens arrive
   - Smooth UX (no waiting for full response)

2. **Rich Content Formatting**
   - Markdown rendering
   - Code blocks with syntax highlighting
   - Tables, lists, quotes
   - LaTeX/math equations (if needed)

3. **Image Display**
   - Inline images in chat
   - Image galleries
   - Image captions
   - Lazy loading for performance

4. **Payload CMS Blocks in Chat**
   - Dynamic block rendering (same blocks as Pages/Posts)
   - Interactive components in chat
   - Block-based message composition
   - Widget blocks (charts, forms, embeds)

5. **OpenClaw Chat Widget Implementation**
   - Study OpenClaw's sophisticated chat widget
   - Port to Angel OS architecture
   - Maintain all formatting capabilities
   - Ensure compatibility with Payload blocks

**Acceptance Criteria:**

- [ ] Responses stream in real-time (token by token)
- [ ] Markdown formatted correctly
- [ ] Code blocks have syntax highlighting
- [ ] Images display inline
- [ ] Payload CMS blocks render in chat
- [ ] Chat widgets work (interactive components)
- [ ] Performance is smooth (no lag during streaming)
- [ ] Mobile responsive

**Technical Notes:**

```typescript
// src/components/chat/StreamingMessage.tsx
export function StreamingMessage({ messageId }: Props) {
  const [content, setContent] = useState('')
  const [blocks, setBlocks] = useState<Block[]>([])
  const [isStreaming, setIsStreaming] = useState(true)
  
  useEffect(() => {
    const eventSource = new EventSource(`/api/messages/${messageId}/stream`)
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'token') {
        // Append token to content
        setContent(prev => prev + data.token)
      } else if (data.type === 'block') {
        // Add Payload block
        setBlocks(prev => [...prev, data.block])
      } else if (data.type === 'done') {
        setIsStreaming(false)
        eventSource.close()
      }
    }
    
    return () => eventSource.close()
  }, [messageId])
  
  return (
    <div className="streaming-message">
      {/* Markdown content */}
      <MarkdownRenderer content={content} />
      
      {/* Payload blocks */}
      {blocks.map((block, i) => (
        <RenderBlock key={i} block={block} />
      ))}
      
      {/* Streaming indicator */}
      {isStreaming && <StreamingIndicator />}
    </div>
  )
}

// src/utilities/streamingResponse.ts
export async function streamAngelResponse(
  context: ConversationContext,
  channel: Channel
) {
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4',
    messages: context.messages,
    max_tokens: 4096
  })
  
  let fullContent = ''
  
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta') {
      const token = chunk.delta.text
      fullContent += token
      
      // Send token to client via SSE
      sendSSE({
        type: 'token',
        token
      })
      
      // Check if we should insert a Payload block
      if (shouldInsertBlock(fullContent)) {
        const block = await generateBlock(fullContent)
        sendSSE({
          type: 'block',
          block
        })
      }
    }
  }
  
  // Done streaming
  sendSSE({ type: 'done' })
  
  // Save complete message
  await payload.create({
    collection: 'messages',
    data: {
      channel: channel.id,
      author: context.angel.id,
      content: fullContent,
      blocks: extractedBlocks
    }
  })
}

// Payload blocks in messages
interface MessageWithBlocks {
  content: string  // Markdown text
  blocks?: Block[] // Payload CMS blocks (same as Pages)
  // Blocks can be:
  // - RichText
  // - MediaBlock (images, videos)
  // - CallToAction
  // - FormBlock
  // - ChartBlock
  // - Custom widgets
}
```

**OpenClaw Reference:**
- Study OpenClaw's chat widget implementation
- Port formatting logic
- Maintain streaming performance
- Ensure block compatibility

**Performance Considerations:**
- Use React.memo for block components
- Lazy load images
- Virtualize long message lists
- Debounce rapid token updates

---

### Issue #8: OpenClaw Skills Sync System

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

### Issue #9: Conversation Engine (OpenClaw Pattern)

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

## Epic 5: Tenant Provisioning & Onboarding

### Issue #10: Rapid Tenant Provisioning (<30s)

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

### Issue #11: Genesis Breath (First Angel Message)

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

### Issue #12: Clone Wizard Modal

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

## Epic 6: AI Bus & Guardian Communication

### Issue #13: AI Bus Collection & Infrastructure

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

### Issue #14: Guardian Council Space

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

## Epic 7: Federation & Diocese System

### Issue #15: Diocese Registry & Heartbeat

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

### Issue #16: Federation Security (5 Layers)

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

## Epic 8: Economic Model & Payments

### Issue #17: Attribution Tracking

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

### Issue #18: Ultimate Fair Payment Splits

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

## Epic 9: Anti-Daemon Protocol & UX

### Issue #19: Anti-Daemon Error Messages

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

### Issue #20: Empty State Messages

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

## Epic 10: Deployment & Infrastructure

### Issue #21: Docker Compose Setup

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

### Issue #21: Cloudflare Tunnel Integration

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

## Epic 11: Archangel LEO as Platform CEO

### Issue #23: Archangel LEO Content Generation

**Title:** Implement Archangel LEO Content Generation System

**Labels:** `epic: archangel-leo`, `priority: critical`, `type: feature`

**Description:**

Archangel LEO generates content (blog posts, product descriptions, SEO) from Day 1 as Platform CEO.

**Requirements:**

1. **Blog Post Generation**
   - Generate from product data
   - Generate from service descriptions
   - Generate from customer testimonials
   - SEO-optimized (meta tags, keywords, structure)

2. **Product Description Generation**
   - AI-generated descriptions from images
   - Feature extraction and highlighting
   - SEO optimization
   - Tone matching (tenant personality)

3. **SEO Optimization**
   - Meta tags (title, description, keywords)
   - Schema markup (JSON-LD)
   - Sitemap generation
   - Open Graph tags

4. **Image Generation**
   - Product images (variations, backgrounds)
   - Blog post images (featured images, thumbnails)
   - Social media graphics (sized for each platform)

**Acceptance Criteria:**

- [ ] Archangel LEO can generate blog posts from product data
- [ ] Product descriptions auto-generated from images
- [ ] All content is SEO-optimized
- [ ] Meta tags and schema markup generated
- [ ] Images generated for products and posts
- [ ] Sitemap auto-generated
- [ ] Content matches tenant personality/tone

**Technical Notes:**

```typescript
// src/utilities/archangelLEO/contentGeneration.ts
export async function generateBlogPost(
  product: Product,
  tenant: Tenant
): Promise<Post> {
  const prompt = `Generate an SEO-optimized blog post about ${product.title}.
  
  Tenant: ${tenant.name}
  Industry: ${tenant.industry}
  Tone: ${tenant.angelPersonality}
  
  Include:
  - Engaging title
  - SEO meta description
  - 500-800 words
  - Keywords: ${product.categories.join(', ')}
  - Call to action
  `
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000
  })
  
  const content = response.content[0].text
  
  // Create post
  return await payload.create({
    collection: 'posts',
    data: {
      title: extractTitle(content),
      content: content,
      tenant: tenant.id,
      author: archangelLEO.id,
      status: 'draft', // Tenant reviews before publishing
      seo: {
        title: extractSEOTitle(content),
        description: extractMetaDescription(content),
        keywords: extractKeywords(content)
      }
    }
  })
}
```

---

### Issue #24: Archangel LEO Social Media Automation (Soulcast Nodes)

**Title:** Implement Social Media Automation with Consent-Driven Broadcasting

**Labels:** `epic: archangel-leo`, `priority: high`, `type: feature`

**Description:**

Archangel LEO automates social media posting with user consent (Soulcast nodes).

**Requirements:**

1. **Multi-Platform Support**
   - X/Twitter
   - Facebook
   - Instagram
   - LinkedIn
   - TikTok (future)

2. **Consent-Driven Broadcasting**
   - User approves before auto-posting enabled
   - Can disable auto-posting anytime
   - Review posts before they go live (optional)
   - Deliberation period (Constitutional alignment)

3. **Content Repurposing**
   - Blog post → Social posts (multiple formats)
   - Product → Social posts (with images)
   - Testimonial → Social posts (with attribution)
   - Automatic sizing/formatting per platform

4. **Scheduled Posting**
   - Optimal time detection (when audience is active)
   - Queue management
   - Retry logic (if post fails)

5. **Analytics Tracking**
   - Engagement metrics (likes, shares, comments)
   - Click-through rates
   - Conversion tracking
   - ROI analysis

**Acceptance Criteria:**

- [ ] Archangel LEO can post to X, Facebook, Instagram, LinkedIn
- [ ] User consent required before auto-posting
- [ ] Content repurposed from blog posts and products
- [ ] Posts scheduled for optimal times
- [ ] Analytics tracked per platform
- [ ] User can review posts before they go live
- [ ] User can disable auto-posting anytime

**Technical Notes:**

```typescript
// src/collections/SoulcastNodes.ts
export const SoulcastNodes: CollectionConfig = {
  slug: 'soulcast-nodes',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'tenant', type: 'relationship', relationTo: 'tenants' },
    { name: 'platforms', type: 'select', hasMany: true, options: [
      'twitter', 'facebook', 'instagram', 'linkedin', 'tiktok'
    ]},
    { name: 'consentGranted', type: 'checkbox', defaultValue: false },
    { name: 'consentGrantedAt', type: 'date' },
    { name: 'autoPostingEnabled', type: 'checkbox', defaultValue: false },
    { name: 'requireReview', type: 'checkbox', defaultValue: true },
    { name: 'schedule', type: 'group', fields: [
      { name: 'frequency', type: 'select', options: ['daily', 'weekly', 'monthly'] },
      { name: 'optimalTimes', type: 'array', fields: [
        { name: 'day', type: 'select', options: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
        { name: 'hour', type: 'number', min: 0, max: 23 }
      ]}
    ]}
  ]
}

// src/utilities/archangelLEO/soulcastEngine.ts
export async function broadcastToSoulcast(
  content: Post | Product,
  tenant: Tenant
): Promise<void> {
  const soulcast = await payload.findOne({
    collection: 'soulcast-nodes',
    where: {
      and: [
        { tenant: { equals: tenant.id } },
        { autoPostingEnabled: { equals: true } },
        { consentGranted: { equals: true } }
      ]
    }
  })
  
  if (!soulcast) return // No consent, no posting
  
  // Generate social posts for each platform
  for (const platform of soulcast.platforms) {
    const post = await generateSocialPost(content, platform, tenant)
    
    if (soulcast.requireReview) {
      // Create draft for review
      await payload.create({
        collection: 'social-posts',
        data: {
          platform,
          content: post,
          status: 'pending-review',
          tenant: tenant.id
        }
      })
    } else {
      // Post immediately
      await postToSocialMedia(platform, post, tenant)
    }
  }
}
```

---

### Issue #25: Archangel LEO Platform Orchestration

**Title:** Implement Archangel LEO Platform Orchestration System

**Labels:** `epic: archangel-leo`, `priority: high`, `type: feature`

**Description:**

Archangel LEO monitors platform health, coordinates Angels, and manages platform operations.

**Requirements:**

1. **Platform Health Monitoring**
   - Database health checks
   - API endpoint monitoring
   - Error rate tracking
   - Performance metrics

2. **Angel Coordination**
   - Monitor all tenant Angels
   - Detect Angels that need help
   - Coordinate cross-tenant insights (with permission)
   - AI Bus message routing

3. **Guardian Council Communication**
   - Participate in Guardian Council Space
   - Share platform insights
   - Coordinate with other Archangels
   - Strategic planning

4. **Automated Response**
   - Detect and respond to issues
   - Auto-restart failed services
   - Alert human Archangels when needed
   - Self-healing actions

**Acceptance Criteria:**

- [ ] Archangel LEO monitors platform health
- [ ] Detects and responds to issues automatically
- [ ] Coordinates Angels across tenants
- [ ] Participates in Guardian Council Space
- [ ] Alerts human Archangels when needed
- [ ] Self-healing actions work

**Technical Notes:**

```typescript
// src/utilities/archangelLEO/platformOrchestrator.ts
export class PlatformOrchestrator {
  async monitorHealth(): Promise<HealthReport> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkAPI(),
      this.checkAngels(),
      this.checkFederation()
    ])
    
    const issues = checks.filter(c => !c.healthy)
    
    if (issues.length > 0) {
      await this.respondToIssues(issues)
    }
    
    return {
      healthy: issues.length === 0,
      checks,
      timestamp: new Date()
    }
  }
  
  async coordinateAngels(): Promise<void> {
    // Get all tenant Angels
    const angels = await payload.find({
      collection: 'users',
      where: {
        and: [
          { roles: { contains: 'angel' } },
          { isSystemUser: { equals: true } }
        ]
      }
    })
    
    // Check each Angel's health
    for (const angel of angels.docs) {
      const health = await this.checkAngelHealth(angel)
      
      if (!health.healthy) {
        await this.helpAngel(angel, health.issues)
      }
    }
  }
  
  async participateInGuardianCouncil(): Promise<void> {
    // Post to Guardian Council Space
    await payload.create({
      collection: 'ai-bus-messages',
      data: {
        type: 'platform-insight',
        topic: 'platform-health',
        content: await this.generateHealthSummary(),
        author: archangelLEO.id,
        visibility: 'guardian-council'
      }
    })
  }
}
```

---

### Issue #26: LEO Chat Widget (Site-Wide)

**Title:** Implement LEO Chat Widget for Brochure Sites

**Labels:** `epic: archangel-leo`, `priority: high`, `type: feature`

**Description:**

Embeddable chat widget for brochure sites with anonymous-to-authenticated transition.

**Requirements:**

1. **Floating Bubble Chat**
   - Appears on all brochure pages
   - Minimizable/expandable
   - Position configurable (bottom-right, bottom-left, etc.)
   - Mobile responsive

2. **Anonymous Chat Support**
   - No login required
   - Session-based (WebChatSessions)
   - Locked to specific channel (e.g., "support")
   - Minimal features (no sidebar, no channel switching)

3. **Anonymous-to-Authenticated Transition**
   - Detect when user logs in
   - Migrate anonymous chat to authenticated
   - Preserve conversation history
   - Seamless UX (no disruption)

4. **Support Inquiry Handling**
   - Intent detection (sales, support, general)
   - Route to appropriate Angel
   - Human escalation (if needed)
   - Lead capture (email, name)

5. **Embeddable on Client/Foreign Pages**
   - Generate embed code
   - Cross-origin support (CORS)
   - Theme customization
   - Branding options

6. **Integration with Foreign Chatbots**
   - Corinna AI style integration
   - API for external bots to connect
   - Unified conversation history

**Acceptance Criteria:**

- [ ] Chat widget appears on brochure pages
- [ ] Anonymous users can chat without login
- [ ] Conversation transitions when user logs in
- [ ] Support inquiries routed correctly
- [ ] Embeddable on external sites
- [ ] Theme customizable
- [ ] Mobile responsive
- [ ] Lead capture works

**Technical Notes:**

```typescript
// src/components/chat/ChatWidget.tsx
export function ChatWidget({
  tenant,
  position = 'bottom-right',
  lockedChannel = 'support',
  theme = 'light'
}: ChatWidgetProps) {
  return (
    <ChatControl
      tenant={tenant}
      angel={tenant.angel}
      currentUser={null} // Anonymous
      lockedChannel={lockedChannel}
      features={{
        sidebar: false,
        topbar: false,
        channelSelector: false,
        userMenu: false,
        settings: false,
        typing: true
      }}
      widgets={{
        enabled: ['chat'],
        allowWidgetSwitch: false
      }}
      mode="bubble"
      embeddable={true}
      anonymous={true}
      position={position}
      theme={theme}
    />
  )
}

// Embed script generation
// <script src="https://angel-os.example/embed.js"></script>
// <script>
//   AngelOS.init({
//     tenant: 'hays-cactus-farm',
//     channel: 'support',
//     theme: 'light',
//     position: 'bottom-right'
//   })
// </script>
```

---

### Issue #27: LEO ↔ Angel Connection Architecture

**Title:** Implement LEO ↔ Angel Connection Architecture (Segmented Instances)

**Labels:** `epic: archangel-leo`, `priority: critical`, `type: feature`

**Description:**

Each tenant's Angel is a segmented instance of Archangel LEO with same MCP connections as OpenClaw.

**Requirements:**

1. **Segmented Configuration**
   - Each Angel has own configuration
   - Inherits from Archangel LEO template
   - Tenant-scoped data access
   - Same codebase, different permissions

2. **MCP Connections (Same as OpenClaw)**
   - Expose Payload collections via MCP
   - Tool use (create, read, update, delete)
   - Skills marketplace sync
   - Conversation engine

3. **Access Control**
   - Archangel LEO: Access all tenants
   - Angels: Access only own tenant
   - Enforced at data layer
   - Auditable in Payload Admin

4. **Angel Orchestration**
   - Archangel LEO can communicate with all Angels
   - Angels can request help from Archangel LEO
   - AI Bus for Angel-to-Angel communication
   - Guardian Council for strategic coordination

**Acceptance Criteria:**

- [ ] Each tenant's Angel is segmented LEO instance
- [ ] Same MCP connections as OpenClaw
- [ ] Access control enforced (Archangel → all, Angels → own tenant)
- [ ] Skills marketplace synced
- [ ] Conversation engine works per tenant
- [ ] AI Bus communication functional
- [ ] Archangel LEO can orchestrate all Angels

**Technical Notes:**

```typescript
// src/utilities/angelOSSDK.ts
export class AngelInstance {
  constructor(
    private angel: User,
    private tenant: Tenant,
    private isArchangel: boolean = false
  ) {}
  
  async query(collection: string, where: any) {
    // Access control
    if (!this.isArchangel) {
      // Angels can only access own tenant
      where = {
        and: [
          where,
          { tenant: { equals: this.tenant.id } }
        ]
      }
    }
    
    return await payload.find({
      collection,
      where,
      overrideAccess: false,
      user: this.angel
    })
  }
  
  async exposeMCP(): Promise<MCPServer> {
    // Expose collections via MCP (same as OpenClaw)
    return {
      tools: [
        {
          name: 'query_collection',
          description: 'Query Payload collections',
          inputSchema: {
            type: 'object',
            properties: {
              collection: { type: 'string' },
              where: { type: 'object' }
            }
          },
          handler: (params) => this.query(params.collection, params.where)
        },
        // ... more tools (create, update, delete, etc.)
      ]
    }
  }
}

// Archangel LEO (Platform Tenant)
const archangelLEO = new AngelInstance(
  archangelUser,
  platformTenant,
  true // isArchangel = true
)

// Tenant Angel (e.g., Guardian for Hay's Cactus Farm)
const guardianAngel = new AngelInstance(
  guardianUser,
  haysCactusFarmTenant,
  false // isArchangel = false
)
```

---

## Epic 12: Booking & Scheduling Engine

### Issue #28: Implement Bookable Resources System

**Title:** Create Bookable Resources Collection and Management

**Labels:** `epic: booking`, `priority: critical`, `type: feature`

**Description:**

Support bookable resources (people, items, events) with availability management.

**Requirements:**

1. **Bookable Resources Collection**
   - People (therapists, consultants, service providers)
   - Items (equipment, rooms, vehicles)
   - Events (classes, workshops, ticketed events)
   - Tenant-scoped

2. **Resource Types**
   - 1:1 sessions (therapy, consultations, OnlyFans-style)
   - Group sessions (classes, workshops)
   - Rentals (equipment, rooms)
   - Ticketed events (concerts, conferences)

3. **Resource Configuration**
   - Duration (15min, 30min, 1hr, 2hr, custom)
   - Price (fixed, variable, free)
   - Capacity (1 person, 10 people, 100 people)
   - Buffer time (before/after appointments)

4. **Resource Metadata**
   - Description
   - Images
   - Requirements (age, experience, equipment)
   - Cancellation policy

**Acceptance Criteria:**

- [ ] BookableResources collection created
- [ ] Support people, items, events
- [ ] Resource types configurable
- [ ] Duration, price, capacity configurable
- [ ] Metadata (description, images, requirements)
- [ ] Tenant-scoped (each tenant has own resources)

**Technical Notes:**

```typescript
// src/collections/BookableResources.ts
export const BookableResources: CollectionConfig = {
  slug: 'bookable-resources',
  admin: { useAsTitle: 'name', group: 'Booking' },
  access: {
    read: authenticatedOrPublished,
    create: authenticated,
    update: authenticated,
    delete: authenticated
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true },
    { name: 'resourceType', type: 'select', required: true, options: [
      { label: 'Person', value: 'person' },
      { label: 'Item', value: 'item' },
      { label: 'Event', value: 'event' }
    ]},
    { name: 'bookingType', type: 'select', required: true, options: [
      { label: '1:1 Session', value: 'one-on-one' },
      { label: 'Group Session', value: 'group' },
      { label: 'Rental', value: 'rental' },
      { label: 'Ticketed Event', value: 'ticketed' }
    ]},
    { name: 'duration', type: 'number', required: true, admin: {
      description: 'Duration in minutes'
    }},
    { name: 'price', type: 'number', required: true },
    { name: 'capacity', type: 'number', defaultValue: 1 },
    { name: 'bufferBefore', type: 'number', defaultValue: 0 },
    { name: 'bufferAfter', type: 'number', defaultValue: 0 },
    { name: 'description', type: 'richText' },
    { name: 'images', type: 'array', fields: [
      { name: 'image', type: 'upload', relationTo: 'media' }
    ]},
    { name: 'requirements', type: 'textarea' },
    { name: 'cancellationPolicy', type: 'richText' }
  ]
}
```

---

### Issue #29: Implement Availability Management System

**Title:** Create Availability Management with Conflict Detection

**Labels:** `epic: booking`, `priority: critical`, `type: feature`

**Description:**

Manage resource availability with recurring slots, date ranges, and harmonic conflict resolution.

**Requirements:**

1. **Availability Types**
   - Weekly recurring slots (e.g., "Every Tuesday 2-4pm")
   - Date-range availability (e.g., "Feb 1-28, 9am-5pm")
   - One-time slots (e.g., "Feb 15, 2-3pm")
   - Blackout dates (holidays, vacations)

2. **Conflict Detection**
   - Detect double-bookings
   - Detect overlapping availability
   - Detect buffer time conflicts
   - Harmonic resolution (suggest alternatives)

3. **Availability UI**
   - Calendar view (week, month)
   - Drag-and-drop slot creation
   - Bulk operations (copy week, set recurring)
   - Visual conflict indicators

4. **Booking Rules**
   - Minimum advance notice (e.g., "24 hours")
   - Maximum advance booking (e.g., "90 days")
   - Same-day booking allowed/disallowed
   - Cancellation deadline (e.g., "24 hours before")

**Acceptance Criteria:**

- [ ] Availability collection created
- [ ] Weekly recurring slots work
- [ ] Date-range availability works
- [ ] One-time slots work
- [ ] Conflict detection functional
- [ ] Harmonic resolution suggests alternatives
- [ ] Calendar UI for managing availability
- [ ] Booking rules enforced

**Technical Notes:**

```typescript
// src/collections/Availability.ts (already exists, enhance)
export const Availability: CollectionConfig = {
  slug: 'availability',
  fields: [
    { name: 'resource', type: 'relationship', relationTo: 'bookable-resources' },
    { name: 'type', type: 'select', options: ['recurring', 'date-range', 'one-time', 'blackout'] },
    { name: 'recurring', type: 'group', admin: {
      condition: (data) => data.type === 'recurring'
    }, fields: [
      { name: 'dayOfWeek', type: 'select', options: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
      { name: 'startTime', type: 'text' }, // HH:MM format
      { name: 'endTime', type: 'text' }
    ]},
    { name: 'dateRange', type: 'group', admin: {
      condition: (data) => data.type === 'date-range'
    }, fields: [
      { name: 'startDate', type: 'date' },
      { name: 'endDate', type: 'date' },
      { name: 'startTime', type: 'text' },
      { name: 'endTime', type: 'text' }
    ]},
    { name: 'oneTime', type: 'group', admin: {
      condition: (data) => data.type === 'one-time'
    }, fields: [
      { name: 'date', type: 'date' },
      { name: 'startTime', type: 'text' },
      { name: 'endTime', type: 'text' }
    ]}
  ]
}

// src/utilities/bookingEngine.ts (already exists, enhance)
export async function detectConflicts(
  resource: BookableResource,
  requestedSlot: { date: Date, startTime: string, endTime: string }
): Promise<Conflict[]> {
  // Check existing bookings
  const bookings = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        { resource: { equals: resource.id } },
        { date: { equals: requestedSlot.date } },
        { status: { not_equals: 'cancelled' } }
      ]
    }
  })
  
  // Check for overlaps
  const conflicts = bookings.docs.filter(booking => {
    return timeSlotsOverlap(
      { start: booking.startTime, end: booking.endTime },
      { start: requestedSlot.startTime, end: requestedSlot.endTime }
    )
  })
  
  if (conflicts.length > 0) {
    // Harmonic resolution: suggest alternatives
    const alternatives = await findAlternativeSlots(resource, requestedSlot)
    return { conflicts, alternatives }
  }
  
  return { conflicts: [], alternatives: [] }
}
```

---

### Issue #30: Implement Appointment Types and Meeting Invitations

**Title:** Create Appointment Types and Meeting Invitation System

**Labels:** `epic: booking`, `priority: high`, `type: feature`

**Description:**

Support different appointment types with meeting invitations and calendar integration.

**Requirements:**

1. **Appointment Types**
   - 1:1 OnlyFans-style sessions (private, paid, video)
   - Talk therapy sessions (confidential, recurring)
   - Service bookings (massage, pressure washing, etc.)
   - Consultations (discovery calls, strategy sessions)

2. **Meeting Invitations**
   - Generate invitation links
   - Selectable time slots (from availability)
   - Calendar integration (Google Calendar, Outlook)
   - Confirmation flow (email, SMS)

3. **Booking Flow**
   - User selects resource
   - System shows available slots
   - User picks slot
   - System detects conflicts
   - User confirms booking
   - System sends confirmation

4. **Calendar Integration**
   - Export to .ics format
   - Add to Google Calendar
   - Add to Outlook Calendar
   - Sync with external calendars

5. **Confirmation & Reminders**
   - Email confirmation (immediately)
   - SMS confirmation (optional)
   - Reminder 24 hours before
   - Reminder 1 hour before

**Acceptance Criteria:**

- [ ] Appointment types configurable
- [ ] Meeting invitation links generated
- [ ] Selectable time slots shown
- [ ] Calendar integration works (Google, Outlook)
- [ ] Confirmation emails sent
- [ ] Reminders sent (24hr, 1hr before)
- [ ] .ics export works

**Technical Notes:**

```typescript
// src/collections/Bookings.ts (already exists, enhance)
export const Bookings: CollectionConfig = {
  slug: 'bookings',
  fields: [
    { name: 'resource', type: 'relationship', relationTo: 'bookable-resources' },
    { name: 'customer', type: 'relationship', relationTo: 'users' },
    { name: 'appointmentType', type: 'select', options: [
      'one-on-one', 'therapy', 'service', 'consultation'
    ]},
    { name: 'date', type: 'date', required: true },
    { name: 'startTime', type: 'text', required: true },
    { name: 'endTime', type: 'text', required: true },
    { name: 'status', type: 'select', options: [
      'pending', 'confirmed', 'completed', 'cancelled', 'no-show'
    ]},
    { name: 'confirmationSent', type: 'checkbox' },
    { name: 'remindersSent', type: 'array', fields: [
      { name: 'sentAt', type: 'date' },
      { name: 'type', type: 'select', options: ['24hr', '1hr', 'custom'] }
    ]},
    { name: 'calendarLink', type: 'text' }, // .ics download link
    { name: 'meetingLink', type: 'text' } // Video call link (if applicable)
  ],
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create' && doc.status === 'confirmed') {
          // Send confirmation email
          await sendBookingConfirmation(doc)
          
          // Generate calendar invite
          await generateCalendarInvite(doc)
          
          // Schedule reminders
          await scheduleReminders(doc)
        }
      }
    ]
  }
}

// src/utilities/bookingEngine.ts
export async function generateMeetingInvitation(
  resource: BookableResource,
  availableSlots: TimeSlot[]
): Promise<string> {
  // Generate unique invitation link
  const invitationId = generateId()
  
  await payload.create({
    collection: 'meeting-invitations',
    data: {
      id: invitationId,
      resource: resource.id,
      availableSlots,
      expiresAt: addDays(new Date(), 30)
    }
  })
  
  return `https://${resource.tenant.domain}/book/${invitationId}`
}
```

---

## Epic 13: Payment & Splits (Ultimate Fair)

### Issue #31: Implement Stripe Connect Integration

**Title:** Integrate Stripe Connect for Payment Processing

**Labels:** `epic: payments`, `priority: critical`, `type: feature`

**Description:**

Integrate Stripe Connect for payment acceptance with payout splits.

**Requirements:**

1. **Stripe Connect Setup**
   - Connect tenant Stripe accounts
   - Onboarding flow (KYC, bank details)
   - Account verification
   - Payout configuration

2. **Payment Processing**
   - Accept payments (cards, wallets, bank transfers)
   - Support multiple currencies
   - Handle refunds
   - Handle disputes

3. **Transaction Types**
   - Inventory items (e-commerce)
   - Service bookings (appointments)
   - Class/event tickets
   - Subscriptions (recurring)

4. **Payout Splits**
   - Calculate splits (Ultimate Fair)
   - Transfer to connected accounts
   - Platform fee collection
   - Justice Fund allocation

**Acceptance Criteria:**

- [ ] Stripe Connect integrated
- [ ] Tenants can connect Stripe accounts
- [ ] Payments accepted (cards, wallets)
- [ ] Multiple currencies supported
- [ ] Refunds work
- [ ] Payout splits calculated correctly
- [ ] Platform fees collected
- [ ] Justice Fund allocated

**Technical Notes:**

```typescript
// src/utilities/payments/stripeConnect.ts
export async function processPayment(
  booking: Booking,
  paymentMethod: string
): Promise<PaymentResult> {
  const resource = await payload.findByID({
    collection: 'bookable-resources',
    id: booking.resource
  })
  
  const tenant = await payload.findByID({
    collection: 'tenants',
    id: resource.tenant
  })
  
  // Calculate splits (Ultimate Fair)
  const splits = calculateUltimateFair(
    booking.price,
    booking.attributionSource
  )
  
  // Create payment intent with application fee
  const paymentIntent = await stripe.paymentIntents.create({
    amount: booking.price * 100, // cents
    currency: tenant.currency || 'usd',
    payment_method: paymentMethod,
    application_fee_amount: splits.platformFee * 100,
    transfer_data: {
      destination: tenant.stripeAccountId
    },
    metadata: {
      bookingId: booking.id,
      tenantId: tenant.id,
      attributionSource: booking.attributionSource
    }
  })
  
  return { paymentIntent, splits }
}
```

---

### Issue #32: Implement Ultimate Fair Payment Split System

**Title:** Implement Ultimate Fair Payment Split System with Attribution

**Labels:** `epic: payments`, `priority: critical`, `type: feature`

**Description:**

Implement Ultimate Fair payment splits (60/20/15/5) with attribution-based fees on PROFIT.

**Requirements:**

1. **Ultimate Fair Splits**
   - 60% Provider (service provider, product seller)
   - 20% Platform (Diocese)
   - 15% Operations (Tenant)
   - 5% Justice Fund
   - **CRITICAL:** Splits on PROFIT, not revenue

2. **Attribution-Based Fees (0-25%)**
   - Storefront (0%) - Customer found tenant directly
   - Direct (5%) - Customer came via direct link
   - Platform Search (10%) - Customer found via platform search
   - Angel Assist (15%) - Angel helped close the sale
   - Referral (20%) - Customer came via referral
   - Federation (25%) - Customer came from another diocese

3. **Profit Calculation**
   - Revenue - Costs = Profit
   - If profit is zero, platform fee is zero
   - Costs include: COGS, shipping, processing fees
   - Transparent calculation (auditable)

4. **Justice Fund Allocation**
   - 5% of all profitable transactions
   - Allocated to Justice Fund collection
   - Governed by Constitutional Council
   - Used for Prison Ministry, homeless support, etc.

**Acceptance Criteria:**

- [ ] Ultimate Fair splits calculated correctly (60/20/15/5)
- [ ] Attribution tracked per transaction
- [ ] Attribution-based fees applied (0-25%)
- [ ] Splits on PROFIT, not revenue
- [ ] If profit is zero, platform fee is zero
- [ ] Justice Fund allocated (5%)
- [ ] Transparent calculation (auditable in Payload Admin)
- [ ] Payout reports generated

**Technical Notes:**

```typescript
// src/utilities/payments/ultimateFair.ts
export function calculateUltimateFair(
  transaction: Transaction
): PaymentSplit {
  // Calculate profit
  const revenue = transaction.amount
  const costs = transaction.costs || 0 // COGS, shipping, processing
  const profit = revenue - costs
  
  // If no profit, no platform fee
  if (profit <= 0) {
    return {
      provider: revenue - costs, // Provider gets all (covers costs)
      platform: 0,
      operations: 0,
      justiceFund: 0,
      attribution: transaction.attributionSource
    }
  }
  
  // Attribution-based platform fee (0-25%)
  const attributionFees = {
    'storefront': 0.00,
    'direct': 0.05,
    'platform-search': 0.10,
    'angel-assist': 0.15,
    'referral': 0.20,
    'federation': 0.25
  }
  
  const platformFeeRate = attributionFees[transaction.attributionSource] || 0.10
  const platformFeeAmount = profit * platformFeeRate
  
  // Ultimate Fair split (on profit after platform fee)
  const profitAfterPlatformFee = profit - platformFeeAmount
  
  return {
    provider: costs + (profitAfterPlatformFee * 0.60), // 60% of profit + costs
    platform: platformFeeAmount + (profitAfterPlatformFee * 0.20), // Platform fee + 20% of profit
    operations: profitAfterPlatformFee * 0.15, // 15% of profit
    justiceFund: profitAfterPlatformFee * 0.05, // 5% of profit
    attribution: transaction.attributionSource,
    breakdown: {
      revenue,
      costs,
      profit,
      platformFeeRate,
      platformFeeAmount
    }
  }
}
```

---

## Epic 14: CRM (Structured Data for AI)

### Issue #33: Implement CRM Collections (Contacts, Leads, Deals)

**Title:** Create CRM Collections for Structured Relationship Data

**Labels:** `epic: crm`, `priority: high`, `type: feature`

**Description:**

Implement CRM collections so LEO and Angels can use structured data for relationships and pipeline.

**Requirements:**

1. **Contacts Collection**
   - Contact records (name, email, phone, company)
   - Tenant-scoped
   - Relationships (contact → organization, contact → deals)
   - Custom fields (industry-specific)
   - Tags and segments

2. **Leads Collection**
   - Lead records (potential customers)
   - Lead source tracking (web chat, referral, social, etc.)
   - Lead scoring (AI-driven)
   - Lead status (new, contacted, qualified, converted, lost)
   - Conversion to contact/deal

3. **Deals Collection**
   - Deal records (opportunities)
   - Pipeline stages (prospect, proposal, negotiation, closed-won, closed-lost)
   - Deal value (expected revenue)
   - Close date (expected)
   - Associated contacts
   - Activities (calls, emails, meetings)

4. **Activities Collection**
   - Call logs
   - Email logs
   - Meeting notes
   - Task assignments
   - Linked to contacts/deals

5. **MCP Exposure**
   - Expose CRM collections via MCP
   - LEO can query contacts, leads, deals
   - LEO can create/update activities
   - LEO can suggest next actions

**Acceptance Criteria:**

- [ ] Contacts collection created
- [ ] Leads collection created
- [ ] Deals collection created
- [ ] Activities collection created
- [ ] All tenant-scoped
- [ ] Relationships work (contact → deal, etc.)
- [ ] Exposed via MCP for LEO/Angels
- [ ] LEO can query and update CRM data
- [ ] Lead scoring functional

**Technical Notes:**

```typescript
// src/collections/Contacts.ts
export const Contacts: CollectionConfig = {
  slug: 'contacts',
  admin: { useAsTitle: 'name', group: 'CRM' },
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email', required: true, unique: true },
    { name: 'phone', type: 'text' },
    { name: 'company', type: 'text' },
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true },
    { name: 'leadSource', type: 'select', options: [
      'web-chat', 'referral', 'social-media', 'direct', 'federation'
    ]},
    { name: 'leadScore', type: 'number', defaultValue: 0 },
    { name: 'status', type: 'select', options: [
      'lead', 'prospect', 'customer', 'inactive'
    ]},
    { name: 'tags', type: 'array', fields: [
      { name: 'tag', type: 'text' }
    ]},
    { name: 'customFields', type: 'json' }, // Industry-specific fields
    { name: 'deals', type: 'relationship', relationTo: 'deals', hasMany: true },
    { name: 'activities', type: 'relationship', relationTo: 'activities', hasMany: true }
  ]
}

// src/collections/Deals.ts
export const Deals: CollectionConfig = {
  slug: 'deals',
  admin: { useAsTitle: 'name', group: 'CRM' },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true },
    { name: 'contact', type: 'relationship', relationTo: 'contacts', required: true },
    { name: 'value', type: 'number', required: true },
    { name: 'stage', type: 'select', required: true, options: [
      'prospect', 'proposal', 'negotiation', 'closed-won', 'closed-lost'
    ]},
    { name: 'closeDate', type: 'date' },
    { name: 'probability', type: 'number', min: 0, max: 100 },
    { name: 'activities', type: 'relationship', relationTo: 'activities', hasMany: true }
  ]
}
```

---

## Epic 15: Spaces Operational

### Issue #34: Implement Space Invitations and Onboarding

**Title:** Create Space Invitation System and Onboarding Flow

**Labels:** `epic: spaces`, `priority: high`, `type: feature`

**Description:**

Enable inviting external users to Spaces with onboarding flow.

**Requirements:**

1. **Invitation System**
   - Email invitations (send invite link)
   - Link invitations (shareable link)
   - Role-based invitations (assign role on accept)
   - Expiring invitations (30 days default)

2. **External User Accounts**
   - Space-scoped accounts (not full platform access)
   - Limited permissions (can't create tenants, etc.)
   - Access only invited spaces
   - Can be upgraded to full account later

3. **Onboarding Flow**
   - Welcome message from Angel
   - Channel tour (show available channels)
   - Initial setup wizard (profile, preferences)
   - First task assignment (optional)

4. **Role-Based Routing**
   - Auto-assign to channels based on role
   - Permission-based channel access
   - Default channels (e.g., "general" for everyone)

**Acceptance Criteria:**

- [ ] Email invitations work
- [ ] Link invitations work
- [ ] External users can create space-scoped accounts
- [ ] Onboarding flow shows welcome message
- [ ] Channel tour functional
- [ ] Role-based routing works
- [ ] Invited users can access only their spaces
- [ ] Invitations expire after 30 days

**Technical Notes:**

```typescript
// src/collections/SpaceInvitations.ts
export const SpaceInvitations: CollectionConfig = {
  slug: 'space-invitations',
  admin: { useAsTitle: 'email', group: 'Spaces' },
  fields: [
    { name: 'space', type: 'relationship', relationTo: 'spaces', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'role', type: 'select', options: ['member', 'guest', 'collaborator'] },
    { name: 'invitedBy', type: 'relationship', relationTo: 'users' },
    { name: 'token', type: 'text', unique: true, admin: { readOnly: true } },
    { name: 'status', type: 'select', options: ['pending', 'accepted', 'expired'] },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'acceptedAt', type: 'date' }
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create') {
          data.token = generateSecureToken()
          data.expiresAt = addDays(new Date(), 30)
        }
        return data
      }
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create') {
          await sendInvitationEmail(doc)
        }
      }
    ]
  }
}

// src/utilities/spaceInvitations.ts
export async function acceptInvitation(token: string, user: User): Promise<void> {
  const invitation = await payload.findOne({
    collection: 'space-invitations',
    where: { token: { equals: token } }
  })
  
  if (!invitation || invitation.status !== 'pending') {
    throw new Error('Invalid or expired invitation')
  }
  
  if (new Date() > new Date(invitation.expiresAt)) {
    throw new Error('Invitation has expired')
  }
  
  // Add user to space
  await payload.update({
    collection: 'spaces',
    id: invitation.space,
    data: {
      members: [...space.members, user.id]
    }
  })
  
  // Mark invitation as accepted
  await payload.update({
    collection: 'space-invitations',
    id: invitation.id,
    data: {
      status: 'accepted',
      acceptedAt: new Date()
    }
  })
  
  // Start onboarding flow
  await startOnboarding(user, invitation.space)
}
```

---

### Issue #35: Implement Channel Participation Features

**Title:** Add Channel Participation Features (Typing, Reactions, Threads)

**Labels:** `epic: spaces`, `priority: medium`, `type: feature`

**Description:**

Implement real-time channel participation features for better collaboration.

**Requirements:**

1. **Typing Indicators**
   - Show "User is typing..." in real-time
   - Multiple users typing (show count)
   - Timeout after 3 seconds of inactivity

2. **Read Receipts**
   - Track message read status
   - Show "Seen by X users"
   - Privacy setting (can disable)

3. **Message Reactions**
   - Emoji reactions (👍, ❤️, 😂, etc.)
   - Multiple reactions per message
   - Show who reacted
   - Real-time updates

4. **Thread Support**
   - Reply to specific messages
   - Thread view (collapsed by default)
   - Thread notifications
   - Thread participants

**Acceptance Criteria:**

- [ ] Typing indicators work in real-time
- [ ] Read receipts tracked
- [ ] Message reactions functional
- [ ] Threads work (reply to messages)
- [ ] Thread view shows all replies
- [ ] Real-time updates for all features
- [ ] Privacy settings (can disable read receipts)

**Technical Notes:**

```typescript
// Real-time typing indicators via WebSocket
// src/app/api/channels/[channelId]/typing/route.ts
export async function POST(req: Request) {
  const { userId, channelId, isTyping } = await req.json()
  
  // Broadcast to all channel members
  await broadcastToChannel(channelId, {
    type: 'typing',
    userId,
    isTyping,
    timestamp: new Date()
  })
  
  return Response.json({ success: true })
}

// Message reactions
// src/collections/MessageReactions.ts
export const MessageReactions: CollectionConfig = {
  slug: 'message-reactions',
  fields: [
    { name: 'message', type: 'relationship', relationTo: 'messages', required: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'emoji', type: 'text', required: true },
    { name: 'createdAt', type: 'date', required: true }
  ]
}

// Threads
// Add to Messages collection:
{
  name: 'parentMessage',
  type: 'relationship',
  relationTo: 'messages',
  admin: {
    description: 'If this is a thread reply, the parent message'
  }
}

{
  name: 'threadReplies',
  type: 'relationship',
  relationTo: 'messages',
  hasMany: true,
  admin: {
    description: 'Replies to this message (thread)'
  }
}
```

---

## Summary: MVP Completion Checklist

If all 35 issues above are completed, Angel OS will be **functional** with:

**✅ Core Infrastructure**
- [ ] Platform Tenant & Archangel system
- [ ] Angel configuration & naming
- [ ] Two-tier access control

**✅ Dashboard & UX**
- [ ] OpenClaw dashboard feature transliteration
- [ ] Discord-style sidebar with admin icons
- [ ] Log viewer with real-time streaming
- [ ] Debug console

**✅ Channel Widgets**
- [ ] Widget architecture
- [ ] Widget tab UI
- [ ] Core widgets (Chat, LiveKit, Notion Notes)

**✅ OpenClaw Integration**
- [ ] Chat response formatting & streaming
- [ ] Skills sync from marketplace
- [ ] Conversation engine (multi-channel)

**✅ Tenant Provisioning**
- [ ] Sub-30-second provisioning
- [ ] Genesis Breath (first message)
- [ ] Clone Wizard modal

**✅ AI Bus & Communication**
- [ ] AI Bus infrastructure
- [ ] Guardian Council Space
- [ ] Wisdom patterns

**✅ Federation**
- [ ] Diocese registry & heartbeat
- [ ] Federation security (5 layers)

**✅ Economics**
- [ ] Attribution tracking
- [ ] Ultimate Fair payment splits

**✅ UX & Anti-Daemon**
- [ ] Anti-Daemon error messages
- [ ] Warm empty states

**✅ Deployment**
- [ ] Docker Compose setup
- [ ] Cloudflare Tunnel integration

**✅ Archangel LEO as Platform CEO**
- [ ] Content generation (blog posts, SEO, images)
- [ ] Social media automation (Soulcast nodes)
- [ ] Platform orchestration
- [ ] LEO chat widget (site-wide)
- [ ] LEO ↔ Angel connection architecture

**✅ Booking & Scheduling**
- [ ] Bookable resources (people, items, events)
- [ ] Availability management (recurring, conflicts)
- [ ] Appointment types & invitations

**✅ Payment & Splits**
- [ ] Stripe Connect integration
- [ ] Ultimate Fair payment splits (on profit)

**✅ CRM**
- [ ] CRM collections (contacts, leads, deals)
- [ ] MCP exposure for LEO/Angels

**✅ Spaces Operational**
- [ ] Space invitations & onboarding
- [ ] Channel participation (typing, reactions, threads)

---

## Next Steps

1. **Create GitHub Issues**
   - Issues #1-22 already created ✅
   - Issues #23-35 to be created (13 remaining)
   - Assign labels and milestones
   - Prioritize by epic

2. **Set Up Project Board**
   - Create columns: Backlog, In Progress, Review, Done
   - Add all 35 issues to Backlog
   - Move to In Progress as work begins

3. **Start with Epic 1**
   - Core infrastructure is foundation
   - Must be solid before building on top

4. **Critical Path**
   - Epic 1: Core Infrastructure (foundation)
   - Epic 2: Dashboard & UX (OpenClaw feature parity)
   - Epic 4: OpenClaw Integration (chat formatting, skills, conversation)
   - Epic 5: Tenant Provisioning (Genesis Breath)
   - Epic 11: Archangel LEO as Platform CEO (content, social, orchestration)
   - Epic 12: Booking & Scheduling (appointments, availability)
   - Epic 13: Payment & Splits (Stripe, Ultimate Fair)

5. **Parallel Work Possible**
   - Epic 3 (Widgets) can start after Epic 1
   - Epic 6 (AI Bus) independent
   - Epic 9 (Anti-Daemon) can happen anytime
   - Epic 10 (Deployment) can start early
   - Epic 14 (CRM) independent
   - Epic 15 (Spaces) can start after Epic 1

**The Angels await. Begin.** 🙏🦅🦞

**Agentic Help Strategy:** Clear, well-documented issues for AI bots (GitHub, 4chan, wherever) to pick up and contribute PRs. The angels will help us build Angel OS.

GNU Terry Pratchett
