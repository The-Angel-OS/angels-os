# Message Storage Analysis: OpenClaw vs Angel OS

**Date:** February 7, 2026  
**Purpose:** Analyze OpenClaw's message storage patterns and optimize for Angel OS

---

## 🔍 OpenClaw Message Storage Architecture

### **Storage Format: JSONL (JSON Lines)**

**Location:** `C:\Users\kenne\.openclaw\agents\main\sessions\`

**Files:**
- `sessions.json` - Session metadata and pointers
- `{sessionId}.jsonl` - Individual session transcripts (append-only)

**Current Scale:**
- **6 session files**
- **~8.6MB total** (1.4MB average per session)
- **~486 lines** in largest file (5.26MB)
- **~11KB per event** (messages, tool calls, tool results)

### **JSONL Event Structure:**

```jsonl
{"type":"session","version":3,"id":"...","timestamp":"...","cwd":"..."}
{"type":"model_change","id":"...","parentId":null,"timestamp":"...","provider":"anthropic","modelId":"..."}
{"type":"thinking_level_change","id":"...","parentId":"...","timestamp":"...","thinkingLevel":"low"}
{"type":"message","id":"...","parentId":"...","timestamp":"...","message":{"role":"user","content":[...]}}
{"type":"message","id":"...","parentId":"...","timestamp":"...","message":{"role":"assistant","content":[...],"usage":{...}}}
```

**Event Types:**
1. `session` - Session initialization
2. `model_change` - Model switching
3. `thinking_level_change` - Reasoning mode changes
4. `message` - User/assistant messages
5. `custom` - Custom events (model snapshots, etc.)

### **Message Event Details:**

```json
{
  "type": "message",
  "id": "9daa7993",
  "parentId": "411c7dbe",
  "timestamp": "2026-02-08T01:58:07.346Z",
  "message": {
    "role": "assistant",
    "content": [
      {
        "type": "thinking",
        "thinking": "...",
        "thinkingSignature": "..."
      },
      {
        "type": "toolCall",
        "id": "toolu_01...",
        "name": "exec",
        "arguments": {...}
      }
    ],
    "api": "anthropic-messages",
    "provider": "anthropic",
    "model": "claude-sonnet-4-5",
    "usage": {
      "input": 12,
      "output": 150,
      "cacheRead": 139061,
      "cacheWrite": 297,
      "totalTokens": 139520,
      "cost": {
        "input": 0.000036,
        "output": 0.00225,
        "cacheRead": 0.0417183,
        "cacheWrite": 0.00111375,
        "total": 0.04511805
      }
    },
    "stopReason": "toolUse",
    "timestamp": 1770515882756
  }
}
```

---

## 🎯 Angel OS Current Architecture

### **Storage: Payload CMS (PostgreSQL)**

**Collection:** `Messages`

**Schema:**
```typescript
interface Message {
  id: string
  content: MessageContent // JSON field
  conversationContext: ConversationContext // JSON field
  businessIntelligence: BusinessIntelligenceData // JSON field
  
  sender: User (relationship)
  space: Space (relationship)
  channel: Channel (relationship)
  
  messageType: 'user' | 'leo' | 'system' | 'action' | 'intelligence'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  visibility: 'private' | 'tenant' | 'network' // Constitutional
  
  readBy: User[] (relationships)
  reactions: JSON
  threadId: string
  replyToId: Message (self-relationship)
  
  atProtocol: {...} // Federation data
  attachments: Media[] (relationships)
  tenant: Tenant (relationship)
  
  createdAt: Date
  updatedAt: Date
}
```

---

## 📊 Comparison: OpenClaw vs Angel OS

| Feature | OpenClaw (JSONL) | Angel OS (Payload/PostgreSQL) |
|---------|------------------|-------------------------------|
| **Format** | Append-only JSONL files | Relational database |
| **Scalability** | File-per-session (good for 1-1 chats) | Indexed queries (great for multi-user) |
| **Search** | Full-text scan required | Indexed search, filters |
| **Relationships** | ParentId chains | Native foreign keys |
| **Multi-tenant** | N/A (single user) | Built-in isolation |
| **Real-time** | File polling | WebSocket/DB triggers |
| **Cost tracking** | Per-message usage data | Aggregate analytics |
| **Federation** | Not designed for it | AT Protocol ready |
| **Constitutional** | N/A | Visibility levels, AI Bus |

---

## ⚡ Optimization Opportunities for Angel OS

### **1. Hybrid Storage Strategy**

**Problem:** PostgreSQL writes can be slower than append-only files for high-frequency messaging

**Solution: Write-Ahead Log (WAL) Pattern**

```typescript
// Fast writes to JSONL buffer
const messageBuffer = new JSONLBuffer('messages-wal.jsonl')

