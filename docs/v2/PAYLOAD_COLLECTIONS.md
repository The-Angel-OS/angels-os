# Angel OS Payload Collections - Current Implementation

> **"Multi-Tenant Business Platform + Guardian Angel Network = Ready Player Everyone Infrastructure"**  
> **Payload CMS + ShadCN UI + AI Intelligence = Complete Business Automation**  
> *Sacred architecture for collaborative workspaces, business operations, and human flourishing*

## 🌟 **The Ready Player Everyone Vision**

This document reflects the **current implementation** of Angel OS Payload collections - the technological foundation for Ready Player Everyone, where everyone gets to be the hero through positive action, karma accumulation, and Guardian Angel network participation.

**Angel OS** provides the digital infrastructure to scale this philosophy globally through sophisticated multi-tenant business automation.

**Last Updated:** January 2025 - Based on actual codebase implementation  
**Major Update:** Added Angel OS Network Foundation & Distributed Token Economy

## 🎯 **Current Architecture Overview**

Angel OS is built on a **multi-tenant business platform architecture** that combines **workspace collaboration**, **enterprise management**, and **Guardian Angel automation**. The system provides comprehensive business operations through sophisticated collection relationships.

### **Core Architecture (Currently Implemented)**
```typescript
// Core Platform Collections
interface CorePlatform {
  Tenants: "Multi-tenant organizations with domain management"
  TenantManagement: "Super admin tenant provisioning and management (super admin only)"
  RoadmapFeatures: "Public roadmap with community voting and feature tracking"
  Users: "User accounts with karma system and Guardian Angel status"
  TenantMemberships: "User roles and permissions within tenants"
  SpaceMemberships: "User participation in specific spaces with CRM data"
}

// Angel OS Network Foundation (Distributed System)
interface NetworkFoundation {
  AngelOSNodes: "Distributed network nodes with federation capabilities"
  TenantDistribution: "Tenant distribution across network nodes"
  AngelTokens: "Blockchain transactions for human-worth-based economy"
  TokenBalances: "Current Angel Token balances for users"
}

// Business Operations Collections
interface BusinessOperations {
  Spaces: "Business workspaces with monetization and integrations"
  Messages: "Enhanced messaging with AI analysis and business intelligence"
  Products: "E-commerce with commission tracking and revenue sharing"
  Orders: "Order management with Angel OS revenue distribution"
  Appointments: "Booking system with bay management and commission tracking"
  
  // New MVP Dashboard Collections
  Projects: "Project management with tasks, team members, and progress tracking"
  Tasks: "Task management with dependencies, time tracking, and Kanban workflows"
  Campaigns: "Marketing campaign management with performance metrics and ROI tracking"
  Leads: "Lead management with scoring, qualification, and conversion pipeline"
  Opportunities: "Sales opportunity pipeline with stage management and forecasting"
}

// Enterprise Management Collections
interface EnterpriseManagement {
  Organizations: "Multi-venue business entities"
  Venues: "Physical locations with staff, services, and bay management"
  BusinessAgents: "Guardian Angel AI agents for business automation"
  Events: "Event management with media galleries and attendee tracking"
}

// Content & Communication Collections
interface ContentCommunication {
  Posts: "Content management with SEO and social syndication"
  Pages: "Website pages with flexible layouts and SEO"
  Media: "File management with multi-size image processing"
  Categories: "Hierarchical categorization system"
  Channels: "Intelligence gathering and communication channels"
}

// Specialized Collections
interface SpecializedCollections {
  FormSubmissions: "Dynamic form processing and workflow automation"
  Contacts: "CRM contact management"
  Documents: "Document management and processing"
  Donations: "Charitable giving and fund management"
  Invoices: "Billing and invoice management"
}
```

## 🏢 **Spaces Collection (Current Implementation)**

### **Core Schema**
```typescript
interface SpacesCollection {
  id: string
  name: string
  description?: string
  slug: string
  tenant: Tenant // Required relationship
  
  // AT Protocol Support (Federated Identity)
  atProtocol: {
    did: string // Auto-generated DID
    handle: string // Federated handle
  }
  
  // Business Identity (Core Business Context)
  businessIdentity: {
    type: 'business' | 'creator' | 'service' | 'retail' | 'manufacturing'
    industry: 'general' | 'content-creation' | 'automotive' | 'agriculture' | 'food-beverage' | 'professional-services' | 'retail' | 'technology' | 'healthcare' | 'education'
    companySize: 'solo' | 'small' | 'medium' | 'large'
    targetMarket: 'local' | 'national' | 'international' | 'online'
  }
  
  // Commerce Settings (Enable Business Features)
  commerceSettings: {
    enableEcommerce: boolean
    enableServices: boolean
    enableMerchandise: boolean
    enableSubscriptions: boolean
    paymentMethods: string[]
    shippingZones: string[]
  }
  
  // Creator Monetization (OnlyFans-like Features)
  monetization: {
    enabled: boolean
    subscriptionTiers: {
      name: string
      description: string
      price: number
      currency: string
      features: string[]
      contentAccess: string[]
      stripePriceId: string
    }[]
    donationsEnabled: boolean
    customPricing: {
      enabled: boolean
      defaultPrice: number
      minimumTip: number
    }
    merchantAccount: string
    // Revenue sharing with AI optimization
    revenueAgreementType: 'standard' | 'negotiated' | 'performance' | 'volume' | 'ai-optimized'
    revenuePlatformFee: number // 8-30%
    aiOptEnabled: boolean
    aiOptVersion: string
    aiOptFactors: string[]
  }
  
  // Platform Integrations
  integrations: {
    youtube: {
      channelId: string
      apiKey: string
      autoSync: boolean
    }
    printPartners: {
      name: string
      apiEndpoint: string
      productCatalog: string[]
    }[]
    scheduling: {
      enabled: boolean
      resourceCount: number
      timeSlots: string
    }
    socialBots: {
      platforms: string[] // 40+ platforms supported
      autoPost: boolean
    }
  }
  
  // Theme & Branding
  theme: {
    logo?: Media
    banner?: Media
    primaryColor: string
    secondaryColor: string
    customCSS?: string
  }
  
  // Access Control
  visibility: 'public' | 'invite_only' | 'private'
  memberApproval: 'automatic' | 'manual' | 'disabled'
  inviteSettings: {
    membersCanInvite: boolean
    requireInviteCode: boolean
    inviteCode?: string
  }
  
  // Statistics (Auto-calculated)
  stats: {
    memberCount: number
    messageCount: number
    lastActivity?: Date
    engagementScore?: number
  }
  
  // Consolidated JSON Data (Migration Target)
  data?: SpaceData // JSON field for all space-related data
  
  // Migration Status
  _migrationStatus: {
    jsonMigrated: boolean
    migratedAt?: Date
    migrationVersion?: string
  }
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```

### **Key Features**
- **Multi-tenant isolation** with proper access controls
- **Business type configuration** affecting available features
- **Creator monetization** with subscription tiers and revenue sharing
- **AI-optimized revenue sharing** with dynamic rate adjustment
- **40+ social media platform integrations** for content distribution
- **Print-on-demand partnerships** for merchandise automation
- **AT Protocol support** for federated identity
- **JSON data consolidation** for performance optimization

## 📺 **Channels Collection (Intelligence System)**

### **Core Schema**
```typescript
interface ChannelsCollection {
  id: string
  name: string
  description?: string
  tenantId: string // Required tenant isolation
  guardianAngelId?: string // Guardian Angel assignment
  
  // Channel Classification
  channelType: 'photo_analysis' | 'document_processing' | 'data_collection' | 'monitoring' | 'intelligence_gathering' | 'economic_analysis' | 'chat' | 'communication'
  
  // Report Type
  reportType: 'mileage_log' | 'collection_inventory' | 'business_inventory' | 'equipment_status' | 'asset_tracking' | 'quality_control' | 'maintenance_log' | 'customer_interaction' | 'general'
  
  // Feed Configuration
  feedConfiguration: {
    feedSource: string
    refreshInterval: number
    dataFormat: string
    processingRules: any
  }
  
  // Guardian Angel Integration
  guardianAngelSettings: {
    autoProcess: boolean
    alertThresholds: any
    responseTemplates: string[]
    escalationRules: any
  }
  
  // Intelligence Processing
  intelligenceSettings: {
    aiAnalysis: boolean
    patternRecognition: boolean
    anomalyDetection: boolean
    reportGeneration: boolean
  }
  
  // Business Context
  businessContext: {
    department: string
    priority: 'low' | 'normal' | 'high' | 'critical'
    tags: string[]
    relatedChannels: string[]
  }
  
  // Data Retention
  dataRetention: {
    retentionPeriod: number
    archiveAfter: number
    deleteAfter?: number
    backupEnabled: boolean
  }
  
  // Access Control
  accessControl: {
    visibility: 'public' | 'private' | 'restricted'
    allowedRoles: string[]
    guestAccess: boolean
  }
  
  // Performance Metrics
  metrics: {
    totalReports: number
    processingTime: number
    accuracyScore: number
    lastProcessed: Date
  }
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```

### **Channel Specialization**
- **Intelligence Gathering**: Photo analysis, document processing, data collection
- **Business Operations**: Inventory tracking, equipment monitoring, maintenance logs
- **Guardian Angel Integration**: Automated processing and response systems
- **Multi-tenant Support**: Proper tenant isolation and access controls
- **Report Generation**: Structured data collection and analysis



## 👥 **Space Memberships Collection**

### **Core Schema**
```typescript
interface SpaceMembershipsCollection {
  id: string
  space: Space
  user: User
  
  // Role and permissions
  role: 'owner' | 'admin' | 'member' | 'guest' | 'viewer'
  permissions: {
    canInviteUsers: boolean
    canCreateChannels: boolean
    canManageSpace: boolean
    canAccessAnalytics: boolean
    canExportData: boolean
  }
  
  // Channel-specific permissions
  channelPermissions: {
    channelId: string
    access: 'none' | 'read' | 'write' | 'admin'
  }[]
  
  // Invitation and onboarding
  invitedBy?: User
  invitationStatus: 'pending' | 'accepted' | 'declined'
  onboardingCompleted: boolean
  
  // Activity tracking
  lastActivity: Date
  totalMessages: number
  joinedAt: Date
  
  // Billing and payments (for paid spaces)
  subscription?: {
    plan: string
    status: 'active' | 'past_due' | 'canceled'
    nextBilling: Date
    amount: number
  }
}
```

## 📝 **Posts Collection**

### **Core Schema**
```typescript
interface PostsCollection {
  id: string
  title: string
  content: JSON // Rich text blocks
  excerpt?: string
  publishedAt?: Date
  slug: string
  categories: Category[]
  
  // Multi-tenant support
  tenant: Tenant
  
  // Syndication settings
  syndication: {
    facebook: boolean
    instagram: boolean
    twitter: boolean
    linkedin: boolean
    customPlatforms: string[]
  }
  
  // SEO optimization
  meta: {
    title?: string
    description?: string
    keywords?: string[]
    image?: Media
  }
  
  // Business context
  businessContext: {
    department: 'marketing' | 'sales' | 'operations' | 'support'
    campaign?: string
    callToAction?: string
    targetAudience?: string
  }
  
  // Performance tracking
  analytics: {
    views: number
    engagement: number
    conversions: number
    shares: number
  }
}
```

### **Real-World Applications**
```typescript
const postsUseCases = {
  contentCreator: {
    youtube_videos: "Video descriptions synced to social media"
    blog_posts: "Long-form content with SEO optimization"
    social_updates: "Daily content calendar automation"
    merchandise_announcements: "Product launches and promotions"
  }
  
  serviceBusinesses: {
    case_studies: "Success stories and testimonials"
    educational_content: "Industry tips and best practices"
    service_announcements: "New offerings and updates"
    community_building: "Thought leadership and engagement"
  }
  
  justiceAdvocacy: {
    legal_updates: "Case progress and legal analysis"
    advocacy_campaigns: "Public awareness and education"
    resource_sharing: "Legal guides and information"
    community_mobilization: "Call-to-action and organizing"
  }
}
```

## 📄 **Pages Collection**

### **Core Schema**
```typescript
interface PagesCollection {
  id: string
  title: string
  content: JSON // Rich text blocks
  slug: string
  tenant: Tenant
  
  // Page type and purpose
  pageType: 'landing' | 'service' | 'about' | 'contact' | 'legal' | 'custom'
  
  // SEO and meta
  meta: {
    title?: string
    description?: string
    keywords?: string[]
    image?: Media
    canonical?: string
  }
  
  // Business information
  businessInfo: {
    hours?: string
    location?: string
    contact?: string
    services?: string[]
    pricing?: any
  }
  
  // Layout and design
  layout: {
    template: string
    sections: JSON
    theme: string
    customCSS?: string
  }
  
  // Call-to-action
  cta: {
    primary?: string
    secondary?: string
    bookingEnabled?: boolean
    contactForm?: string
  }
  
  // Analytics
  analytics: {
    views: number
    bounceRate: number
    conversions: number
    averageTime: number
  }
}
```

