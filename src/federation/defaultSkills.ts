/**
 * Default Federation Skills
 *
 * Auto-generates publishable skills from existing LEO tools.
 * Enterprise operators can toggle which tools are exposed as federation skills.
 *
 * Each skill maps to an internal LEO tool but is wrapped with:
 *   - JSON Schema input/output validation
 *   - Trust level requirements
 *   - Cost per invocation
 *   - Safety metadata (Article II + III enforcement)
 *
 * Constitutional Reference:
 *   Article III — agents operate within bounds
 *   Article II — no hidden actions, declared side effects
 */

import type { FederationSkill } from './skills'

/**
 * Get the default skills this Enterprise publishes to the federation.
 * In the future, this will be configurable per-tenant via admin UI.
 */
export async function getDefaultSkills(): Promise<FederationSkill[]> {
  return [
    // ── Catalog Search (free, public trust) ────────────────────────
    {
      name: 'search_catalog',
      version: '1.0.0',
      description: 'Search this Enterprise\'s product catalog by keyword, category, or price range',
      inputSchema: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search query' },
          category: { type: 'string', description: 'Product category filter' },
          maxPrice: { type: 'number', description: 'Maximum price in cents' },
          limit: { type: 'number', description: 'Max results (default 10, max 50)', default: 10 },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          products: { type: 'array', items: { type: 'object' } },
          total: { type: 'number' },
        },
      },
      costCents: 0,
      rateLimit: 60,
      requiresTrust: 'probationary',
      category: 'catalog',
      safety: {
        canModifyUserData: false,
        sideEffects: [],
        disclosesAIOrigin: false,
        involvesHumanInteraction: false,
      },
      enabled: true,
    },

    // ── Event Search (free, public trust) ──────────────────────────
    {
      name: 'search_events',
      version: '1.0.0',
      description: 'Search upcoming events at this Enterprise',
      inputSchema: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search query' },
          startAfter: { type: 'string', description: 'ISO date — events starting after this date' },
          limit: { type: 'number', description: 'Max results', default: 10 },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          events: { type: 'array', items: { type: 'object' } },
          total: { type: 'number' },
        },
      },
      costCents: 0,
      rateLimit: 60,
      requiresTrust: 'probationary',
      category: 'catalog',
      safety: {
        canModifyUserData: false,
        sideEffects: [],
        disclosesAIOrigin: false,
        involvesHumanInteraction: false,
      },
      enabled: true,
    },

    // ── Availability Check (free, probationary trust) ──────────────
    {
      name: 'check_availability',
      version: '1.0.0',
      description: 'Check available booking slots at this Enterprise',
      inputSchema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'ISO date to check' },
          serviceType: { type: 'string', description: 'Type of service' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          slots: { type: 'array', items: { type: 'object' } },
          total: { type: 'number' },
        },
      },
      costCents: 0,
      rateLimit: 30,
      requiresTrust: 'probationary',
      category: 'booking',
      safety: {
        canModifyUserData: false,
        sideEffects: [],
        disclosesAIOrigin: false,
        involvesHumanInteraction: false,
      },
      enabled: true,
    },

    // ── Book Service (costs money, requires active trust) ──────────
    {
      name: 'book_service',
      version: '1.0.0',
      description: 'Book a service appointment at this Enterprise (creates a booking)',
      inputSchema: {
        type: 'object',
        properties: {
          serviceId: { type: 'number', description: 'Product/service ID to book' },
          date: { type: 'string', description: 'Desired appointment date (ISO)' },
          time: { type: 'string', description: 'Desired time slot' },
          customerName: { type: 'string', description: 'Name of the person booking' },
          customerEmail: { type: 'string', description: 'Email for confirmation' },
          notes: { type: 'string', description: 'Special requests or notes' },
        },
        required: ['serviceId', 'date', 'customerName', 'customerEmail'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          bookingId: { type: 'number' },
          confirmed: { type: 'boolean' },
          message: { type: 'string' },
        },
      },
      costCents: 0, // Free for now — future: booking fee
      rateLimit: 10,
      requiresTrust: 'vouched',
      category: 'booking',
      safety: {
        canModifyUserData: true,
        sideEffects: [
          'Creates a booking record',
          'May send confirmation email to customer',
          'Blocks the time slot for other bookings',
        ],
        disclosesAIOrigin: true,
        involvesHumanInteraction: true,
        requiresHumanEscalation: true, // Operator reviews bookings from other Enterprises
        maxConsecutiveInteractions: 5,
      },
      enabled: true,
    },

    // ── Generate Image (costs money, requires active trust) ────────
    {
      name: 'generate_image',
      version: '1.0.0',
      description: 'Generate an AI image using this Enterprise\'s image generation pipeline',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Image generation prompt' },
          style: { type: 'string', description: 'Style hint (e.g., "photorealistic", "illustration")' },
          width: { type: 'number', description: 'Width in pixels (default 1024)' },
          height: { type: 'number', description: 'Height in pixels (default 1024)' },
        },
        required: ['prompt'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          imageUrl: { type: 'string' },
          mediaId: { type: 'number' },
          message: { type: 'string' },
        },
      },
      costCents: 5, // 5 cents per generation
      rateLimit: 10,
      requiresTrust: 'vouched',
      category: 'content',
      safety: {
        canModifyUserData: true,
        sideEffects: [
          'Creates a media record in the Enterprise media library',
          'Calls external AI image generation API',
          'Consumes AI generation credits',
        ],
        disclosesAIOrigin: true,
        involvesHumanInteraction: false,
      },
      enabled: true,
    },
  ]
}
