# Agent System Architecture

Multi-avatar AI agent system for Angel OS. Each tenant can have multiple system users (agents) with distinct personalities, capabilities, and routing rules.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENT SYSTEM FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Incoming Message                                                           │
│         │                                                                    │
│         ▼                                                                    │
│   ┌─────────────────┐                                                       │
│   │  AgentRouter    │  ← Routes based on channel, keywords, tenant          │
│   └────────┬────────┘                                                       │
│            │                                                                 │
│   ┌────────┴────────┬────────────┬────────────┐                            │
│   │                 │            │            │                             │
│   ▼                 ▼            ▼            ▼                             │
│  LEO            Support       Sales      Integration                        │
│  (default)      Agent         Agent       Agent                             │
│   │                 │            │            │                             │
│   └────────┬────────┴────────────┴────────────┘                            │
│            │                                                                 │
│            ▼                                                                 │
│   ┌─────────────────┐                                                       │
│   │ConversationEngine│ ← Uses agent context (personality, capabilities)     │
│   └────────┬────────┘                                                       │
│            │                                                                 │
│            ▼                                                                 │
│   Response with agent identity                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Users Collection Schema

System agents are stored in the `users` collection with `isSystemUser: true`.

### Fields

```typescript
{
  email: 'leo-{tenantSlug}@system.angelos.local',
  name: 'LEO',
  isSystemUser: true,
  servesTenant: <tenantId>,
  agentConfig: {
    agentType: 'leo' | 'support' | 'sales' | 'onboarding' | 'integration' | 'custom',
    displayName: 'LEO',
    personality: 'Friendly, helpful, and knowledgeable...',
    capabilities: ['query_posts', 'query_products', 'manage_spaces'],
    responseRules: { /* custom JSON rules */ },
    handoffTo: <userId>, // escalation target
    routingRules: {
      channels: [{ channelSlug: 'support' }],
      keywords: [{ keyword: 'help' }],
      isDefault: true
    }
  }
}
```

---

## Agent Types

| Type | Default Personality | Default Capabilities | Use Case |
|------|-------------------|---------------------|----------|
| **leo** | Friendly, helpful, knowledgeable | query_posts, query_products, manage_spaces | General assistant (default) |
| **support** | Professional, empathetic | query_posts, send_emails | Customer support, issue resolution |
| **sales** | Enthusiastic, consultative | query_products, create_orders | Product recommendations, checkout |
| **onboarding** | Patient, encouraging | query_posts, manage_spaces | New user guidance |
| **integration** | Technical, precise | external_api, query_posts, query_products | Foreign system connectors |
| **custom** | Admin-defined | Admin-defined | Custom use cases |

---

## Routing Logic

The `AgentRouter` determines which agent handles a message:

### 1. Channel-Based Routing
```typescript
// Message in #support channel → Support Agent
routingRules: {
  channels: [{ channelSlug: 'support' }]
}
```

### 2. Keyword-Based Routing
```typescript
// Message contains "buy" → Sales Agent
routingRules: {
  keywords: [{ keyword: 'buy' }, { keyword: 'purchase' }]
}
```

### 3. Default Agent
```typescript
// No match → LEO (isDefault: true)
routingRules: {
  isDefault: true
}
```

---

## Creating Agents

### During Seed

```typescript
import { findOrCreateSystemAgent } from '@/endpoints/seed/seed-helpers'

// Create LEO (default agent)
const leo = await findOrCreateSystemAgent(payload, req, {
  tenantId: tenant.id,
  tenantSlug: tenant.slug,
  agentType: 'leo',
  displayName: 'LEO',
  // personality, capabilities, routingRules use defaults
})

// Create Support Agent (optional)
const support = await findOrCreateSystemAgent(payload, req, {
  tenantId: tenant.id,
  tenantSlug: tenant.slug,
  agentType: 'support',
  displayName: 'Support',
  capabilities: ['query_posts', 'send_emails'],
  routingRules: {
    channels: [{ channelSlug: 'support' }],
    keywords: [{ keyword: 'help' }, { keyword: 'issue' }],
  },
})
```

### Via Admin UI

1. Go to **Users** collection
2. Create new user
3. Check **isSystemUser**
4. Select **servesTenant**
5. Configure **agentConfig**:
   - Agent Type
   - Display Name
   - Personality
   - Capabilities
   - Routing Rules

---

## Using Agents

### Via MCP Tool

```bash
# MCP client calls leo_respond
POST /api/mcp
{
  "tool": "leo_respond",
  "args": {
    "message": "Show me recent posts",
    "conversationId": "conv_123"
  }
}
```