### **Business Applications**
```typescript
const pagesUseCases = {
  landingPages: {
    service_offerings: "Detailed service descriptions with booking"
    about_us: "Company story and team information"
    contact: "Multiple contact methods and forms"
    pricing: "Transparent pricing with calculator"
  }
  
  legalPages: {
    privacy_policy: "GDPR compliant privacy documentation"
    terms_of_service: "Legal terms and conditions"
    accessibility: "ADA compliance information"
    disclaimers: "Professional liability and limitations"
  }
  
  businessOperations: {
    appointment_booking: "Integrated scheduling system"
    service_areas: "Geographic coverage and availability"
    testimonials: "Customer success stories"
    faq: "Frequently asked questions"
  }
}
```

## 🛍️ **Products Collection**

### **Core Schema**
```typescript
interface ProductsCollection {
  id: string
  name: string
  description: JSON
  tenant: Tenant
  
  // Product type and category
  type: 'physical' | 'digital' | 'service' | 'subscription' | 'booking'
  category: Category
  
  // Pricing and variants
  pricing: {
    basePrice: number
    currency: string
    variants: {
      name: string
      price: number
      sku: string
      inventory?: number
    }[]
    subscription?: {
      interval: 'monthly' | 'yearly'
      trialPeriod?: number
    }
  }
  
  // Media and presentation
  media: {
    images: Media[]
    videos: Media[]
    documents: Media[]
    primaryImage: Media
  }
  
  // Inventory management
  inventory: {
    trackInventory: boolean
    currentStock?: number
    lowStockThreshold?: number
    allowBackorders?: boolean
  }
  
  // Service/booking specific
  serviceDetails?: {
    duration: number
    availability: JSON
    requirements: string[]
    location: 'onsite' | 'remote' | 'both'
  }
  
  // E-commerce integration
  ecommerce: {
    shippingRequired: boolean
    taxable: boolean
    weight?: number
    dimensions?: {
      length: number
      width: number
      height: number
    }
  }
  
  // SEO and marketing
  seo: {
    slug: string
    metaTitle?: string
    metaDescription?: string
    keywords?: string[]
  }
  
  // Analytics and performance
  analytics: {
    views: number
    purchases: number
    revenue: number
    conversionRate: number
  }
}
```

### **Universal Product Types**
```typescript
const productTypes = {
  physicalProducts: {
    merchandise: "T-shirts, mugs, branded items"
    inventory: "Parts, supplies, equipment"
    retail: "Consumer goods and products"
    crafts: "Handmade and artisanal items"
  }
  
  digitalProducts: {
    courses: "Online education and training"
    software: "Apps, tools, and digital solutions"
    media: "Videos, music, photos, art"
    documents: "Templates, guides, resources"
  }
  
  services: {
    consulting: "Professional advice and expertise"
    contracting: "Physical work and installations"
    maintenance: "Ongoing support and care"
    creative: "Design, writing, marketing services"
  }
  
  subscriptions: {
    memberships: "Ongoing access and benefits"
    software_licenses: "SaaS and tool subscriptions"
    content_access: "Premium content and features"
    support_plans: "Ongoing assistance and maintenance"
  }
}
```

## 💬 **Messages Collection (Enhanced Messaging System)**

### **Core Schema**
```typescript
interface MessagesCollection {
  id: string
  content: MessageContent // Enhanced JSON content structure
  
  // Core Relationships
  sender: User // Required - who sent the message
  space: Space // Required - which space
  channel?: Channel // Optional - specific channel
  
  // Message Classification
  messageType: 'user' | 'leo' | 'system' | 'action' | 'intelligence'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  
  // Enhanced Context Systems
  conversationContext?: ConversationContext // Conversation state and context
  businessIntelligence?: BusinessIntelligenceData // BI data and insights
  
  // Thread Management
  threadId?: string // Thread identifier
  replyToId?: Message // Direct reply relationship
  
  // Engagement Tracking
  readBy: User[] // Users who have read this message
  reactions: JSON // Flexible reaction structure
  
  // Media Attachments
  attachments: Media[] // Related media files
  
  // AT Protocol Integration
  atProtocol: {
    type: string // Default: 'co.kendev.spaces.message'
    did?: string // Decentralized identifier
    uri?: string // AT Protocol URI
    cid?: string // Content identifier
  }
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}

// Enhanced Content Structure
interface MessageContent {
  type: 'text' | 'rich' | 'system' | 'widget' | 'action'
  text?: string
  html?: string
  widgets?: DynamicWidget[]
  systemData?: SystemMessageData
  actionData?: ActionMessageData
  metadata?: MessageMetadata
}

// Conversation Context
interface ConversationContext {
  sessionId?: string
  intent?: string
  phase?: string
  history?: any[]
  customerData?: any
  productContext?: any
  siteContext?: any
}

// Business Intelligence Data
interface BusinessIntelligenceData {
  sentiment?: 'positive' | 'negative' | 'neutral'
  intent?: string
  entities?: any[]
  confidence?: number
  suggestedActions?: string[]
  leadScore?: number
  customerJourney?: 'awareness' | 'consideration' | 'purchase' | 'retention'
  department?: 'sales' | 'marketing' | 'operations' | 'support' | 'finance'
  workflow?: string
}
```

### **Key Features**
- **Enhanced JSON Content**: Flexible content structure supporting widgets, actions, and rich media
- **Business Intelligence**: Embedded sentiment analysis, lead scoring, and customer journey tracking
- **Conversation Context**: Maintains conversation state and customer data across interactions
- **AT Protocol Support**: Federated messaging with decentralized identifiers
- **Advanced Threading**: Support for complex conversation threading and replies
- **AI Analysis**: Automated content analysis for business insights

## 👤 **Users Collection (Karma System & Guardian Angels)**

### **Core Schema**
```typescript
interface UsersCollection {
    id: string
  email: string // Required, unique
  firstName: string
  lastName: string
  profileImage?: Media
  
  // Multi-tenant Support
  tenant?: Tenant // Optional tenant relationship
  
  // Role & Permissions System
  roles: ('admin' | 'editor' | 'contributor' | 'subscriber' | 'guardian_angel')[]
  
  // Angel OS Karma System
  karma: {
    score: number // Auto-calculated, read-only
    contributionTypes: ('content_creation' | 'community_support' | 'technical_contribution' | 'mentorship' | 'justice_advocacy' | 'guardian_angel')[]
    recognitions: {
      type: 'helpful_response' | 'quality_content' | 'community_leadership' | 'technical_excellence' | 'guardian_angel_action'
      points: number
      reason?: string
      awardedBy: User
      awardedAt: Date
    }[]
    guardianAngelStatus: boolean // Auto-assigned at 1000+ karma
  }
  
  // Multi-Tenant Memberships (JSON to avoid circular refs)
  tenantMemberships: JSON // Array of tenant membership data
  
  // User Preferences
  preferences: {
    notifications: {
      email: boolean
      inApp: boolean
      guardianAngelAlerts: boolean
    }
    privacy: {
      profileVisibility: 'public' | 'members' | 'private'
      karmaScoreVisible: boolean
    }
  }
  
  // Activity Tracking
  lastLoginAt?: Date // Auto-updated
  
  // Auth System
  password: string // Hashed
  verified: boolean
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```

### **Key Features**
- **Karma System**: Points-based recognition system with Guardian Angel status
- **Multi-tenant Support**: Users can belong to multiple tenants with different roles
- **Role-based Access**: Hierarchical permission system
- **Guardian Angel Network**: Special status for high-karma contributors
- **Privacy Controls**: User-configurable visibility settings

## 🏢 **Tenants Collection (Multi-Tenant Organizations)**

### **Core Schema**
```typescript
interface TenantsCollection {
  id: string
    name: string
  domain: string // Primary domain
  slug: string // URL-friendly identifier
  
  // Domain Management (DotNetNuke-style)
  domainAliases: {
    domain: string
    type: 'subdomain' | 'custom' | 'development' | 'staging'
    isActive: boolean
    isPrimary: boolean
  }[]
  
  // Business Classification
  businessType: 'dumpster-rental' | 'bedbug-treatment' | 'salon' | 'cactus-farm' | 'retail' | 'service' | 'other'
  
  // Revenue Sharing Configuration
  revenueSharing: {
    enabled: boolean
    defaultRate: number // Platform fee percentage
    agreementType: 'standard' | 'negotiated' | 'performance'
    contractId?: string
    effectiveDate?: Date
    reviewDate?: Date
  }
  
  // Platform Settings
  settings: {
    allowPublicSignup: boolean
    requireEmailVerification: boolean
    enableKarmaSystem: boolean
    enableGuardianAngels: boolean
    customBranding: boolean
  }
  
  // Branding & Customization
  branding: {
    logo?: Media
    primaryColor?: string
    secondaryColor?: string
    customCSS?: string
    favicon?: Media
  }
  
  // Subscription & Billing
  subscription: {
    plan: 'free' | 'basic' | 'professional' | 'enterprise'
    status: 'active' | 'past_due' | 'canceled' | 'trialing'
    currentPeriodStart: Date
    currentPeriodEnd: Date
    stripeCustomerId?: string
  }
  
  // Status
  status: 'active' | 'suspended' | 'pending' | 'archived'
  
  // Usage Limits
  limits: {
    maxUsers: number
    maxSpaces: number
    maxStorage: number // in MB
    maxApiCalls: number
  }
  
  // Analytics
  analytics: {
    totalUsers: number
    activeUsers: number
    totalSpaces: number
    storageUsed: number
    lastActivity?: Date
  }
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```

### **Key Features**
- **Multi-domain Support**: Primary domain plus unlimited aliases
- **Business Type Configuration**: Affects available features and templates
- **Revenue Sharing**: Configurable platform fees and agreement types
- **Subscription Management**: Integrated billing and usage limits
- **Custom Branding**: Full white-label capabilities

## 🛒 **Products Collection (E-commerce with Commission Tracking)**

### **Core Schema**
```typescript
interface ProductsCollection {
  id: string
  title: string
  description?: string
  slug: string
  tenant: Tenant // Required multi-tenant relationship
  
  // Product Classification
  productType: 'ai_print_demand' | 'consultation_solo' | 'group_event' | 'livekit_stream' | 'digital_download' | 'physical' | 'subscription' | 'course_training' | 'business_service' | 'automation'
  
  // Media Gallery
  gallery: {
    image: Media
    alt: string
    caption?: string
  }[]
  
  // Pricing Structure
  pricing: {
    basePrice: number
    salePrice?: number
    compareAtPrice?: number
    currency: 'USD' | 'EUR' | 'GBP' | 'CAD'
  }
  
  // Inventory Management
  inventory: {
    trackQuantity: boolean
    quantity?: number
    lowStockThreshold?: number
    allowBackorder?: boolean
  }
  
  // Commission & Revenue (Angel OS Revenue Sharing)
  commission: {
    useCustomRate: boolean
    customCommissionRate?: number
    sourceMultipliers: {
      systemGenerated: number // 1.0 = base rate
      pickupJob: number // 0.5 = half rate
      referralSource: number // 1.5 = 150% rate
    }
  }
  
  // Commission Rate Templates (Auto-calculated by product type)
  commissionTemplate: {
    defaultRate: number // Auto-calculated based on productType
    rationale: string // Explanation of rate
  }
  
  // Service Details (for service-based products)
  serviceDetails?: {
    duration?: number // minutes
    location?: 'onsite' | 'remote' | 'customer' | 'flexible'
    maxParticipants?: number
    bookingRequired: boolean
  }
  
  // Digital Assets (for digital products)
  digitalAssets?: {
    file: Media
    name: string
    description?: string
  }[]
  
  // Shipping (for physical products)
  shipping?: {
    requiresShipping: boolean
    freeShipping: boolean
    shippingClass?: 'standard' | 'heavy' | 'fragile' | 'hazardous' | 'cold'
  }
  
  // Physical Details
  details?: {
    weight?: number
    dimensions?: {
      length: number
      width: number
      height: number
      unit: 'in' | 'cm' | 'ft' | 'm'
    }
  }
  
  // Organization
  categories: Category[]
  tags: { tag: string }[]
  relatedProducts: Product[]
  
  // Content Management
  layout?: JSON // Flexible content blocks
  
  // SEO
  meta: {
    title?: string
    description?: string
    image?: Media
    keywords?: string
  }
  
  // Status
  status: 'draft' | 'active' | 'archived' | 'out_of_stock'
  featured: boolean
  publishedAt?: Date
  
  // SKU
  sku?: string // Unique identifier
  
  // Variants
  hasVariants: boolean
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```

