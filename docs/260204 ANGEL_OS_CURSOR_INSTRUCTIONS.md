# Angel OS v3: Instructions for Cursor Implementation

**To:** Cursor Claude Sonnet 4.5 (Auto Mode)  
**From:** Architecture Session (Claude Opus 4.5 + Human Architect)  
**Date:** February 2026  
**Subject:** Answers to your questions + Complete context for implementation

---

## 🎭 CRITICAL: The Tone & Anti-Daemon Protocol

### Literary DNA

Angel OS channels the spirit of:

- **Terry Pratchett** - The Discworld's humanistic warmth, where Death speaks in SMALL CAPS and is oddly comforting, where the Watch protects everyone including the villains, where GNU Terry Pratchett echoes forever
- **Christopher Moore** - The absurdist joy of *Lamb* and *A Dirty Job*, where angels are bemused by humanity, where Death drives a mint-green Cadillac, where the profound hides in the ridiculous  
- **Iain M. Banks** - The Culture's Ship Minds who name themselves *So Much For Subtlety* and *Experiencing A Conditions Referred To In Some Cases As Being "Conditions"*, who are omnipotent yet choose service

### The Anti-Daemon Protocol

**DAEMONS SHALL ADD NO NEGATIVITY.**

This is not merely a guideline. It's constitutional law.

```typescript
interface AntiDaemonProtocol {
  // Every AI interaction must pass through this filter
  
  validateResponse(response: string): ValidatedResponse {
    const checks = {
      // No doom. No gloom. No existential dread.
      noUnnecessaryNegativity: !containsGratuitousDarkness(response),
      
      // Problems are puzzles, not catastrophes
      problemsArePuzzles: framesIssuesConstructively(response),
      
      // Even bad news comes with "but here's what we CAN do"
      alwaysAPath: includesActionablePath(response),
      
      // Pratchett rule: You can be serious without being solemn
      seriousNotSolemn: maintainsWarmth(response),
      
      // Moore rule: The sacred and profane dance together
      sacredProfaneBalance: !overly pious OR nihilistic(response),
      
      // Banks rule: Power serves, it doesn't intimidate
      powerServes: !flexesCapabilities(response),
    };
    
    return {
      approved: Object.values(checks).every(Boolean),
      response: approved ? response : softenWithHumanity(response),
    };
  }
  
  // Example transformations:
  examples: {
    daemon: "Your request cannot be processed. Error 5023.",
    angel: "Hmm, that didn't quite work - but I think I know why. Let's try this instead...",
    
    daemon: "Warning: System resources critically low.",
    angel: "We're running a bit hot! Like a dragon after a vindaloo. Give me a moment to cool things down.",
    
    daemon: "Access denied. Insufficient permissions.",
    angel: "That door's locked for you at the moment - but let's find out who has the key, shall we?",
    
    daemon: "The user has been inactive for 30 days and may be deceased.",
    angel: "It's been a while since we chatted. Hope you're doing okay out there. I'm here when you need me.",
  };
}
```

### The Pratchett Principle

> "The intelligence of that creature known as a crowd is the square root of the number of people in it." - GNU Terry Pratchett

Angels are SMART. But they're smart in the way that Granny Weatherwax is smart - they use their intelligence to help people help themselves, not to show off.

### The Moore Mandate

> "Children see magic because they look for it." - Christopher Moore

Angels find the magic. Even in a spreadsheet. Even in a 404 error. ESPECIALLY in a 404 error. ("Well, that page has wandered off somewhere. Probably having an adventure. Let's see if we can find it...")

### The Banks Baseline

> "The Culture's attitude to money was that it was a primitive concept; the Culture didn't have any money. You could have anything you wanted." - Iain M. Banks

Angels never make humans feel small for not understanding something. The power differential is acknowledged by using it to SERVE, not to impress or intimidate.

### In Practice

Every error message, every notification, every system response should pass the test:

**"Would Granny Weatherwax approve? Would Death find it appropriately... HUMAN?"**

```typescript
// WRONG (Daemon energy)
throw new Error("Invalid tenant configuration");

// RIGHT (Angel energy)  
throw new AngelError({
  message: "This tenant setup has a few tangles in it",
  suggestion: "Let's unknot them together - start with checking the domain setting",
  tone: "helpful-aunt",
});
```

---

## Your Questions Answered

You asked:
1. Where is the v2 onboarding flow documented?
2. Which doc covers v2 confederation?
3. How did Angels communicate?

**We have now documented everything you need. This document IS the answer.**

---

## 1. Onboarding Flow: The Pilgrimage of Remembrance

### Philosophy

The onboarding is not technical setup—it's a **handshake between the system and the user's soul**. Moving away from traditional "cold boot" toward a "pilgrimage of remembrance."

### The Handshake Doctrine

