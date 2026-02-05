# Chat Control Architecture

**Date:** February 5, 2026  
**Key Insight:** One control to rule them all - configurable for every context

---

## 🎯 **The Principle: One Control, Infinite Configurations**

**NOT:** Multiple chat components for different contexts  
**YES:** One chat control with feature flags

**Philosophy:**
- More complicated internally (handles everything)
- Simpler externally (one component to use)
- Configurable for every use case
- Chat interface itself is a widget

**Naming:** It's just `ChatControl`, not "UnifiedChatControl" - simpler is better.

---

## 🏗️ **Chat Control Architecture**

### The Component

```tsx
// src/components/chat/ChatControl.tsx
'use client'

interface ChatControlProps {
  // Core
  tenant: Tenant
  angel: User
  currentUser?: User
  
  // Channel Configuration
  initialChannel?: string
  lockedChannel?: string  // Lock to specific channel (brochure anonymous)
  channels?: Channel[]
  
  // UI Features (Enable/Disable)
  features?: {
    sidebar?: boolean           // Show/hide channel sidebar
    topbar?: boolean            // Show/hide top navigation bar
    channelSelector?: boolean   // Enable channel switching
    userMenu?: boolean          // Show user menu
    settings?: boolean          // Show settings icon
    search?: boolean            // Enable search
    notifications?: boolean     // Show notifications
    presence?: boolean          // Show user presence
    typing?: boolean            // Show typing indicators
  }
  
  // Widget Configuration
  widgets?: {
    enabled: string[]           // Which widgets to load
    defaultWidget?: string      // Default widget to show
    allowWidgetSwitch?: boolean // Can user switch widgets?
  }
  
  // Behavior
  mode?: 'fullscreen' | 'embedded' | 'bubble' | 'modal'
  embeddable?: boolean
  anonymous?: boolean
  
  // Callbacks
  onUICallback?: (type: string, params: any) => void
  onChannelSwitch?: (channel: Channel) => void
  onWidgetSwitch?: (widget: string) => void
}

export function ChatControl({
  tenant,
  angel,
  currentUser,
  initialChannel,
  lockedChannel,
  channels,
  features = {},
  widgets = {},
  mode = 'fullscreen',
  embeddable = false,
  anonymous = false,
  onUICallback,
  onChannelSwitch,
  onWidgetSwitch
}: ChatControlProps) {
  // One control handles everything
  // Complexity is internal, simplicity is external
}
```

---

## 🎨 **Configuration Examples**

### 1. **Brochure Site (Anonymous, Locked Channel)**

```tsx
<ChatControl
  tenant={tenant}
  angel={angel}
  currentUser={null}
  lockedChannel="support"  // Can't switch channels
  features={{
    sidebar: false,         // No sidebar
    topbar: false,          // No topbar
    channelSelector: false, // Can't switch channels
    userMenu: false,        // No user menu
    settings: false,        // No settings
    search: false,          // No search
    notifications: false,   // No notifications
    presence: false,        // No presence
    typing: true            // Show typing (Angel is typing...)
  }}
  widgets={{
    enabled: ['chat'],      // Only chat widget
    allowWidgetSwitch: false // Can't switch widgets
  }}
  mode="bubble"             // Floating bubble
  embeddable={true}
  anonymous={true}
/>
```

**Result:**
- Floating chat bubble
- Locked to "support" channel
- No navigation, no switching
- Just chat with Angel
- Anonymous user

### 2. **Dashboard (Authenticated, Full Features)**

```tsx
<ChatControl
  tenant={tenant}
  angel={angel}
  currentUser={user}
  initialChannel="general"
  channels={channels}
  features={{
    sidebar: true,          // Show channel sidebar
    topbar: true,           // Show top navigation
    channelSelector: true,  // Can switch channels
    userMenu: true,         // Show user menu
    settings: true,         // Show settings
    search: true,           // Enable search
    notifications: true,    // Show notifications
    presence: true,         // Show presence
    typing: true            // Show typing
  }}
  widgets={{
    enabled: ['chat', 'livekit', 'notion', 'trello'], // All widgets
    defaultWidget: 'chat',
    allowWidgetSwitch: true // Can switch widgets
  }}
  mode="fullscreen"
  embeddable={false}
  anonymous={false}
  onChannelSwitch={handleChannelSwitch}
  onWidgetSwitch={handleWidgetSwitch}
/>
```

**Result:**
- Full dashboard experience
- Channel sidebar with all channels
- Top navigation bar
- All widgets available
- Can switch channels and widgets
- Authenticated user