The MCP handler:
1. Resolves tenant from `x-tenant-id` header
2. Routes to appropriate agent via `AgentRouter`
3. Passes agent context to `ConversationEngine`
4. Returns response with agent identity

### Via Chat API (Future)

```typescript
import { leoProcessMessage } from '@/utilities/leoProcessMessage'

const result = await leoProcessMessage({
  message: 'I need help with my order',
  tenantId: 1,
  channelSlug: 'support', // routes to Support Agent
  payload,
})

console.log(result.agentName) // "Support"
console.log(result.text) // "Support: I can help you with that..."
```

---

## ConversationEngine Integration

The `ConversationEngine` receives agent context and uses it:

```typescript
// Check capabilities before actions
if (capabilities.includes('query_posts')) {
  // Query posts
}

// Apply personality to responses
const agentName = agent?.displayName ?? 'LEO'
responseText = `${agentName}: ${response}`

// Use responseRules for custom logic
if (agent?.responseRules?.maxResponseLength) {
  responseText = truncate(responseText, agent.responseRules.maxResponseLength)
}
```

---

## Future: Inbound Email

```
support@tenant.angelos.app
    │
    ▼
Email Connector (SendGrid/Mailgun webhook)
    │
    ▼
Parse recipient → Map to agent (support@... → Support Agent)
    │
    ▼
Create Message in channel
    │
    ▼
Agent responds → Outbound email
```

### Email Address Pattern

- `leo-{tenantSlug}@system.angelos.local` (internal, current)
- `support@{tenantSlug}.angelos.app` (future, inbound-enabled)
- `sales@{tenantSlug}.angelos.app` (future, inbound-enabled)

---

## Integration Agents

For foreign system integrations (Stripe, Shopify, etc.):

```typescript
const stripeAgent = await findOrCreateSystemAgent(payload, req, {
  tenantId: tenant.id,
  tenantSlug: tenant.slug,
  agentType: 'integration',
  displayName: 'Stripe Sync',
  capabilities: ['external_api', 'create_orders'],
  personality: 'Technical and precise. I handle payment processing and order synchronization.',
  routingRules: {
    keywords: [{ keyword: 'payment' }, { keyword: 'stripe' }],
  },
})
```

The integration agent can:
- Respond to webhook events
- Sync data between systems
- Handle API calls with specific credentials
- Maintain separate conversation context

---

## API Reference

### `AgentRouter.routeToAgent(payload, context)`

```typescript
import { routeToAgent } from '@/utilities/AgentRouter'

const agent = await routeToAgent(payload, {
  tenantId: 1,
  channelSlug: 'support',
  messageText: 'I need help',
})
```

### `AgentRouter.getAgentById(payload, agentId)`

```typescript
const agent = await getAgentById(payload, leoUserId)
```

### `AgentRouter.getTenantAgents(payload, tenantId)`

```typescript
const agents = await getTenantAgents(payload, tenantId)
// Returns all system agents for the tenant
```

### `leoProcessMessage(options)`

```typescript
const result = await leoProcessMessage({
  message: 'Show me products',
  tenantId: 1,
  channelSlug: 'sales', // optional
  agentId: salesAgentId, // optional, overrides routing
  conversationId: 'conv_123', // optional
  payload,
})
```

---

## Best Practices

1. **Start with LEO** – Every tenant gets LEO by default
2. **Add agents as needed** – Support, Sales, etc. when requirements emerge
3. **Use routing rules** – Channel-based for dedicated support channels, keyword-based for general channels
4. **Set one default** – Usually LEO with `isDefault: true`
5. **Leverage capabilities** – Restrict what each agent can do
6. **Apply personality** – Differentiate agent responses
7. **Plan for handoff** – Use `handoffTo` for escalation to humans

---

## Files

- `src/collections/Users/index.ts` – Schema with `agentConfig`
- `src/utilities/AgentRouter.ts` – Routing logic
- `src/utilities/ConversationEngine.ts` – Response generation with agent context
- `src/utilities/leoProcessMessage.ts` – Entry point with routing
- `src/endpoints/seed/seed-helpers.ts` – `findOrCreateSystemAgent`
- `src/types/conversation.ts` – `AgentInfo`, `ConversationContext`

---

## Migration from Previous System

Old system: Single LEO per tenant, no routing.

New system: Multi-agent with routing, backward compatible.

**No breaking changes** – `findOrCreateLeoUser` still works, now creates agent with `agentConfig`.

Existing LEO users will work as-is. To upgrade:
1. Run `payload migrate` to add `agentConfig` fields
2. Optionally update existing LEO users via admin UI to set personality/capabilities
3. Add new agents (Support, Sales) as needed