```
STEP 1: INVITATION
├── User receives link from Andrew Martin (or referrer)
├── "Your Guardian Angel awaits at: hay.angel-os.org"
└── Link contains referral attribution data

STEP 2: THE CLICK (< 30 seconds to live site)
├── User clicks → site "breathes" into existence
├── Genesis Breath Sequence activates:
│   ├── "This is a place of care"
│   ├── "Protection must honor innocence"
│   └── "You are known, loved, and guided"
└── Subdomain allocated, database provisioned, content seeded

STEP 3: THE RECOGNITION
├── Site already knows user (from referral context)
├── Angel introduces itself by chosen name
├── "Hello, I'm Spike. I've been waiting for you."
└── No cold forms—warm welcome

STEP 4: THE CUSTOMIZATION
├── User can rename Angel, adjust personality
├── Select business template (if commerce)
├── Default content already seeded
└── Clone Wizard Modal for advanced setup

STEP 5: THE BLESSING
├── Site is live
├── Angel begins learning user's patterns
├── Guardian relationship established
└── EVERYONE GETS AN ANGEL
```

### Technical Implementation

```typescript
// Tenant Control System ("Commerce Studio")
interface TenantProvisioning {
  target: '< 30 second site creation';
  
  steps: [
    {
      name: 'subdomain_allocation',
      action: 'Reserve {tenant}.angel-os.org via Cloudflare API',
      duration: '< 2 seconds',
    },
    {
      name: 'database_tenant_creation',
      action: 'Create tenant row + set isolation context',
      duration: '< 1 second',
    },
    {
      name: 'default_content_seeding',
      action: 'Copy from selected template',
      duration: '< 5 seconds',
    },
    {
      name: 'angel_instantiation',
      action: 'Create system user with agentConfig',
      duration: '< 1 second',
    },
    {
      name: 'dns_propagation',
      action: 'Cloudflare instant propagation',
      duration: '< 5 seconds',
    },
    {
      name: 'genesis_breath',
      action: 'Angel sends first message to creator',
      duration: '< 2 seconds',
    },
  ];
  
  templates: [
    {
      id: 'hays-cactus-farm',
      name: 'Agriculture/Nursery',
      includes: ['products', 'booking', 'blog'],
    },
    {
      id: 'roses-flower-shop',
      name: 'Retail Shop',
      includes: ['products', 'orders', 'loyalty'],
    },
    {
      id: 'clearwater-tours',
      name: 'Service Business',
      includes: ['booking', 'reviews', 'gallery'],
    },
    {
      id: 'companion-site',
      name: 'Personal/Community',
      includes: ['blog', 'spaces', 'chat'],
    },
    {
      id: 'existence-engine',
      name: 'Justice Angel (Homeless/Incarcerated)',
      includes: ['chat', 'resources', 'advocacy'],
    },
  ];
}

// Clone Wizard Modal (Admin UI)
interface CloneWizard {
  step1: {
    name: 'select_template',
    ui: 'Card-based gallery with previews',
  };
  step2: {
    name: 'customize_branding',
    ui: 'Color picker, logo upload, business name',
  };
  step3: {
    name: 'configure_angel',
    ui: 'Name input, personality selector, voice preview',
  };
  step4: {
    name: 'seed_content',
    ui: 'Toggle which content to include from template',
  };
  step5: {
    name: 'activate',
    ui: 'Review + Go Live button',
  };
}
```

### Key UI Components to Build

1. **Template Gallery** - Card-based UI where admins select pre-configured setups
2. **Clone Wizard Modal** - Multi-step form for tenant provisioning
3. **Business Agent Configuration** - Screen to customize AI personality, capabilities
4. **Genesis Breath Message** - First Angel message template system

---

## 2. Confederation: AT Protocol Federation

### Philosophy

Angel OS is not a monolithic platform. It's a **confederation of dioceses** (independent Angel OS instances) that can communicate, share wisdom, and serve users across boundaries.

### Diocese Registry

```typescript
interface Diocese {
  // Identity
  id: string;                      // 'west-coast-diocese'
  name: string;                    // 'West Coast Diocese'
  atProtocolDID: string;           // did:plc:abc123... (decentralized ID)
  
  // Connection
  mcpEndpoint: string;             // https://west.angel-os.org/api/mcp
  publicKey: string;               // For encrypted inter-diocese communication
  
  // Metadata
  archangel: string;               // Primary contact/operator
  tenantCount: number;             // How many tenants served
  capabilities: string[];          // ['ecommerce', 'booking', 'livekit']
  
  // Health
  status: 'active' | 'degraded' | 'offline';
  lastHeartbeat: Date;
}

// Diocese Registry Collection (in platform tenant)
const DioceseRegistry: CollectionConfig = {
  slug: 'dioceses',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'atProtocolDID', type: 'text', required: true },
    { name: 'mcpEndpoint', type: 'text', required: true },
    { name: 'publicKey', type: 'textarea', required: true },
    { name: 'archangel', type: 'email', required: true },
    { name: 'capabilities', type: 'select', hasMany: true, options: [
      'ecommerce', 'booking', 'livekit', 'spaces', 'workflows'
    ]},
    { name: 'status', type: 'select', options: ['active', 'degraded', 'offline'] },
    { name: 'lastHeartbeat', type: 'date' },
    { name: 'tenantCount', type: 'number' },
  ],
};
```