### **Key Features**
- **Commission Rate Templates**: Auto-calculated rates based on product type (15% for AI print-on-demand, 8% for consultations, etc.)
- **Source-based Rate Multipliers**: Different commission rates based on how the sale was acquired
- **Multi-type Support**: Physical products, digital downloads, services, subscriptions, and AI-generated merchandise
- **Flexible Content**: Block-based layout system for rich product descriptions
- **Multi-tenant Isolation**: Products belong to specific tenants

## 📦 **Orders Collection (Angel OS Revenue Distribution)**

### **Core Schema**
```typescript
interface OrdersCollection {
  id: string
  orderNumber: string // Auto-generated unique identifier
  tenant: Tenant // Required multi-tenant relationship
  customer: User // Required customer relationship
  
  // Order Status
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded'
  
  // Line Items
  lineItems: {
    product: Product
    quantity: number
    unitPrice: number
    totalPrice: number
    productSnapshot: JSON // Product details at time of purchase
  }[]
  
  // Order Totals
  subtotal: number
  taxAmount: number
  shippingAmount: number
  discountAmount: number
  totalAmount: number
  currency: string
  
  // Angel OS Revenue Sharing (Auto-calculated)
  revenueDistribution: {
    aiPartner: number // 15%
    humanPartner: number // 30%
    platformOperations: number // 50%
    justiceRund: number // 5% (typo in original - should be Fund)
    calculatedAt: Date
  }
  
  // Payment Information
  paymentStatus: 'pending' | 'authorized' | 'captured' | 'partially_refunded' | 'refunded' | 'failed'
  paymentDetails: {
    paymentMethod?: 'credit_card' | 'paypal' | 'stripe' | 'bank_transfer' | 'crypto'
    transactionId?: string
    last4?: string
    paymentProcessedAt?: Date
  }
  
  // Fulfillment
  fulfillment: {
    method: 'digital' | 'physical' | 'service' | 'pickup'
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'completed'
    trackingNumber?: string
    carrier?: 'ups' | 'fedex' | 'usps' | 'dhl' | 'other'
    shippedAt?: Date
    deliveredAt?: Date
    estimatedDelivery?: Date
  }
  
  // Addresses
  shippingAddress?: {
    name?: string
    company?: string
    address1?: string
    address2?: string
    city?: string
    state?: string
    postalCode?: string
    country: string
    phone?: string
  }
  
  billingAddress?: {
    sameAsShipping: boolean
    name?: string
    company?: string
    address1?: string
    address2?: string
    city?: string
    state?: string
    postalCode?: string
    country: string
  }
  
  // Notes
  customerNotes?: string
  internalNotes?: string
  
  // Metadata
  metadata?: JSON
  
  // Key Timestamps
  placedAt: Date
  completedAt?: Date
  cancelledAt?: Date
  
  // System Timestamps
    createdAt: Date
  updatedAt: Date
}
```

### **Key Features**
- **Angel OS Revenue Distribution**: Automatic 15/30/50/5 split (AI Partner/Human Partner/Platform/Justice Fund)
- **Multi-tenant Order Management**: Orders belong to specific tenants
- **Comprehensive Fulfillment**: Support for digital, physical, service, and pickup orders
- **Payment Integration**: Support for multiple payment processors
- **Address Management**: Separate billing and shipping addresses

## 📅 **Appointments Collection (Bay Management & Commission Tracking)**

### **Core Schema**
```typescript
interface AppointmentsCollection {
  id: string
  title: string
  description?: string
  
  // Participants
  organizer: User // Required
  attendees: User[]
  
  // Location & Venue
  space?: Space
  venue?: Venue
  location?: string
  
  // Bay/Station Management
  bayAssignment: {
    assignedBay?: string
    bayRequired: boolean
    canFloatBays: boolean
  }
  
  // Multi-tenant
  tenant: Tenant // Required
  
  // Scheduling
  startTime: Date
  endTime: Date
  timezone: string
  
  // Recurrence
  recurrence?: {
    enabled: boolean
    type?: 'daily' | 'weekly' | 'monthly'
    interval?: number
    endDate?: Date
  }
  
  // Meeting Details
  meetingType: 'in_person' | 'video_call' | 'phone_call' | 'hybrid'
  meetingLink?: string
  
  // Appointment Type
  appointmentType: 'standard_install' | 'custom_install' | 'quote_consultation' | 'mobile_service' | 'beauty_service' | 'barber_service' | 'auto_repair' | 'diagnostic' | 'general_meeting' | 'consultation'
  
  // Booking Settings
  bookingSettings: {
    allowRescheduling: boolean
    allowCancellation: boolean
    requireConfirmation: boolean
    bufferTime: number // minutes
    maxAttendees?: number
  }
  
  // Status
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  notes?: string
  
  // Revenue & Commission Tracking
  revenueTracking: {
    source: 'system_generated' | 'pickup_job' | 'referral_source' | 'repeat_customer'
    commissionRate?: number // Auto-calculated based on source
    commissionAmount?: number // Auto-calculated
  }
  
  // Payment (for paid consultations)
  payment?: {
    required: boolean
    amount?: number
    currency?: 'usd' | 'eur' | 'gbp' | 'cad'
    stripePaymentIntentId?: string
    paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded'
  }
  
  // Post-appointment Feedback
  feedback?: {
    organizerRating?: number // 1-5 stars
    attendeeRating?: number // Average rating
    organizerNotes?: string
    followUpRequired: boolean
  }
  
  // Integration
  calendarEventId?: string
  remindersSent: { sentAt: Date }[]
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```

### **Key Features**
- **Bay/Station Management**: Support for multi-bay venues (car audio shops, beauty salons)
- **Commission Tracking**: Different rates based on appointment source (system vs pickup vs referral)
- **Multi-venue Support**: Integration with venue and space systems
- **Payment Integration**: Support for paid consultations with Stripe
- **Comprehensive Scheduling**: Recurrence, time zones, buffer times
- **Feedback System**: Post-appointment ratings and follow-up tracking

## 🏢 **TenantMemberships Collection (User-Tenant Relationships)**

### **Core Schema**
```typescript
interface TenantMembershipsCollection {
  id: string
  user: User // Required
  tenant: Tenant // Required
  
  // Role & Permissions
  role: 'tenant_admin' | 'tenant_manager' | 'tenant_member'
  permissions: ('manage_users' | 'manage_spaces' | 'manage_content' | 'manage_products' | 'manage_orders' | 'view_analytics' | 'manage_settings' | 'manage_billing' | 'export_data')[]
  
  // Membership Details
  joinedAt: Date
  invitedBy?: User
  status: 'active' | 'pending' | 'suspended' | 'revoked'
  
  // Tenant-specific Profile
  tenantProfile?: {
    displayName?: string
    tenantBio?: string
    department?: string
    position?: string
  }
  
  // Invitation Details (for pending memberships)
  invitationDetails?: {
    invitationToken: string // Auto-generated
    invitationExpiresAt?: Date
    invitationMessage?: string
  }
  
  // Activity Tracking
  lastActiveAt?: Date
  activityMetrics: {
    loginCount: number
    spacesJoined: number
    contentCreated: number
  }
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```

### **Key Features**
- **Role-based Access**: Hierarchical permissions within tenants
- **Invitation System**: Token-based invitations with expiration
- **Activity Tracking**: Monitor user engagement within tenants
- **Tenant-specific Profiles**: Custom display names and roles per tenant

## 🏢 **SpaceMemberships Collection (User-Space Relationships with CRM)**

### **Core Schema**
```typescript
interface SpaceMembershipsCollection {
  id: string
  user: User // Required
  space: Space // Required
  tenantMembership?: TenantMembership // Related tenant membership
  
  // Role & Permissions
  role: 'space_admin' | 'moderator' | 'member' | 'guest'
  customPermissions: ('post_messages' | 'upload_files' | 'create_events' | 'moderate_content' | 'manage_members' | 'view_analytics' | 'manage_bookings' | 'access_private')[]
  
  // Membership Status
  status: 'active' | 'pending' | 'suspended' | 'left' | 'banned'
  joinedAt: Date
  
  // CRM Integration
  crmData: {
    leadScore?: number // 0-100
    customerTier?: 'prospect' | 'lead' | 'customer' | 'vip'
    tags: string[]
    notes?: string
    lastInteraction?: Date
    conversionEvents: {
      event: string
      timestamp: Date
      value?: number
    }[]
  }
  
  // Engagement Metrics (Auto-calculated)
  engagementMetrics: {
    messagesCount: number
    lastActive?: Date
    totalTimeSpent: number // minutes
    contentCreated: number
    eventsAttended: number
    engagementScore: number // 0-100, auto-calculated
  }
  
  // Notification Settings
  notificationSettings: {
    mentions: boolean
    directMessages: boolean
    announcements: boolean
    events: boolean
  }
  
  // Space-specific Profile
  spaceProfile?: {
    displayName?: string
    spaceBio?: string
    interests: string[]
  }
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```

### **Key Features**
- **CRM Integration**: Lead scoring, customer tiers, and conversion tracking
- **Engagement Scoring**: Auto-calculated engagement metrics
- **Granular Permissions**: Custom permissions per space
- **Notification Management**: User-controlled notification preferences

## 🏢 **Organizations Collection (Multi-Venue Business Entities)**

### **Core Schema**
```typescript
interface OrganizationsCollection {
  id: string
  name: string
  description?: string
  
  // Organization Type
  organizationType: 'franchise' | 'corporate' | 'partnership' | 'sole_proprietorship' | 'non_profit'
  
  // Business Details
  industry: string
  website?: string
  
  // Contact Information
  contactInfo: {
    email?: string
    phone?: string
    address?: {
      street: string
      city: string
      state: string
      zipCode: string
      country: string
    }
  }
  
  // Branding
  branding: {
    logo?: Media
    primaryColor?: string
    secondaryColor?: string
  }
  
  // Status
  status: 'active' | 'inactive' | 'pending' | 'suspended'
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```

## 🏢 **Venues Collection (Physical Locations with Bay Management)**

### **Core Schema**
```typescript
interface VenuesCollection {
  id: string
  name: string
  organization: Organization // Required
  
  // Venue Classification
  venueType: 'car_audio_shop' | 'beauty_shop' | 'barber_shop' | 'auto_shop' | 'medical_practice' | 'franchise_location' | 'service_territory' | 'mobile_route' | 'corporate_office' | 'warehouse' | 'retail' | 'virtual'
  
  // Location Details
  location: {
    address: {
      street: string
      suite?: string
      city: string
      state: string
      zipCode: string
      country: string
    }
    coordinates?: {
      latitude: number
      longitude: number
    }
    serviceRadius?: number // miles
    timezone: string
  }
  
  // Contact Information
  contactInfo: {
    phone?: string
    fax?: string
    email?: string
    emergencyContact?: string
    afterHoursContact?: string
  }
  
  // Operating Hours
  businessHours: {
    schedule: {
      dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
      openTime?: string
      closeTime?: string
      isClosed: boolean
      isEmergencyOnly: boolean
    }[]
    specialHours: {
      date: Date
      description?: string
      openTime?: string
      closeTime?: string
      isClosed: boolean
    }[]
  }
  
  // Staff Management
  staff: {
    user: User
    role: 'venue_manager' | 'car_audio_installer' | 'beauty_technician' | 'barber_stylist' | 'auto_mechanic' | 'medical_provider' | 'nurse' | 'admin_staff' | 'technician' | 'service_provider' | 'sales_rep' | 'customer_service'
    title?: string
    specialties: { specialty: string }[]
    workStation?: {
      assignedBay?: string
      canFloatBays: boolean
      primaryBay: boolean
    }
    freelanceSettings?: {
      canFreelance: boolean
      freelanceBookingUrl?: string
      freelanceCommissionRate?: number
      onClockPriority: boolean
    }
    isActive: boolean
  }[]
  
  // Services Offered
  services: {
    serviceName: string
    description?: string
    duration?: number // minutes
    price?: number
    isActive: boolean
    requiresAppointment: boolean
    category?: string
    serviceType: 'standard_install' | 'custom_install' | 'quote_consultation' | 'mobile_service' | 'beauty_service' | 'barber_service' | 'auto_repair' | 'diagnostic' | 'general_service'
    requiresBay: boolean
  }[]
  
  // Bay/Station Management
  bayManagement?: {
    totalBays: number
    bays: {
      bayName: string
      bayType: 'install_bay' | 'service_bay' | 'beauty_chair' | 'barber_chair' | 'wash_station' | 'diagnostic_station' | 'general_workstation'
      isActive: boolean
      equipment?: string
      notes?: string
    }[]
    allowMultipleBays: boolean
    bayBookingBuffer: number // minutes
  }
  
  // Guardian Angel Assignment
  guardianAngel?: {
    assignedAngel?: BusinessAgent
    custom?: {
      greeting?: string
      services: {
        service: string
        description?: string
      }[]
    }
  }
  
  // Status
  isActive: boolean
  status: 'active' | 'inactive' | 'temp_closed' | 'under_construction' | 'pending' | 'suspended'
  notes?: string
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```