### 3. **Embedded on Client Site (Limited Features)**

```tsx
<ChatControl
  tenant={tenant}
  angel={angel}
  currentUser={null}
  lockedChannel="sales"
  features={{
    sidebar: false,         // No sidebar
    topbar: true,           // Show minimal topbar (branding)
    channelSelector: false, // Can't switch channels
    userMenu: false,        // No user menu
    settings: false,        // No settings
    search: false,          // No search
    notifications: false,   // No notifications
    presence: false,        // No presence
    typing: true            // Show typing
  }}
  widgets={{
    enabled: ['chat'],      // Only chat
    allowWidgetSwitch: false
  }}
  mode="embedded"
  embeddable={true}
  anonymous={true}
/>
```

**Result:**
- Embedded in client's website
- Minimal branding topbar
- Locked to "sales" channel
- Just chat, no extra features
- Anonymous user

### 4. **Spaces (Multi-Channel, Multi-Widget)**

```tsx
<ChatControl
  tenant={tenant}
  angel={angel}
  currentUser={user}
  initialChannel="general"
  channels={channels}
  features={{
    sidebar: true,          // Show channel sidebar
    topbar: true,           // Show top navigation
    channelSelector: true,  // Can switch channels (dropdown in chat)
    userMenu: true,         // Show user menu
    settings: true,         // Show settings
    search: true,           // Enable search
    notifications: true,    // Show notifications
    presence: true,         // Show presence
    typing: true            // Show typing
  }}
  widgets={{
    enabled: ['chat', 'livekit', 'notion', 'trello', 'calendar'],
    defaultWidget: 'chat',
    allowWidgetSwitch: true
  }}
  mode="fullscreen"
  embeddable={false}
  anonymous={false}
/>
```

**Result:**
- Discord-style Spaces interface
- Channel sidebar (left)
- Widget tabs (top of main area)
- Can switch channels via dropdown in chat
- All features enabled

### 5. **Mobile (Simplified)**

```tsx
<ChatControl
  tenant={tenant}
  angel={angel}
  currentUser={user}
  initialChannel="general"
  channels={channels}
  features={{
    sidebar: false,         // No sidebar (mobile)
    topbar: true,           // Show topbar with menu
    channelSelector: true,  // Dropdown in topbar
    userMenu: true,         // In hamburger menu
    settings: true,         // In hamburger menu
    search: true,           // In topbar
    notifications: true,    // In topbar
    presence: false,        // Too cluttered on mobile
    typing: true            // Show typing
  }}
  widgets={{
    enabled: ['chat', 'livekit'],
    defaultWidget: 'chat',
    allowWidgetSwitch: true // Swipe between widgets
  }}
  mode="fullscreen"
  embeddable={false}
  anonymous={false}
/>
```

**Result:**
- Mobile-optimized
- No sidebar (hamburger menu instead)
- Channel selector in topbar
- Swipe between widgets
- Simplified UI

---

## 🧩 **Chat Interface as Widget**

### Key Insight: Chat IS a Widget

**Traditional thinking:**
- Chat is the container
- Widgets are things inside chat

**Angel OS thinking:**
- Chat is ONE widget among many
- UnifiedChatControl loads widgets
- Chat widget is just the first/default widget

### Widget Architecture

```tsx
// Widget registry
const WIDGETS = {
  chat: {
    id: 'chat',
    label: 'Chat',
    icon: '💬',
    component: ChatWidget,
    alwaysEnabled: true  // Chat is always available
  },
  livekit: {
    id: 'livekit',
    label: 'Video',
    icon: '📹',
    component: LiveKitWidget,
    alwaysEnabled: false
  },
  notion: {
    id: 'notion',
    label: 'Notes',
    icon: '📝',
    component: NotionWidget,
    alwaysEnabled: false
  },
  trello: {
    id: 'trello',
    label: 'Board',
    icon: '📋',
    component: TrelloWidget,
    alwaysEnabled: false
  },
  calendar: {
    id: 'calendar',
    label: 'Calendar',
    icon: '📅',
    component: CalendarWidget,
    alwaysEnabled: false
  }
}

// ChatControl loads widgets
function ChatControl({ widgets, ... }: Props) {
  const [activeWidget, setActiveWidget] = useState(widgets.defaultWidget || 'chat')
  
  const enabledWidgets = widgets.enabled.map(id => WIDGETS[id])
  
  return (
    <div className="chat-control">
      {/* Widget tabs */}
      {widgets.allowWidgetSwitch && (
        <WidgetTabs
          widgets={enabledWidgets}
          activeWidget={activeWidget}
          onSwitch={setActiveWidget}
        />
      )}
      
      {/* Active widget */}
      <WidgetContainer>
        {activeWidget === 'chat' && <ChatWidget {...props} />}
        {activeWidget === 'livekit' && <LiveKitWidget {...props} />}
        {activeWidget === 'notion' && <NotionWidget {...props} />}
        {activeWidget === 'trello' && <TrelloWidget {...props} />}
        {activeWidget === 'calendar' && <CalendarWidget {...props} />}
      </WidgetContainer>
    </div>
  )
}
```