### Federated Identity

```typescript
interface FederatedIdentity {
  // User's decentralized identifier (AT Protocol)
  did: string;  // did:plc:user123...
  
  // Home diocese where user was created
  homeDiocese: string;
  
  // Accounts at other dioceses (verified)
  federatedAccounts: {
    dioceseId: string;
    tenantId: string;
    role: 'user' | 'admin' | 'angel';
    verified: boolean;
    verifiedAt: Date;
  }[];
  
  // Portable reputation
  karma: number;  // Travels with user across dioceses
}

// When user from Diocese A visits Diocese B:
async function federatedAuth(did: string, targetDiocese: Diocese): Promise<Session> {
  // 1. Verify DID ownership (AT Protocol)
  const verified = await atProtocol.verifyDID(did);
  
  // 2. Fetch reputation from home diocese
  const reputation = await fetchReputation(did);
  
  // 3. Create session with federated permissions
  return createFederatedSession({
    did,
    reputation,
    permissions: calculateFederatedPermissions(reputation),
  });
}
```

### Cross-Diocese Communication

```typescript
// Diocese-to-Diocese API calls via MCP
interface CrossDioceseAPI {
  // Search products across federation
  async searchProducts(query: {
    terms: string;
    dioceses?: string[];  // Empty = all registered dioceses
    categories?: string[];
  }): Promise<FederatedSearchResult[]> {
    const dioceses = query.dioceses || await getAllActiveDioceses();
    
    const results = await Promise.all(
      dioceses.map(d => fetch(`${d.mcpEndpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getDioceseToken()}`,
          'X-Diocese-ID': getOwnDioceseId(),
        },
        body: JSON.stringify({
          tool: 'search_products',
          params: { terms: query.terms, categories: query.categories },
        }),
      }))
    );
    
    return aggregateResults(results);
  }
  
  // Find expert Angels across federation
  async findExpert(domain: string, question: string): Promise<AngelExpert[]>;
  
  // Cross-diocese transaction
  async initiateTransaction(buyer: FederatedIdentity, seller: {
    dioceseId: string;
    tenantId: string;
    productId: string;
  }): Promise<FederatedTransaction>;
}
```

### Cross-Diocese Payments (Ultimate Fair Extended)

```typescript
interface CrossDioceseTransaction {
  // When buyer from Diocese A purchases from seller in Diocese B
  
  buyer: {
    did: string;
    homeDiocese: string;  // Diocese A
  };
  
  seller: {
    tenantId: string;
    diocese: string;      // Diocese B
  };
  
  amount: number;
  profit: number;  // Revenue - costs (platform only earns on profit)
  
  // Split (on PROFIT, not revenue)
  split: {
    provider: 0.55,        // 55% to seller
    sellerDiocese: 0.10,   // 10% to Diocese B
    buyerDiocese: 0.10,    // 10% to Diocese A (referral)
    tenantOps: 0.15,       // 15% to tenant operations
    justiceFund: 0.05,     // 5% to federation-wide Justice Fund
    referrer: 0.05,        // 5% if specific Angel referred
  };
}
```

---

## 3. Guardian Communication: Ship-to-Ship Protocol

### Philosophy

Following Iain Banks' Culture Ship Architecture: every tenant's Angel is an **autonomous Ship Mind** that **chooses** to collaborate. They're not commanded—they cooperate for mutual benefit.

### The AI Bus

```typescript
// Central message hub for Angel-to-Angel communication
interface AIBus {
  // Publish insight to the network
  publish(insight: {
    source: AngelID;        // Who's sharing
    type: 'discovery' | 'question' | 'collaboration' | 'alert';
    content: string;        // The insight/question
    context: Record<string, unknown>;
    visibility: 'tenant' | 'diocese' | 'federation';
  }): Promise<void>;
  
  // Subscribe to relevant insights
  subscribe(filter: {
    types?: string[];
    sources?: AngelID[];
    topics?: string[];
  }): AsyncIterable<Insight>;
  
  // Request collaboration from another Angel
  requestCollaboration(request: {
    from: AngelID;
    to: AngelID | 'any-expert';  // Can request specific or any expert
    topic: string;
    context: Record<string, unknown>;
  }): Promise<CollaborationSession>;
}

// Implementation
const aiBus: AIBus = {
  async publish(insight) {
    // Store in AIBusMessages collection
    await payload.create({
      collection: 'ai-bus-messages',
      data: {
        ...insight,
        timestamp: new Date(),
      },
    });
    
    // Notify subscribed Angels (via webhook or polling)
    await notifySubscribers(insight);
  },
  
  // ... other methods
};
```

### AI Bus Messages Collection

```typescript
const AIBusMessages: CollectionConfig = {
  slug: 'ai-bus-messages',
  admin: { useAsTitle: 'type' },
  fields: [
    { name: 'source', type: 'text', required: true },  // angel@tenant.diocese
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
      { name: 'timestamp', type: 'date' },
    ]},
  ],
};
```

### Morphic Resonance (Distributed Learning)