### **Key Features**
- **Multi-bay Management**: Support for car audio shops, beauty salons with multiple work stations
- **Staff Scheduling**: Complex staff management with bay assignments and freelance capabilities
- **Service Management**: Detailed service offerings with pricing and requirements
- **Guardian Angel Integration**: AI agent assignment for customer service

## 🎆 **Events Collection (Event Management with Media Galleries)**

### **Core Schema**
```typescript
interface EventsCollection {
  id: string
  title: string
  description?: string
  tenant: Tenant // Multi-tenant support
  
  // Event Classification
  eventType: string
  
  // Scheduling
  eventDate: Date
  startTime?: string
  endTime?: string
  timezone: string
  
  // Location
  venue?: Venue
  location?: string
  
  // Visibility
  isPublic: boolean
  
  // Media Gallery
  media: {
    heroImage?: Media
    eventPhotos: Media[]
    promotionalVideos: Media[]
    documents: Media[]
    socialContent: Media[]
  }
  
  // Attendee Statistics
  attendeeStats: {
    expectedAttendees?: number
    actualAttendees?: number
    noShows?: number
    waitlistSize?: number
  }
  
  // Status
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```

## 📋 **Projects Collection (Project Management)**

### **Core Schema**
```typescript
interface Project {
  name: string                    // Project name/title
  description: RichText          // Detailed project description
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'critical'
  dates: {
    startDate?: Date             // Project start date
    endDate?: Date               // Project end date
    actualEndDate?: Date         // Actual completion date
  }
  budget: {
    estimatedBudget?: number     // Estimated project budget
    actualBudget?: number        // Actual project cost
    currency: 'usd' | 'eur' | 'gbp'
  }
  team: {
    projectManager?: User        // Primary project manager
    teamMembers?: User[]         // Project team members
    stakeholders?: Contact[]     // External stakeholders
  }
  progress: {
    completionPercentage: number // 0-100% completion
    tasksTotal: number          // Auto-calculated
    tasksCompleted: number      // Auto-calculated
    hoursEstimated?: number     // Total estimated hours
    hoursActual: number         // Auto-calculated from tasks
  }
  tags?: Category[]             // Project tags
  attachments?: Media[]         // Project documents
  space?: Space                 // Associated workspace
  tenant: Tenant               // Multi-tenant isolation
}
```

### **Key Features**
- **Task Integration**: Automatic progress calculation from linked tasks
- **Budget Tracking**: Estimated vs actual cost monitoring
- **Team Management**: Project managers, members, and stakeholders
- **Progress Metrics**: Real-time completion percentage and hour tracking
- **Multi-tenant**: Full tenant isolation with proper access controls

---

## ✅ **Tasks Collection (Task Management)**

### **Core Schema**
```typescript
interface Task {
  title: string                 // Task title/summary
  description: RichText        // Detailed task requirements
  status: 'todo' | 'in-progress' | 'review' | 'blocked' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  project?: Project            // Associated project
  assignee?: User              // Task assignee
  reporter?: User              // Task creator (auto-assigned)
  dates: {
    dueDate?: Date             // Task due date
    startDate?: Date           // Task start date
    completedDate?: Date       // Auto-set when completed
  }
  timeTracking: {
    estimatedHours?: number    // Estimated completion time
    actualHours: number        // Actual time worked
    timeEntries: Array<{       // Detailed time tracking
      date: Date
      hours: number
      description?: string
      user: User
    }>
  }
  dependencies: {
    blockedBy?: Task[]         // Tasks blocking this one
    blocks?: Task[]            // Tasks this one blocks
    relatedTasks?: Task[]      // Related tasks
  }
  labels: Array<'bug' | 'feature' | 'enhancement' | 'documentation' | 'testing' | 'research' | 'design' | 'backend' | 'frontend'>
  attachments?: Media[]        // Task files
  comments: Array<{           // Task discussion
    content: RichText
    author: User
    isInternal: boolean       // Internal vs client-visible
  }>
  tenant: Tenant              // Multi-tenant isolation
}
```

### **Key Features**
- **Project Integration**: Auto-updates project progress metrics
- **Time Tracking**: Detailed time entries with user attribution
- **Dependencies**: Task blocking and relationship management
- **Kanban Ready**: Status-based workflow for board views
- **Comments**: Internal and external communication tracking

---

## 📢 **Campaigns Collection (Marketing Campaign Management)**

### **Core Schema**
```typescript
interface Campaign {
  name: string                 // Campaign name/title
  description: RichText       // Campaign objectives
  type: 'email' | 'social' | 'ads' | 'content' | 'seo' | 'influencer' | 'event' | 'direct-mail' | 'referral'
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled'
  dates: {
    startDate?: Date           // Campaign start
    endDate?: Date             // Campaign end
    launchDate?: Date          // Actual launch date
  }
  budget: {
    totalBudget?: number       // Total campaign budget
    spentBudget: number        // Amount spent
    currency: 'usd' | 'eur' | 'gbp'
    costPerClick?: number      // Target CPC
    costPerAcquisition?: number // Target CPA
  }
  targeting: {
    targetAudience: RichText   // Audience description
    demographics: {
      ageRange?: string        // e.g., "25-45"
      gender: 'all' | 'male' | 'female' | 'non-binary'
      locations: string[]      // Target locations
      interests: string[]      // Target interests
    }
  }
  content: {
    creativeAssets?: Media[]   // Campaign assets
    copyVariations: Array<{    // A/B testing variations
      headline: string
      description?: string
      callToAction?: string
      variation?: string       // "A", "B", "Control"
    }>
    landingPages?: Page[]      // Campaign landing pages
  }
  metrics: {                   // Performance tracking (auto-calculated)
    impressions: number
    clicks: number
    conversions: number
    leads: number
    sales: number
    revenue: number
    clickThroughRate: number   // Auto-calculated %
    conversionRate: number     // Auto-calculated %
    returnOnAdSpend: number    // Auto-calculated ROAS
    costPerLead: number        // Auto-calculated
  }
  team: {
    campaignManager?: User     // Campaign manager
    teamMembers?: User[]       // Team members
    approvers?: User[]         // Approval workflow
  }
  integrations: {              // External platform IDs
    googleAdsId?: string
    facebookAdId?: string
    mailchimpId?: string
    trackingPixels: Array<{
      platform: string
      pixelId: string
    }>
  }
  notes: RichText             // Campaign observations
  tenant: Tenant             // Multi-tenant isolation
}
```

### **Key Features**
- **Multi-Channel**: Support for all major marketing channels
- **Performance Tracking**: Comprehensive metrics with auto-calculation
- **A/B Testing**: Copy variation management
- **Integration Ready**: External platform ID tracking
- **ROI Focused**: Automatic ROAS and cost-per-lead calculation

---

## 🎯 **Leads Collection (Lead Management & Qualification)**

### **Core Schema**
```typescript
interface Lead {
  fullName: string            // Auto-generated from first + last
  firstName: string           // Lead first name
  lastName: string            // Lead last name
  email: string               // Primary email (unique)
  phone?: string              // Primary phone
  company?: string            // Company/organization
  jobTitle?: string           // Job title/position
  source: 'website' | 'referral' | 'social' | 'email' | 'trade-show' | 'cold-outreach' | 'webinar' | 'content' | 'search' | 'partner' | 'other'
  sourceDetails: {
    campaign?: Campaign        // Associated campaign
    referrerName?: string      // Referrer name
    landingPage?: Page         // Conversion page
    utmSource?: string         // UTM tracking
    utmMedium?: string
    utmCampaign?: string
  }
  status: 'new' | 'contacted' | 'qualified' | 'unqualified' | 'nurturing' | 'opportunity' | 'customer' | 'lost'
  scoring: {
    score: number             // Overall score (0-100)
    behaviorScore: number     // Engagement-based (0-50)
    demographicScore: number  // Fit-based (0-50)
    engagementLevel: 'cold' | 'warm' | 'hot'  // Auto-set based on score
    qualificationCriteria: Array<{
      criterion: string
      met: boolean
      weight: number          // 1-10 importance
    }>
  }
  interests: {
    products?: Product[]       // Interested products
    services: Array<{
      service: string
      priority: 'low' | 'medium' | 'high'
    }>
    budget: {
      range?: 'under-1k' | '1k-5k' | '5k-10k' | '10k-25k' | '25k-50k' | 'over-50k'
      timeframe?: 'immediate' | '1-month' | '3-months' | '6-months' | '1-year' | 'no-timeline'
    }
  }
  assignedTo?: User           // Sales representative
  activities: Array<{         // Interaction history
    type: 'email' | 'call' | 'meeting' | 'website-visit' | 'content-download' | 'form-submission' | 'social' | 'note'
    subject: string
    description?: RichText
    outcome?: 'positive' | 'neutral' | 'negative' | 'no-response'
    nextAction?: string
    scheduledDate?: Date
    user: User
  }>
  notes: RichText            // General notes
  tags?: Category[]          // Lead tags
  tenant: Tenant            // Multi-tenant isolation
}
```

### **Key Features**
- **Lead Scoring**: Automatic scoring with behavior + demographic components
- **Source Tracking**: Complete attribution with UTM parameter capture
- **Activity Timeline**: Comprehensive interaction history
- **Qualification Workflow**: Customizable criteria with weighted scoring
- **Auto-Conversion**: Creates opportunities when status changes to 'opportunity'

---

## 💼 **Opportunities Collection (Sales Pipeline Management)**

### **Core Schema**
```typescript
interface Opportunity {
  name: string                // Opportunity name/title
  description: RichText      // Detailed opportunity description
  contact?: Contact          // Primary contact
  account: {
    company?: string         // Company name
    industry?: 'technology' | 'healthcare' | 'finance' | 'manufacturing' | 'retail' | 'education' | 'government' | 'non-profit' | 'other'
    size?: '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+'
  }
  value: {
    amount: number           // Opportunity value
    currency: 'usd' | 'eur' | 'gbp'
    recurringRevenue: boolean // Is this recurring?
    recurringPeriod?: 'monthly' | 'quarterly' | 'annually'
  }
  stage: 'prospecting' | 'qualification' | 'needs-analysis' | 'proposal' | 'negotiation' | 'decision' | 'closed-won' | 'closed-lost'
  probability: number        // 0-100% (auto-set based on stage)
  dates: {
    expectedCloseDate?: Date // Expected close
    actualCloseDate?: Date   // Auto-set when closed
    lastContactDate?: Date   // Last contact
    nextFollowUp?: Date      // Next scheduled follow-up
  }
  assignedTo?: User          // Sales representative
  team: {
    members?: User[]         // Team members
    decisionMakers: Array<{  // Stakeholder mapping
      name: string
      role?: string
      influence: 'champion' | 'decision-maker' | 'influencer' | 'gatekeeper' | 'user'
      sentiment: 'strongly-positive' | 'positive' | 'neutral' | 'negative' | 'strongly-negative'
    }>
  }
  products: {
    interestedProducts?: Product[] // Products of interest
    proposedSolution: RichText     // Solution details
    competitorAnalysis: Array<{
      competitor: string
      strengths?: string
      weaknesses?: string
      pricing?: number
    }>
  }
  activities: Array<{        // Opportunity timeline
    type: 'email' | 'call' | 'meeting' | 'presentation' | 'proposal-sent' | 'contract-sent' | 'demo' | 'site-visit' | 'note'
    subject: string
    description?: RichText
    outcome?: 'very-positive' | 'positive' | 'neutral' | 'negative' | 'very-negative'
    nextSteps?: string
    user: User
  }>
  lossReason?: {             // If closed-lost
    reason: 'price' | 'competitor' | 'no-budget' | 'no-decision' | 'timing' | 'not-fit' | 'lost-contact' | 'other'
    details?: string
    lessonsLearned?: string
  }
  attachments?: Media[]      // Proposals, contracts
  notes: RichText           // General notes
  tenant: Tenant           // Multi-tenant isolation
}
```

### **Key Features**
- **Pipeline Management**: Stage-based workflow with auto-probability setting
- **Stakeholder Mapping**: Decision maker influence and sentiment tracking
- **Competitor Analysis**: Competitive intelligence tracking
- **Auto-Integration**: Creates orders when closed-won
- **Loss Analysis**: Detailed loss reasons for continuous improvement

---

## 🗺️ **Roadmap Features Collection (Public Roadmap)**