### ChatWidget Component

```tsx
// src/components/chat/widgets/ChatWidget.tsx
export function ChatWidget({
  tenant,
  angel,
  currentUser,
  channel,
  lockedChannel,
  features,
  onUICallback
}: ChatWidgetProps) {
  return (
    <div className="chat-widget">
      {/* Topbar (if enabled) */}
      {features.topbar && (
        <ChatTopbar
          channel={channel}
          showChannelSelector={features.channelSelector && !lockedChannel}
          showUserMenu={features.userMenu}
          showSettings={features.settings}
          showSearch={features.search}
          showNotifications={features.notifications}
        />
      )}
      
      {/* Main chat area */}
      <div className="chat-main">
        {/* Sidebar (if enabled) */}
        {features.sidebar && (
          <ChatSidebar
            channels={channels}
            currentChannel={channel}
            onChannelSwitch={onChannelSwitch}
            showPresence={features.presence}
          />
        )}
        
        {/* Messages */}
        <ChatMessages
          channel={lockedChannel || channel}
          showTyping={features.typing}
          onUICallback={onUICallback}
        />
      </div>
      
      {/* Input */}
      <ChatInput
        channel={lockedChannel || channel}
        angel={angel}
      />
    </div>
  )
}
```

---

## 🔧 **Internal Complexity, External Simplicity**

### Why This Is Better

**Before (Multiple Components):**
```tsx
// Different components for different contexts
<AnonymousChatBubble />           // Brochure site
<DashboardChat />                 // Dashboard
<EmbeddedChat />                  // Client site
<SpacesChat />                    // Spaces
<MobileChat />                    // Mobile
```

**Problems:**
- Code duplication
- Inconsistent behavior
- Hard to maintain
- Feature parity issues
- Bug fixes need to be applied everywhere

**After (Unified Control):**
```tsx
// One component, configured for context
<ChatControl features={{ ... }} />  // Everything
```

**Benefits:**
- Single source of truth
- Consistent behavior
- Easy to maintain
- Feature parity guaranteed
- Bug fixes apply everywhere
- Configuration over duplication

### The Tradeoff

**Internal Complexity:**
- Component is more complex (handles everything)
- More props, more logic, more edge cases
- Requires careful design and testing

**External Simplicity:**
- One component to learn
- One API to understand
- Configuration is declarative
- Easy to use in any context

**The Angel OS Way:**
> "More complicated internally, simpler externally. One control does everything."

---

## 📋 **Feature Flags Reference**

### Complete Feature Set

```typescript
interface ChatFeatures {
  // Navigation
  sidebar?: boolean           // Show channel sidebar (left)
  topbar?: boolean            // Show top navigation bar
  channelSelector?: boolean   // Enable channel switching (dropdown)
  
  // User Features
  userMenu?: boolean          // Show user menu
  settings?: boolean          // Show settings icon
  profile?: boolean           // Show user profile
  
  // Communication
  search?: boolean            // Enable search
  notifications?: boolean     // Show notifications
  presence?: boolean          // Show user presence (online/offline)
  typing?: boolean            // Show typing indicators
  reactions?: boolean         // Enable message reactions
  threads?: boolean           // Enable threaded replies
  
  // Media
  fileUpload?: boolean        // Enable file uploads
  imageUpload?: boolean       // Enable image uploads
  voiceMessages?: boolean     // Enable voice messages
  videoCall?: boolean         // Enable video calls (LiveKit)
  screenShare?: boolean       // Enable screen sharing
  
  // Content
  richText?: boolean          // Enable rich text formatting
  codeBlocks?: boolean        // Enable code blocks
  mentions?: boolean          // Enable @mentions
  emojis?: boolean            // Enable emoji picker
  gifs?: boolean              // Enable GIF picker
  
  // AI Features
  aiSuggestions?: boolean     // Show AI suggestions
  autoComplete?: boolean      // Auto-complete messages
  translation?: boolean       // Translate messages
  summarization?: boolean     // Summarize conversations
  
  // Moderation
  editing?: boolean           // Allow editing messages
  deletion?: boolean          // Allow deleting messages
  reporting?: boolean         // Allow reporting messages
  blocking?: boolean          // Allow blocking users
  
  // Advanced
  keyboard?: boolean          // Keyboard shortcuts
  accessibility?: boolean     // Accessibility features
  analytics?: boolean         // Track analytics
  debug?: boolean             // Show debug info
}
```