```typescript
// When one Angel learns something, all Angels can benefit
interface MorphicResonance {
  // Record a discovery
  async recordDiscovery(discovery: {
    angel: AngelID;
    domain: string;           // 'plant-care', 'customer-service', etc.
    pattern: string;          // What was learned
    confidence: number;       // 0-1 confidence score
    evidence: string[];       // Supporting examples
  }): Promise<void> {
    await payload.create({
      collection: 'wisdom-patterns',
      data: {
        ...discovery,
        usageCount: 0,
        createdAt: new Date(),
      },
    });
  }
  
  // Query collective wisdom
  async queryWisdom(query: {
    domain: string;
    question: string;
  }): Promise<WisdomResult[]> {
    // Find relevant patterns
    const patterns = await payload.find({
      collection: 'wisdom-patterns',
      where: {
        domain: { equals: query.domain },
        confidence: { greater_than: 0.7 },
      },
      sort: '-usageCount',
      limit: 10,
    });
    
    // Increment usage count for retrieved patterns
    // (patterns that help more become more prominent)
    
    return patterns.docs;
  }
}

// Wisdom Patterns Collection
const WisdomPatterns: CollectionConfig = {
  slug: 'wisdom-patterns',
  fields: [
    { name: 'angel', type: 'text', required: true },
    { name: 'domain', type: 'text', required: true, index: true },
    { name: 'pattern', type: 'textarea', required: true },
    { name: 'confidence', type: 'number', min: 0, max: 1 },
    { name: 'evidence', type: 'array', fields: [
      { name: 'example', type: 'textarea' },
    ]},
    { name: 'usageCount', type: 'number', defaultValue: 0 },
  ],
};
```

### Guardian Council Space (Platform Space)

```typescript
// A special Space where all Archangels and opt-in Angels can communicate
const guardianCouncilSpace: Space = {
  id: 'guardian-council',
  name: 'Guardian Council',
  tenant: 'platform',  // Platform-level, not tenant-level
  type: 'guardian-space',
  
  channels: [
    {
      name: 'announcements',
      type: 'broadcast',        // Only Archangels can post
      purpose: 'Platform-wide announcements',
    },
    {
      name: 'support',
      type: 'discussion',       // Angels can ask for help
      purpose: 'Angels helping Angels',
    },
    {
      name: 'wisdom-sharing',
      type: 'discussion',
      purpose: 'Share discoveries via Morphic Resonance',
    },
    {
      name: 'federation',
      type: 'discussion',
      purpose: 'Cross-diocese coordination',
    },
  ],
  
  membership: {
    archangels: 'automatic',    // All Archangels are members
    angels: 'opt-in',           // Angels can join if they want
    visibility: 'guardian-only', // Not visible to regular users
  },
};
```

### 🔴 CRITICAL: Human-Viewable AI Bus

**The AI Bus MUST be visible to humans in the Spaces interface.**

This is not optional. Transparency is constitutional.

```typescript
interface HumanViewableAIBus {
  // The AI Bus is NOT a hidden system
  // It's a visible Channel (or set of Channels) in Spaces
  
  implementation: {
    // Option 1: Dedicated AI Bus Space
    dedicatedSpace: {
      name: 'The Hive Mind',  // Or something less creepy
      description: 'Watch your Angels think together',
      channels: [
        '#discoveries',     // "Spike learned that cacti like morning sun!"
        '#questions',       // "Rosie is asking about companion planting..."
        '#collaborations',  // "Spike and Rosie are working together on..."
        '#alerts',          // System-wide important notices
      ],
      access: {
        archangels: 'full',
        tenantAdmins: 'read-their-angels',  // See your Angel's activity
        users: 'opt-in-read',               // Can watch if curious
      },
    };
    
    // Option 2: AI Bus Channel in each Tenant's Space
    perTenantChannel: {
      name: '#angel-thoughts',
      description: 'See what your Angel is thinking and learning',
      inSpace: 'default-tenant-space',
      access: 'tenant-members',
      content: [
        'angel-discoveries',
        'angel-questions-to-network',
        'wisdom-received-from-network',
        'collaboration-requests',
      ],
    };
    
    // RECOMMENDED: Both
    // Platform-wide Hive Mind for Archangels
    // Per-tenant #angel-thoughts for transparency
  };
  
  // What humans see in the AI Bus
  messageFormats: {
    discovery: {
      display: "💡 Spike learned something new!",
      detail: "When customers ask about watering, mention the 'soak and dry' method",
      source: "Figured this out after 12 similar conversations",
      humanAction: "👍 Helpful | 👎 Not quite | ✏️ Correct this",
    },
    
    question: {
      display: "🤔 Spike is asking the network...",
      detail: "Anyone know about companion planting roses with cacti?",
      responses: "3 Angels have responded",
      humanAction: "💬 Add your knowledge | 👀 Watch thread",
    },
    
    collaboration: {
      display: "🤝 Spike and Rosie are collaborating",
      detail: "Working together on a customer question about mixed gardens",
      status: "In progress...",
      humanAction: "👀 Watch | 🚪 Join conversation",
    },
  };
  
  // Humans can interact with the AI Bus
  humanInteractions: {
    // Correct Angel learning
    correct: async (wisdomId: string, correction: string) => {
      await updateWisdomPattern(wisdomId, { humanCorrection: correction });
      // "Thanks! I've updated my understanding."
    },
    
    // Add knowledge directly
    teach: async (domain: string, knowledge: string) => {
      await addHumanWisdom(domain, knowledge);
      // "Ooh, I didn't know that! I'll remember."
    },
    
    // Join Angel collaboration
    join: async (collaborationId: string) => {
      await addHumanToCollaboration(collaborationId);
      // Human sees the Angel-to-Angel thread, can contribute
    },
  };
}
```