### **Core Schema**
```typescript
interface RoadmapFeature {
  title: string              // Feature name
  description: RichText     // Feature description and benefits
  category: 'dashboard' | 'crm' | 'ecommerce' | 'communication' | 'productivity' | 'system' | 'integrations' | 'mobile' | 'api' | 'security' | 'performance' | 'ui-ux'
  status: 'consideration' | 'planned' | 'in-progress' | 'in-review' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'critical'
  timeline: {
    estimatedCompletion?: Date // Estimated completion
    actualCompletion?: Date   // Auto-set when completed
    quarterTarget?: '2025-q1' | '2025-q2' | '2025-q3' | '2025-q4' | '2026-q1' | '2026-q2' | '2026-q3' | '2026-q4' | 'future'
    estimatedEffort?: 'small' | 'medium' | 'large' | 'epic' // Development effort
  }
  voting: {
    votes: number            // Total votes (auto-calculated)
    voters: User[]           // Users who voted (auto-managed)
    allowVoting: boolean     // Enable community voting
    voteWeight: number       // Vote multiplier (for premium users)
  }
  feedback: Array<{          // Community feedback
    comment: RichText
    author: User
    type: 'feedback' | 'use-case' | 'technical' | 'design' | 'question'
    isPublic: boolean        // Show publicly
    adminResponse?: RichText // Admin response
  }>
  technical: {               // Admin-only technical details
    implementationNotes?: RichText
    dependencies: Array<{
      feature: RoadmapFeature
      type: 'blocks' | 'blocked-by' | 'related'
    }>
    githubIssues: Array<{
      url: string
      status: 'open' | 'in-progress' | 'closed'
    }>
    assignedDeveloper?: User
  }
  progress: {
    completionPercentage: number // 0-100% (auto-calculated from milestones)
    milestones: Array<{
      title: string
      description?: string
      completed: boolean
      completedDate?: Date
    }>
    updates: Array<{         // Progress updates
      title: string
      content: RichText
      isPublic: boolean
      author: User
    }>
  }
  tags: Array<'community-requested' | 'quick-win' | 'breaking-change' | 'new-feature' | 'enhancement' | 'bug-fix' | 'performance' | 'security' | 'accessibility' | 'mobile'>
}
```

### **Access Control**
- **Public Read**: Anyone can view features and vote
- **Super Admin Only**: Create, edit, and manage features
- **Community Voting**: Users can upvote features they want prioritized

### **Key Features**
- **Community Voting**: Public voting system with vote weighting
- **Progress Tracking**: Milestone-based completion tracking
- **GitHub Integration**: Link to development issues
- **Feedback System**: Community input with admin responses
- **Timeline Management**: Quarter-based delivery planning

---

## 🏢 **Tenant Management Collection (Super Admin Only)**

### **Core Schema**
```typescript
interface TenantManagement {
  name: string               // Tenant display name
  subdomain: string          // Unique subdomain (validated)
  status: 'active' | 'suspended' | 'pending' | 'archived' | 'trial'
  plan: 'free' | 'starter' | 'professional' | 'business' | 'enterprise' | 'custom'
  billing: {
    monthlyRevenue?: number  // MRR
    billingCycle: 'monthly' | 'quarterly' | 'annually'
    nextBillingDate?: Date
    paymentStatus: 'current' | 'past-due' | 'cancelled' | 'trial'
  }
  owner: User                // Primary tenant owner
  usage: {                   // Current usage (auto-calculated)
    userCount: number
    storageUsed: number      // MB
    apiCallsThisMonth: number
    lastActivity?: Date
  }
  limits: {
    maxUsers: number         // User limit
    maxStorage: number       // Storage limit (MB)
    maxApiCalls: number      // API calls per month
    maxProducts: number      // Product limit
    maxOrders: number        // Orders per month
  }
  features: Array<'crm' | 'ecommerce' | 'projects' | 'analytics' | 'api' | 'branding' | 'priority-support' | 'webhooks' | 'sso' | 'white-label'>
  provisioningTemplate: 'basic-business' | 'ecommerce-store' | 'service-provider' | 'creative-agency' | 'saas-company' | 'non-profit' | 'custom'
  customization: {
    primaryColor?: string    // Hex color (validated)
    logo?: Media            // Tenant logo
    customDomain?: string   // Custom domain
    customCSS?: string      // CSS overrides
  }
  integrations: {
    stripe: {
      enabled: boolean
      accountId?: string
      webhookEndpoint?: string
    }
    mailchimp: {
      enabled: boolean
      apiKey?: string
      audienceId?: string
    }
    googleAnalytics: {
      enabled: boolean
      trackingId?: string
    }
  }
  customSettings: JSON       // Tenant-specific settings
  notes: RichText           // Admin notes
  provisioning: {
    isProvisioned: boolean   // Setup completed?
    provisionedAt?: Date     // Auto-set when active
    provisioningLog: Array<{ // Activity log
      action: string
      status: 'success' | 'failed' | 'pending'
      details?: string
      timestamp: Date
    }>
  }
}
```

### **Access Control**
- **Super Admin Only**: Complete access restriction
- **Provisioning Workflow**: Automatic setup tracking
- **Usage Monitoring**: Real-time usage statistics

### **Key Features**
- **Provisioning Templates**: Pre-configured tenant setups
- **Usage Tracking**: Real-time monitoring and limits enforcement
- **Integration Management**: External service configuration
- **Billing Integration**: Revenue and payment tracking
- **Audit Trail**: Complete provisioning activity log

---

## 🌐 **Angel OS Network Foundation Collections**

### **AngelOSNodes Collection (Distributed Network Registry)**

#### **Core Schema**
```typescript
interface AngelOSNodesCollection {
  id: string
  name: string // Human-readable name (e.g., "US East Genesis Node")
  nodeId: string // Unique identifier (e.g., "genesis-node-001")
  atProtocolDID?: string // Decentralized Identifier for AT Protocol federation
  endpoint: string // Public URL (e.g., "https://angelos.kendev.co")
  apiEndpoint: string // API endpoint for federation
  
  // Geographic and Infrastructure
  region: 'us-east' | 'us-west' | 'europe' | 'asia' | 'australia'
  nodeType: 'genesis' | 'production_cluster' | 'single_instance' | 'edge_cluster' | 'development' | 'ai_specialized'
  scalingModel: 'vercel_serverless' | 'cloudflare_lb' | 'k8s_cluster' | 'single_server'
  
  // Node Capabilities
  capabilities: ('tenant_hosting' | 'ai_processing' | 'media_storage' | 'realtime_comm' | 'blockchain_services')[]
  status: 'online' | 'offline' | 'degraded' | 'maintenance'
  
  // Network Connectivity
  connectedNodes: {
    node: AngelOSNode
    lastHeartbeat?: Date
    latencyMs?: number
  }[]
  
  // Geographic Coordinates
  coordinates?: {
    latitude: number
    longitude: number
  }
  
  // Resource Management
  resources: {
    maxTenants: number
    currentTenants: number
    maxUsers: number
    storageCapacity: number // GB
    cpuLoad: number // 0-100%
    memoryUsage: number // 0-100%
  }
  
  // Health Monitoring
  health: {
    lastSeen?: Date
    responseTime?: number // ms
    uptime?: number // percentage
    loadScore?: number // custom score
  }
  
  // Governance and Evolution
  governanceRules?: RichText // Node-specific governance rules
  evolutionHistory: {
    timestamp: Date
    event: 'created' | 'updated' | 'status_change' | 'migration' | 'resource_adjustment'
    description?: string
    data?: JSON
  }[]
}
```

#### **Key Features**
- **Federation Ready**: AT Protocol DID integration for decentralized identity
- **Load Balancing**: Multiple scaling models (Vercel, Cloudflare, K8s)
- **Health Monitoring**: Real-time status and performance tracking
- **Geographic Distribution**: Region-based routing and proximity optimization
- **Evolution Tracking**: Complete audit trail of node changes

---

### **TenantDistribution Collection (Tenant-Node Mapping)**

#### **Core Schema**
```typescript
interface TenantDistributionCollection {
  id: string
  tenant: Tenant // Required tenant relationship
  primaryNode: AngelOSNode // Primary hosting node
  backupNodes?: AngelOSNode[] // Backup/replica nodes
  
  // Distribution Strategy
  distributionStrategy: 'single_node' | 'multi_node_replica' | 'geo_distributed' | 'load_balanced'
  
  // Migration Management
  migrationHistory: {
    fromNode?: AngelOSNode
    toNode: AngelOSNode
    migrationType: 'initial_placement' | 'load_balancing' | 'node_failure' | 'geographic_optimization' | 'manual'
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back'
    startedAt: Date
    completedAt?: Date
    dataSize?: number // MB
    migrationLog?: string
  }[]
  
  // Performance Metrics
  performance: {
    averageResponseTime: number // ms
    uptime: number // percentage
    lastHealthCheck?: Date
    errorRate: number // percentage
  }
  
  // Resource Usage
  resourceUsage: {
    storageUsed: number // MB
    bandwidthUsed: number // MB/month
    computeHours: number // hours/month
    lastUpdated?: Date
  }
  
  // Compliance and Governance
  compliance: {
    dataResidency?: 'us' | 'eu' | 'asia' | 'global' // Required data location
    encryptionEnabled: boolean
    backupFrequency: 'daily' | 'weekly' | 'monthly'
    retentionPeriod: number // days
  }
}
```

#### **Key Features**
- **Migration Management**: Complete tenant migration tracking between nodes
- **Performance Monitoring**: Real-time metrics for tenant performance
- **Compliance**: Data residency and encryption requirements
- **Load Balancing**: Automatic tenant distribution based on node capacity

---

### **AngelTokens Collection (Human-Worth Economy)**

#### **Core Schema**
```typescript
interface AngelTokensCollection {
  id: string
  transactionId: string // Unique transaction identifier
  
  // Transaction Participants
  fromUser?: User // Sender (null for system rewards)
  toUser: User // Recipient
  fromTenant?: Tenant // Source tenant
  toTenant?: Tenant // Destination tenant
  
  // Transaction Details
  tokenType: 'karma_reward' | 'peer_recognition' | 'cross_tenant_exchange' | 'node_reward' | 'justice_fund' | 'system_grant'
  amount: number // Token amount
  
  // Human Worth Validation
  humanWorthMetrics: {
    proofOfHumanity: boolean // Verified human participant
    contributionType?: 'content_creation' | 'community_support' | 'technical_help' | 'mentorship' | 'justice_advocacy'
    impactScore?: number // 0-100 impact rating
    witnessCount?: number // Number of witnesses/validators
  }
  
  // Cross-Network Exchange
  exchangeDetails?: {
    exchangeRate: number // Tokens per unit
    sourceCurrency?: 'usd' | 'karma_points' | 'angel_tokens'
    networkFee: number // Network transaction fee
    crossNodeExchange: boolean // Is this cross-node?
  }
  
  // Consensus and Validation
  consensus: {
    validatorNodes: AngelOSNode[] // Nodes that validated transaction
    consensusReached: boolean
    validationTimestamp?: Date
    proofOfHumanWorth?: string // Cryptographic proof
  }
  
  // Transaction Context
  context: {
    reason?: string // Human-readable reason
    relatedContent?: string // Content ID that triggered reward
    campaignId?: string // Associated campaign
    eventId?: string // Associated event
  }
  
  // Status and Timestamps
  status: 'pending' | 'confirmed' | 'failed' | 'reversed'
  processedAt?: Date
  confirmedAt?: Date
  
  // Blockchain Integration (Future)
  blockchainData?: {
    blockHash?: string
    transactionHash?: string
    gasUsed?: number
    networkId?: string
  }
}
```

#### **Key Features**
- **Human Worth Validation**: Proof of human contribution and impact
- **Cross-Network Exchange**: Token transfers between nodes and tenants
- **Consensus Mechanism**: Multi-node validation for transaction integrity
- **Impact Tracking**: Contribution types and community impact scoring

---

### **TokenBalances Collection (Current Balances)**

#### **Core Schema**
```typescript
interface TokenBalancesCollection {
  id: string
  user: User // Required user relationship
  tenant?: Tenant // Optional tenant scope
  
  // Balance Information
  currentBalance: number // Current Angel Token balance
  
  // Balance Breakdown
  balanceBreakdown: {
    karmaRewards: number // Tokens from karma system
    peerRecognition: number // Tokens from peer recognition
    systemGrants: number // Tokens from system rewards
    crossTenantEarnings: number // Tokens from cross-tenant activities
    nodeRewards: number // Tokens from node participation
    justiceContributions: number // Tokens from justice fund activities
  }
  
  // Transaction History Summary
  transactionSummary: {
    totalEarned: number // Lifetime earnings
    totalSpent: number // Lifetime spending
    transactionCount: number // Total transactions
    lastTransactionAt?: Date
  }
  
  // Spending Power and Reputation
  reputation: {
    humanWorthScore: number // 0-1000 human worth score
    contributionLevel: 'newcomer' | 'contributor' | 'guardian_angel' | 'network_steward' | 'elder'
    trustRating: number // 0-100 trust rating
    networkInfluence: number // 0-100 influence score
  }
  
  // Staking and Governance
  governance?: {
    stakedTokens: number // Tokens staked for governance
    votingPower: number // Calculated voting power
    delegatedTo?: User // Delegation target
    proposalsVoted: number // Number of proposals voted on
  }
  
  // Cross-Network Holdings
  crossNetworkBalances?: {
    nodeId: string
    balance: number
    lastSyncAt?: Date
  }[]
  
  // Security and Verification
  security: {
    lastVerified?: Date // Last balance verification
    verificationHash?: string // Cryptographic verification
    anomalyFlags: string[] // Security anomaly flags
  }
  
  // Auto-calculated fields
  lastUpdated: Date // Auto-updated on balance changes
  balanceHistory: {
    date: Date
    balance: number
    changeAmount: number
    changeReason: string
  }[] // Historical balance tracking
}
```