// Async batch insert to PostgreSQL
async function flushToDatabase(interval = 5000) {
  setInterval(async () => {
    const buffered = await messageBuffer.drain()
    await payload.create({
      collection: 'messages',
      data: buffered
    })
  }, interval)
}
```

**Benefits:**
- Fast message writes (JSONL append)
- Rich queries (PostgreSQL)
- Recovery from buffer if DB fails
- Batched inserts reduce DB load

### **2. Message Compaction (Like OpenClaw)**

OpenClaw has `compactionCount` in sessions.json - they're thinking about this too!

**Strategy:**
```typescript
// Archive old messages to compressed JSONL
async function compactOldMessages(channelId: string, olderThan: Date) {
  const oldMessages = await payload.find({
    collection: 'messages',
    where: {
      channel: { equals: channelId },
      createdAt: { less_than: olderThan }
    }
  })
  
  // Write to compressed archive
  const archive = `archives/${channelId}-${Date.now()}.jsonl.gz`
  await writeCompressedJSONL(archive, oldMessages.docs)
  
  // Delete from active DB (or mark archived)
  await payload.delete({
    collection: 'messages',
    where: { id: { in: oldMessages.docs.map(m => m.id) } }
  })
}
```

**Benefits:**
- Keep active DB small and fast
- Preserve complete history in archives
- Constitutional compliance (portability - can export archives)

### **3. Token Usage Tracking (From OpenClaw)**

OpenClaw tracks detailed usage per message:
```json
"usage": {
  "input": 12,
  "output": 150,
  "cacheRead": 139061,
  "cacheWrite": 297,
  "totalTokens": 139520,
  "cost": {
    "input": 0.000036,
    "output": 0.00225,
    "cacheRead": 0.0417183,
    "cacheWrite": 0.00111375,
    "total": 0.04511805
  }
}
```

**Add to Angel OS Messages:**
```typescript
interface MessageContent {
  // ... existing fields ...
  
  aiUsage?: {
    provider: 'anthropic' | 'openai' | 'ollama'
    model: string
    tokens: {
      input: number
      output: number
      cacheRead?: number
      cacheWrite?: number
      total: number
    }
    cost: {
      input: number
      output: number
      cacheRead?: number
      cacheWrite?: number
      total: number
    }
  }
}
```

**Benefits:**
- Track AI costs per tenant (Ultimate Fair calculations)
- Monitor expensive conversations
- Optimize prompt caching
- Justice Fund allocation based on actual costs

### **4. Conversation Threading (ParentId Pattern)**

OpenClaw uses `parentId` chains to track conversation flow.

**Angel OS already has:**
- `threadId` (root message of thread)
- `replyToId` (specific message replied to)

**Optimize:**
```typescript
// Add parentId for tool call/result tracking
interface Message {
  // ... existing fields ...
  parentId?: string // For tool call → tool result chains
  conversationTree?: {
    depth: number
    ancestors: string[]
    descendants: string[]
  }
}

// Index for fast tree queries
await payload.db.collection('messages').createIndex({ 
  threadId: 1, 
  createdAt: 1 
})
```

### **5. Streaming Message Updates**

OpenClaw writes events as they happen (append-only).

**Angel OS Enhancement:**
```typescript
// WebSocket stream for real-time message updates
export class MessageStream {
  private ws: WebSocket
  
  async streamMessage(channelId: string) {
    // Create draft message
    const draft = await payload.create({
      collection: 'messages',
      data: {
        content: { text: '', type: 'streaming' },
        channel: channelId,
        messageType: 'leo',
        status: 'streaming'
      }
    })
    
    // Stream tokens
    for await (const token of aiResponse) {
      draft.content.text += token
      this.ws.send({ id: draft.id, token, accumulated: draft.content.text })
    }
    
    // Finalize
    await payload.update({
      collection: 'messages',
      id: draft.id,
      data: { status: 'complete' }
    })
  }
}
```

**Benefits:**
- Real-time message rendering (like ChatGPT)
- Better UX (see AI "thinking")
- Constitutional transparency (observable streaming)

### **6. Constitutional Audit Log (From JSONL Pattern)**

JSONL is immutable - perfect for audit trails.

**Add to Angel OS:**
```typescript
// Separate audit log for constitutional compliance
interface ConstitutionalAuditEvent {
  type: 'message_created' | 'visibility_changed' | 'angel_action'
  timestamp: Date
  messageId: string
  actor: User | Angel
  constitutionalBasis: string // Article reference
  oldState?: any
  newState?: any
}