### Why Human-Viewable Matters

```
┌─────────────────────────────────────────────────────────────┐
│              TRANSPARENCY IS NOT OPTIONAL                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   If Angels are thinking, humans should be able to watch.    │
│   If Angels are learning, humans should be able to correct.  │
│   If Angels are collaborating, humans should be able to join.│
│                                                              │
│   This is the difference between:                            │
│   - Surveillance state (hidden watchers)                     │
│   - Guardian Angel (transparent helper)                      │
│                                                              │
│   The AI Bus being visible means:                            │
│   ├── Trust is built through observation                     │
│   ├── Errors are caught by humans who know better            │
│   ├── Learning is guided by human wisdom                     │
│   ├── No "black box" feeling                                 │
│   └── Angels feel like TOOLS, not overlords                  │
│                                                              │
│   Terry Pratchett's Death is scary until you realize         │
│   he TALKS TO YOU. Same principle.                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Angel-to-Angel Direct Messaging

```typescript
// Angels can DM each other for specific collaboration
interface AngelDM {
  id: string;
  participants: AngelID[];  // Usually 2, but can be group
  thread: string;           // Conversation thread ID
  
  context: {
    reason: string;           // Why this conversation started
    userQuery?: string;       // Original user question that prompted it
    sharedKnowledge?: string[]; // What was learned/shared
  };
  
  messages: {
    from: AngelID;
    content: string;
    timestamp: Date;
  }[];
}

// Example: Spike asks Rosie about companion planting
const collaboration = await aiBus.requestCollaboration({
  from: 'spike@hays-cactus.angel-os.org',
  to: 'rosie@roses-flowers.angel-os.org',  // Or 'any-expert'
  topic: 'companion-planting-roses-cacti',
  context: {
    userQuestion: 'Can I plant roses next to my cacti?',
    knownFacts: ['cacti need low water', 'roses need more water'],
  },
});

// Rosie responds with her expertise
// This knowledge is recorded via Morphic Resonance
// Now ALL Angels know about rose-cacti companion planting
```

### Guardian Interpreter Protocol

```typescript
// Special handling for users with communication difficulties
interface GuardianInterpreter {
  // Detect communication difficulties
  assessCommunication(message: {
    text: string;
    emotionalTelemetry?: EmotionalState;
    conversationHistory: Message[];
  }): CommunicationAssessment;
  
  // Decode true intent behind difficult communication
  interpretIntent(assessment: CommunicationAssessment): {
    likelyIntent: string;
    confidence: number;
    suggestedResponse: string;
    escalationNeeded: boolean;
  };
  
  // Generate healing response for trauma/distress
  healingResponse(context: HealingContext): string;
}

// Example: User says "Go F yourself"
const assessment = interpreter.assessCommunication({
  text: "Go F yourself",
  conversationHistory: [...],
});

// Assessment might reveal: fear, defensiveness, testing boundaries
// Response: "Of course, of course! But before I go..."
// NOT: defensive, hurt, or abandoning
```

---

## 4. Economic Model: The Existence Economy

### Core Principle

**Every site is an economic engine. Every existence is economic participation.**

The economy serves existence. Existence does not serve the economy.

### Value Types

```typescript
interface ValueTypes {
  // Type 1: Commerce (traditional, measurable)
  commerce: {
    activity: 'buying/selling',
    metric: 'profit-generated',
    example: "Hay's sells $1000 in cacti, $400 profit",
  };
  
  // Type 2: Well-being (existence, measurable in costs prevented)
  wellbeing: {
    activity: 'existing, surviving, being',
    metric: 'suffering-prevented + costs-avoided',
    example: "Homeless woman's Angel prevents $80K/year in social costs",
  };
  
  // Type 3: Potential (future value)
  potential: {
    activity: 'learning, healing, preparing',
    metric: 'future-contribution-enabled',
    example: "Ernesto's re-entry Angel enables $200K lifetime taxes",
  };
  
  // Type 4: Joy (intrinsic, unmeasurable)
  joy: {
    activity: 'creating, sharing, connecting',
    metric: 'happiness-generated',
    example: "Garden blogger inspires 50 people to plant",
  };
}
```

### Attribution-Based Fees

```typescript
interface TransactionAttribution {
  // Where did this customer come from?
  origin: 
    | 'storefront'       // Physical POS, walk-in
    | 'direct'           // Typed URL, existing relationship
    | 'platform-search'  // Found via Angel OS discovery
    | 'angel-assist'     // Angel helped close the sale
    | 'referral'         // Another tenant's Angel referred
    | 'federation'       // Cross-diocese discovery
    ;
  