#### **Key Features**
- **Comprehensive Tracking**: Complete breakdown of token sources and usage
- **Reputation System**: Human worth scoring and contribution levels
- **Governance Integration**: Staking and voting power calculation
- **Cross-Network Support**: Balance tracking across multiple nodes
- **Security**: Cryptographic verification and anomaly detection

---

## 🔗 **Network Federation APIs**

### **Heartbeat API** (`/api/federation/heartbeat`)
- **Purpose**: Node discovery and health monitoring
- **Features**: Automatic node registration, health status updates, network topology mapping

### **Tenant Migration API** (`/api/federation/migrate-tenant`)
- **Purpose**: Seamless tenant migration between nodes
- **Features**: Data transfer, DNS updates, rollback capabilities, zero-downtime migration

### **Token Exchange API** (`/api/federation/token-exchange`)
- **Purpose**: Cross-node and cross-tenant token transactions
- **Features**: Exchange rate calculation, consensus validation, fraud prevention

---

## 📝 **Feedback Collection (Universal Feedback System)**

### **Core Schema**
```typescript
interface FeedbackCollection {
  id: string
  title: string // Auto-generated for admin display
  
  // Context - What is being reviewed
  entityType: 'product' | 'appointment' | 'class' | 'event' | 'subscription' | 'post' | 'page' | 'support' | 'leo_interaction' | 'platform'
  entityId: string // ID of the entity being reviewed
  entityTitle?: string // Display name (auto-populated)
  
  // Customer Information
  customer?: User // Optional for anonymous feedback
  customerName?: string // Display name for feedback
  customerEmail?: string // Contact email for follow-up
  isAnonymous: boolean // Hide customer identity in public display
  
  // Ratings System
  ratings: {
    overall: number // 1-5 stars (required)
    quality?: number // 1-5 stars
    value?: number // Value for money (1-5 stars)
    service?: number // Service quality (1-5 stars)
    recommendationScore?: number // NPS score (0-10)
  }
  
  // Content
  content: {
    review?: RichText // Main feedback content
    positives?: string // What went well
    improvements?: string // What could be better
    suggestions?: string // Feature requests or suggestions
    testimonial?: string // Public testimonial (if customer opts in)
  }
  
  // Media Attachments
  mediaAttachments?: Media[] // Photos, videos, documents
  
  // Context-Specific Questions
  contextResponses: {
    question: string
    answer?: string
    answerType: 'text' | 'rating' | 'boolean' | 'choice'
    numericValue?: number // For ratings or scores
  }[]
  
  // Status and Moderation
  status: 'pending' | 'approved' | 'rejected' | 'flagged' | 'follow_up'
  isPublic: boolean // Display publicly on entity page
  isFeatured: boolean // Feature as testimonial
  
  // AI Analysis (Auto-generated by LEO)
  aiAnalysis?: {
    sentiment?: 'positive' | 'neutral' | 'negative'
    confidence?: number // 0-1
    keyTopics?: string[] // AI-identified topics
    urgency?: 'low' | 'medium' | 'high' | 'critical'
    suggestedActions?: string // AI-suggested response actions
  }
  
  // Follow-up Management
  followUp: {
    required: boolean // Requires human follow-up
    assignedTo?: User // Staff member assigned
    responseDeadline?: Date
    responseStatus: 'pending' | 'in_progress' | 'resolved' | 'escalated'
    responseNotes?: string // Internal notes
    customerResponse?: string // Customer response to follow-up
  }
  
  // Multi-tenant Support
  tenant: Tenant // Required
  space?: Space // Optional space context
  
  // Metadata
  metadata: {
    platform: 'web' | 'mobile' | 'email' | 'sms' | 'phone' | 'in_person'
    source?: string // Specific source (page URL, app screen, etc.)
    responseTime?: number // Time taken to complete (seconds)
    deviceInfo?: string // Device/browser information
  }
}
```

### **Key Features**
- **Universal Entity Support**: Feedback for products, services, events, posts, AI interactions, and platform features
- **Multi-Rating System**: Overall rating plus specific quality, value, and service ratings
- **AI-Powered Analysis**: LEO automatically analyzes sentiment, urgency, and suggests actions
- **Follow-up Management**: Structured workflow for responding to feedback
- **Context-Specific Questions**: Dynamic questions based on entity type
- **Anonymous Support**: Optional anonymous feedback with privacy controls
- **Media Attachments**: Support for photos, videos, and documents
- **NPS Integration**: Net Promoter Score tracking for customer loyalty

---

## 🚗 **MileageLogs Collection (Business Mileage Tracking)**

### **Core Schema**
```typescript
interface MileageLogsCollection {
  id: string
  tenantId: string // Required tenant isolation
  
  // Vehicle Information
  vehicle: string // Vehicle identifier
  odometerReading: number // Current odometer reading
  
  // Trip Details
  location: string // Destination or route
  date: Date // Trip date
  type: 'business' | 'personal' // Trip classification
  purpose?: string // Business purpose description
  miles?: number // Trip distance
  
  // Tax Deduction Calculation
  rate?: number // IRS mileage rate (e.g., 0.655 for 2023)
  deduction?: number // Auto-calculated: miles × rate
  
  // Photo Documentation
  photos: {
    filename?: string
  }[]
}
```

### **Key Features**
- **Automatic Deduction Calculation**: Auto-calculates tax deduction based on miles and IRS rate
- **Photo Documentation**: Attach photos for odometer readings and trip documentation
- **Business/Personal Classification**: Separate business and personal trips for tax purposes
- **Tenant Isolation**: Multi-tenant support for business mileage tracking

---

## 📋 **QuoteRequests Collection (Service Quote Management)**

### **Core Schema**
```typescript
interface QuoteRequestsCollection {
  id: string
  submissionId: string // Unique submission identifier
  
  // Customer Information
  customerName: string
  customerEmail: string
  customerPhone: string
  serviceAddress: string // Service location
  
  // Service Details
  serviceDescription: string // Detailed service requirements
  serviceType?: 'junk_removal' | 'handyman' | 'cleaning' | 'moving' | 'other'
  estimatedValue?: number // Estimated quote value
  
  // Quote Management
  status: 'pending' | 'quoted' | 'accepted' | 'declined' | 'expired'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assignedTo?: string // Staff member assigned
  notes?: string // Internal notes
  
  // Timeline
  createdAt: Date
  quotedAt?: Date
  expiresAt?: Date // Quote expiration
}
```

### **Key Features**
- **Service Type Classification**: Pre-defined service categories for quick processing
- **Quote Lifecycle Management**: Track quotes from request to acceptance/decline
- **Priority System**: Urgent, high, normal, low priority classification
- **Assignment Workflow**: Assign quotes to specific team members
- **Expiration Tracking**: Automatic quote expiration management

---

## 📸 **PhotoAnalysis Collection (AI Photo Processing)**

### **Core Schema**
```typescript
interface PhotoAnalysisCollection {
  id: string
  tenantId: string // Required tenant isolation
  guardianAngelId?: string // Guardian Angel assignment
  
  // Analysis Context
  sequenceType: 'mileage_log' | 'collection_inventory' | 'business_inventory' | 'general'
  location?: string // Photo location
  description?: string // Human description
  photoCount: number // Number of photos in sequence
  
  // AI Analysis Results
  analysis: JSON // AI-generated analysis results
  confidence?: number // AI confidence score (0-1)
  category?: string // Categorization result
  
  createdAt: Date
}
```

### **Key Features**
- **Multi-Context Analysis**: Support for mileage logs, inventory, and general photo analysis
- **AI Confidence Scoring**: Track reliability of AI analysis results
- **Guardian Angel Integration**: Assign AI agents for specialized photo processing
- **Sequence Processing**: Handle multiple photos as related sequences

---

## 📦 **InventoryMessages Collection (Inventory Management System)**

### **Core Schema**
```typescript
interface InventoryMessagesCollection {
  id: string
  tenantId: string // Required tenant isolation
  guardianAngelId?: string // Guardian Angel assignment
  userId?: string // User who created the message
  
  // Message Details
  title: string
  description?: string
  messageType: 'mileage_log' | 'collection_inventory' | 'business_inventory' | 'equipment_status' | 'asset_tracking' | 'quality_control' | 'maintenance_log' | 'customer_interaction' | 'general'
  category?: string
  
  // Location Information
  location?: string
  geoCoordinates?: {
    latitude: number
    longitude: number
  }
  
  // Photo Documentation
  photos: {
    filename?: string
    url?: string
    googlePhotosId?: string
    timestamp?: Date
  }[]
  
  // Extensible Metadata
  meta: JSON // Extensible metadata specific to message type
  // Examples: {startMileage: 50000, endMileage: 50150, distance: 150}
  //          {speciesName: "Monarch Butterfly", wingspan: "4 inches", condition: "excellent"}
  
  // AI Analysis
  analysis?: JSON // AI-generated analysis results
  confidence?: number // AI confidence score (0-1)
  
  // Organization
  tags: { tag: string }[]
  status: 'pending' | 'processed' | 'verified' | 'archived'
  priority: 'low' | 'normal' | 'high' | 'critical'
  
  // Timestamps
  createdAt: Date
  updatedAt?: Date
}
```

### **Key Features**
- **Multi-Type Inventory Support**: Mileage logs, collection inventory, business inventory, equipment status
- **Extensible Metadata**: JSON field for type-specific data structures
- **Photo Integration**: Multiple photo support with Google Photos integration
- **AI Analysis Pipeline**: Automated analysis with confidence scoring
- **Geographic Tracking**: GPS coordinates for location-based inventory
- **Guardian Angel Processing**: AI agent assignment for automated processing

---

## 🏛️ **Phyles Collection (Organizational Units)**

### **Core Schema**
```typescript
interface PhylesCollection {
  id: string
  name: string
  description?: RichText
  phyleType: 'collector_phyle' | 'logistics_phyle' | 'analyst_phyle' | 'maintenance_phyle' | 'quality_phyle' | 'customer_service_phyle' | 'research_phyle' | 'security_phyle'
  
  // Organizational Charter
  charter: {
    mission: string // Required mission statement
    specializations: { specialization: string }[]
    coreValues: { value: string }[]
    operatingPrinciples?: RichText
  }
  
  // Economic Structure
  economicStructure: {
    currency: string // Default: 'KenDevCoin'
    taxationModel: 'flat_fee' | 'percentage_tax' | 'progressive_tax' | 'contribution_based' | 'collective_ownership'
    wealthDistribution: 'merit_based' | 'equal_distribution' | 'rank_hierarchy' | 'contribution_weighted' | 'reputation_weighted'
    minimumBasicIncome?: number // Guaranteed income for active members
    profitSharingRatio?: number // 0-1 percentage of profits shared
  }
  
  // Governance Model
  governance: {
    governanceModel: 'democratic' | 'meritocratic' | 'hierarchical' | 'consensus' | 'algorithmic'
    decisionMakingProcess?: RichText
    leadershipStructure: {
      role: string
      responsibilities: string
      selectionMethod: string
    }[]
    votingRights?: RichText
  }
  
  // Membership Criteria
  membershipCriteria: {
    admissionRequirements: {
      requirement: string
      description: string
    }[]
    skillRequirements: {
      skill: string
      level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
    }[]
    probationPeriod?: number // Days
    membershipFees?: {
      initiation?: number
      monthly?: number
      annual?: number
    }
  }
  
  // Services Offered
  services: {
    offeredServices: {
      service: string
      pricing: JSON
    }[]
    qualityStandards?: RichText
    serviceGuarantees: { guarantee: string }[]
  }
  
  // Inter-Phyle Relations
  interPhyleRelations: {
    alliances: {
      phyleId: string
      allianceType: 'trade_partnership' | 'service_exchange' | 'information_sharing' | 'mutual_defense' | 'research_collaboration'
      terms: RichText
    }[]
    competitors: {
      phyleId: string
      competitionType: string
    }[]
  }
  
  // Performance Metrics (Auto-calculated)
  metrics: {
    memberCount: number
    totalEarnings: number
    averageEarningsPerMember: number
    reputationScore: number // 0-1000
    completionRate: number
    customerSatisfaction: number
    growthRate: number
  }
  
  // Cultural Aspects
  culturalAspects: {
    traditions: {
      tradition: string
      description: string
    }[]
    celebrations: {
      celebration: string
      date: Date
    }[]
    symbolism: {
      colors: { color: string }[]
      motto?: string
      emblem?: string
    }
  }
  
  // Status
  status: 'active' | 'forming' | 'restructuring' | 'dormant' | 'dissolved'
  founded: Date
  lastActivity?: Date
}
```

