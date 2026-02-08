/**
 * Tenant Field Analysis
 * 
 * Analysis of which collections need tenant fields added
 */

export const COLLECTIONS_ANALYSIS = {
  // ✅ HAVE TENANT FIELDS (Good)
  HAS_TENANT_FIELD: [
    'products',           // ✅ Has tenant relationship
    'orders',             // ✅ Has tenant relationship  
    'contacts',           // ✅ Has tenant relationship
    'spaces',             // ✅ Has tenant relationship
    'appointments',       // ✅ Uses tenantField
    'leads',              // ✅ Uses tenantField
    'opportunities',      // ✅ Uses tenantField
    'projects',           // ✅ Uses tenantField
    'tasks',              // ✅ Uses tenantField
    'campaigns',          // ✅ Uses tenantField
    'workflows',          // ✅ Has tenant relationship
    'business-agents',    // ✅ Has tenant relationship
    'social-media-bots',  // ✅ Has tenant relationship
    'linked-accounts',    // ✅ Has tenant relationship
    'web-chat-sessions',  // ✅ Has tenant relationship
    'invoices',           // ✅ Has tenant relationship
    'donations',          // ✅ Has tenant relationship
    'documents',          // ✅ Has tenant relationship
    'feedback',           // ✅ Has tenant relationship
    'events',             // ✅ Has tenant relationship
  ],

  // ❌ MISSING TENANT FIELDS (Need Adding)
  NEEDS_TENANT_FIELD: [
    'media',              // ❌ Currently global - CRITICAL for tenant isolation
    'pages',              // ❌ Content should be tenant-specific
    'posts',              // ❌ Blog posts should be tenant-specific
    'categories',         // ❌ Product categories should be tenant-specific
    'messages',           // ❌ No direct tenant field (uses space relationship)
    'schools',            // ❌ SafeSchool data should be tenant-specific
    'invitations',        // ❌ Invites should be tenant-scoped
    'quote-requests',     // ❌ Quotes should be tenant-specific
  ],

  // 📊 TEXT-BASED TENANT ID (Legacy - Should Convert)
  HAS_TEXT_TENANT_ID: [
    'channels',           // 🔄 Uses tenantId as text
    'photo-analysis',     // 🔄 Uses tenantId as text
    'mileage-logs',       // 🔄 Uses tenantId as text
    'inventory-messages', // 🔄 Uses tenantId as text
  ],

  // 🌐 GLOBAL COLLECTIONS (Should Stay Global)
  SHOULD_BE_GLOBAL: [
    'users',              // 🌐 Users can belong to multiple tenants
    'tenant-memberships', // 🌐 Cross-tenant relationships
    'space-memberships',  // 🌐 Cross-tenant relationships
    'tenants',            // 🌐 Platform-level
    'tenant-management',  // 🌐 Platform-level
    'angel-tokens',       // 🌐 Platform currency
    'token-balances',     // 🌐 Platform currency
    'angel-os-nodes',     // 🌐 Platform infrastructure
    'tenant-distribution',// 🌐 Platform infrastructure
    'humanitarian-agents',// 🌐 Platform-level
    'ai-generation-queue',// 🌐 Platform-level
    'job-queue',          // 🌐 Platform-level
    'roadmap-features',   // 🌐 Platform roadmap
    'organizations',      // 🌐 Can span multiple tenants
    'venues',             // 🌐 Can span multiple tenants
    'phyles',             // 🌐 Platform-level
    'agent-reputation',   // 🌐 Platform-level
  ],
}

/**
 * Priority order for adding tenant fields
 */
export const TENANT_FIELD_PRIORITY = [
  // CRITICAL (Data isolation required)
  { collection: 'media', priority: 'CRITICAL', reason: 'File isolation essential for multi-tenant security' },
  { collection: 'pages', priority: 'CRITICAL', reason: 'Website content must be tenant-specific' },
  { collection: 'posts', priority: 'CRITICAL', reason: 'Blog content must be tenant-specific' },
  { collection: 'categories', priority: 'HIGH', reason: 'Product categories should be tenant-specific' },
  
  // HIGH (Business functionality)
  { collection: 'schools', priority: 'HIGH', reason: 'SafeSchool data must be tenant-isolated' },
  { collection: 'quote-requests', priority: 'HIGH', reason: 'Business quotes must be tenant-specific' },
  { collection: 'invitations', priority: 'MEDIUM', reason: 'Invites should be scoped to tenant' },
  
  // MEDIUM (Convert text to relationship)
  { collection: 'channels', priority: 'MEDIUM', reason: 'Convert tenantId text to relationship' },
  { collection: 'photo-analysis', priority: 'LOW', reason: 'Convert tenantId text to relationship' },
  { collection: 'mileage-logs', priority: 'LOW', reason: 'Convert tenantId text to relationship' },
]

/**
 * Collections that need immediate attention
 */
export const CRITICAL_MISSING_TENANT_FIELDS = [
  'media',
  'pages', 
  'posts',
  'categories'
]