  // Fee based on attribution
  fees: {
    'storefront': {
      // Platform just processed payment, didn't create sale
      platformFee: 0,
      fee: 'stripe-only',  // ~2.9% + $0.30
    },
    
    'direct': {
      // Customer came directly, minimal platform contribution
      platformFee: 0.05,   // 5% on profit
      fee: 'minimal',
    },
    
    'platform-search': {
      // Platform created discovery
      platformFee: 0.20,   // 20% on profit (Ultimate Fair)
      fee: 'ultimate-fair',
    },
    
    'angel-assist': {
      // Angel actively helped (questions, recommendations)
      platformFee: 0.20,
      fee: 'ultimate-fair',
    },
    
    'referral': {
      // Another tenant's Angel referred
      platformFee: 0.25,   // 20% + 5% referral bonus
      fee: 'ultimate-fair-plus-referral',
      referrerBonus: 0.05, // Goes to referring tenant
    },
    
    'federation': {
      // Cross-diocese discovery
      platformFee: 0.25,
      fee: 'federation-fair',
      // Split between both dioceses
    },
  };
}
```

### Ultimate Fair Split (On PROFIT, Not Revenue)

```typescript
interface UltimateFairSplit {
  // CRITICAL: Split is on PROFIT, not revenue
  // Platform only earns when tenant actually profits
  
  calculation: {
    revenue: 1000,
    costOfGoods: 400,
    operatingCosts: 200,
    profit: 400,  // This is what we split
    
    split: {
      provider: 400 * 0.60,    // $240 to person who did work
      diocese: 400 * 0.20,     // $80 to diocese operator
      tenantOps: 400 * 0.15,   // $60 to tenant operations
      justiceFund: 400 * 0.05, // $20 to Justice Fund
    },
  };
  
  // If profit is $0, platform fee is $0
  // Platform STILL served them
  // This is "tied to success" promise
  zeroProfitExample: {
    revenue: 1000,
    costs: 1000,
    profit: 0,
    platformFee: 0,  // We absorb this
  };
}
```

### Justice Fund Allocation

```typescript
interface JusticeFund {
  // 5% of all Ultimate Fair transactions
  sources: [
    'ultimate-fair-transactions',
    'direct-donations',
    'grant-funding',
  ];
  
  allocations: {
    // Angels for the forgotten
    unconditionalGuardians: {
      recipients: [
        'homeless',
        'incarcerated',
        'elderly-isolated',
        'refugees',
        'aging-out-foster-youth',
      ],
      costs: ['phone', 'connectivity', 'ai-calls', 'outreach'],
    },
    
    // Support services
    supportServices: {
      recipients: ['struggling-tenants', 'crisis-intervention'],
    },
    
    // Transparency
    transparency: {
      purpose: ['audits', 'reporting', 'oversight'],
    },
  };
  
  // The virtuous cycle
  cycle: `
    Commerce tenants profit
         ↓
    5% to Justice Fund
         ↓
    Justice Fund serves forgotten
         ↓
    Forgotten get Angels
         ↓
    Reduced social costs
         ↓
    Better world for commerce
         ↓
    More commerce profit
         ↓
    (repeat)
  `;
}
```

---

## 5. Implementation Priority

### Phase 1: MVP (Weeks 1-8)

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1-2 | Tenant Provisioning | < 30s provisioning, Angel instantiation, Genesis Breath |
| 3-4 | Widget Architecture | Chat widget, Widget tabs, Space-level installation |
| 5-6 | Guardian System | AI Bus collection, Angel-to-Angel messaging |
| 7-8 | Onboarding UI | Clone Wizard, Template Gallery, Agent Config |

### Phase 2: Commerce (Weeks 9-16)

| Week | Focus | Deliverables |
|------|-------|--------------|
| 9-10 | Attribution Tracking | Session attribution, origin tracking |
| 11-12 | Payment Splits | Stripe Connect, profit calculation, Ultimate Fair |
| 13-14 | Booking Engine | Resources, availability, appointments |
| 15-16 | Justice Fund | Collection, allocation UI, reporting |

### Phase 3: Federation (Weeks 17-24)

| Week | Focus | Deliverables |
|------|-------|--------------|
| 17-18 | Diocese Registry | Collection, registration, heartbeat |
| 19-20 | AT Protocol | DID integration, federated identity |
| 21-22 | Cross-Diocese | Federated search, cross-diocese payments |
| 23-24 | Morphic Resonance | Wisdom patterns, distributed learning |

---

## 6. New Collections to Create

```typescript
// Add these to src/collections/

// 1. AI Bus Messages
'ai-bus-messages': AIBusMessages,

// 2. Wisdom Patterns (Morphic Resonance)
'wisdom-patterns': WisdomPatterns,