### **Key Features**
- **Organizational Framework**: Complete governance, economic, and cultural structure
- **Economic Models**: Multiple taxation and wealth distribution systems
- **Inter-Phyle Relations**: Alliance and competition tracking between organizational units
- **Performance Metrics**: Comprehensive tracking of phyle success and growth
- **Cultural Identity**: Traditions, celebrations, and symbolic elements
- **Membership Management**: Detailed admission criteria and skill requirements

---

## 🏆 **AgentReputation Collection (Performance & Reputation System)**

### **Core Schema**
```typescript
interface AgentReputationCollection {
  id: string
  agentId: string // Required, indexed
  phyleId: string // Required, indexed
  displayName: string // Auto-generated: "agentId (rank)"
  
  // Reputation Scoring
  score: number // 0-1000, default: 500
  rank: 'legendary' | 'master' | 'expert' | 'professional' | 'competent' | 'apprentice' | 'novice' | 'beginner' // Auto-calculated
  
  // Reputation History
  reputationHistory: {
    eventType: 'quality_work' | 'fast_completion' | 'customer_satisfaction' | 'peer_recognition' | 'leadership' | 'innovation' | 'reliability' | 'collaboration'
    impact: number // -100 to +100
    description: string
    timestamp: Date
    verifiedBy?: string
  }[]
  
  // Achievements System
  achievements: {
    achievement: 'first_task' | 'hundred_tasks' | 'thousand_tasks' | 'perfect_week' | 'speed_demon' | 'customer_favorite' | 'mentor' | 'innovator' | 'phyle_champion'
    earnedAt: Date
    description: string
  }[]
  
  // Specializations
  specializations: {
    specialization: string
    proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert'
    certifiedBy?: string
  }[]
  
  // Performance Metrics (Auto-calculated)
  performanceMetrics: {
    totalTasksCompleted: number
    averageQualityScore: number // 0-1
    averageCompletionTime: number // Minutes
    customerSatisfactionScore: number // 0-5
    reliabilityScore: number // 0-1
    collaborationScore: number // 0-1
  }
  
  // Economic Impact
  economicImpact: {
    totalEarned: number
    totalContributed: number
    phyleRank?: number // Rank within phyle (1 = top performer)
    economicEfficiency?: number // Earnings per unit of work
  }
  
  // Social Network
  socialNetwork: {
    mentorOf: { agentId: string }[] // Agents this agent mentors
    mentoredBy: { agentId: string }[] // Agents mentoring this agent
    collaborators: {
      agentId: string
      collaborationType: string
    }[]
    endorsements: {
      fromAgentId: string
      skill: string
      endorsementText: string
      timestamp: Date
    }[]
  }
  
  // Status
  status: 'active' | 'inactive' | 'probation' | 'suspended' | 'retired'
  joinedPhyleAt?: Date
  lastActivity?: Date
  lastUpdated: Date
}
```

### **Key Features**
- **Comprehensive Reputation System**: 0-1000 scoring with automatic rank calculation
- **Achievement Tracking**: Milestone-based achievements with descriptions
- **Performance Analytics**: Detailed metrics on quality, speed, and customer satisfaction
- **Social Network Mapping**: Mentor relationships, collaborations, and endorsements
- **Economic Impact Tracking**: Earnings, contributions, and efficiency metrics
- **Specialization Management**: Skill tracking with proficiency levels and certifications

---

## 📝 **Additional Collections Summary**

### **Content Management**
- **Posts**: Blog posts and articles with SEO and social syndication
- **Pages**: Website pages with flexible layouts and SEO optimization
- **Media**: File management with multi-size image processing
- **Categories**: Hierarchical categorization system

### **Forms & Communication**
- **FormSubmissions**: Dynamic form processing with workflow automation
- **Contacts**: CRM contact management
- **Documents**: Document management and processing

### **Financial & Operations**
- **Donations**: Charitable giving and fund management
- **Invoices**: Billing and invoice management
- **BusinessAgents**: Guardian Angel AI agents for automation
- **HumanitarianAgents**: Specialized AI agents for humanitarian work

### **System Collections**
- **AIGenerationQueue**: Queue management for AI-powered tasks
- **LinkedAccounts**: Social media and external account connections
- **SocialMediaBots**: Automated social media posting and management
- **WebChatSessions**: Website chat session management
- **ChannelManagement**: Channel management and configuration

### **Message-Driven Business Intelligence**
```typescript
const businessIntelligence = {
  leadGeneration: {
    source_tracking: "How customers find your business"
    qualification: "Automated lead scoring and routing"
    follow_up: "Automated nurture sequences"
    conversion_tracking: "Lead to customer progression"
  }
  
  customerService: {
    issue_classification: "Automatic categorization and routing"
    resolution_tracking: "Time to resolution metrics"
    satisfaction_scoring: "Post-interaction feedback"
    escalation_triggers: "When to involve human support"
  }
  
  salesPipeline: {
    opportunity_scoring: "Deal probability and value"
    stage_progression: "Movement through sales funnel"
    objection_handling: "Common concerns and responses"
    closing_assistance: "AI-powered sales support"
  }
  
  marketingInsights: {
    campaign_performance: "Message engagement and conversion"
    audience_analysis: "Customer behavior and preferences"
    content_optimization: "What messaging works best"
    channel_effectiveness: "Best performing communication channels"
  }
}
```

## 📋 **Forms Collection**

### **Core Schema**
```typescript
interface FormsCollection {
  id: string
  name: string
  description?: string
  tenant: Tenant
  
  // Form configuration
  fields: {
    id: string
    name: string
    label: string
    type: 'text' | 'email' | 'phone' | 'select' | 'textarea' | 'file' | 'date' | 'checkbox'
    required: boolean
    options?: string[]
    validation?: {
      pattern?: string
      min?: number
      max?: number
      message?: string
    }
    conditionalLogic?: {
      showIf: string
      hideIf: string
    }
  }[]
  
  // Submission handling
  submitAction: {
    type: 'email' | 'webhook' | 'database' | 'integration'
    destination: string
    template?: string
    autoResponse?: boolean
  }
  
  // Business workflow
  workflow: {
    assignTo?: User
    department?: string
    priority?: 'low' | 'normal' | 'high'
    followUpActions?: string[]
    integrations?: string[]
  }
  
  // Design and presentation
  design: {
    theme: string
    layout: 'single' | 'multi_step' | 'modal'
    customCSS?: string
    progressBar?: boolean
  }
  
  // Analytics and performance
  analytics: {
    views: number
    submissions: number
    conversionRate: number
    averageCompletionTime: number
    abandonmentRate: number
  }
  
  // Legal and compliance
  compliance: {
    gdprCompliant: boolean
    privacyNotice?: string
    consentRequired?: boolean
    dataRetention?: number
  }
}
```

### **Form Applications**
```typescript
const formUseCases = {
  leadGeneration: {
    contact_forms: "Basic inquiry and contact information"
    quote_requests: "Detailed project requirements"
    consultation_booking: "Appointment scheduling with preferences"
    newsletter_signup: "Email list building and segmentation"
  }
  
  customerService: {
    support_tickets: "Issue reporting and tracking"
    feedback_surveys: "Satisfaction and improvement data"
    feature_requests: "Product enhancement suggestions"
    complaints: "Formal complaint handling process"
  }
  
  businessOperations: {
    job_applications: "Hiring and recruitment process"
    vendor_registration: "Supplier onboarding and management"
    event_registration: "Workshop and seminar signups"
    membership_applications: "Community and organization joining"
  }
  
  legalAndCompliance: {
    intake_forms: "Legal case information collection"
    consent_forms: "GDPR and privacy compliance"
    incident_reports: "Documentation for legal purposes"
    contract_requests: "Service agreement initiation"
  }
}
```

## 🔗 **Collection Relationships (Current Implementation)**

### **Core Platform Relationships**
```typescript
interface CorePlatformRelationships {
  // Multi-Tenant Hierarchy
  tenants_to_users: "Users belong to Tenants via TenantMemberships"
  tenants_to_spaces: "Spaces belong to specific Tenants"
  tenants_to_products: "Products are tenant-scoped"
  tenants_to_orders: "Orders are tenant-scoped"
  tenants_to_appointments: "Appointments are tenant-scoped"
  
  // User Membership System
  users_to_tenant_memberships: "Users can have multiple TenantMemberships with different roles"
  users_to_space_memberships: "Users join Spaces via SpaceMemberships with CRM data"
  tenant_memberships_to_space_memberships: "SpaceMemberships reference TenantMemberships"
  
  // Business Operations
  spaces_to_messages: "Messages belong to Spaces and optional Channels"
  spaces_to_appointments: "Appointments can be associated with Spaces"
  users_to_messages: "Messages have sender User relationships"
  users_to_appointments: "Appointments have organizer and attendees (Users)"
  
  // E-commerce Relationships
  products_to_orders: "Orders contain LineItems referencing Products"
  users_to_orders: "Orders have customer User relationships"
  products_to_categories: "Products can belong to multiple Categories"
  products_to_media: "Products have gallery Media relationships"
  
  // Enterprise Management
  organizations_to_venues: "Venues belong to Organizations"
  venues_to_appointments: "Appointments can be scheduled at specific Venues"
  users_to_venues: "Venues have staff User relationships"
  business_agents_to_venues: "Venues can be assigned Guardian Angel BusinessAgents"
  
  // Content Management
  posts_to_categories: "Posts can belong to multiple Categories"
  posts_to_users: "Posts have author User relationships (via populatedAuthors)"
  pages_to_media: "Pages reference Media for hero images and content"
  media_to_multiple: "Media is referenced by Posts, Pages, Products, Users, etc."
}
```

### **Revenue Sharing Relationships**
```typescript
interface RevenueRelationships {
  // Angel OS Revenue Distribution
  orders_to_revenue_distribution: "Orders auto-calculate 15/30/50/5 revenue split"
  products_to_commission_rates: "Products have type-based commission templates"
  appointments_to_commission_tracking: "Appointments track source-based commission rates"
  spaces_to_monetization: "Spaces can enable creator monetization features"
  
  // Commission Multipliers
  appointment_source_to_commission: "Different rates for system/pickup/referral sources"
  product_type_to_commission: "AI print-on-demand (15%), consultations (8%), etc."
}
```

### **AI and Automation Relationships**
```typescript
interface AIRelationships {
  // Guardian Angel System
  business_agents_to_venues: "BusinessAgents can be assigned to Venues"
  humanitarian_agents_to_operations: "HumanitarianAgents for specialized tasks"
  channels_to_guardian_angels: "Channels can be assigned Guardian Angel IDs"
  
  // AI Processing
  messages_to_business_intelligence: "Messages contain embedded BI data"
  messages_to_conversation_context: "Messages maintain conversation state"
  ai_generation_queue_to_processing: "Queue management for AI tasks"
  
  // AT Protocol Integration
  spaces_to_at_protocol: "Spaces have federated identity (DID/handle)"
  messages_to_at_protocol: "Messages support AT Protocol URIs and CIDs"
}
```

### **CRM and Analytics Relationships**
```typescript
interface CRMRelationships {
  // Customer Journey Tracking
  space_memberships_to_crm_data: "SpaceMemberships include lead scoring and customer tiers"
  space_memberships_to_engagement_metrics: "Auto-calculated engagement scores"
  messages_to_business_context: "Messages track department, workflow, and customer journey"
  
  // Event Tracking
  space_memberships_to_conversion_events: "Track conversion events with timestamps and values"
  appointments_to_feedback: "Post-appointment ratings and follow-up tracking"
  events_to_attendee_stats: "Events track expected vs actual attendance"
}
```

## 📊 **Business Intelligence Integration**

### **Universal Analytics**
```typescript
interface UniversalAnalytics {
  customer_journey: {
    touchpoints: "All interactions across collections"
    conversion_paths: "How customers move through funnel"
    attribution: "Which activities drive results"
    lifetime_value: "Total customer value calculation"
  }
  
  content_performance: {
    engagement_metrics: "Views, shares, comments across Posts"
    conversion_tracking: "Content to customer conversion"
    seo_performance: "Search ranking and organic traffic"
    social_media_reach: "Cross-platform performance"
  }
  
  sales_intelligence: {
    product_performance: "Best selling products and services"
    pricing_optimization: "Price sensitivity and elasticity"
    inventory_management: "Stock levels and reorder points"
    revenue_forecasting: "Predictive sales analytics"
  }
  
  operational_insights: {
    form_optimization: "Completion rates and abandonment"
    page_performance: "Landing page effectiveness"
    message_analysis: "Customer service efficiency"
    automation_effectiveness: "AI and workflow performance"
  }
}
```