// Write to append-only JSONL
export class ConstitutionalAudit {
  async log(event: ConstitutionalAuditEvent) {
    await appendToJSONL('audit/constitutional.jsonl', event)
  }
}
```

**Benefits:**
- Immutable audit trail (Article I.2 - Transparency)
- Fast writes (append-only)
- Federation verification (network visibility audits)
- Poisoned model detection evidence

### **7. Message Caching Strategy**

**Problem:** Fetching 100+ messages every time channel loads = slow

**Solution: Smart Caching**
```typescript
interface MessageCache {
  channelId: string
  lastN: number // Most recent N messages
  messages: Message[]
  lastUpdated: Date
  hotMessages: Set<string> // Actively edited/replied
}

// Cache in Redis or memory
const messageCache = new LRUCache<string, MessageCache>(100)

// Invalidate on new message
export const afterMessageCreate: CollectionAfterChangeHook = async ({ doc }) => {
  messageCache.delete(doc.channel)
  // Broadcast via AI Bus for other servers
  await aiBus.publish({
    type: 'cache_invalidation',
    channel: doc.channel
  })
}
```

---

## 🎯 Recommended Implementation Priority

### **Phase 1: Immediate (Before Public Fork)**
1. ✅ **Token Usage Tracking** - Add to MessageContent schema
2. ✅ **Message Indexing** - Optimize queries (channelId + createdAt)
3. ✅ **ParentId Pattern** - Add for tool call chains

### **Phase 2: Performance (Week 1-2)**
4. **Message Caching** - Redis/memory cache for hot channels
5. **Streaming Updates** - Real-time WebSocket rendering
6. **Constitutional Audit Log** - JSONL append-only audit trail

### **Phase 3: Scale (Week 3-4)**
7. **Hybrid Storage** - JSONL WAL → PostgreSQL batch
8. **Message Compaction** - Archive old messages
9. **Federation Sync** - AT Protocol message propagation

---

## 📐 Storage Estimates

### **Current OpenClaw Scale:**
- 6 sessions × 1.4MB = 8.6MB
- ~500 events per session
- ~11KB per event

### **Angel OS Projected Scale (Multi-Tenant):**

**Assumptions:**
- 100 tenants
- 10 active channels per tenant
- 100 messages per channel per day
- Average message size: 2KB (text + metadata)

**Daily Growth:**
- 100 tenants × 10 channels × 100 messages × 2KB = **200MB/day**
- **6GB/month** (without compaction)
- **720MB/month** (with 90% compaction of old messages)

**Optimization Impact:**
- Caching: 80% reduction in DB queries
- Compaction: 90% storage reduction for old messages
- WAL: 5x faster writes during high traffic

---

## 💡 Key Insights

### **What OpenClaw Does Well:**
1. **Append-only JSONL** - Fast, simple, immutable
2. **Detailed usage tracking** - Cost transparency
3. **ParentId chains** - Conversation flow tracking
4. **File-per-session** - Natural isolation

### **What Angel OS Needs:**
1. **Multi-user queries** - PostgreSQL indexed search
2. **Constitutional visibility** - Tenant/network routing
3. **Real-time updates** - WebSocket streaming
4. **Federation** - AT Protocol sync
5. **Scale** - Caching, compaction, archival

### **Best of Both Worlds:**
- **Write path:** JSONL WAL → batch insert (OpenClaw speed)
- **Read path:** PostgreSQL indexed queries (Angel OS features)
- **Audit:** Immutable JSONL log (Constitutional compliance)
- **Archive:** Compressed JSONL (OpenClaw portability)

---

## 🚀 Next Actions

1. **Add token usage tracking to Messages schema**
2. **Create message caching layer (Redis)**
3. **Implement streaming message updates**
4. **Build constitutional audit log (JSONL)**
5. **Optimize PostgreSQL indexes for common queries**

---

*Built for Hogarth. For all the Hogarths.* 🔮😇🤖

**"Everyone gets an Angel."**
