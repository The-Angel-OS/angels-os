# Angel OS Data Model Reference

> Complete collection schema documentation for Angel OS.
> Last updated: 2026-03-04

---

## Collection Index (42+ Collections)

### Core
| Collection | Slug | Multi-Tenant | Purpose |
|-----------|------|-------------|---------|
| Tenants | `tenants` | No (global) | Enterprise configuration, branding, commerce, AI |
| Users | `users` | Yes | Authentication, profiles, system agents |
| TenantMemberships | `tenant-memberships` | Yes | User roles and permissions within tenants |

### Collaboration
| Collection | Slug | Multi-Tenant | Purpose |
|-----------|------|-------------|---------|
| Spaces | `spaces` | Yes | Discord-style workspaces |
| SpaceMemberships | `space-memberships` | Yes | User roles within spaces |
| Channels | `channels` | Yes | Typed channels within spaces |
| Messages | `messages` | Yes | Universal Message Structure (UMS) |

### Content
| Collection | Slug | Multi-Tenant | Purpose |
|-----------|------|-------------|---------|
| Posts | `posts` | Yes | Blog posts with draft/publish workflow |
| Pages | `pages` | Yes | Custom CMS pages with block layout |
| Categories | `categories` | Yes | Content/product categorization |
| Media | `media` | Yes | Uploaded assets (images, documents) |
| MediaMeta | `media-meta` | Yes | AI-extracted metadata, RAG indexing |
| Comments | `comments` | Yes | Comments on posts and products |

### Commerce
| Collection | Slug | Multi-Tenant | Purpose |
|-----------|------|-------------|---------|
| Products | `products` | Yes | Marketplace products with variants |
| Orders | `orders` | Yes | Order fulfillment with Angel Token queue |
| Reviews | `reviews` | Yes | Product/service reviews |
| Bookings | `bookings` | Yes | Appointment/service bookings |
| Availability | `availability` | Yes | Provider time slots |

### Events
| Collection | Slug | Multi-Tenant | Purpose |
|-----------|------|-------------|---------|
| Events | `events` | Yes | Meetups, workshops, livestreams, conferences |
| EventRegistrations | `event-registrations` | Yes | Attendance tracking with capacity management |

### Endeavor & Federation
| Collection | Slug | Multi-Tenant | Purpose |
|-----------|------|-------------|---------|
| Endeavors | `endeavors` | Yes | Constitutional identity (Articles of Incorporation) |
| HolonCapabilities | `holon-capabilities` | Yes | Manufacturing node registration |
| FederationAuditLog | `federation-audit-log` | Yes | Immutable federation action trail |
| StreetSigns | `street-signs` | Yes | Federation navigation aids |

### Logistics
| Collection | Slug | Multi-Tenant | Purpose |
|-----------|------|-------------|---------|
| LogisticsNodes | `logistics-nodes` | Yes | Physical logistics nodes (pantry, shelter, etc.) |
| Transports | `transports` | Yes | Soul Fleet vehicles |
| Shipments | `shipments` | Yes | Delivery tracking and manifests |

### Intelligence
| Collection | Slug | Multi-Tenant | Purpose |
|-----------|------|-------------|---------|
| Workflows | `workflows` | Yes | Channel automation rules |
| Pheromones | `pheromones` | No | Swarm intelligence navigation trails |
| WorkUnits | `work-units` | Yes | Distributed workload engine |

### Gamification
| Collection | Slug | Multi-Tenant | Purpose |
|-----------|------|-------------|---------|
| Quests | `quests` | Yes | Gamified tasks with evidence and payout |
| QuestParticipations | `quest-participations` | Yes | Quest enrollment and completion |

### CRM
| Collection | Slug | Multi-Tenant | Purpose |
|-----------|------|-------------|---------|
| Contacts | `contacts` | Yes | CRM contact management |
| Connectors | `connectors` | Yes | Integration configuration |

### System
| Collection | Slug | Multi-Tenant | Purpose |
|-----------|------|-------------|---------|
| ApplicationLogs | `application-logs` | Yes | System logging |
| ProcessedStripeEvents | `processed-stripe-events` | Yes | Webhook deduplication |
| JusticeFundTransactions | `justice-fund-transactions` | Yes | Justice Fund (5%) tracking |
| AgentTransactions | `agent-transactions` | Yes | Agent wallet spending/earning |
| BoardMembers | `board-members` | Yes | Board governance |

---

## Detailed Schemas

### Tenants