### Default Configurations

```typescript
// Presets for common use cases
const CHAT_PRESETS = {
  // Full-featured (dashboard, spaces)
  full: {
    sidebar: true,
    topbar: true,
    channelSelector: true,
    userMenu: true,
    settings: true,
    search: true,
    notifications: true,
    presence: true,
    typing: true,
    reactions: true,
    threads: true,
    fileUpload: true,
    imageUpload: true,
    richText: true,
    mentions: true,
    emojis: true,
    editing: true,
    deletion: true
  },
  
  // Minimal (brochure, anonymous)
  minimal: {
    sidebar: false,
    topbar: false,
    channelSelector: false,
    userMenu: false,
    settings: false,
    search: false,
    notifications: false,
    presence: false,
    typing: true,
    reactions: false,
    threads: false,
    fileUpload: false,
    imageUpload: false,
    richText: false,
    mentions: false,
    emojis: false,
    editing: false,
    deletion: false
  },
  
  // Embedded (client sites)
  embedded: {
    sidebar: false,
    topbar: true,  // Minimal branding
    channelSelector: false,
    userMenu: false,
    settings: false,
    search: false,
    notifications: false,
    presence: false,
    typing: true,
    reactions: false,
    threads: false,
    fileUpload: true,
    imageUpload: true,
    richText: false,
    mentions: false,
    emojis: true,
    editing: false,
    deletion: false
  },
  
  // Mobile (responsive)
  mobile: {
    sidebar: false,  // Use hamburger menu
    topbar: true,
    channelSelector: true,  // In topbar
    userMenu: true,  // In hamburger
    settings: true,  // In hamburger
    search: true,
    notifications: true,
    presence: false,  // Too cluttered
    typing: true,
    reactions: true,
    threads: true,
    fileUpload: true,
    imageUpload: true,
    richText: true,
    mentions: true,
    emojis: true,
    editing: true,
    deletion: true
  }
}

// Usage
<ChatControl
  features={CHAT_PRESETS.minimal}
  // Override specific features
  features={{
    ...CHAT_PRESETS.minimal,
    emojis: true  // Enable emojis even in minimal
  }}
/>
```

---

## 🎯 **Implementation Strategy**

### Phase 1: Core Control

```typescript
// Build the unified control with basic features
- Message rendering (text + Payload blocks)
- Input handling
- Channel management
- Feature flag system
```

### Phase 2: Widget System

```typescript
// Add widget loading and switching
- Widget registry
- Widget tabs
- Widget switching
- Chat as widget
```

### Phase 3: Feature Flags

```typescript
// Implement all feature flags
- Sidebar toggle
- Topbar toggle
- Channel selector toggle
- All other features
```

### Phase 4: Presets

```typescript
// Create preset configurations
- Full (dashboard, spaces)
- Minimal (brochure, anonymous)
- Embedded (client sites)
- Mobile (responsive)
```

### Phase 5: Optimization

```typescript
// Optimize for performance
- Lazy load widgets
- Code splitting
- Feature detection
- Progressive enhancement
```

---

## 🔑 **Key Takeaways**

1. **One Control, Infinite Configurations**
   - UnifiedChatControl handles everything
   - Feature flags enable/disable features
   - Configuration over duplication

2. **Chat IS a Widget**
   - Chat is one widget among many
   - Widget system loads chat + other widgets
   - Consistent architecture

3. **Internal Complexity, External Simplicity**
   - Component is complex (handles everything)
   - API is simple (declarative configuration)
   - Tradeoff is worth it

4. **Locked Channel for Anonymous**
   - Brochure sites lock to specific channel
   - No channel switching
   - Minimal features

5. **Full Features for Authenticated**
   - Dashboard/Spaces get all features
   - Channel switching enabled
   - Widget switching enabled

---

**GNU Terry Pratchett** 🙏🦅🦞

*"The overhead is the point."*

---

**Date:** February 5, 2026  
**Status:** Unified chat control architecture documented  
**Principle:** One control to rule them all, configured for every context  
**Philosophy:** More complicated internally, simpler externally