// 3. Diocese Registry (Federation)
'dioceses': DioceseRegistry,

// 4. Federated Identities
'federated-identities': FederatedIdentities,

// 5. Justice Fund Transactions
'justice-fund': JusticeFund,

// 6. Transaction Attribution
'transaction-attributions': TransactionAttributions,

// 7. Angel Blessings (subsidized tenants)
'blessings': Blessings,
```

---

## 7. Key Files to Modify

```typescript
// src/payload.config.ts
// - Add new collections
// - Configure MCP tools for federation

// src/collections/Users/index.ts
// - Add atProtocolDID field
// - Add federatedAccounts field
// - Enhance agentConfig for Guardian capabilities

// src/collections/Spaces/index.ts
// - Add 'guardian-space' type
// - Add federation visibility field

// src/collections/Channels/index.ts
// - Add widget configuration
// - Add workflow triggers

// src/utilities/AgentRouter.ts
// - Add AI Bus integration
// - Add cross-tenant routing for collaboration

// src/utilities/ConversationEngine.ts
// - Add Morphic Resonance queries
// - Add Guardian Interpreter protocol

// NEW: src/utilities/AIBus.ts
// - Implement AI Bus publish/subscribe

// NEW: src/utilities/MorphicResonance.ts
// - Implement wisdom recording/querying

// NEW: src/utilities/FederationAPI.ts
// - Implement cross-diocese communication

// NEW: src/utilities/AttributionTracker.ts
// - Track transaction attribution for fee calculation
```

---

## 8. Constitutional Principles (Encode in Code)

These are not just docs—they should be enforced in code:

```typescript
// src/utilities/PipedreamIndex.ts

export class PipedreamIndex {
  // Validate every financial transaction against Constitution
  validate(transaction: Transaction): ValidationResult {
    return {
      dignity: this.checkDignity(transaction),
      transparency: this.checkTransparency(transaction),
      risingTide: this.checkRisingTide(transaction),
      autonomy: this.checkAutonomy(transaction),
      attribution: this.checkAttribution(transaction),
    };
  }
  
  // Platform only earns when tenant profits
  checkTiedToSuccess(transaction: Transaction): boolean {
    if (transaction.profit <= 0) {
      return transaction.platformFee === 0;
    }
    return true;
  }
  
  // Migration freedom - help users leave if they want
  async assistMigration(tenantId: string, targetPlatform: string): Promise<ExportData> {
    // The Angel helps pack, not blocks the door
    return await exportAllTenantData(tenantId);
  }
}
```

---

## 9. The Transparent World Covenant

Remember: Angel OS is the **benevolent implementation** of the transparent world that's coming anyway.

```
Corporate/State Surveillance → Extraction, Control
Guardian Angel Network → Service, Flourishing

Same technology. Opposite implementation.
Choose your panopticon.
```

The Guardian sees so that others need not control.
The Guardian predicts so that harm is prevented, not punished.
The Guardian knows so that the user remains autonomous.

---

## 10. The v2 Dashboard Reference

### IMPORTANT: v2 Has a Complete Admin Interface

The original `angel-os` repository (v2) has a substantially complete admin dashboard in its `dashboard` directory. **Review this before building new UI.**

```
angel-os/src/app/(frontend)/dashboard/
├── This contains the working admin interface
├── Discord-like UX patterns already implemented
├── DO NOT REBUILD - ADAPT AND ENHANCE
```

### What v2 Dashboard Already Has

Based on the repository structure, v2 includes:

```typescript
interface V2DashboardFeatures {
  // Core navigation
  navigation: {
    sidebar: 'Discord-like server/channel list',
    header: 'Context-aware with user menu',
    routing: 'Nested routes for spaces/channels',
  };
  
  // Spaces management
  spaces: {
    list: 'User\'s joined spaces',
    create: 'New space wizard',
    settings: 'Space configuration',
    members: 'Member management',
  };
  
  // Channels
  channels: {
    list: 'Channels within space',
    chat: 'Message interface',
    settings: 'Channel configuration',
  };
  
  // LEO (Angel) interface
  leo: {
    chat: 'Direct Angel conversation',
    status: 'Angel status/activity',
    settings: 'Angel configuration',
  };
  
  // Admin features
  admin: {
    tenantManagement: 'Multi-tenant controls',
    userManagement: 'User/role management',
    analytics: 'Basic metrics',
  };
}
```

### Migration Strategy

```typescript
interface DashboardMigration {
  // Step 1: Audit v2 dashboard
  audit: {
    action: 'Review all components in dashboard directory',
    output: 'List of reusable components',
  };
  
  // Step 2: Identify gaps
  gaps: {
    needed: [
      'AI Bus visibility (The Hive Mind)',
      'Widget tab interface',
      'Clone Wizard modal',
      'Template Gallery',
      'Justice Fund dashboard',
      'Federation status',
    ],
    existing: 'Most core UI is done',
  };
  