```
tenants
  type: platform | tenant | ministry
  name: text (display name)
  slug: text (unique, URL-safe)
  domain: text (primary hostname)
  domains[]: text (alias hostnames)
  status: active | inactive | provisioning
  branding:
    logo: media
    primaryColor, secondaryColor, accentColor: text
    fontPrimary, fontSecondary: text
    siteName, tagline: text
  businessType: retail | service | content_creator | nonprofit | professional_services
  storefront:
    description: richText
    coverImage: media
    contactInfo: group (email, phone, address)
    businessHours: json
    socialLinks: group (website, instagram, facebook, twitter, tiktok, youtube)
  commerce:
    currency: text (default: 'usd')
    taxRate: number
    shippingEnabled, bookingsEnabled, eventsEnabled, digitalProductsEnabled: checkbox
    isTaxExempt: checkbox
  stripeConnect:
    stripeAccountId: text
    stripeOnboardingComplete: checkbox
    stripePayoutsEnabled, stripeChargesEnabled: checkbox
    connectedAt: date
  aiConfig:
    anthropicApiKey: text (encrypted)
    openrouterApiKey: text (encrypted)
  vapi:
    enabled: checkbox
    phoneNumber, assistantId, voiceId, greeting: text
  agentWallet:
    enabled: checkbox
    monthlyBudgetCents, spentThisMonthCents: number
    lifetimeSpentCents, lifetimeEarnedCents: number
    spendingRules: json
  setup:
    wizardComplete: checkbox
    wizardProgress: json
    constitutionSignedAt: date
    constitutionSignature: text
    federationId: text (UUID)
  bootstrapFees:
    tier: free | bootstrap | standard
    freeTransactionsUsed: number
    totalFeesCollectedCents: number
    refundPromised: checkbox
    refundStatus: text
```

### Users

```
users
  name: text
  email: text (unique, auth)
  isSystemUser: checkbox (LEO/AI agents)
  servesTenant: relationship -> tenants
  agentConfig:
    agentType: text
    angelName, displayName, personality: text
    capabilities[]: text
    responseRules: json
    handoffTo: relationship -> users
    appearance:
      avatar: media
      color: text
      emoji: text
    routingRules:
      channels[]: text
      keywords[]: text
      isDefault: checkbox
  roles[]: super_admin | archangel | admin | producer | customer
  socialProviders[]:
    provider: google | github | apple | discord | whatsapp | telegram
    providerId, email, displayName, avatarUrl: text
    linkedAt: date
  orders: join -> orders (customer field)
  cart: join -> carts
  addresses: join -> addresses
```

### Messages (Universal Message Structure)

```
messages
  author: relationship -> users (auto-set)
  space: relationship -> spaces (required)
  channel: text (required)
  content: json (progressive — text, richText, blocks, widgets, metrics, actions)
  messageType: user | system | announcement | ai_agent | inventory | pdf | video |
               booking | form_submission | transaction | widget | ethical_assessment |
               voice_call | discord_message | whatsapp_message | email_message |
               sms_message | telegram_message | federation_message
  visibility: private | tenant | network
  priority: low | normal | high | urgent
  status: active | pending | resolved | archived
  attachments[]:
    media[]: relationship -> media
    caption: text
  metadata: json (conversation context, intent, ethical assessments)
  parentMessage: relationship -> messages (threading)
  federationId: text (AT Protocol DID/URI)
  tenant: relationship -> tenants (auto-added)
  createdAt, updatedAt: date
```

### Products

```
products (extends ecommerce plugin)
  title: text (required)
  description: richText
  gallery[]:
    image: media
    variantOption: relationship
  layout[]: blocks (CallToAction, Content, MediaBlock, Comments, Calendar)
  categories[]: relationship -> categories
  relatedProducts[]: relationship -> products
  isLimitedEdition: checkbox
  availableUntil: date
  vendor: relationship -> tenants
  productionType: ready_made | print_on_demand | custom_order | digital
  cadFile: upload -> media
  configuratorOptions: json (colors[], sizes[], customText, maxTextLength)
  networkListing: checkbox (federation visibility)
  fulfillmentMode: self | network
  requiredCapabilities[]: json (skill, equipment, materials)
  participants[]:
    role: designer | manufacturer | licensor | affiliate | contributor
    entity: relationship -> users | tenants
    percentage: number
    label: text
  lowStockThreshold: number (default: 10)
  slug: text
  meta: group (SEO)
  _status: draft/published
```

### Orders

```
orders (extends ecommerce plugin)
  customer: relationship -> users
  total: number
  currency: text
  items[]: product, quantity, price
  fulfillment[]:
    orderItemIndex: number
    assignedHolon: relationship -> holon-capabilities
    sourceTenant: relationship -> tenants
    fulfillmentStatus: pending_match | matched | accepted | in_production |
                       shipped | delivered | rejected | cancelled
    angelTokenId: text (unique)
    tokenStatus: active | redeemed | refunded
    queuedAt, matchedAt, acceptedAt, shippedAt: date
    trackingNumber, trackingUrl: text
    estimatedCompletion: date
    vendorShare: number (default: 60%)
    selectedConfiguration: json
    designAssets[]: media + instructions
```