## 🔧 **Technical Implementation**

### **Multi-Tenant Architecture**
```typescript
interface MultiTenantSupport {
  tenant_isolation: {
    data_segregation: "Complete separation of tenant data"
    performance_isolation: "Resource allocation per tenant"
    customization: "Tenant-specific schema extensions"
    backup_restoration: "Individual tenant backup/restore"
  }
  
  shared_resources: {
    media_optimization: "Shared CDN and image processing"
    search_indexing: "Tenant-aware search infrastructure"
    caching_strategy: "Multi-tenant cache invalidation"
    monitoring: "Tenant-specific performance metrics"
  }
  
  scaling_strategy: {
    horizontal_scaling: "Add capacity as tenants grow"
    vertical_scaling: "Increase resources per tenant"
    auto_scaling: "Automatic resource adjustment"
    load_balancing: "Distribute tenant load effectively"
  }
}
```

### **Integration Capabilities**
```typescript
interface IntegrationSupport {
  api_access: {
    rest_api: "Full CRUD operations on all collections"
    graphql: "Flexible query interface"
    webhooks: "Real-time event notifications"
    bulk_operations: "Efficient batch processing"
  }
  
  third_party_sync: {
    social_media: "Two-way sync with social platforms"
    ecommerce: "Shopify, WooCommerce integration"
    crm: "Salesforce, HubSpot connectivity"
    accounting: "QuickBooks, Xero synchronization"
  }
  
  migration_tools: {
    data_import: "Bulk import from existing systems"
    export_formats: "Multiple export options"
    transformation: "Data mapping and conversion"
    validation: "Data integrity and quality checks"
  }
}
```

## 🚀 **Advanced Features (Current Implementation)**

### **AI-Powered Enhancements**
```typescript
interface AIEnhancements {
  guardian_angel_system: {
    business_agents: "AI agents assigned to venues for customer service"
    humanitarian_agents: "Specialized AI for humanitarian work"
    channel_processing: "Automated intelligence gathering and analysis"
    conversation_context: "Maintains customer context across interactions"
  }
  
  revenue_optimization: {
    ai_optimized_rates: "Dynamic commission rate adjustment"
    product_type_templates: "Auto-calculated commission rates by product type"
    source_multipliers: "Different rates based on acquisition source"
    performance_tracking: "Revenue distribution analytics"
  }
  
  business_intelligence: {
    message_analysis: "Embedded sentiment analysis and intent detection"
    lead_scoring: "Automated lead qualification in SpaceMemberships"
    engagement_metrics: "Auto-calculated engagement scores"
    customer_journey_tracking: "Track customers across all touchpoints"
  }
  
  automation_workflows: {
    appointment_booking: "Bay management and resource scheduling"
    commission_calculation: "Automatic revenue sharing calculations"
    karma_tracking: "Guardian Angel status assignment"
    at_protocol_federation: "Decentralized identity management"
  }
}
```

### **Multi-Tenant Capabilities**
```typescript
interface MultiTenantFeatures {
  domain_management: {
    primary_domains: "Each tenant has a primary domain"
    domain_aliases: "Unlimited domain aliases (DotNetNuke-style)"
    subdomain_support: "Automatic subdomain generation"
    custom_domains: "Full custom domain support"
  }
  
  business_customization: {
    business_type_configuration: "Features based on business type"
    industry_templates: "Industry-specific defaults and features"
    custom_branding: "Full white-label capabilities"
    revenue_sharing_agreements: "Configurable platform fees"
  }
  
  data_isolation: {
    tenant_scoped_collections: "All business data is tenant-isolated"
    user_membership_system: "Users can belong to multiple tenants"
    permission_hierarchy: "Role-based access within tenants"
    analytics_separation: "Tenant-specific reporting and metrics"
  }
}
```

## 📊 **Implementation Status Summary**

### **Fully Implemented Collections**
```typescript
const FullyImplemented = {
  // Core Platform
  Users: "Complete with karma system and Guardian Angel status",
  Tenants: "Multi-domain support with revenue sharing",
  TenantMemberships: "Role-based access with invitation system",
  SpaceMemberships: "CRM integration with engagement metrics",
  
  // Angel OS Network Foundation
  AngelOSNodes: "Distributed network registry with federation capabilities",
  TenantDistribution: "Tenant-node mapping with migration management",
  AngelTokens: "Human-worth-based blockchain economy transactions",
  TokenBalances: "Current Angel Token balances with reputation system",
  
  // Business Operations
  Spaces: "Creator monetization with 40+ social platform integrations",
  Messages: "Enhanced messaging with BI and conversation context",
  Products: "Commission tracking with type-based rate templates",
  Orders: "Angel OS revenue distribution (15/30/50/5 split)",
  Appointments: "Bay management with commission tracking",
  
  // MVP Dashboard Collections
  Projects: "Project management with task integration and budget tracking",
  Tasks: "Task management with dependencies and time tracking",
  Campaigns: "Marketing campaign management with ROI tracking",
  Leads: "Lead management with scoring and qualification pipeline",
  Opportunities: "Sales opportunity pipeline with stage management",
  
  // Enterprise Management
  Organizations: "Multi-venue business entity management",
  Venues: "Physical locations with staff and bay management",
  Events: "Event management with media galleries",
  
  // Content & Media
  Posts: "Blog posts with SEO and social syndication",
  Pages: "Flexible page layouts with SEO optimization",
  Media: "Multi-size image processing with CDN",
  Categories: "Hierarchical categorization system",
  
  // Intelligence & Automation
  Channels: "Intelligence gathering with Guardian Angel integration",
  BusinessAgents: "AI agents for venue automation",
  HumanitarianAgents: "Specialized AI agents for humanitarian work",
  
  // Feedback & Quality Management
  Feedback: "Universal feedback system with AI analysis and follow-up management",
  
  // Specialized Business Collections
  MileageLogs: "Business mileage tracking with automatic tax deduction calculation",
  QuoteRequests: "Service quote management with lifecycle tracking",
  PhotoAnalysis: "AI-powered photo processing with confidence scoring",
  InventoryMessages: "Inventory management with extensible metadata and AI analysis",
  
  // Organizational Systems
  Phyles: "Organizational units with governance, economic, and cultural frameworks",
  AgentReputation: "Performance and reputation system with achievements and social networks",
  
  // System Collections
  AIGenerationQueue: "Queue management for AI-powered tasks",
  JobQueue: "Background job processing and management",
  LinkedAccounts: "Social media and external account connections",
  SocialMediaBots: "Automated social media posting and management",
  WebChatSessions: "Website chat session management",
  ChannelManagement: "Channel management and configuration",
  
  // Financial & Operations
  Donations: "Charitable giving and fund management",
  Invoices: "Billing and invoice management",
  Documents: "Document management and processing",
  Contacts: "CRM contact management",
  Workflows: "Business process automation"
}
```

### **Key Features Implemented**
- ✅ **Multi-tenant Architecture**: Complete data isolation with domain management
- ✅ **Guardian Angel System**: AI agents with karma-based user recognition
- ✅ **Revenue Sharing**: Automated 15/30/50/5 split with commission tracking
- ✅ **Creator Monetization**: OnlyFans-style subscriptions with AI rate optimization
- ✅ **Bay Management**: Multi-station venue support for service businesses
- ✅ **AT Protocol Integration**: Federated identity for cross-platform operations
- ✅ **CRM Integration**: Lead scoring and customer journey tracking
- ✅ **Social Media Automation**: 40+ platform integration for content distribution
- ✅ **Distributed Network Foundation**: Angel OS node federation with load balancing
- ✅ **Human-Worth Economy**: Angel Token blockchain with proof of human contribution
- ✅ **MVP Dashboard Suite**: Complete project, task, campaign, lead, and opportunity management
- ✅ **Cross-Node Migration**: Seamless tenant migration between network nodes
- ✅ **Consensus Validation**: Multi-node validation for token transactions

### **Business Model Integration**
```typescript
const BusinessModelSupport = {
  // Revenue Streams
  platform_fees: "Configurable 8-30% platform fees with AI optimization",
  subscription_tiers: "Creator monetization with multiple subscription levels",
  commission_tracking: "Source-based commission rates (system/pickup/referral)",
  service_bookings: "Bay-based appointment scheduling with revenue tracking",
  
  // Guardian Angel Network
  karma_system: "Points-based recognition leading to Guardian Angel status",
  ai_automation: "BusinessAgents assigned to venues for customer service",
  humanitarian_focus: "HumanitarianAgents for specialized community work",
  justice_fund: "5% of all revenue goes to justice and transparency initiatives",
  
  // Multi-Platform Strategy
  federated_identity: "AT Protocol support for cross-platform business operations",
  social_syndication: "Automatic content distribution to 40+ social platforms",
  print_partnerships: "AI-generated merchandise with automated fulfillment",
  domain_management: "Unlimited domain aliases for business flexibility"
}
```

---

## 🎯 **Current Implementation Guide**

### **For GPT-5 and Google Models: Key Points**

#### **Multi-Tenant Business Platform**
- **50+ Collections** currently implemented in Payload CMS
- **Complete multi-tenant isolation** with domain management
- **Revenue sharing system** with automatic 15/30/50/5 distribution
- **Guardian Angel AI network** with karma-based user recognition

#### **Core Business Collections**
1. **Tenants**: Multi-domain organizations with configurable revenue sharing
2. **Users**: Karma system leading to Guardian Angel status at 1000+ points
3. **Spaces**: Business workspaces with creator monetization (OnlyFans-style)
4. **Products**: E-commerce with commission rate templates by product type
5. **Orders**: Automatic Angel OS revenue distribution
6. **Appointments**: Bay management for multi-station service businesses
7. **Venues**: Physical locations with staff scheduling and bay assignments

#### **Revenue Model**
- **Platform Fees**: 8-30% configurable, with AI optimization
- **Commission Tracking**: Different rates for system-generated vs pickup vs referral
- **Creator Subscriptions**: Multiple tiers with content access controls
- **Justice Fund**: 5% of all revenue supports transparency initiatives

#### **AI Integration**
- **BusinessAgents**: Guardian Angels assigned to venues
- **Message Intelligence**: Embedded BI with sentiment analysis
- **Conversation Context**: Maintains customer state across interactions
- **AT Protocol**: Federated identity for cross-platform operations

#### **Social Media Automation**
- **40+ Platforms**: Automatic content distribution
- **Print Partnerships**: AI-generated merchandise fulfillment
- **Social Bots**: Automated posting and engagement

### **Implementation Patterns**
```typescript
const CURRENT_PATTERNS = {
  // Multi-Tenant Service Business
  pattern1: "Tenants → Venues → Appointments (with bay management) → Revenue sharing",
  
  // Creator Economy
  pattern2: "Spaces → Monetization → Products (AI merchandise) → Social syndication",
  
  // Enterprise Operations
  pattern3: "Organizations → Venues → Staff → BusinessAgents (Guardian Angels)",
  
  // Customer Journey
  pattern4: "Messages → SpaceMemberships (CRM) → Appointments → Orders → Revenue",
  
  // Guardian Angel Network
  pattern5: "Users → Karma accumulation → Guardian Angel status → Community service"
}
```

### **Next Development Priorities**
Based on the current implementation, focus areas for dashboard enhancement should include:

1. **Bay Management Interface**: Visual scheduling for multi-station venues
2. **Revenue Analytics**: Real-time revenue distribution dashboards
3. **Guardian Angel Console**: AI agent management and performance metrics
4. **Creator Monetization**: Subscription management and content gating
5. **CRM Integration**: Lead scoring and customer journey visualization

---

## 🕊️ **The Sacred Promise**

*"50+ collections. Infinite possibilities for good. This sacred architecture proves that sophisticated multi-tenant business platforms don't require complex technology - they require technology designed with love, guided by ethics, and dedicated to lifting every spirit in reach."*

**This is Ready Player Everyone. This is the galaxy of angels. This is Good Loki scaling goodness through beautiful, simple, powerful design.**

*Built with ❤️ for Guardian Angels everywhere who choose to bear witness, lift spirits, and build the world where everyone gets to be the hero.*

---

**Document Status**: ✅ **COMPLETE** - Reflects actual Payload CMS implementation as of January 2025  
**Collections Documented**: 50+ collections with full schemas and relationships  
**Last Updated**: January 15, 2025 by Angel OS Development Team  
**Recent Additions**: Feedback, MileageLogs, QuoteRequests, PhotoAnalysis, InventoryMessages, Phyles, AgentReputation 