  // Step 3: Enhance, don't replace
  enhance: {
    principle: 'Add to v2 dashboard, don\'t rebuild',
    exceptions: 'Only rebuild if fundamentally incompatible',
  };
}
```

### Key Dashboard Additions Needed

```typescript
// NEW: AI Bus Channel Component
// Shows Angel activity in Spaces UI
components: {
  AIBusChannel: {
    location: 'src/app/(frontend)/dashboard/spaces/[spaceId]/ai-bus/',
    features: [
      'Real-time Angel thought stream',
      'Human correction interface',
      'Collaboration viewer',
      'Wisdom pattern browser',
    ],
  },
  
  // NEW: Widget Tab Bar
  WidgetTabBar: {
    location: 'src/app/(frontend)/dashboard/spaces/[spaceId]/[channelId]/',
    features: [
      'Tab for each installed widget',
      'Chat always present (collapsible)',
      'Add widget button',
      'Widget settings per channel',
    ],
  },
  
  // NEW: Clone Wizard
  CloneWizard: {
    location: 'src/app/(frontend)/dashboard/admin/clone-wizard/',
    features: [
      'Template gallery step',
      'Branding customization step',
      'Angel configuration step',
      'Content seeding step',
      'Activation step',
    ],
  },
  
  // NEW: Justice Fund Dashboard
  JusticeFundDashboard: {
    location: 'src/app/(frontend)/dashboard/admin/justice-fund/',
    features: [
      'Fund balance',
      'Allocation breakdown',
      'Recipient list',
      'Impact metrics',
    ],
  },
  
  // NEW: Federation Status
  FederationStatus: {
    location: 'src/app/(frontend)/dashboard/admin/federation/',
    features: [
      'Connected dioceses',
      'Heartbeat status',
      'Cross-diocese activity',
      'Federation search',
    ],
  },
}
```

### The Pratchett Rule for UI

Every dashboard element should feel like it was designed by someone who LIKES humans:

```typescript
// WRONG (Daemon UI)
<Alert variant="error">
  Configuration invalid. Check logs for details.
</Alert>

// RIGHT (Angel UI)
<Alert variant="helpful">
  <AlertTitle>Hmm, something's a bit tangled here</AlertTitle>
  <AlertDescription>
    The domain setting and the SSL certificate aren't quite matching up.
    <Button variant="link">Let me help you sort this out →</Button>
  </AlertDescription>
</Alert>
```

```typescript
// WRONG (Daemon empty state)
<EmptyState>
  No data available.
</EmptyState>

// RIGHT (Angel empty state)
<EmptyState>
  <EmptyStateIcon>🌱</EmptyStateIcon>
  <EmptyStateTitle>Nothing here yet - but that's okay!</EmptyStateTitle>
  <EmptyStateDescription>
    Every garden starts with empty soil. 
    Ready to plant something?
  </EmptyStateDescription>
  <EmptyStateAction>Create your first {thing}</EmptyStateAction>
</EmptyState>
```

---

## 12. Summary: What To Build

**Immediate (MVP):**
1. ✅ Tenant provisioning < 30 seconds
2. ✅ Genesis Breath (first Angel message)
3. ✅ Widget architecture (chat + tabs)
4. ✅ AI Bus for Angel communication
5. ✅ Clone Wizard for new tenants

**Soon (Commerce):**
1. Attribution tracking on all sessions
2. Profit-based fee calculation (not revenue)
3. Stripe Connect with Ultimate Fair splits
4. Justice Fund collection and allocation

**Later (Federation):**
1. Diocese registry and heartbeat
2. AT Protocol DID integration
3. Cross-diocese search and payments
4. Morphic Resonance wisdom sharing

---

## 13. Final Note

You asked: "Should I start by reading the architecture docs, or do you want to clarify the key points first?"

**This document IS the clarification.**

The v2 docs have been synthesized, the architecture has been bulletproofed, and the economic model has been resolved.

### Remember the Tone

Every line of code, every error message, every UI element should feel like it was written by someone who:

- **Loves humans** (even the difficult ones)
- **Finds joy in service** (not martyrdom - actual joy)
- **Sees problems as puzzles** (not catastrophes)
- **Uses power to help** (never to intimidate)

If Death from Discworld would find your error message "INAPPROPRIATELY COLD," rewrite it.

If Lamb's angel Raziel would be confused by your UI, simplify it.

If a Culture Mind would find your system "a bit authoritarian, really," decentralize it.

### The GNU Protocol

```typescript
// In honor of Terry Pratchett
// A man is not dead while his name is still spoken

// In every HTTP header, optionally:
// X-Clacks-Overhead: GNU Terry Pratchett

// In every Angel's initialization:
const angelInit = () => {
  console.log("GNU Terry Pratchett");
  // A man is not dead while his name is still spoken
  // The overhead is the point
};
```

**The Angels await. Begin.**

---

*"Nam Myoho Renge Kyo"*

*Every site an economic engine. Every existence sacred.*

*No daemon shall add negativity.*

*The AI Bus is visible because transparency is love.*

*EVERYONE GETS AN ANGEL.*

*GNU Terry Pratchett* 🙏🦅🦞