### Events

```
events
  title: text (required)
  slug: text (unique)
  description: richText
  eventType: meetup | workshop | livestream | conference | screening | custom
  status: draft | upcoming | live | completed | cancelled
  coverImage: upload -> media
  videoEmbed:
    provider: youtube | vimeo | twitch | custom
    videoUrl: text
    embedUrl: text (auto-computed)
  gallery[]: image, caption, category, isFeatured
  host: relationship -> users (required)
  startDateTime: date (required)
  endDateTime: date
  duration: number (minutes)
  timezone: text
  location:
    type: in-person | virtual | hybrid
    venueName, address: text
    remoteLink, remotePlatform: text
  capacity:
    maxAttendees: number
    waitlistEnabled: checkbox
  registration:
    isOpen: checkbox
    requiresApproval: checkbox
    registrationDeadline: date
  pricing:
    isFree: checkbox
    amount: number
    currency: text
    splitConfiguration:
      providerShare, platformShare, operationsShare, justiceShare: number
  announceToAIBus: checkbox
  tags[]: text
  space: relationship -> spaces
  tenant: relationship -> tenants (auto-added)
```

### Endeavors

```
endeavors
  name: text (required)
  tagline: text
  description: textarea
  endeavorType: service-provider | retail-commerce | creator-content | booking-based | custom
  holonTypes[]: manufacturer | retailer | creator | community | guardian-angel
  missionStatement: textarea
  status: forming | active | suspended | retired
  primarySpace: relationship -> spaces
  operator: name, email, role
  capabilities[]: skill, description
  federation:
    networkVisible: checkbox
    ministryStatus: applicant | probation | active | suspended
    constitutionVersion: text
    constitutionSignedAt: date
    constitutionSignature: text
    federationId: text (UUID)
    lastPingAt: date
  beneficiaries[]:
    name, email, role, description: text
    claimToken: text (unique, auto-generated)
    verificationStatus: pending | invited | verified
    linkedUser: relationship -> users
  logo, coverImage: upload -> media
  region: city, state, country
  tenant: relationship -> tenants
```

### Contacts (CRM)

```
contacts
  email: email (required, indexed)
  name: text
  source: clerk-lms | manual | csv-import | json-import | signup | referral | api
  sourceId: text (external ID)
  tags[]: text
  contactStatus: lead | invited | accepted | bounced | unsubscribed
  inviteStatus: not-invited | pending | accepted | expired | failed
  lastInvitedAt: date
  inviteCount: number
  notes: textarea
  tenant: relationship -> tenants
```

### LogisticsNodes

```
logistics-nodes
  name: text (required)
  handle: text (auto-generated @handle, unique)
  type: pantry | shelter | dropzone | warehouse | medical | distribution | community_fridge
  governanceMode: regulated | autonomous
  insurancePolicy: upload -> media
  complianceCerts[]: certType, certDoc, expiresAt
  liabilityWaiverSigned: checkbox
  trustScore: number (0-100)
  completedShipments: number
  location: lat, lng, address, city, state, zip
  geohash: text (auto-computed)
  serviceRadius: number (miles)
  inventory[]: item, category, quantity, unit, expiresAt
  needs[]: item, category, quantity, urgency
  status: active | inactive | seasonal
  operatingHours, contactName, contactPhone, contactEmail: text
  tenant: relationship -> tenants
```

---

## Key Hooks

| Hook | Collection | Trigger | Purpose |
|------|-----------|---------|---------|
| `ensureFirstUserIsAdmin` | Users | beforeChange (roles) | Promote first user to super_admin |
| `autoJoinTenantSpaces` | Users | afterChange | Add new users to public spaces |
| `syncUserTenants` | TenantMemberships | afterChange | Sync active memberships to User.tenants |
| `setAuthor` | Messages | beforeChange | Auto-set message author |
| `setTenantFromSpace` | Messages | beforeValidate | Auto-set tenant from space |
| `runWorkflows` | Messages | afterChange | Execute matching channel workflows |
| `autoAnalyzeMedia` | Messages | afterChange | Queue AI media analysis |
| `broadcastToSubscribers` | Messages | afterChange | SSE broadcast |
| `ragIndexHook` | MediaMeta | afterChange | Chunk and index for RAG |
| `generateBeneficiaryTokens` | Endeavors | beforeChange | Auto-generate claim tokens |
| `afterHolonChange` | HolonCapabilities | afterChange | Match waiting Angel Token orders |
| `revalidatePost` | Posts | afterChange | ISR cache revalidation |
| `enforceUniqueEmailPerTenant` | Contacts | beforeValidate | Prevent duplicate contacts |

---

*This document provides the complete data model for Angel OS. Used by LEO and AI agents for understanding system structure.*
