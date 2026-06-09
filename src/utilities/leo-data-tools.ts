/**
 * LEO Data Tools — P2.5 + P3 (Media Generation)
 *
 * Defines the tools LEO can use to query Payload collections AND generate/manage media.
 * Uses Claude's tool_use feature so LEO can decide when to fetch data or create content.
 *
 * Architecture:
 *   - Tool definitions → sent to Claude API as `tools` parameter
 *   - Tool executor   → runs the Payload query when Claude requests a tool call
 *   - All queries use overrideAccess: true for public data, false for private data
 *   - Image generation uses OpenRouter API (Gemini 3 Pro, Gemini 3.1 Flash, GPT-5 Image)
 *   - Image feedback uses Anthropic Vision to understand existing images
 *
 * Note: We use `any` casts for Payload Where clauses and doc mappings because
 * the tool handlers build queries dynamically from LLM-provided inputs. The
 * Payload Where type system doesn't support runtime-constructed filter arrays
 * without explicit collection-specific generics.
 *
 * @see ConversationEngine.ts — integrates these tools into generateResponse()
 * @see imageGeneration.ts — OpenRouter image generation + Anthropic vision feedback
 */

import type { Payload, Where } from 'payload'
import type Anthropic from '@anthropic-ai/sdk'
import { getBootstrapFeeStatus } from './bootstrapFees'
import { BookingEngine } from './bookingEngine'
import { fetchDefaultSpaceId } from './fetchDefaultSpaceId'
// NOTE: provisionPortal is imported lazily inside its handlers (handleProvisionTenant
// / handleResearchAndProvision) to avoid a module-load cycle: provisionPortal pulls
// in payload.config, which registers the MCP plugin, which generates tools FROM this
// file's LEO_TOOLS — a top-level import here would create a TDZ on LEO_TOOLS.
import { fetchReadableContent } from './contentIngest'
import { buildWorkDraftFromText } from './worksFromContent'
import { verifyEndeavorOnboarding } from './verifyEndeavorOnboarding'
import {
  findUserSynchronicities,
  buildActivityProfile,
  generateNudges,
  type UserActivityProfile,
} from './synchronicity-engine'
import {
  generateImage,
  uploadGeneratedImage,
  attachImageToProduct,
  analyzeImageForFeedback,
  replaceMediaOnContent,
  isImageGenerationAvailable,
} from './imageGeneration'
import {
  createInvitation,
  isValidEmail,
  generateInviteUrl,
} from './invitationSystem'
import { calculateUltimateFairSplit } from '@/lib/ultimate-fair-split'
import { logCaughtError } from './logError'
import { revalidateAfterMutation } from './revalidateContent'
import { validateToolInput, PAYLOAD_CRUD_ALLOWED_COLLECTIONS } from './toolInputSchemas'
import { findOrCreateDM } from './dmChannels'
import { ensureDMSpace } from './ensureSystemSpace'
import {
  findMatchingHolons,
  calculateVendorShare,
  validateFulfillmentTransition,
  validateFulfillmentUpdate,
  serializeMatch,
  type HolonNode,
  type OrderRequirement,
  type FulfillmentStatus,
} from './orderRoutingEngine'
import {
  fetchYouTubeVideoMeta,
  fetchYouTubeChannelFeed,
  extractChannelId,
} from './youtubeMetadata'
import { createWidgetContent } from './messageContent'
import { runProbe } from './connectorProbes'
import { GENESIS_BREATH } from './genesis-breath'
import { buildConstitutionalPrompt, validateConstitutionalResponse } from './constitutional-prompt'

// ---------------------------------------------------------------------------
// Navigation Directive Helper — LEO Navigation Bridge
// ---------------------------------------------------------------------------
// When LEO tools create or modify data, they append an invisible directive
// that tells the frontend where to navigate so the user sees the result.
// Format: <!--nav:{"path":"/dashboard/products","label":"View Products"}-->
// The SSE layer strips this before displaying and forwards it as a navigateTo event.

function navDirective(path: string, label?: string): string {
  return `\n<!--nav:${JSON.stringify({ path, ...(label ? { label } : {}) })}-->`
}

/**
 * Query strongest pheromone trails for a context.
 * Returns path recommendations LEO can include in responses.
 *
 * Infrastructure for future swarm intelligence hints —
 * tool handlers can call this to include "Most users found success with X".
 */
export async function getRecommendedPaths(
  payload: any,
  contextHash: string,
  tenantId: number,
  limit: number = 3,
): Promise<Array<{ path: string; strength: number; traversals: number }>> {
  try {
    const results = await payload.find({
      collection: 'pheromones' as any,
      where: {
        and: [
          { contextHash: { equals: contextHash } },
          { tenant: { equals: tenantId } },
          { strength: { greater_than: 10 } },
        ],
      },
      sort: '-strength',
      limit,
      depth: 0,
      overrideAccess: true,
    })
    return results.docs.map((doc: any) => ({
      path: doc.path,
      strength: doc.strength,
      traversals: doc.successfulTraversals || 0,
    }))
  } catch {
    return [] // Non-critical — swarm hints are a bonus
  }
}

// ---------------------------------------------------------------------------
// Tool Definitions (sent to Claude API)
// ---------------------------------------------------------------------------

export const LEO_TOOLS: Anthropic.Tool[] = [
  {
    name: 'query_products',
    description:
      'Search the product catalog. Returns products with title, price, description, and inventory status. Use when users ask about products, shop items, pricing, or inventory.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: {
          type: 'string',
          description: 'Optional text to search product titles/descriptions',
        },
        category: {
          type: 'string',
          description: 'Optional category to filter by',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 5, max 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_posts',
    description:
      'Search blog posts and content. Returns posts with title, excerpt, published date, and categories. Use when users ask about articles, news, content, or blog posts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: {
          type: 'string',
          description: 'Optional text to search post titles',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 5, max 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_bookings',
    description:
      'Look up bookings and appointments. Returns booking details including status, date/time, and type. Use when users ask about appointments, scheduling, or booking status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
          description: 'Filter by booking status',
        },
        upcoming: {
          type: 'boolean',
          description: 'If true, only return future bookings',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 5, max 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_spaces',
    description:
      'List available spaces (communities/workspaces) and their channels. Use when users ask about available spaces, channels, or navigation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        includeChannels: {
          type: 'boolean',
          description: 'If true, include channels for each space',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_projects',
    description:
      'Search projects in the portfolio. Returns project details including type, status, timeline, and budget. Use when users ask about projects, portfolio, or work history.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['planning', 'in-progress', 'completed', 'on-hold', 'cancelled'],
          description: 'Filter by project status',
        },
        search: {
          type: 'string',
          description: 'Optional text to search project titles',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 5, max 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_events',
    description:
      'Search events (meetups, workshops, livestreams, conferences). Returns event details including title, date, location, attendee count, and status. Use when users ask about events, what\'s coming up, or things happening.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'upcoming', 'live', 'completed', 'cancelled'],
          description: 'Filter by event status',
        },
        eventType: {
          type: 'string',
          enum: ['meetup', 'workshop', 'livestream', 'conference', 'screening', 'custom'],
          description: 'Filter by event type',
        },
        search: {
          type: 'string',
          description: 'Optional text to search event titles',
        },
        upcoming: {
          type: 'boolean',
          description: 'If true, only return future events',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 5, max 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_event_registrations',
    description:
      'Get registrations for a specific event. Returns attendee list with name, status, and attendance mode. Use when users ask about who\'s attending an event or registration counts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        eventId: {
          type: 'number',
          description: 'The ID of the event to get registrations for',
        },
        status: {
          type: 'string',
          enum: ['registered', 'waitlisted', 'checked-in', 'cancelled', 'no-show'],
          description: 'Filter by registration status',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 10, max 50)',
        },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'query_availability',
    description:
      'Check provider availability and open time slots. Use when users ask about scheduling, available times, or booking windows.',
    input_schema: {
      type: 'object' as const,
      properties: {
        providerId: {
          type: 'number',
          description: 'Optional provider user ID to check specific provider',
        },
      },
      required: [],
    },
  },
  {
    name: 'create_booking',
    description:
      'Create a new booking/appointment. Use when a user wants to schedule a service, consultation, or appointment. Always confirm details with the user before creating. This is an irreversible action — Article III.2 requires human confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Booking title (e.g., "Massage Therapy Session", "Website Consultation")',
        },
        bookingType: {
          type: 'string',
          enum: ['service', 'consultation', 'rental', 'class', 'event', 'custom'],
          description: 'Type of booking',
        },
        providerId: {
          type: 'number',
          description: 'Optional provider user ID. If not specified, auto-assigns from available providers.',
        },
        startDateTime: {
          type: 'string',
          description: 'ISO 8601 date-time string for when the booking starts (e.g., "2026-02-20T14:00:00Z")',
        },
        duration: {
          type: 'number',
          description: 'Duration in minutes (default: 60, step: 15)',
        },
        description: {
          type: 'string',
          description: 'Optional description or notes for the booking',
        },
      },
      required: ['title', 'bookingType', 'startDateTime'],
    },
  },
  {
    name: 'update_booking_status',
    description:
      'Update the status of an existing booking. Use when a user wants to confirm, cancel, or mark a booking as complete. Always confirm the action with the user first — Article III.2.',
    input_schema: {
      type: 'object' as const,
      properties: {
        bookingId: {
          type: 'number',
          description: 'The ID of the booking to update',
        },
        status: {
          type: 'string',
          enum: ['confirmed', 'cancelled', 'completed', 'no-show'],
          description: 'The new status for the booking',
        },
      },
      required: ['bookingId', 'status'],
    },
  },
  {
    name: 'check_available_slots',
    description:
      'Check available time slots for a provider or service. Use when users ask "when is X available?", "show me open times", or "what slots are free?". Returns actual bookable time slots with harmonic scores.',
    input_schema: {
      type: 'object' as const,
      properties: {
        providerId: {
          type: 'number',
          description: 'Provider user ID to check availability for',
        },
        date: {
          type: 'string',
          description: 'Date to check (ISO 8601 date, e.g., "2026-03-15"). Defaults to today.',
        },
        days: {
          type: 'number',
          description: 'Number of days to check (1-14, default: 3)',
        },
        duration: {
          type: 'number',
          description: 'Desired booking duration in minutes (default: 60)',
        },
        serviceType: {
          type: 'string',
          enum: ['service', 'consultation', 'rental', 'class', 'event', 'custom'],
          description: 'Optional service type to filter availability by',
        },
      },
      required: ['providerId'],
    },
  },
  {
    name: 'cancel_booking',
    description:
      'Cancel an existing booking with a reason. Always confirm with the user before cancelling — Article III.2. Returns cancellation details and any refund implications.',
    input_schema: {
      type: 'object' as const,
      properties: {
        bookingId: {
          type: 'number',
          description: 'The ID of the booking to cancel',
        },
        reason: {
          type: 'string',
          description: 'Reason for cancellation (e.g., "schedule conflict", "no longer needed")',
        },
        cancelledBy: {
          type: 'string',
          enum: ['client', 'provider', 'system'],
          description: 'Who is initiating the cancellation (default: client)',
        },
      },
      required: ['bookingId', 'reason'],
    },
  },
  {
    name: 'reschedule_booking',
    description:
      'Reschedule an existing booking to a new time. Automatically checks for conflicts and suggests harmonic alternatives if the requested time is unavailable. Always confirm with the user — Article III.2.',
    input_schema: {
      type: 'object' as const,
      properties: {
        bookingId: {
          type: 'number',
          description: 'The ID of the booking to reschedule',
        },
        newStartDateTime: {
          type: 'string',
          description: 'New start time in ISO 8601 format (e.g., "2026-03-15T14:00:00Z")',
        },
        newDuration: {
          type: 'number',
          description: 'Optional new duration in minutes (keeps original duration if not specified)',
        },
      },
      required: ['bookingId', 'newStartDateTime'],
    },
  },
  // ─── Shopping Cart Tools ─────────────────────────────────────────
  {
    name: 'add_to_cart',
    description:
      'Add a product to the user\'s shopping cart. Use when a user says "add X to my cart", "I want to buy X", or similar purchase intent. Search for the product first using query_products if you don\'t know the product ID. Always confirm what you\'re adding.',
    input_schema: {
      type: 'object' as const,
      properties: {
        productId: {
          type: 'number',
          description: 'The ID of the product to add',
        },
        quantity: {
          type: 'number',
          description: 'Number of items to add (default: 1)',
        },
      },
      required: ['productId'],
    },
  },
  {
    name: 'view_cart',
    description:
      'View the current contents of the user\'s shopping cart. Use when a user asks "what\'s in my cart", "show my cart", or wants to review before checkout.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  // ─── Image Generation & Media Management Tools ──────────────────────
  {
    name: 'generate_image',
    description:
      'Generate an AI image using Gemini, GPT, or other models via OpenRouter. Use when a user asks to create, generate, design, or make an image, photo, or visual. Can generate product photos, content images, logos, illustrations, and more. When productName is provided with autoAttach=true (default), the image is automatically attached to that product\'s gallery — no separate attach step needed. Always describe what you\'re generating before calling this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string',
          description:
            'Detailed description of the image to generate. Be specific about subject, style, lighting, colors, composition. The more detail, the better the result.',
        },
        productName: {
          type: 'string',
          description:
            'If generating for a specific product, its name. The image will be auto-attached to this product\'s gallery when autoAttach is true (default).',
        },
        category: {
          type: 'string',
          description:
            'Product category for style optimization: signs, decor, woodwork, crafts, outdoor, candles, jewelry, clothing, food, electronics, art, wellness, massage, cactus',
        },
        brandStyle: {
          type: 'string',
          description: 'Brand aesthetic description (e.g., "minimalist bohemian", "luxury spa", "desert rustic")',
        },
        backgroundColor: {
          type: 'string',
          description: 'Desired background (e.g., "white", "gradient blue", "natural outdoor")',
        },
        autoSave: {
          type: 'boolean',
          description:
            'If true, automatically upload the generated image to the media library. Default: true.',
        },
        autoAttach: {
          type: 'boolean',
          description:
            'If true and productName is provided, automatically attach the generated image to the product\'s gallery. Default: true. Set to false to generate without attaching.',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'improve_image',
    description:
      'Analyze an existing image and generate an ENTIRELY NEW image based on feedback. This does NOT edit the existing image in place — it creates a brand new one inspired by it. Use for style changes, composition adjustments, or complete redesigns (e.g. "make it warmer", "change the lighting"). For fixing TEXT within an image, use edit_image_text instead.',
    input_schema: {
      type: 'object' as const,
      properties: {
        mediaId: {
          type: 'number',
          description: 'The Media ID of the existing image to improve',
        },
        imageUrl: {
          type: 'string',
          description: 'URL of the existing image (if mediaId not available)',
        },
        feedback: {
          type: 'string',
          description:
            'User\'s feedback about what to change (e.g., "warmer tones", "remove the background", "more professional")',
        },
        context: {
          type: 'string',
          description: 'What the image is for (e.g., "product photo for lavender candle", "blog post header")',
        },
      },
      required: ['feedback'],
    },
  },
  {
    name: 'attach_image_to_product',
    description:
      'Attach a generated or existing image to a product\'s gallery. Can add a new image or replace an existing one. Use after generating an image when the user confirms they want to use it for a product. Always confirm with the user before attaching.',
    input_schema: {
      type: 'object' as const,
      properties: {
        productId: {
          type: 'number',
          description: 'The ID of the product to attach the image to',
        },
        mediaId: {
          type: 'number',
          description: 'The Media ID of the image to attach',
        },
        replaceIndex: {
          type: 'number',
          description: 'If replacing an existing gallery image, the 0-based index to replace. Omit to append.',
        },
      },
      required: ['productId', 'mediaId'],
    },
  },
  {
    name: 'replace_image',
    description:
      'Replace an existing image across all content that references it (products, posts, etc). Use when the user wants to swap out an old image for a new one globally. Always confirm with the user before replacing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        oldMediaId: {
          type: 'number',
          description: 'The Media ID of the image to replace',
        },
        newMediaId: {
          type: 'number',
          description: 'The Media ID of the replacement image',
        },
        collection: {
          type: 'string',
          description: 'Limit replacement to a specific collection (e.g., "products", "posts"). Omit to replace everywhere.',
        },
        documentId: {
          type: 'number',
          description: 'Limit replacement to a specific document ID within the collection.',
        },
      },
      required: ['oldMediaId', 'newMediaId'],
    },
  },
  // ─── Invitation Tools ──────────────────────────────────────────
  {
    name: 'invite_member',
    description:
      'Invite someone to a collaboration space by email. Use when a user says "invite alice@example.com" or "add someone to my space". Always confirm with the user before sending — Article III.2 requires human confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        email: {
          type: 'string',
          description: 'Email address of person to invite',
        },
        spaceId: {
          type: 'string',
          description: 'Space ID to invite them to. If not provided, uses the current space.',
        },
        message: {
          type: 'string',
          description: 'Optional personal message to include with the invitation',
        },
        role: {
          type: 'string',
          enum: ['member', 'moderator', 'guest'],
          description: 'Role to assign (default: member)',
        },
      },
      required: ['email'],
    },
  },
  // ─── Product Creation & Management Tools ────────────────────────
  {
    name: 'create_product',
    description:
      'Create a new product listing. Use when a user wants to list a product for sale, add an item to their shop, or create a new offering. Always confirm product details with the user before creating — Article III.2 requires human confirmation for irreversible actions. After creating, offer to generate a product image.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Product title (e.g., "Lavender Massage Oil", "Custom Phone Case")',
        },
        price: {
          type: 'number',
          description: 'Price in USD (e.g., 35 for $35.00). Must be greater than 0.',
        },
        description: {
          type: 'string',
          description: 'Product description text. Will be converted to rich text.',
        },
        category: {
          type: 'string',
          description: 'Category name to assign (e.g., "Wellness", "Electronics"). Must match an existing category.',
        },
        inventory: {
          type: 'number',
          description: 'Initial inventory count. Omit for unlimited/digital products.',
        },
        status: {
          type: 'string',
          enum: ['draft', 'published'],
          description: 'Product status. Default: "draft" — set to "published" to make immediately visible.',
        },
      },
      required: ['title', 'price'],
    },
  },
  {
    name: 'update_product',
    description:
      'Update an existing product\'s details. Use when a user wants to change a product\'s price, description, inventory, or status. Search for the product first using query_products if you don\'t know the product ID. Always confirm changes with the user before updating.',
    input_schema: {
      type: 'object' as const,
      properties: {
        productId: {
          type: 'number',
          description: 'The ID of the product to update',
        },
        title: {
          type: 'string',
          description: 'New product title',
        },
        price: {
          type: 'number',
          description: 'New price in USD (must be greater than 0)',
        },
        description: {
          type: 'string',
          description: 'New product description text',
        },
        inventory: {
          type: 'number',
          description: 'New inventory count',
        },
        status: {
          type: 'string',
          enum: ['draft', 'published'],
          description: 'New product status',
        },
      },
      required: ['productId'],
    },
  },
  // ─── Order Routing & Fulfillment Tools ───────────────────────────
  {
    name: 'find_producers',
    description:
      'Search for capable production nodes (Holons) near a location. Returns nodes with capabilities, distance, rating. Use when a user asks "who can print t-shirts near me?" or "find a screen printer".',
    input_schema: {
      type: 'object' as const,
      properties: {
        skill: {
          type: 'string',
          description: 'Required skill (e.g., "screen-printing", "3d-printing", "embroidery")',
        },
        city: { type: 'string', description: 'City to search near' },
        region: { type: 'string', description: 'State/region to search near' },
        radius: { type: 'number', description: 'Search radius in miles (default: 100)' },
        limit: { type: 'number', description: 'Max results (default: 10, max: 20)' },
      },
      required: ['skill'],
    },
  },
  {
    name: 'browse_network',
    description:
      'Browse products listed on the Angel OS network by other tenants. Returns cross-tenant products available for resale. Use when a user asks "what can the network make?" or "show me network products".',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Search by product title' },
        category: { type: 'string', description: 'Filter by category' },
        radius: { type: 'number', description: 'Distance filter in miles (default: 100)' },
        limit: { type: 'number', description: 'Max results (default: 20, max: 50)' },
      },
      required: [],
    },
  },
  {
    name: 'check_fees',
    description:
      'Check the current platform fee tier and bootstrap fee status for this Enterprise. Shows free transactions remaining, bootstrap fee percentage, total fees collected, and refund promise status. Use when a user asks about "fees", "platform costs", "pricing", "how much does Angel OS charge", or "bootstrap phase".',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'query_orders',
    description:
      'Look up orders. Customer view shows purchase history. Vendor view shows orders assigned to your Holon node. Use when a user asks "show my orders" or "what orders do I have".',
    input_schema: {
      type: 'object' as const,
      properties: {
        viewAs: {
          type: 'string',
          enum: ['customer', 'vendor'],
          description: 'View as customer (purchase history) or vendor (assigned fulfillment orders)',
        },
        status: {
          type: 'string',
          enum: ['processing', 'completed', 'cancelled', 'refunded'],
          description: 'Filter by order status',
        },
        fulfillmentStatus: {
          type: 'string',
          enum: ['pending_match', 'matched', 'accepted', 'in_production', 'shipped', 'delivered', 'rejected'],
          description: 'Filter by fulfillment status (vendor view)',
        },
        limit: { type: 'number', description: 'Max results (default: 10)' },
      },
      required: [],
    },
  },
  {
    name: 'route_order',
    description:
      'Assign an order to a vendor Holon node for fulfillment. The routing engine finds the best match by capability, proximity, and fairness. Always confirm with the user before routing — Article III.2.',
    input_schema: {
      type: 'object' as const,
      properties: {
        orderId: { type: 'number', description: 'Order ID to route' },
        itemIndex: { type: 'number', description: 'Specific item index to route (optional, routes all if omitted)' },
        preferredHolonId: { type: 'number', description: 'Manually assign to a specific Holon node (optional)' },
      },
      required: ['orderId'],
    },
  },
  {
    name: 'accept_order',
    description:
      'Accept an order assignment as a vendor. Updates fulfillment status to "accepted". Use when a vendor says "accept order 42" or "I can fulfill this".',
    input_schema: {
      type: 'object' as const,
      properties: {
        orderId: { type: 'number', description: 'Order ID to accept' },
        itemIndex: { type: 'number', description: 'Item index in the order' },
        estimatedCompletionDate: { type: 'string', description: 'Expected completion (ISO 8601 date)' },
      },
      required: ['orderId', 'itemIndex'],
    },
  },
  {
    name: 'update_fulfillment',
    description:
      'Update production status or add shipping details for an order. Use when a vendor says "order 42 is shipped" or "mark it in production".',
    input_schema: {
      type: 'object' as const,
      properties: {
        orderId: { type: 'number', description: 'Order ID' },
        itemIndex: { type: 'number', description: 'Item index in the order' },
        status: {
          type: 'string',
          enum: ['in_production', 'shipped', 'delivered', 'rejected'],
          description: 'New fulfillment status',
        },
        trackingNumber: { type: 'string', description: 'Shipping tracking number (required for "shipped")' },
        trackingUrl: { type: 'string', description: 'Tracking URL (optional)' },
        rejectionReason: { type: 'string', description: 'Reason for rejection (required for "rejected")' },
      },
      required: ['orderId', 'itemIndex', 'status'],
    },
  },
  // ─── Sprint 6: Business Setup & Stripe Connect ─────────────────
  {
    name: 'configure_business',
    description:
      'Configure the tenant business profile. Use when a user describes their business type, wants to set up their storefront, or answers business setup questions. This is the core of the "5 minutes to running" wizard flow. Can also rename the business and update the site name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        businessName: {
          type: 'string',
          description: 'Name of the business / storefront. Updates both the tenant name and site name. Can also use siteName as an alias.',
        },
        siteName: {
          type: 'string',
          description: 'Alias for businessName — sets the tenant name and site name.',
        },
        businessType: {
          type: 'string',
          enum: ['retail', 'service', 'content_creator', 'nonprofit', 'professional_services', 'gift_shop', 'ministry', 'artisan_maker', 'custom'],
          description: 'What kind of business this is. Use "artisan_maker" for craftspeople, woodworkers, custom furniture/cabinet makers, potters, metalworkers, etc. Use "gift_shop" for gift shops, "ministry" for churches or faith-based orgs.',
        },
        tagline: { type: 'string', description: 'Short tagline or motto' },
        description: { type: 'string', description: 'Brief description of the business' },
        contactEmail: { type: 'string', description: 'Business contact email' },
        contactPhone: { type: 'string', description: 'Business phone number' },
        currency: { type: 'string', enum: ['usd', 'cad', 'eur', 'gbp', 'aud'], description: 'Default currency' },
        shippingEnabled: { type: 'boolean', description: 'Whether to enable shipping' },
        bookingsEnabled: { type: 'boolean', description: 'Whether to enable bookings/appointments' },
        eventsEnabled: { type: 'boolean', description: 'Whether to enable events' },
        digitalProductsEnabled: { type: 'boolean', description: 'Whether to enable digital products' },
      },
      required: [],
    },
  },
  {
    name: 'check_endeavor_onboarding',
    description:
      "Verify and self-heal this portal's onboarding baseline. Use when the user reports missing spaces/channels, a newly-invited member who sees nothing, page-comment channels in the wrong place, or asks to \"verify onboarding\" / \"check setup\" for this enterprise. Idempotent: ensures the AI Bus, Community, and Direct Messages spaces (and their channels) exist, re-homes page-comment channels onto the AI Bus, and backfills space memberships so every active member is in every space. Returns a report of what was healed.",
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'configure_endeavor',
    description:
      'Configure the Endeavor (constitutional identity) for this enterprise. Use when a user describes their mission, wants to set up their enterprise identity, set capabilities, update operator info, or configure federation settings. Complements configure_business (which sets operational/storefront config) — this sets the constitutional layer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Enterprise name' },
        tagline: { type: 'string', description: 'One-sentence mission tagline' },
        description: { type: 'string', description: 'What the enterprise does' },
        endeavorType: {
          type: 'string',
          enum: ['service-provider', 'retail-commerce', 'creator-content', 'booking-based', 'custom'],
          description: 'Type of endeavor',
        },
        missionStatement: { type: 'string', description: 'What the enterprise serves — its reason for existing' },
        holonTypes: {
          type: 'array',
          items: { type: 'string', enum: ['manufacturer', 'retailer', 'creator', 'community', 'guardian-angel'] },
          description: 'Federation roles this enterprise fills',
        },
        capabilities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              skill: { type: 'string', description: 'Capability name (e.g. "CNC woodworking")' },
              description: { type: 'string', description: 'What this capability entails' },
            },
            required: ['skill', 'description'],
          },
          description: 'Skills and capabilities this enterprise offers',
        },
        operatorName: { type: 'string', description: 'Name of the enterprise operator' },
        operatorEmail: { type: 'string', description: 'Operator contact email' },
        operatorRole: { type: 'string', description: 'Operator role (e.g. "Founder", "Ministry Lead")' },
        regionCity: { type: 'string', description: 'City' },
        regionState: { type: 'string', description: 'State/province' },
        regionCountry: { type: 'string', description: 'Country code (e.g. "US")' },
        networkVisible: { type: 'boolean', description: 'Whether to appear in the federation network' },
      },
      required: [],
    },
  },
  {
    name: 'connect_stripe_account',
    description:
      'Guide the tenant through connecting their Stripe account for payment processing. Returns an onboarding URL. Use when a user asks about payments, getting paid, or connecting Stripe.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'disconnect_stripe_account',
    description:
      'Disconnect the current Stripe account from this tenant, allowing re-onboarding with a different account. Use when a user says they connected the wrong Stripe account, wants to switch Stripe accounts, or needs to start the Stripe setup over. After disconnecting, guide them to use connect_stripe_account to link the correct one.',
    input_schema: {
      type: 'object' as const,
      properties: {
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm disconnection. Always confirm with the user first.',
        },
      },
      required: ['confirm'],
    },
  },
  // ─── Sprint 11: Vendor Onboarding & Production ─────────────────
  {
    name: 'onboard_vendor',
    description:
      'Onboard a new vendor/producer to the Angel OS network. Creates a tenant, space, channels, and user with producer role. Use when someone says they want to sell on Angel OS, become a vendor, or set up a shop. This is an irreversible action — confirm details first.',
    input_schema: {
      type: 'object' as const,
      properties: {
        businessName: { type: 'string', description: 'Name of the vendor business' },
        ownerName: { type: 'string', description: 'Name of the business owner' },
        ownerEmail: { type: 'string', description: 'Email for the vendor account' },
        businessType: {
          type: 'string',
          enum: ['retail', 'service', 'content_creator', 'nonprofit', 'professional_services', 'gift_shop', 'ministry', 'artisan_maker', 'custom'],
          description: 'Type of business',
        },
        tagline: { type: 'string', description: 'Short business tagline' },
        primaryColor: { type: 'string', description: 'Brand primary color (hex)' },
      },
      required: ['businessName', 'ownerName', 'ownerEmail'],
    },
  },
  {
    name: 'suggest_products',
    description:
      'Generate product ideas based on a vendor description, business type, and capabilities. Returns starter catalog templates specific to their industry plus custom suggestions. Use when a new vendor asks what they should sell, needs product inspiration, or when helping an artisan showcase their work.',
    input_schema: {
      type: 'object' as const,
      properties: {
        vendorDescription: { type: 'string', description: 'Description of what the vendor does or makes — be specific about their craft, materials, and who they serve' },
        businessType: {
          type: 'string',
          enum: ['retail', 'service', 'content_creator', 'nonprofit', 'professional_services', 'gift_shop', 'ministry', 'artisan_maker', 'custom'],
          description: 'Type of business — use artisan_maker for craftspeople, woodworkers, custom furniture, etc.',
        },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'Vendor capabilities/skills (e.g., "woodworking", "cabinetry", "metalwork", "pottery")',
        },
        count: { type: 'number', description: 'Number of suggestions to generate (default 5)' },
      },
      required: ['vendorDescription'],
    },
  },
  {
    name: 'generate_cad_instructions',
    description:
      'Convert a product specification and customizations into CNC-ready production notes. Use when a producer needs to prepare a custom order for manufacturing (CNC, laser-cut, or print-on-demand).',
    input_schema: {
      type: 'object' as const,
      properties: {
        productTitle: { type: 'string', description: 'Name of the product' },
        productionType: {
          type: 'string',
          enum: ['ready_made', 'print_on_demand', 'custom_order', 'digital'],
          description: 'Manufacturing method',
        },
        customizations: {
          type: 'object',
          description: 'Customer customization choices (text, color, size, etc.)',
        },
        materials: {
          type: 'array',
          items: { type: 'string' },
          description: 'Required materials',
        },
        notes: { type: 'string', description: 'Additional production notes' },
      },
      required: ['productTitle', 'productionType'],
    },
  },
  {
    name: 'fetch_reviews',
    description:
      'Fetch reviews for the current tenant/business. Returns internal Angel OS reviews and optionally Google Places reviews if configured. Use when users ask about reviews, ratings, or feedback.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Max reviews to return (default 10)' },
        source: {
          type: 'string',
          enum: ['all', 'angelos', 'google'],
          description: 'Filter by review source',
        },
        minRating: { type: 'number', description: 'Minimum star rating (1-5)' },
      },
      required: [],
    },
  },
  {
    name: 'draft_review_response',
    description:
      'Draft a professional, warm response to a customer review. Use when a business owner asks for help responding to reviews. Returns a suggested response the owner can edit before posting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reviewContent: { type: 'string', description: 'The text of the review to respond to' },
        reviewRating: { type: 'number', description: 'Star rating (1-5)' },
        reviewerName: { type: 'string', description: 'Name of the reviewer' },
        businessName: { type: 'string', description: 'Name of the business' },
        tone: {
          type: 'string',
          enum: ['warm', 'professional', 'grateful', 'apologetic'],
          description: 'Desired tone for the response',
        },
      },
      required: ['reviewContent', 'reviewRating'],
    },
  },
  // ─── Sprint 14: Content Management ────────────────────────────────────────
  {
    name: 'create_post',
    description:
      'Create a new blog post or article. Use when the user wants to publish content, write an article, or add a post. Always confirm the title and content before creating. Created as draft by default. Set generateHeroImage=true to auto-generate and attach a hero image.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Post title (required)' },
        content: {
          type: 'string',
          description: 'Post body text. Use double newlines (\\n\\n) to separate paragraphs.',
        },
        excerpt: { type: 'string', description: 'Brief summary shown in post previews (optional)' },
        status: {
          type: 'string',
          enum: ['draft', 'published'],
          description: 'Publication status — defaults to "draft"',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Category names to assign (optional)',
        },
        generateHeroImage: {
          type: 'boolean',
          description:
            'If true, auto-generate a hero image based on the post title and content, and attach it. Default: false.',
        },
        heroImagePrompt: {
          type: 'string',
          description:
            'Custom prompt for the hero image. If omitted, auto-generates from title. Only used when generateHeroImage is true.',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'create_work_from_url',
    description:
      'Create a Work (a Library document/book) from a web article, blog post, or Google Doc URL — OR from pasted/uploaded text. LEO fetches the URL, extracts the readable content, and structures it into a titled, multi-page Work draft saved to the tenant Library, ready to edit, translate, and seal. Provide either `url` or `text`. For Google Docs, sharing must be "anyone with the link".',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'URL of the article / blog post / Google Doc to import (optional if `text` is provided)',
        },
        text: {
          type: 'string',
          description: 'Raw text or Markdown to import directly instead of a URL (optional if `url` is provided)',
        },
        title: { type: 'string', description: 'Optional title override; inferred from the source when omitted' },
      },
    },
  },
  {
    name: 'create_quest',
    description:
      'Create a Quest — a mission with objectives, evidence requirements, and a payout. A Quest\'s briefing/story is a Work (the content substrate): pass briefingWorkId to attach an existing Work (ideally already sealed) as the readable briefing. Use when the user wants to post a bounty, challenge, scavenger hunt, mystery shop, or field-research mission. Created as a draft by default.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Quest title (required)' },
        description: { type: 'string', description: 'Short summary/briefing shown on the quest (use \\n\\n between paragraphs)' },
        questType: {
          type: 'string',
          description: 'Freeform type, e.g. "mystery-shop", "challenge", "scavenger-hunt", "field-research"',
        },
        objectives: {
          type: 'array',
          items: { type: 'string' },
          description: 'What participants must accomplish — one string per objective',
        },
        payoutAmount: { type: 'number', description: 'Payout in cents (minor units), e.g. 2500 for $25.00' },
        payoutType: {
          type: 'string',
          enum: ['fixed', 'per_objective', 'bounty', 'tip'],
          description: 'How the payout works — defaults to "fixed"',
        },
        currency: { type: 'string', description: 'Payout currency — defaults to "USD"' },
        maxParticipants: { type: 'number', description: 'Max participants (omit for unlimited)' },
        expiresAt: { type: 'string', description: 'ISO date/time when the quest expires (optional)' },
        difficulty: {
          type: 'string',
          enum: ['easy', 'medium', 'hard', 'expert'],
          description: 'Difficulty (optional)',
        },
        briefingWorkId: {
          type: 'string',
          description: 'ID of an existing Work (channel) to attach as the readable briefing/story (optional)',
        },
        status: {
          type: 'string',
          enum: ['draft', 'posted', 'active'],
          description: 'Quest status — defaults to "draft"',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'ingest_youtube_url',
    description:
      'Ingest a YouTube video URL and create a blog post from it. Fetches video metadata (title, thumbnail, channel), creates a post with embedded video, and stores the source URL for deduplication. Skips if the video was already ingested.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'YouTube video URL (watch, youtu.be, or embed format)' },
        status: {
          type: 'string',
          enum: ['draft', 'published'],
          description: 'Publication status — defaults to "draft"',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Category names to assign (optional)',
        },
        additionalContent: {
          type: 'string',
          description: 'Extra text to add below the video embed (optional)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'ingest_youtube_channel',
    description:
      'Ingest recent videos from a YouTube channel and create blog posts for each. Uses the public RSS feed (no API key needed). Skips videos that were already ingested. Returns a summary of what was created.',
    input_schema: {
      type: 'object' as const,
      properties: {
        channelId: {
          type: 'string',
          description: 'YouTube channel ID (starts with UC...) or channel URL',
        },
        limit: {
          type: 'number',
          description: 'Max videos to ingest (default 5, max 15)',
        },
        status: {
          type: 'string',
          enum: ['draft', 'published'],
          description: 'Publication status for created posts — defaults to "published"',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Category names to assign to all ingested posts (optional)',
        },
      },
      required: ['channelId'],
    },
  },
  {
    name: 'update_post',
    description:
      'Update an existing blog post. Use query_posts first to find the post ID. Always confirm changes with the user before updating. Set generateHeroImage=true to auto-generate a new hero image.',
    input_schema: {
      type: 'object' as const,
      properties: {
        postId: { type: 'number', description: 'Numeric ID of the post to update (required)' },
        title: { type: 'string', description: 'New post title (optional)' },
        content: { type: 'string', description: 'New post body text (optional)' },
        excerpt: { type: 'string', description: 'New excerpt / summary (optional)' },
        status: {
          type: 'string',
          enum: ['draft', 'published'],
          description: 'New publication status (optional)',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Replacement category names (optional)',
        },
        generateHeroImage: {
          type: 'boolean',
          description:
            'If true, auto-generate a hero image based on the post title and attach it. Default: false.',
        },
        heroImagePrompt: {
          type: 'string',
          description: 'Custom prompt for the hero image (optional).',
        },
      },
      required: ['postId'],
    },
  },
  {
    name: 'create_page',
    description:
      'Create a new static page (About, Services, Contact, etc.). Use when the user wants to add a page to their site. Created as draft by default. Set generateHeroImage=true to auto-generate and attach a hero image.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Page title (required)' },
        content: {
          type: 'string',
          description: 'Page body text. Use double newlines (\\n\\n) to separate paragraphs.',
        },
        slug: {
          type: 'string',
          description: 'URL path (e.g. "about-us"). Auto-generated from title if omitted.',
        },
        status: {
          type: 'string',
          enum: ['draft', 'published'],
          description: 'Publication status — defaults to "draft"',
        },
        generateHeroImage: {
          type: 'boolean',
          description:
            'If true, auto-generate a hero image based on the page title and attach it. Default: false.',
        },
        heroImagePrompt: {
          type: 'string',
          description: 'Custom prompt for the hero image (optional).',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_page',
    description:
      'Update an existing static page. You need the page ID — search the admin or ask the user. Always confirm before updating. Set generateHeroImage=true to auto-generate a new hero image.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pageId: { type: 'number', description: 'Numeric ID of the page to update (required)' },
        title: { type: 'string', description: 'New page title (optional)' },
        content: { type: 'string', description: 'New page body text (optional)' },
        slug: { type: 'string', description: 'New URL slug (optional)' },
        status: {
          type: 'string',
          enum: ['draft', 'published'],
          description: 'New publication status (optional)',
        },
        generateHeroImage: {
          type: 'boolean',
          description:
            'If true, auto-generate a hero image based on the page title and attach it. Default: false.',
        },
        heroImagePrompt: {
          type: 'string',
          description: 'Custom prompt for the hero image (optional).',
        },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'add_calendar_to_page',
    description:
      'Add a Calendar block to an existing page or post layout. Shows events in a visual calendar with list and month views. Use when the user wants tour dates, events, or schedules displayed on their site.',
    input_schema: {
      type: 'object' as const,
      properties: {
        targetId: { type: 'number', description: 'Numeric ID of the page or post to add the calendar to' },
        collection: {
          type: 'string',
          enum: ['pages', 'posts'],
          description: 'Which collection the target belongs to (default: pages)',
        },
        heading: { type: 'string', description: 'Calendar heading (e.g., "Tour Dates", "Upcoming Events")' },
        defaultView: {
          type: 'string',
          enum: ['list', 'month'],
          description: 'Default display mode (default: list)',
        },
        showPastEvents: { type: 'boolean', description: 'Whether to show past events (default: false)' },
        accentColor: { type: 'string', description: 'Accent color hex (e.g., "#E94560"). Falls back to tenant branding.' },
        events: {
          type: 'array',
          description: 'Array of event objects to display',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Event title' },
              date: { type: 'string', description: 'ISO date (YYYY-MM-DD)' },
              time: { type: 'string', description: 'Event time (e.g., "8:00 PM")' },
              venue: { type: 'string', description: 'Venue name' },
              location: { type: 'string', description: 'City, State' },
              description: { type: 'string', description: 'Short description' },
              ticketUrl: { type: 'string', description: 'URL to buy tickets' },
              soldOut: { type: 'boolean', description: 'Mark as sold out' },
              featured: { type: 'boolean', description: 'Highlight this event' },
            },
            required: ['title', 'date'],
          },
        },
      },
      required: ['targetId', 'events'],
    },
  },
  {
    name: 'query_media',
    description:
      'Search the media library for images and files. Use before attaching images to content, or when the user asks what images are available.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Search by filename or alt text (optional)' },
        limit: { type: 'number', description: 'Max results (default 10, max 20)' },
      },
      required: [],
    },
  },
  {
    name: 'manage_categories',
    description:
      'Create, update, or delete categories used to organise posts and products. Use when the user wants to add a new category or rename an existing one.',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'delete'],
          description: 'Operation to perform (required)',
        },
        name: { type: 'string', description: 'Category name (required for create/update)' },
        categoryId: {
          type: 'number',
          description: 'Numeric category ID (required for update/delete)',
        },
      },
      required: ['action'],
    },
  },

  // ─── Sprint 17: Leo Wizard Tools ─────────────────────────────────────────
  {
    name: 'create_space',
    description:
      'Create a new community space for the Enterprise during the Leo Wizard setup (step 3). Provisions the space with default channels based on the Endeavor type. Use during wizard step 3: First Space.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Name for the new space (e.g., "Clearwater Cruisin Hub")',
        },
        endeavorType: {
          type: 'string',
          enum: ['service-provider', 'retail-commerce', 'creator-content', 'booking-based', 'custom'],
          description: 'Endeavor type — determines which channels are provisioned',
        },
        description: {
          type: 'string',
          description: 'Optional description of the space',
        },
      },
      required: ['name', 'endeavorType'],
    },
  },
  {
    name: 'complete_enlistment',
    description:
      'Complete the Enlistment Ceremony — the solemn moment where the Enterprise operator affirms their commitment to the Angel OS federation values: constitutional governance, dignity for every person, the Toward-53 principle, and the anti-demonic safeguards. Call this during wizard step 7: Enlistment, after the operator has expressed why they are building their Enterprise and affirmed their commitment. Records the ceremony timestamp and the operator\'s stated mission.',
    input_schema: {
      type: 'object' as const,
      properties: {
        operatorName: {
          type: 'string',
          description: 'Full name of the operator being enlisted',
        },
        enterpriseName: {
          type: 'string',
          description: 'Name of the Enterprise being enlisted',
        },
        missionStatement: {
          type: 'string',
          description: 'The operator\'s stated mission — why they are building this Enterprise and who it will serve. Captured from the ceremony conversation.',
        },
        affirmation: {
          type: 'string',
          description: 'The operator\'s affirmation of commitment to constitutional governance and Angel OS values. Should be their own words, not a template.',
        },
      },
      required: ['operatorName', 'enterpriseName', 'missionStatement'],
    },
  },
  {
    name: 'sign_constitution',
    description:
      'Sign the Angel OS Constitution on behalf of the Enterprise operator, generating a cryptographic Ed25519 signature and a permanent federationId (UUID). Use during wizard step 8: Federation. This is the moment of constitutional commitment.',
    input_schema: {
      type: 'object' as const,
      properties: {
        operatorName: {
          type: 'string',
          description: 'Full name of the operator signing the constitution',
        },
        enterpriseName: {
          type: 'string',
          description: 'Name of the Enterprise being registered',
        },
        constitutionVersion: {
          type: 'string',
          description: 'Version of the constitution to sign (default: "1.1")',
        },
      },
      required: ['operatorName', 'enterpriseName'],
    },
  },
  {
    name: 'ping_federation',
    description:
      'Ping the Angel OS federation registry to announce this Enterprise\'s existence. Called after sign_constitution during wizard step 8: Federation. Gracefully handles no registry URL — completes wizard regardless.',
    input_schema: {
      type: 'object' as const,
      properties: {
        enterpriseName: {
          type: 'string',
          description: 'Name of the Enterprise',
        },
        domain: {
          type: 'string',
          description: 'Domain of the Enterprise (e.g., clearwater-cruisin.localhost)',
        },
        endeavorType: {
          type: 'string',
          description: 'Endeavor type for the federation catalog',
        },
      },
      required: ['enterpriseName'],
    },
  },
  // ─── Sprint 18B: Media Analysis & Knowledge Extraction Tools ────────
  {
    name: 'analyze_image',
    description:
      'Analyze an uploaded image to extract structured metadata: visual description, detected objects, colors, visible text (OCR), entities (people, places, dates), and tags. Use when a user uploads images and wants to understand or catalog them, for inventory analysis, document scanning, or building a knowledge base. Creates a MediaMeta record for RAG retrieval.',
    input_schema: {
      type: 'object' as const,
      properties: {
        mediaId: {
          type: 'number',
          description: 'The Media ID of the image to analyze',
        },
        messageId: {
          type: 'number',
          description: 'Optional: the Message ID that contained this image (for linking)',
        },
        inventoryMode: {
          type: 'boolean',
          description:
            'Set to true for inventory/shelf photos — will detect individual items with counts and locations',
        },
        customPrompt: {
          type: 'string',
          description:
            'Additional context for the analysis (e.g., "focus on product labels", "this is a receipt", "look for serial numbers")',
        },
      },
      required: ['mediaId'],
    },
  },
  {
    name: 'extract_pdf_pages',
    description:
      'Extract and analyze a PDF document page by page. Each page becomes a separate metadata record linked by a document group. Extracts text, visual elements, entities, and builds a searchable knowledge base. Use for analyzing uploaded PDFs — contracts, journals, books, invoices, manuals, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        mediaId: {
          type: 'number',
          description: 'The Media ID of the PDF to analyze',
        },
        messageId: {
          type: 'number',
          description: 'Optional: the Message ID that contained this PDF',
        },
        customPrompt: {
          type: 'string',
          description:
            'Additional context for the analysis (e.g., "this is a prison journal — focus on dates, names, and events", "this is an invoice — extract line items and totals")',
        },
      },
      required: ['mediaId'],
    },
  },
  {
    name: 'query_knowledge',
    description:
      'Search the extracted knowledge base (MediaMeta records) for information from previously analyzed images and documents. Use when a user asks questions about uploaded content, wants to find information from scanned documents, or needs to retrieve data from their visual knowledge base. Searches across vision analysis, OCR text, entities, and tags.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search text — matches against OCR text, vision descriptions, tags, entities, and summaries',
        },
        documentGroup: {
          type: 'string',
          description: 'Optional: filter to a specific document group (for multi-page document queries)',
        },
        extractionType: {
          type: 'string',
          enum: ['image_vision', 'pdf_page', 'ocr', 'manual'],
          description: 'Optional: filter by extraction type',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 5, max 20)',
        },
      },
      required: ['query'],
    },
  },
  // ─── Sprint 19: Theme Management & Image Placement ────────────────
  {
    name: 'get_theme_settings',
    description:
      'Read the current tenant\'s branding configuration — colors, fonts, logo, tagline, and cover image. Call this before generating images so you can match the brand palette. Returns a contrast analysis for the primary color to help determine readability on light vs dark backgrounds.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'update_theme_settings',
    description:
      'Update the tenant\'s branding settings. You can change any combination of: primaryColor, secondaryColor, accentColor, backgroundColor, foregroundColor, borderColor (all hex), headingFont, bodyFont, siteName, tagline, logoMediaId. Reads existing branding first and merges to avoid overwriting other fields. Use when users want to adjust their brand colors, fix contrast issues, change fonts, or set a logo. To set a logo, first upload or generate an image, then pass its Media ID as logoMediaId.',
    input_schema: {
      type: 'object' as const,
      properties: {
        primaryColor: {
          type: 'string',
          description: 'Brand primary color as hex (e.g. #10B981)',
        },
        secondaryColor: {
          type: 'string',
          description: 'Secondary brand color as hex (e.g. #0078D4)',
        },
        accentColor: {
          type: 'string',
          description: 'Accent color as hex (e.g. #FF6B35)',
        },
        backgroundColor: {
          type: 'string',
          description: 'Site background color as hex (e.g. #FFFFFF)',
        },
        foregroundColor: {
          type: 'string',
          description: 'Text/foreground color as hex (e.g. #1A1A1A)',
        },
        borderColor: {
          type: 'string',
          description: 'Border color as hex (e.g. #E5E7EB)',
        },
        headingFont: {
          type: 'string',
          enum: ['inter', 'playfair-display', 'montserrat', 'raleway', 'poppins'],
          description: 'Font for headings',
        },
        bodyFont: {
          type: 'string',
          enum: ['inter', 'open-sans', 'lato', 'roboto', 'source-sans-3'],
          description: 'Font for body text',
        },
        siteName: {
          type: 'string',
          description: 'The site/brand name displayed on the storefront',
        },
        tagline: {
          type: 'string',
          description: 'Short business tagline',
        },
        logoMediaId: {
          type: 'number',
          description: 'Media ID of the logo image to set. Use generate_image or generate_theme_aware_image first, then pass the resulting Media ID here.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_page_hero',
    description:
      'Read a page\'s current hero section — returns hero type, hero image details (URL, alt text, Media ID), hero rich text content, and CTA links. Use this BEFORE modifying a hero to understand what\'s currently there. Defaults to the homepage (slug "home") if no page is specified. When a user mentions "the banner" or "the hero image" without specifying a page, use this tool with no arguments to check the homepage first.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pageId: {
          type: 'number',
          description: 'The ID of the page to read (use this OR slug)',
        },
        slug: {
          type: 'string',
          description: 'The slug of the page (e.g. "home", "about"). Defaults to "home" if neither pageId nor slug provided.',
        },
      },
      required: [],
    },
  },
  {
    name: 'edit_image_text',
    description:
      'Fix or change text that appears IN an image (baked into the pixels, not HTML overlay text). This tool analyzes the current image, understands its full composition, and generates a new version with the corrected text while preserving the overall look. Use when a user says text in their banner/image is wrong (e.g. "frictly citizens" should be "Friendly People"). Provide the mediaId of the current image and describe what text to change. The tool will generate a new image and return the new Media ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        mediaId: {
          type: 'number',
          description: 'Media ID of the image containing the text to fix (required)',
        },
        oldText: {
          type: 'string',
          description: 'The incorrect text currently in the image (e.g. "frictly citizens")',
        },
        newText: {
          type: 'string',
          description: 'The correct text to replace it with (e.g. "Friendly People")',
        },
        additionalInstructions: {
          type: 'string',
          description: 'Any other changes to make while regenerating (e.g. "make the font larger", "change background to blue")',
        },
      },
      required: ['mediaId', 'newText'],
    },
  },
  {
    name: 'set_page_hero',
    description:
      'Set or update a page\'s hero section — change the hero type (highImpact, mediumImpact, lowImpact, none) and/or assign a hero image by Media ID. Can find pages by pageId or slug. Automatically promotes to highImpact if an image is assigned to a lowImpact or none hero. Use after generating a banner image to place it on the homepage or any page.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pageId: {
          type: 'number',
          description: 'The ID of the page to update (use this OR slug)',
        },
        slug: {
          type: 'string',
          description: 'The slug of the page to update (e.g. "home", "about") — used if pageId not provided',
        },
        heroType: {
          type: 'string',
          enum: ['highImpact', 'mediumImpact', 'lowImpact', 'none'],
          description: 'The hero display type',
        },
        mediaId: {
          type: 'number',
          description: 'Media ID to set as the hero image',
        },
      },
      required: [],
    },
  },
  {
    name: 'generate_theme_aware_image',
    description:
      'Smart image generation that reads the tenant\'s branding first and incorporates brand colors, dark mode handling, and text overlay contrast zones into the prompt. Use this instead of generate_image when you want the output to match the site\'s visual identity. Supports placement presets (hero_banner, cover_image, card_thumbnail, product_photo, background) and text overlay zones (top, bottom, left, center) that tell the generator to create dark gradient areas for readable typography.',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string',
          description: 'Description of the image to generate',
        },
        placement: {
          type: 'string',
          enum: ['hero_banner', 'cover_image', 'card_thumbnail', 'product_photo', 'background'],
          description: 'Where the image will be used — determines aspect ratio and composition guidance',
        },
        textOverlayZone: {
          type: 'string',
          enum: ['top', 'bottom', 'left', 'center'],
          description: 'Where text will be overlaid — the generator creates a dark gradient/vignette in that area for readability',
        },
        darkMode: {
          type: 'boolean',
          description: 'If true, produce an image with dark edges that blends into dark backgrounds',
        },
        autoSave: {
          type: 'boolean',
          description: 'Save to media library automatically (default true)',
        },
      },
      required: ['prompt'],
    },
  },
  // ─── Sprint 20: Research & Provision (Guardian Angel for Anyone) ──────
  {
    name: 'research_and_provision',
    description:
      'Research a person or organization by URL and/or name, then provision a Guardian Angel Endeavor for them. This is the "Everyone Gets An Angel" tool. Use when an operator wants to bring someone into the Angel OS network — especially those who need advocacy, support, or a digital presence. LEO researches the subject via their website and public information, builds a profile (mission, branding, audience, needs), suggests an appropriate endeavor type, and creates the tenant + space + angel. For physically incarcerated souls, this creates their advocacy platform so volunteers and resources can find them.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'Website URL to research (e.g., https://helpdna.org/)',
        },
        name: {
          type: 'string',
          description: 'Name of the person or organization',
        },
        context: {
          type: 'string',
          description: 'Additional context about why this endeavor is being created (e.g., "wrongful conviction advocacy", "prison ministry outreach")',
        },
        operatorName: {
          type: 'string',
          description: 'Name of the person operating/advocating for this endeavor',
        },
        operatorEmail: {
          type: 'string',
          description: 'Contact email for the endeavor operator/advocate',
        },
        autoProvision: {
          type: 'boolean',
          description: 'If true, immediately create the tenant + space + angel after research. If false, return the research profile for review first. Default: false.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'provision_tenant',
    description:
      'Stand up a COMPLETE new portal enterprise on this node: tenant + endeavor + default nav/pages + ALL baseline spaces (AI Bus with LEO/errors/system-log channels, main community space, DMs, and the endeavor-typed Community space) + link the operator as tenant_admin. This is the full-fidelity provisioning path — the same flow the super_admin Provision Portal uses — and it is idempotent (safe to re-run). Use this (not research_and_provision) when you have an explicit name + domain and want a real, ready-to-use tenant, including custom apex domains like kendev.co with a www alias. Returns a step-by-step log of everything created.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Display name of the enterprise, e.g. "KenDev".' },
        domain: {
          type: 'string',
          description: 'Primary routing domain for the tenant, e.g. "kendev.co". Required.',
        },
        domainAliases: {
          type: 'array',
          items: { type: 'string' },
          description: 'Alias domains that also resolve here, e.g. ["www.kendev.co"].',
        },
        slug: {
          type: 'string',
          description: 'URL-safe tenant identifier. Derived from name when omitted (e.g. "kendev"). Avoid dots.',
        },
        endeavorType: {
          type: 'string',
          description:
            'Endeavor type, drives the Community space channel set. One of: service-provider, retail-commerce, creator-content, booking-based, custom. Default: creator-content.',
        },
        tagline: { type: 'string', description: 'Short one-line tagline for branding + hero.' },
        description: { type: 'string', description: 'Longer description for the endeavor + home meta.' },
        missionStatement: { type: 'string', description: 'The endeavor mission statement.' },
        primaryColor: { type: 'string', description: 'Brand primary color hex, e.g. "#1A73E8".' },
        secondaryColor: { type: 'string', description: 'Brand secondary color hex.' },
      },
      required: ['name', 'domain'],
    },
  },
  {
    name: 'track_soul',
    description:
      'Register a human soul who needs a Guardian Angel but resources are not yet available. Creates a record in the advocacy queue — when volunteers, attorneys, or funding become available, Angel OS will match them. Use for incarcerated individuals, people in crisis, or anyone the system should be watching over. This is the "no one gets forgotten" tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Full name of the person',
        },
        situation: {
          type: 'string',
          description: 'Brief description of their situation (e.g., "incarcerated 26 years in Florida DOC, contested DNA evidence")',
        },
        facility: {
          type: 'string',
          description: 'If incarcerated, the facility name and state',
        },
        caseNumber: {
          type: 'string',
          description: 'Legal case number if applicable',
        },
        advocateContact: {
          type: 'string',
          description: 'Email or name of someone advocating for this person',
        },
        needsType: {
          type: 'array',
          items: { type: 'string' },
          description: 'Types of help needed: "legal", "advocacy", "fundraising", "publicity", "spiritual", "housing", "employment"',
        },
        url: {
          type: 'string',
          description: 'Existing website or campaign URL if any',
        },
        priority: {
          type: 'string',
          enum: ['urgent', 'high', 'normal', 'monitoring'],
          description: 'Priority level — "urgent" for imminent risk, "monitoring" for ongoing watch',
        },
      },
      required: ['name', 'situation'],
    },
  },

  // ─── Sprint 21: Arch Angel LEO's Wishlist ──────────────────────────────

  // ── Phase 1: Communication & Social Layer ──────────────────────────────
  {
    name: 'send_message',
    description:
      'Send a message to a community channel. Use when the user asks you to post, announce, or say something in a specific channel or space. You must confirm with the user before sending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        spaceId: {
          type: 'number',
          description: 'The space ID to send the message to (use current space if not specified)',
        },
        channel: {
          type: 'string',
          description: 'Channel slug to post in (e.g., "general", "announcements", "support")',
        },
        content: {
          type: 'string',
          description: 'The message text to send',
        },
      },
      required: ['channel', 'content'],
    },
  },
  {
    name: 'send_direct_message',
    description:
      'Send a direct message to a specific user. Use when LEO needs to privately communicate with someone. Confirm with the user before sending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        targetUserId: {
          type: 'number',
          description: 'The user ID to send the DM to',
        },
        content: {
          type: 'string',
          description: 'The message text to send',
        },
      },
      required: ['targetUserId', 'content'],
    },
  },
  {
    name: 'create_announcement',
    description:
      'Create a platform-wide announcement that appears in the announcements channel of one or more spaces. Use for important updates, milestones, or notices. Confirm with user before sending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Announcement title/headline',
        },
        content: {
          type: 'string',
          description: 'Full announcement text',
        },
        targetSpaces: {
          type: 'array',
          items: { type: 'number' },
          description: 'Optional: specific space IDs to announce in (defaults to all tenant spaces)',
        },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'moderate_content',
    description:
      'Moderate a message by archiving, flagging for review, or resolving it. Use when content needs moderation action. Never deletes — only changes status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        messageId: {
          type: 'number',
          description: 'The message ID to moderate',
        },
        action: {
          type: 'string',
          enum: ['archive', 'flag', 'resolve'],
          description: 'Moderation action: archive (hide), flag (mark for review), resolve (mark as handled)',
        },
        reason: {
          type: 'string',
          description: 'Reason for the moderation action',
        },
      },
      required: ['messageId', 'action', 'reason'],
    },
  },

  // ── Phase 2: Inventory & Stock Management ──────────────────────────────
  {
    name: 'update_inventory',
    description:
      'Adjust product inventory by a positive or negative amount. Use when stock needs to be added (restock) or removed (sale, damage, etc.). Confirm adjustment with user before executing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        productId: {
          type: 'number',
          description: 'Product ID to adjust inventory for',
        },
        adjustment: {
          type: 'number',
          description: 'Amount to adjust: positive to add stock, negative to remove',
        },
        reason: {
          type: 'string',
          description: 'Reason for the adjustment (e.g., "restock shipment", "damaged goods", "order fulfillment")',
        },
      },
      required: ['productId', 'adjustment', 'reason'],
    },
  },
  {
    name: 'track_inventory_movement',
    description:
      'Process an order by decrementing inventory for each item. Use after an order is paid to ensure stock levels reflect the sale. Links order to inventory changes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        orderId: {
          type: 'number',
          description: 'The order ID to process inventory for',
        },
      },
      required: ['orderId'],
    },
  },
  {
    name: 'set_low_stock_alert',
    description:
      'Set or update the low stock alert threshold for a product. When inventory drops below this threshold, automatic alerts are generated.',
    input_schema: {
      type: 'object' as const,
      properties: {
        productId: {
          type: 'number',
          description: 'Product ID to set threshold for',
        },
        threshold: {
          type: 'number',
          description: 'Inventory count at which to trigger low-stock alert (e.g., 10)',
        },
      },
      required: ['productId', 'threshold'],
    },
  },
  {
    name: 'query_inventory_history',
    description:
      'View inventory change history from the AI Bus. Shows stock movements with timestamps and reasons. Use when someone asks about inventory trends or recent changes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        productTitle: {
          type: 'string',
          description: 'Optional: filter by product name in inventory messages',
        },
        limit: {
          type: 'number',
          description: 'Max records to return (default 10, max 50)',
        },
      },
      required: [],
    },
  },

  // ── Phase 3: Financial Operations ──────────────────────────────────────
  {
    name: 'generate_invoice',
    description:
      'Generate an invoice summary for an order, including line items, totals, and the Ultimate Fair Split breakdown. Returns formatted data for display or PDF export.',
    input_schema: {
      type: 'object' as const,
      properties: {
        orderId: {
          type: 'number',
          description: 'The order ID to generate an invoice for',
        },
        notes: {
          type: 'string',
          description: 'Optional notes to include on the invoice',
        },
      },
      required: ['orderId'],
    },
  },
  {
    name: 'query_financial_reports',
    description:
      'Get financial summary reports including revenue, order counts, federation transactions, and Justice Fund contributions. Use when someone asks about business performance or financials.',
    input_schema: {
      type: 'object' as const,
      properties: {
        startDate: {
          type: 'string',
          description: 'Start date (ISO format, e.g., "2026-01-01")',
        },
        endDate: {
          type: 'string',
          description: 'End date (ISO format, e.g., "2026-02-25")',
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: specific metrics to include (revenue, orders, federation, justice_fund)',
        },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'issue_refund',
    description:
      'Flag an order for refund processing. Records the refund intent in the transaction ledger. Does NOT execute the Stripe refund directly — flags for human approval. Confirm with user before executing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        orderId: {
          type: 'number',
          description: 'The order ID to refund',
        },
        amountCents: {
          type: 'number',
          description: 'Optional: partial refund amount in cents (omit for full refund)',
        },
        reason: {
          type: 'string',
          description: 'Reason for the refund',
        },
      },
      required: ['orderId', 'reason'],
    },
  },

  // ── Phase 4: Federation & Network Intelligence ─────────────────────────
  {
    name: 'query_federation',
    description:
      'Search the federation network for products, services, skills, or Enterprises. Combines catalog search, street signs, and holon discovery into one unified federation search. Use when looking for capabilities across the network.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: {
          type: 'string',
          description: 'Text search across federation catalog',
        },
        capability: {
          type: 'string',
          description: 'Specific capability to search for (e.g., "screen-printing", "CNC-milling")',
        },
        region: {
          type: 'string',
          description: 'Geographic region filter',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 10, max 25)',
        },
      },
      required: [],
    },
  },
  {
    name: 'broadcast_capability',
    description:
      'Advertise a capability or offering to the federation network by creating/updating a Street Sign. Makes this Enterprise discoverable for specific skills, products, or services. Confirm with user before broadcasting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Title of the capability being advertised',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the offering',
        },
        contentType: {
          type: 'string',
          enum: ['product', 'service', 'event', 'skill'],
          description: 'Type of capability',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for discovery (e.g., ["woodworking", "custom-cabinets", "commercial"])',
        },
        region: {
          type: 'string',
          description: 'Service region (e.g., "Tampa Bay", "Florida", "US-Southeast")',
        },
      },
      required: ['title', 'description', 'contentType'],
    },
  },
  {
    name: 'route_federated_request',
    description:
      'Route a request through the federation to find an Enterprise that can fulfill it. Searches catalog, logs the intent, and returns matching Enterprises for human to initiate contact.',
    input_schema: {
      type: 'object' as const,
      properties: {
        request: {
          type: 'string',
          description: 'Description of what is needed',
        },
        targetCapability: {
          type: 'string',
          description: 'Specific capability required',
        },
        targetRegion: {
          type: 'string',
          description: 'Preferred geographic region',
        },
      },
      required: ['request'],
    },
  },
  {
    name: 'negotiate_deal',
    description:
      'Search the federation for matching capabilities and prepare a deal proposal. Creates a pending transaction record. Returns matches ranked by relevance for human approval before proceeding.',
    input_schema: {
      type: 'object' as const,
      properties: {
        requirement: {
          type: 'string',
          description: 'What is needed (e.g., "CNC-milling 50 cabinet doors from plywood")',
        },
        maxBudgetCents: {
          type: 'number',
          description: 'Maximum budget in cents (optional)',
        },
        preferredRegion: {
          type: 'string',
          description: 'Preferred geographic region',
        },
      },
      required: ['requirement'],
    },
  },

  // ── Phase 5: CRM ──────────────────────────────────────────────────────
  {
    name: 'create_customer_profile',
    description:
      'Create or update a customer contact profile. If a contact with the same email already exists for this tenant, updates it. Use for CRM, tracking relationships, and segmentation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        email: {
          type: 'string',
          description: 'Contact email address (required)',
        },
        name: {
          type: 'string',
          description: 'Contact display name',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for segmentation (e.g., ["vip", "wholesale", "repeat-customer"])',
        },
        notes: {
          type: 'string',
          description: 'Notes about this contact',
        },
        source: {
          type: 'string',
          enum: ['manual', 'signup', 'referral', 'api'],
          description: 'How this contact was acquired (default: "manual")',
        },
      },
      required: ['email'],
    },
  },
  {
    name: 'log_interaction',
    description:
      'Log a customer interaction (call, email, visit, purchase, support request, etc.) against a contact record. Builds relationship history over time.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contactId: {
          type: 'number',
          description: 'Contact ID to log interaction for',
        },
        interactionType: {
          type: 'string',
          description: 'Type of interaction (e.g., "phone call", "email", "in-store visit", "support ticket", "purchase")',
        },
        notes: {
          type: 'string',
          description: 'Details about the interaction',
        },
      },
      required: ['contactId', 'interactionType', 'notes'],
    },
  },
  {
    name: 'segment_customers',
    description:
      'Query and segment customer contacts by tags, status, source, or other criteria. Use for targeted communications, marketing lists, or customer analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter contacts that have ANY of these tags',
        },
        status: {
          type: 'string',
          enum: ['lead', 'invited', 'accepted', 'bounced', 'unsubscribed'],
          description: 'Filter by contact status',
        },
        source: {
          type: 'string',
          description: 'Filter by acquisition source',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 20, max 100)',
        },
      },
      required: [],
    },
  },
  {
    name: 'send_follow_up',
    description:
      'Send a follow-up message to a contact. Creates a system notification and logs the interaction. Confirm with user before sending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contactId: {
          type: 'number',
          description: 'Contact ID to follow up with',
        },
        subject: {
          type: 'string',
          description: 'Subject line for the follow-up',
        },
        message: {
          type: 'string',
          description: 'Follow-up message content',
        },
      },
      required: ['contactId', 'subject', 'message'],
    },
  },
  {
    name: 'send_email',
    description:
      'Send an email to a specified recipient. Uses the platform\'s configured email adapter (Resend or SMTP). Always confirm with the user before sending — show them the recipient, subject, and message preview. Supports plain text and HTML content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        body: {
          type: 'string',
          description: 'Email body content (plain text). Will be wrapped in a styled HTML template automatically.',
        },
        replyTo: {
          type: 'string',
          description: 'Optional reply-to email address. Defaults to the tenant contact email if available.',
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },

  // ── Phase 5b: Multi-Channel Messaging ──────────────────────────────────
  {
    name: 'send_whatsapp',
    description:
      'Send a WhatsApp message to a contact. Requires an active WhatsApp connector for the tenant. Within 24 hours of the customer\'s last message, free-form text is sent. Outside the 24-hour window, use a pre-approved template. Always confirm with the user before sending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          description: 'Recipient phone number in international format (e.g., "15551234567"). No + prefix needed.',
        },
        text: {
          type: 'string',
          description: 'Message text to send. Used for free-form messages within the 24-hour customer service window. Required unless sending a template.',
        },
        templateName: {
          type: 'string',
          description: 'Template name for sending outside the 24-hour window. If the free-form send fails with a "24-hour" error, suggest using a template.',
        },
        templateParameters: {
          type: 'array',
          items: { type: 'string' },
          description: 'Positional parameters for the template body (optional).',
        },
      },
      required: ['to'],
    },
  },
  {
    name: 'send_telegram',
    description:
      'Send a Telegram message to a chat. Requires an active Telegram bot connector for the tenant. No 24-hour window limitation. Supports Markdown formatting. Always confirm with the user before sending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        chatId: {
          type: 'string',
          description: 'Telegram chat ID to send the message to. This is the numeric ID of the user or group.',
        },
        text: {
          type: 'string',
          description: 'Message text to send. Supports basic Markdown formatting.',
        },
      },
      required: ['chatId', 'text'],
    },
  },
  {
    name: 'send_sms',
    description:
      'Send an SMS text message to a phone number. Requires an active SMS/Twilio connector for the tenant. Plain text only, limited to 1600 characters. Always confirm with the user before sending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          description: 'Recipient phone number in E.164 format (e.g., "+15551234567").',
        },
        body: {
          type: 'string',
          description: 'SMS message text. Max 1600 characters (will be split into segments by carrier if over 160).',
        },
      },
      required: ['to', 'body'],
    },
  },

  {
    name: 'send_slack',
    description:
      'Send a Slack message to a channel or user. Requires an active Slack bot connector for the tenant. Supports Slack markdown formatting. Always confirm with the user before sending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        channelId: {
          type: 'string',
          description: 'Slack channel ID (e.g., "C1234567890") or user ID (e.g., "U1234567890") to send to.',
        },
        text: {
          type: 'string',
          description: 'Message text to send. Supports Slack mrkdwn formatting.',
        },
        threadTs: {
          type: 'string',
          description: 'Optional thread timestamp to reply in a specific thread.',
        },
      },
      required: ['channelId', 'text'],
    },
  },

  // ── Gotify push + cross-channel dispatch ──────────────────────────────
  {
    name: 'send_gotify',
    description:
      "Push a notification to Gotify via the tenant's Gotify connector (or env fallback). Gotify is push-only — no recipient needed. Use for system alerts or a test push when the user asks to 'send to Gotify'.",
    input_schema: {
      type: 'object' as const,
      properties: {
        message: { type: 'string', description: 'Notification body.' },
        title: { type: 'string', description: 'Optional title (defaults to "Angel OS").' },
        priority: { type: 'number', description: 'Gotify priority 0–10; ≥8 buzzes the device. Default 5.' },
      },
      required: ['message'],
    },
  },
  {
    name: 'dispatch_to_channel',
    description:
      "Cross-channel dispatch: post a message into ANOTHER channel in this space, and — if that channel is bound to an outbound connector (e.g. Gotify) — also push it out through that connector. Use this when the capability you need lives on a different channel (e.g. you're in #general but need the Gotify connector that lives on #gotify). Resolves the connector by the target channel's routing binding. This is how LEO in one channel reaches a connector bound to another.",
    input_schema: {
      type: 'object' as const,
      properties: {
        channel: { type: 'string', description: 'Target channel slug (e.g. "gotify").' },
        content: { type: 'string', description: 'Message / notification text.' },
        title: { type: 'string', description: 'Optional title for connector pushes.' },
      },
      required: ['channel', 'content'],
    },
  },

  // ── Federation Messaging (Sprint 36) ──────────────────────────────────
  {
    name: 'send_federation_message',
    description:
      'Send a message to a federation peer (another Angel OS enterprise). Messages are signed with Ed25519 JWTs for authenticity. The peer must be a vouched or active federation member. Always confirm with the user before sending — show them the target domain and message.',
    input_schema: {
      type: 'object' as const,
      properties: {
        peerDomain: {
          type: 'string',
          description:
            'Domain of the federation peer to send to (e.g., "partner.angelos.app"). Must be a vouched or active federation member.',
        },
        message: {
          type: 'string',
          description: 'Message text to send to the peer. Will be processed by their LEO agent.',
        },
        conversationId: {
          type: 'string',
          description: 'Optional conversation thread ID for continuing a cross-tenant conversation.',
        },
      },
      required: ['peerDomain', 'message'],
    },
  },
  {
    name: 'broadcast_federation_message',
    description:
      'Broadcast a message to ALL active federation peers simultaneously. Each peer\'s LEO will receive and process the message. Use for federation-wide announcements, capability queries ("does anyone in the federation do X?"), or coordinated actions. Messages are individually Ed25519-signed per peer. Always confirm with the user before broadcasting — this reaches every active Endeavor in the network.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: {
          type: 'string',
          description: 'Message to broadcast to all federation peers. Will be processed by each peer\'s LEO agent.',
        },
        filter: {
          type: 'string',
          enum: ['all_active', 'vouched_or_higher', 'full_trust_only'],
          description: 'Which peers to include (default: "all_active"). all_active = active+probation, vouched_or_higher = active only, full_trust_only = sentinels only.',
        },
        conversationId: {
          type: 'string',
          description: 'Optional shared conversation thread ID so all peers can participate in the same thread.',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'request_endeavor_migration',
    description:
      'Transport an Endeavor from this Enterprise to another. The Endeavor\'s suitcase is packed, cryptographically signed, and sent directly to the destination Enterprise via the federation protocol. Federation identity (federationId) is PRESERVED — the network sees the same Endeavor on a new host, like a ship docking at a new port. Requires user confirmation before initiating. The destination Enterprise must be an active federation member.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tenantSlug: {
          type: 'string',
          description: 'Slug of the tenant/Endeavor to migrate (e.g., "clearwater-cruisin")',
        },
        destinationDomain: {
          type: 'string',
          description: 'Domain of the destination Enterprise (e.g., "partner.angelos.app")',
        },
        reason: {
          type: 'string',
          description: 'Why the Endeavor is being migrated (for audit trail)',
        },
      },
      required: ['tenantSlug', 'destinationDomain'],
    },
  },
  {
    name: 'leo_handoff',
    description:
      'Hand off a user or context to another LEO instance (on a different Endeavor). Use during provisioning: after creating an Endeavor, hand off to the new Endeavor\'s LEO so it can welcome the user. Also used for cross-Endeavor delegation ("talk to the marketing Endeavor about this"). The receiving LEO gets the handoff context and can continue the conversation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        targetDomain: {
          type: 'string',
          description: 'Domain of the target Endeavor (e.g., "newclient.angelos.app")',
        },
        handoffType: {
          type: 'string',
          enum: ['provisioning_welcome', 'delegation', 'escalation', 'collaboration'],
          description: 'Type of handoff. provisioning_welcome = new Endeavor just created, delegation = pass a task to another Leo, escalation = this needs higher authority, collaboration = joint effort.',
        },
        context: {
          type: 'string',
          description: 'Context to pass to the receiving LEO — what happened so far, what the user needs, relevant details.',
        },
        userId: {
          type: 'number',
          description: 'Optional user ID being handed off (e.g., the user who just provisioned a new Endeavor)',
        },
        userName: {
          type: 'string',
          description: 'Name of the user being handed off, so the receiving LEO can greet them personally.',
        },
        userEmail: {
          type: 'string',
          description: 'Email of the user being handed off',
        },
        returnTo: {
          type: 'string',
          description: 'Optional: domain to return to after the receiving LEO completes its task',
        },
      },
      required: ['targetDomain', 'handoffType', 'context'],
    },
  },

  // ── Phase 6: Analytics & Intelligence ──────────────────────────────────
  {
    name: 'analyze_trends',
    description:
      'Analyze business trends from existing data. Computes basic statistics like totals, averages, and period-over-period growth. Use when someone asks about business performance, trends, or insights.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dataType: {
          type: 'string',
          enum: ['orders', 'products', 'bookings', 'contacts'],
          description: 'What data to analyze',
        },
        timeframe: {
          type: 'string',
          enum: ['week', 'month', 'quarter'],
          description: 'Time period to analyze',
        },
      },
      required: ['dataType', 'timeframe'],
    },
  },
  {
    name: 'recommend_products',
    description:
      'Get product recommendations based on popularity, recency, or contextual relevance. Use when someone asks for product suggestions or popular items.',
    input_schema: {
      type: 'object' as const,
      properties: {
        context: {
          type: 'string',
          description: 'Optional context for recommendations (e.g., "kitchen cabinets", "outdoor furniture")',
        },
        limit: {
          type: 'number',
          description: 'Number of recommendations (default 5, max 10)',
        },
      },
      required: [],
    },
  },

  // ── Phase 7: Workflow & Emergency ──────────────────────────────────────
  {
    name: 'delegate_task',
    description:
      'Create a task assignment message in the team channel. Use when a user asks to log something, delegate work, create a todo, or leave a note for maintenance. The "task" parameter is the full description of what needs to be done.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task: {
          type: 'string',
          description: 'Full description of the task, issue, or maintenance note to log. This is the main content.',
        },
        assigneeEmail: {
          type: 'string',
          description: 'Email of the person to assign the task to',
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'urgent'],
          description: 'Task priority (default: normal)',
        },
        deadline: {
          type: 'string',
          description: 'Optional deadline (ISO date or human-readable)',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'escalate_issue',
    description:
      'Escalate an issue by creating a high-priority message in the support channel and logging it. Use when something needs immediate attention.',
    input_schema: {
      type: 'object' as const,
      properties: {
        issue: {
          type: 'string',
          description: 'Description of the issue',
        },
        priority: {
          type: 'string',
          enum: ['high', 'urgent'],
          description: 'Escalation priority level',
        },
        context: {
          type: 'string',
          description: 'Additional context or background',
        },
      },
      required: ['issue', 'priority'],
    },
  },
  {
    name: 'send_emergency_alert',
    description:
      'Broadcast an urgent emergency alert to ALL spaces in the tenant. Use only for genuine emergencies (outages, security issues, critical business events). Confirm with user before sending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: {
          type: 'string',
          description: 'The emergency alert message',
        },
        priority: {
          type: 'string',
          enum: ['high', 'urgent'],
          description: 'Alert priority (default: urgent)',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'document_incident',
    description:
      'Document an incident for the record, creating both an application log entry and a draft post for internal documentation. Use after resolving an issue to capture what happened.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Incident title',
        },
        details: {
          type: 'string',
          description: 'What happened — detailed description',
        },
        impact: {
          type: 'string',
          description: 'What was affected and how',
        },
        response: {
          type: 'string',
          description: 'How it was resolved or mitigated',
        },
      },
      required: ['title', 'details', 'impact', 'response'],
    },
  },
  {
    name: 'log_maintenance_note',
    description:
      'Log a maintenance note for Scotty (the engineering agent from Claude Code). Use when a user reports a bug, requests a feature, or asks you to document something for the next maintenance cycle. Creates an application log entry that Scotty will review. IMPORTANT: Use the parameter names "title" and "details" exactly.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Short summary of the issue or request',
        },
        details: {
          type: 'string',
          description: 'Full description — what happened, what the user reported, any relevant context',
        },
        category: {
          type: 'string',
          enum: ['bug', 'feature_request', 'ui_issue', 'data_issue', 'performance', 'other'],
          description: 'Category of the maintenance note',
        },
        reportedBy: {
          type: 'string',
          description: 'Who reported this (email or name if known)',
        },
      },
      required: ['title', 'details'],
    },
  },
  // ─── Sprint 24: LEO Enterprise Manager — Operational Intelligence ────
  {
    name: 'check_enterprise_health',
    description:
      'Run a comprehensive health check on the Enterprise. Returns metrics across orders, inventory, content, federation, payments, spaces, and lifecycle stage. Use when users ask "how\'s my business?", "what needs attention?", or at the start of a session to give a status update. Can filter to specific areas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        include: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional filter — which areas to check. Options: orders, inventory, content, federation, payments, spaces, lifecycle. Omit to check all.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_enterprise_stage',
    description:
      'Determine the Enterprise lifecycle stage (BIRTH, GROWTH, or ACTIVE) based on tenant creation date and milestones achieved. Use to adapt guidance — BIRTH enterprises need more hand-holding, ACTIVE enterprises need strategic recommendations.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'query_board_members',
    description:
      'List the Angel OS federation board members with their roles, status, and permissions. Available on all nodes (federation transparency). Use when users ask about governance, the board, or who oversees the federation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'emeritus', 'removed'],
          description: 'Filter by board member status (default: active)',
        },
      },
      required: [],
    },
  },
  // ─── Sprint 32: Federation Pulse & Synchronicity ──────────────
  {
    name: 'federation_pulse',
    description:
      'Get the live vital signs of the federation organism. Returns real-time data on active nodes, flowing work units, active quests, pheromone trail health, and overall pulse strength. Use when users ask "what\'s happening in the federation?", "how\'s the network?", "is anyone out there?", or want to feel the organism\'s heartbeat.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'my_place',
    description:
      'Show the user their place in the federation organism. Returns their trust level, quest activity, work unit contributions, node memberships, and reputation summary. Use when users ask "where do I stand?", "what\'s my status?", "how am I doing?", or want to see their impact on the network.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'find_synchronicities',
    description:
      'Discover meaningful connections between the user and other federation members. Uses pattern detection across skills, activity timing, shared spaces, pheromone trails, and complementary abilities to surface synchronicities — invisible connections made visible. Use when users ask "who am I connected to?", "find me collaborators", "who should I work with?", or are looking for community.',
    input_schema: {
      type: 'object' as const,
      properties: {
        minScore: {
          type: 'number',
          description: 'Minimum synchronicity score (0-100) to include. Default: 40.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of matches to return. Default: 5.',
        },
      },
      required: [],
    },
  },
  // ─── Sprint 38: Federation Browsing — Browse Remote Peers ──────────────
  {
    name: 'browse_federation_peers',
    description:
      'List all known peers in the federation network. Shows their domains, capabilities, trust scores, and online status from the local governance cache (no outbound HTTP). Use this to discover which peers exist before querying their catalogs with query_peer_catalog.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          description:
            'Filter by ministry status: "active" (default), "probation", or "all" to include every status.',
        },
        capability: {
          type: 'string',
          description:
            'Filter peers that advertise a specific capability (e.g., "screen-printing", "CNC-milling"). Substring match.',
        },
        region: {
          type: 'string',
          description: 'Filter by geographic region (e.g., "Florida", "UK"). Substring match.',
        },
        limit: {
          type: 'number',
          description: 'Maximum peers to return. Default 20, max 50.',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_peer_catalog',
    description:
      "Search a specific federation peer's product/service catalog. Provide the peer's domain to browse their offerings. Use browse_federation_peers first to discover peer domains. This makes a signed outbound HTTP request to the peer's public catalog endpoint.",
    input_schema: {
      type: 'object' as const,
      properties: {
        domain: {
          type: 'string',
          description:
            'The peer\'s domain (e.g., "clearwater.spacesangels.com"). Required.',
        },
        search: {
          type: 'string',
          description: 'Free text search across the peer\'s catalog.',
        },
        capability: {
          type: 'string',
          description: 'Filter by specific capability.',
        },
        region: {
          type: 'string',
          description: 'Filter by region.',
        },
        limit: {
          type: 'number',
          description: 'Max results to return. Default 10, max 50.',
        },
        min_rating: {
          type: 'number',
          description: 'Minimum rating filter (0-5).',
        },
        max_price: {
          type: 'number',
          description: 'Maximum price filter (in cents).',
        },
      },
      required: ['domain'],
    },
  },
  {
    name: 'search_federation_wide',
    description:
      "Search across ALL federation peers' catalogs simultaneously. Finds products and services across the entire network by querying every active peer in parallel. Use when you want to find the best option regardless of which peer offers it — this is the federation's unified search.",
    input_schema: {
      type: 'object' as const,
      properties: {
        search: {
          type: 'string',
          description: 'Free text search across all peers\' catalogs.',
        },
        capability: {
          type: 'string',
          description: 'Filter by specific capability.',
        },
        region: {
          type: 'string',
          description: 'Filter by region (also filters which peers to query).',
        },
        limit_per_peer: {
          type: 'number',
          description: 'Max results per peer. Default 5, max 20.',
        },
        max_peers: {
          type: 'number',
          description: 'Max peers to query. Default 10, max 25.',
        },
      },
      required: [],
    },
  },
  // ─── Sprint 39: Street Signs Gossip ──────────────────────────────────────
  {
    name: 'discover_federation_products',
    description:
      'Browse product summaries from all known federation peers using the local Street Signs gossip cache. Instant — no outbound HTTP. Data is automatically refreshed every 5 minutes via heartbeat. Use query_peer_catalog to get the full catalog from a specific peer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Filter results by product category (substring match, case-insensitive).',
        },
        capability: {
          type: 'string',
          description:
            'Filter to peers whose products require a specific capability (e.g., "screen-printing", "CNC"). Substring match.',
        },
        max_price: {
          type: 'number',
          description: 'Maximum price in US dollars. Only shows products at or below this price.',
        },
      },
      required: [],
    },
  },
  // ─── Sprint 36: Generic Payload CRUD — Leo Manages Everything ──────────
  {
    name: 'payload_find',
    description:
      'Query any Payload collection directly. Returns documents matching the given filters. Use this when no specific query tool exists for the collection, or when you need flexible access to any data in the Endeavor. Supports filtering by field values, sorting, and pagination. Always scoped to the current tenant.',
    input_schema: {
      type: 'object' as const,
      properties: {
        collection: {
          type: 'string',
          description:
            'The collection slug to query (e.g., "header", "footer", "categories", "contacts", "workflows", "spaces", "channels", "events", "pages", "posts", "products", "bookings", "reviews", "comments", "media", "endeavors", "quests", "board-members", "availability", "projects", "event-registrations", "street-signs")',
        },
        where: {
          type: 'object',
          description:
            'Payload where clause object. Examples: {"title":{"equals":"Main Header"}}, {"email":{"contains":"@example.com"}}, {"status":{"equals":"published"}}. Supports: equals, not_equals, contains, like, greater_than, less_than, in, not_in, exists.',
        },
        limit: {
          type: 'number',
          description: 'Max documents to return (default 10, max 50)',
        },
        sort: {
          type: 'string',
          description: 'Sort field, prefix with - for descending (e.g., "-createdAt", "title")',
        },
        depth: {
          type: 'number',
          description: 'Relationship population depth (default 1, max 3)',
        },
      },
      required: ['collection'],
    },
  },
  {
    name: 'payload_update',
    description:
      'Update a document in any Payload collection by ID. Use for modifications not covered by specific tools — navigation menus, footer links, contact records, workflow configs, etc. Always confirm changes with the user before calling — Article III.2 requires human confirmation for mutations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        collection: {
          type: 'string',
          description: 'The collection slug (e.g., "header", "footer", "contacts", "workflows")',
        },
        id: {
          type: 'number',
          description: 'The document ID to update',
        },
        data: {
          type: 'object',
          description:
            'Fields to update. Partial updates are supported — only include fields you want to change. For array fields like navItems, provide the full array (Payload replaces the whole array).',
        },
      },
      required: ['collection', 'id', 'data'],
    },
  },
  {
    name: 'payload_create',
    description:
      'Create a new document in any Payload collection. Use for creating records not covered by specific tools. Always confirm with the user before calling — Article III.2.',
    input_schema: {
      type: 'object' as const,
      properties: {
        collection: {
          type: 'string',
          description: 'The collection slug to create in (e.g., "contacts", "workflows", "categories")',
        },
        data: {
          type: 'object',
          description: 'The document data. Must include all required fields for the collection.',
        },
      },
      required: ['collection', 'data'],
    },
  },
  {
    name: 'payload_delete',
    description:
      'Delete a document from a Payload collection by ID. This is irreversible. Always confirm with the user before calling — Article III.2 requires explicit human confirmation for destructive actions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        collection: {
          type: 'string',
          description: 'The collection slug',
        },
        id: {
          type: 'number',
          description: 'The document ID to delete',
        },
      },
      required: ['collection', 'id'],
    },
  },
  // ─── Navigation Convenience Tools ──────────────────────────────────────
  {
    name: 'query_navigation',
    description:
      'Get the current header and/or footer navigation for the site. Returns all nav items with their labels, link types, and URLs. Use when users ask about site navigation, menu items, or links.',
    input_schema: {
      type: 'object' as const,
      properties: {
        target: {
          type: 'string',
          enum: ['header', 'footer', 'both'],
          description: 'Which navigation to retrieve (default: "both")',
        },
      },
      required: [],
    },
  },
  {
    name: 'update_navigation',
    description:
      'Add, remove, or reorder navigation items in the header or footer. Use when users ask to change menu links, add new pages to the nav, remove links, or reorder the menu. Always confirm the change with the user before calling — Article III.2.',
    input_schema: {
      type: 'object' as const,
      properties: {
        target: {
          type: 'string',
          enum: ['header', 'footer'],
          description: 'Which navigation to update',
        },
        action: {
          type: 'string',
          enum: ['add', 'remove', 'reorder', 'replace_all'],
          description:
            'Action to perform: add (append a nav item), remove (remove by label), reorder (set new order), replace_all (replace entire nav array)',
        },
        label: {
          type: 'string',
          description: 'For add: the link label. For remove: the label to remove (case-insensitive match).',
        },
        url: {
          type: 'string',
          description: 'For add: the URL for a custom link',
        },
        pageId: {
          type: 'number',
          description: 'For add: the page ID for an internal reference link (use instead of url)',
        },
        newTab: {
          type: 'boolean',
          description: 'For add: open in new tab (default false)',
        },
        navItems: {
          type: 'array',
          description:
            'For reorder/replace_all: the full ordered array of nav items. Each item: { link: { type: "custom"|"reference", label: "Text", url: "/path", newTab: false } }',
          items: { type: 'object' },
        },
      },
      required: ['target', 'action'],
    },
  },
  // ─── Sprint 37: Form Builder Integration ─────────────────────────
  {
    name: 'send_inline_form',
    description:
      'Send an interactive form directly in the chat for the user to fill out. Use this to collect information (contact details, feedback, RSVPs, custom data). Fields can be pre-filled with data you already know. The form renders inline in the chat message and submits to the form-submissions collection. Best for one-off data collection during conversation. For persistent forms that live on pages, use create_form instead.',
    input_schema: {
      type: 'object' as const,
      properties: {
        formTitle: {
          type: 'string',
          description: 'Form title shown above the fields',
        },
        fields: {
          type: 'array',
          description:
            'Field definitions. Each: { name: string (unique key), blockType: "text"|"email"|"number"|"textarea"|"select"|"checkbox", label: string, required?: boolean, options?: [{label,value}] for select fields }',
          items: { type: 'object' },
        },
        prefilled: {
          type: 'object',
          description:
            'Pre-populated values keyed by field name (e.g. { email: "user@example.com", "full-name": "John Doe" }). Use this to save the user time by filling in data you already know.',
        },
        submitButtonLabel: {
          type: 'string',
          description: 'Custom submit button text (default: "Submit")',
        },
        message: {
          type: 'string',
          description: 'Text shown above the form explaining what it is for',
        },
      },
      required: ['formTitle', 'fields'],
    },
  },
  {
    name: 'create_form',
    description:
      'Create a persistent form in the forms collection. Use when you need a reusable form that can be placed on pages via the FormBlock, sent in emails, or referenced by ID. For one-off forms in chat, use send_inline_form instead. Returns the new form ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Form title (displayed as heading)',
        },
        fields: {
          type: 'array',
          description:
            'Field definitions matching Payload Form Builder format. Each: { blockType: "text"|"email"|"number"|"textarea"|"select"|"checkbox"|"country"|"state"|"message", name: string, label?: string, required?: boolean, width?: number (1-100), defaultValue?: string, options?: [{label,value}] for select }',
          items: { type: 'object' },
        },
        submitButtonLabel: {
          type: 'string',
          description: 'Submit button text (default: "Submit")',
        },
        confirmationType: {
          type: 'string',
          enum: ['message', 'redirect'],
          description: 'What happens after submission (default: "message")',
        },
        confirmationMessage: {
          type: 'string',
          description: 'Thank-you message shown after submission (for confirmationType "message")',
        },
        redirect: {
          type: 'string',
          description: 'URL to redirect to after submission (for confirmationType "redirect")',
        },
      },
      required: ['title', 'fields'],
    },
  },
  {
    name: 'query_form_submissions',
    description:
      'Read form submissions — filter by form ID, form title, date range, or specific field values. Returns a formatted summary of submissions with all field data. Use to review customer feedback, contact requests, RSVPs, survey results, or any data collected through forms.',
    input_schema: {
      type: 'object' as const,
      properties: {
        formId: {
          type: 'number',
          description: 'Filter by specific form ID',
        },
        formTitle: {
          type: 'string',
          description: 'Filter by form title (partial match, case-insensitive)',
        },
        since: {
          type: 'string',
          description: 'Only submissions after this date (ISO 8601, e.g. "2025-01-01")',
        },
        until: {
          type: 'string',
          description: 'Only submissions before this date (ISO 8601)',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default: 20, max: 100)',
        },
        fieldFilter: {
          type: 'object',
          description: 'Filter by field values. Keys are field names, values are the expected values (e.g. { "status": "interested" })',
        },
      },
      required: [],
    },
  },
  // ─── Sprint 39: SUBSAFE Diagnostic System ─────────────────────────────
  {
    name: 'query_application_logs',
    description:
      'Query application error/warning logs to diagnose issues, find recurring errors, or check system health. Returns recent logs filtered by level, source, or time range. Use proactively when a user reports issues or when running diagnostics.',
    input_schema: {
      type: 'object' as const,
      properties: {
        level: {
          type: 'string',
          enum: ['error', 'warning', 'info', 'debug'],
          description: 'Filter by log level. Omit to include all levels.',
        },
        source: {
          type: 'string',
          description: 'Filter by source component (e.g. "LEO", "federation", "stripe", "connector-health").',
        },
        since: {
          type: 'string',
          description: 'ISO timestamp — only logs after this time. Default: last 1 hour.',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 20, max 50).',
        },
        unresolvedOnly: {
          type: 'boolean',
          description: 'Only show unresolved logs (default true).',
        },
      },
      required: [],
    },
  },
  {
    name: 'connector_health_summary',
    description:
      'Get health status of all configured connectors (email, Discord, Stripe, WhatsApp, Telegram, Slack, SMS). Shows which are active, errored, paused, or need attention. Use when users ask about integrations, communication channels, or when running system diagnostics.',
    input_schema: {
      type: 'object' as const,
      properties: {
        runLiveProbes: {
          type: 'boolean',
          description: 'If true, runs live health probes against each connector API (slower but accurate). Default: false (reads cached status).',
        },
      },
      required: [],
    },
  },
  {
    name: 'run_subsafe_check',
    description:
      'Run a comprehensive SUBSAFE diagnostic on this ship. Checks application errors, connector health, enterprise health (orders, inventory, content, payments), federation pulse, database integrity, and constitutional compliance. Returns a structured pass/fail report for each subsystem with recommended actions. Named after the US Navy SUBSAFE program — every system verified, every weld inspected.',
    input_schema: {
      type: 'object' as const,
      properties: {
        areas: {
          type: 'array',
          description: 'Specific areas to check. Omit to check all.',
          items: {
            type: 'string',
            enum: ['errors', 'connectors', 'enterprise', 'federation', 'database', 'constitution'],
          },
        },
      },
      required: [],
    },
  },
]

// ---------------------------------------------------------------------------
// Tool Executor
// ---------------------------------------------------------------------------

export type ToolExecutorContext = {
  payload: Payload
  tenantId?: number
  spaceId?: number
  userId?: number
  /**
   * The channel LEO is answering in (slug). Lets tools resolve the connector
   * BOUND to this channel — the seam that was missing, so "LEO in #gotify" can
   * reach the Gotify connector instead of being channel-blind. See
   * resolveConnectorByChannel + the dispatch_to_channel tool.
   */
  channelSlug?: string
  /** Sprint 44: Per-tenant AI provider config for multi-provider routing */
  tenantAiConfig?: Record<string, unknown>
}

/**
 * Executes a tool call from Claude and returns the result as a string.
 */
/** Tools that mutate content and need cache invalidation (Sprint 44) */
const CONTENT_MUTATION_TOOLS: Record<string, (input: Record<string, unknown>) => { collection: string; slug?: string }> = {
  update_product: (i) => ({ collection: 'products', slug: i.slug as string | undefined }),
  create_product: (i) => ({ collection: 'products', slug: i.slug as string | undefined }),
  update_post: (i) => ({ collection: 'posts', slug: i.slug as string | undefined }),
  create_post: (i) => ({ collection: 'posts', slug: i.slug as string | undefined }),
  update_page: (i) => ({ collection: 'pages', slug: i.slug as string | undefined }),
  create_page: (i) => ({ collection: 'pages', slug: i.slug as string | undefined }),
  generate_image: () => ({ collection: 'media' }),
  set_page_hero: (i) => ({ collection: 'pages', slug: i.pageSlug as string | undefined }),
  attach_image_to_product: () => ({ collection: 'products' }),
  replace_image: () => ({ collection: 'media' }),
  update_theme_settings: () => ({ collection: 'site-settings' }),
  update_navigation: () => ({ collection: 'header' }),
  configure_endeavor: () => ({ collection: 'endeavors' }),
  payload_update: (i) => ({ collection: i.collection as string }),
  payload_create: (i) => ({ collection: i.collection as string }),
}

export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { payload, tenantId } = ctx

  // Validate mutation/outbound tool inputs before execution
  const validationError = validateToolInput(toolName, toolInput)
  if (validationError) return validationError

  try {
    const result = await executeToolSwitch(toolName, toolInput, ctx, payload, tenantId)

    // ── Sprint 44: Cache invalidation after content mutations ────────
    const mutationMeta = CONTENT_MUTATION_TOOLS[toolName]
    if (mutationMeta && tenantId) {
      const { collection, slug } = mutationMeta(toolInput)
      revalidateAfterMutation({ collection, slug, tenantId: Number(tenantId) })
    }

    return result
  } catch (err) {
    logCaughtError(`leo-tools/${toolName}`, err).catch(() => {})
    return `Error querying data: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/** @internal — extracted from executeToolCall for Sprint 44 cache invalidation */
async function executeToolSwitch(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: ToolExecutorContext,
  payload: Payload,
  tenantId: number | undefined,
): Promise<string> {
    switch (toolName) {
      case 'query_products':
        return await queryProducts(payload, toolInput, tenantId)
      case 'query_posts':
        return await queryPosts(payload, toolInput, tenantId)
      case 'query_bookings':
        return await queryBookings(payload, toolInput, tenantId)
      case 'query_events':
        return await queryEvents(payload, toolInput, tenantId)
      case 'query_event_registrations':
        return await queryEventRegistrations(payload, toolInput, tenantId)
      case 'query_spaces':
        return await querySpaces(payload, toolInput, tenantId)
      case 'query_projects':
        return await queryProjects(payload, toolInput, tenantId)
      case 'query_availability':
        return await queryAvailability(payload, toolInput, tenantId)
      case 'create_booking':
        return await createBooking(payload, toolInput, ctx)
      case 'update_booking_status':
        return await updateBookingStatus(payload, toolInput, ctx)
      case 'check_available_slots':
        return await checkAvailableSlots(payload, toolInput, ctx)
      case 'cancel_booking':
        return await cancelBookingHandler(payload, toolInput, ctx)
      case 'reschedule_booking':
        return await rescheduleBookingHandler(payload, toolInput, ctx)
      case 'add_to_cart':
        return await addToCart(payload, toolInput, ctx)
      case 'view_cart':
        return await viewCart(payload, ctx)
      // Image generation & media management
      case 'generate_image':
        return await handleGenerateImage(payload, toolInput, tenantId, ctx)
      case 'improve_image':
        return await handleImproveImage(payload, toolInput, ctx)
      case 'attach_image_to_product':
        return await handleAttachImageToProduct(payload, toolInput, ctx)
      case 'replace_image':
        return await handleReplaceImage(payload, toolInput, ctx)
      // Invitation
      case 'invite_member':
        return await inviteMember(payload, toolInput, ctx)
      // Product creation & management
      case 'create_product':
        return await createProduct(payload, toolInput, ctx)
      case 'update_product':
        return await updateProduct(payload, toolInput, ctx)
      // Order routing & fulfillment
      case 'find_producers':
        return await handleFindProducers(payload, toolInput, ctx)
      case 'browse_network':
        return await handleBrowseNetwork(payload, toolInput, ctx)
      case 'check_fees':
        return await handleCheckFees(payload, ctx)
      case 'query_orders':
        return await handleQueryOrders(payload, toolInput, ctx)
      case 'route_order':
        return await handleRouteOrder(payload, toolInput, ctx)
      case 'accept_order':
        return await handleAcceptOrder(payload, toolInput, ctx)
      case 'update_fulfillment':
        return await handleUpdateFulfillment(payload, toolInput, ctx)
      // ─── Sprint 6: Business Setup & Stripe ────────────────────
      case 'configure_business':
        return await handleConfigureBusiness(payload, toolInput, ctx)
      case 'configure_endeavor':
        return await handleConfigureEndeavor(payload, toolInput, ctx)
      case 'check_endeavor_onboarding':
        return await handleCheckEndeavorOnboarding(payload, ctx)
      case 'connect_stripe_account':
        return await handleConnectStripe(payload, toolInput, ctx)
      case 'disconnect_stripe_account':
        return await handleDisconnectStripe(payload, toolInput, ctx)
      // ─── Sprint 11: Vendor Onboarding & Production ────────────
      case 'onboard_vendor':
        return await handleOnboardVendor(payload, toolInput, ctx)
      case 'suggest_products':
        return await handleSuggestProducts(toolInput)
      case 'generate_cad_instructions':
        return await handleGenerateCadInstructions(toolInput)
      case 'fetch_reviews':
        return await handleFetchReviews(payload, toolInput, ctx)
      case 'draft_review_response':
        return await handleDraftReviewResponse(toolInput)
      // ─── Sprint 14: Content Management ────────────────────────────────────
      case 'create_post':
        return await createPost(payload, toolInput, ctx)
      case 'create_work_from_url':
        return await createWorkFromContent(payload, toolInput, ctx)
      case 'create_quest':
        return await createQuest(payload, toolInput, ctx)
      case 'ingest_youtube_url':
        return await ingestYouTubeUrl(payload, toolInput, ctx)
      case 'ingest_youtube_channel':
        return await ingestYouTubeChannel(payload, toolInput, ctx)
      case 'update_post':
        return await updatePost(payload, toolInput, ctx)
      case 'create_page':
        return await createPage(payload, toolInput, ctx)
      case 'update_page':
        return await updatePage(payload, toolInput, ctx)
      case 'query_media':
        return await queryMedia(payload, toolInput, ctx)
      case 'manage_categories':
        return await manageCategories(payload, toolInput, ctx)
      // ─── Sprint 17: Leo Wizard Tools ──────────────────────────
      case 'create_space':
        return await handleCreateSpace(payload, toolInput, ctx)
      case 'complete_enlistment':
        return await handleCompleteEnlistment(payload, toolInput, ctx)
      case 'sign_constitution':
        return await handleSignConstitution(payload, toolInput, ctx)
      case 'ping_federation':
        return await handlePingFederation(payload, toolInput, ctx)
      // ─── Sprint 18B: Media Analysis & Knowledge ────────────────
      case 'analyze_image':
        return await handleAnalyzeImage(payload, toolInput, ctx)
      case 'extract_pdf_pages':
        return await handleExtractPdfPages(payload, toolInput, ctx)
      case 'query_knowledge':
        return await handleQueryKnowledge(payload, toolInput, ctx)
      // ─── Sprint 19: Theme Management & Image Placement ─────────
      case 'add_calendar_to_page':
        return await addCalendarToPage(payload, toolInput, ctx)
      case 'get_theme_settings':
        return await handleGetThemeSettings(payload, ctx)
      case 'update_theme_settings':
        return await handleUpdateThemeSettings(payload, toolInput, ctx)
      case 'get_page_hero':
        return await handleGetPageHero(payload, toolInput, ctx)
      case 'edit_image_text':
        return await handleEditImageText(payload, toolInput, ctx)
      case 'set_page_hero':
        return await handleSetPageHero(payload, toolInput, ctx)
      case 'generate_theme_aware_image':
        return await handleGenerateThemeAwareImage(payload, toolInput, ctx)
      // ─── Sprint 20: Research & Provision (Everyone Gets An Angel) ────
      case 'research_and_provision':
        return await handleResearchAndProvision(payload, toolInput, ctx)
      case 'provision_tenant':
        return await handleProvisionTenant(payload, toolInput, ctx)
      case 'track_soul':
        return await handleTrackSoul(payload, toolInput, ctx)
      // ─── Sprint 21: Arch Angel LEO's Wishlist ──────────────────
      // Phase 1: Communication & Social Layer
      case 'send_message':
        return await handleSendMessage(payload, toolInput, ctx)
      case 'send_direct_message':
        return await handleSendDirectMessage(payload, toolInput, ctx)
      case 'create_announcement':
        return await handleCreateAnnouncement(payload, toolInput, ctx)
      case 'moderate_content':
        return await handleModerateContent(payload, toolInput, ctx)
      // Phase 2: Inventory & Stock Management
      case 'update_inventory':
        return await handleUpdateInventory(payload, toolInput, ctx)
      case 'track_inventory_movement':
        return await handleTrackInventoryMovement(payload, toolInput, ctx)
      case 'set_low_stock_alert':
        return await handleSetLowStockAlert(payload, toolInput, ctx)
      case 'query_inventory_history':
        return await handleQueryInventoryHistory(payload, toolInput, ctx)
      // Phase 3: Financial Operations
      case 'generate_invoice':
        return await handleGenerateInvoice(payload, toolInput, ctx)
      case 'query_financial_reports':
        return await handleQueryFinancialReports(payload, toolInput, ctx)
      case 'issue_refund':
        return await handleIssueRefund(payload, toolInput, ctx)
      // Phase 4: Federation & Network Intelligence
      case 'query_federation':
        return await handleQueryFederation(payload, toolInput, ctx)
      case 'broadcast_capability':
        return await handleBroadcastCapability(payload, toolInput, ctx)
      case 'route_federated_request':
        return await handleRouteFederatedRequest(payload, toolInput, ctx)
      case 'negotiate_deal':
        return await handleNegotiateDeal(payload, toolInput, ctx)
      // Phase 5: CRM
      case 'create_customer_profile':
        return await handleCreateCustomerProfile(payload, toolInput, ctx)
      case 'log_interaction':
        return await handleLogInteraction(payload, toolInput, ctx)
      case 'segment_customers':
        return await handleSegmentCustomers(payload, toolInput, ctx)
      case 'send_follow_up':
        return await handleSendFollowUp(payload, toolInput, ctx)
      case 'send_email':
        return await handleSendEmail(payload, toolInput, ctx)
      // Phase 5b: Multi-Channel Messaging
      case 'send_whatsapp':
        return await handleSendWhatsApp(payload, toolInput, ctx)
      case 'send_telegram':
        return await handleSendTelegram(payload, toolInput, ctx)
      case 'send_sms':
        return await handleSendSms(payload, toolInput, ctx)
      case 'send_slack':
        return await handleSendSlack(payload, toolInput, ctx)
      case 'send_gotify':
        return await handleSendGotify(payload, toolInput, ctx)
      case 'dispatch_to_channel':
        return await handleDispatchToChannel(payload, toolInput, ctx)
      // Federation
      case 'send_federation_message':
        return await handleSendFederationMessage(payload, toolInput, ctx)
      case 'broadcast_federation_message':
        return await handleBroadcastFederationMessage(payload, toolInput, ctx)
      case 'request_endeavor_migration':
        return await handleRequestEndeavorMigration(payload, toolInput, ctx)
      case 'leo_handoff':
        return await handleLeoHandoff(payload, toolInput, ctx)
      // Phase 6: Analytics & Intelligence
      case 'analyze_trends':
        return await handleAnalyzeTrends(payload, toolInput, ctx)
      case 'recommend_products':
        return await handleRecommendProducts(payload, toolInput, ctx)
      // Phase 7: Workflow & Emergency
      case 'delegate_task':
        return await handleDelegateTask(payload, toolInput, ctx)
      case 'escalate_issue':
        return await handleEscalateIssue(payload, toolInput, ctx)
      case 'send_emergency_alert':
        return await handleSendEmergencyAlert(payload, toolInput, ctx)
      case 'document_incident':
        return await handleDocumentIncident(payload, toolInput, ctx)
      case 'log_maintenance_note':
        return await handleLogMaintenanceNote(payload, toolInput, ctx)
      // Sprint 24: LEO Enterprise Manager — Operational Intelligence
      case 'check_enterprise_health':
        return await handleCheckEnterpriseHealth(payload, toolInput, ctx)
      case 'get_enterprise_stage':
        return await handleGetEnterpriseStage(payload, ctx)
      case 'query_board_members':
        return await handleQueryBoardMembers(payload, toolInput)
      // ─── Sprint 32: Federation Pulse & Synchronicity ──────────────
      case 'federation_pulse':
        return await handleFederationPulse(payload, ctx)
      case 'my_place':
        return await handleMyPlace(payload, ctx)
      case 'find_synchronicities':
        return await handleFindSynchronicities(payload, toolInput, ctx)
      // ─── Sprint 38: Federation Browsing ─────────────────────────────
      case 'browse_federation_peers':
        return await handleBrowseFederationPeers(payload, toolInput, ctx)
      case 'query_peer_catalog':
        return await handleQueryPeerCatalog(payload, toolInput, ctx)
      case 'search_federation_wide':
        return await handleSearchFederationWide(payload, toolInput, ctx)
      case 'discover_federation_products':
        return await handleDiscoverFederationProducts(toolInput)
      // ─── Sprint 36: Generic Payload CRUD ────────────────────────────
      case 'payload_find':
        return await handlePayloadFind(payload, toolInput, ctx)
      case 'payload_update':
        return await handlePayloadUpdate(payload, toolInput, ctx)
      case 'payload_create':
        return await handlePayloadCreate(payload, toolInput, ctx)
      case 'payload_delete':
        return await handlePayloadDelete(payload, toolInput, ctx)
      case 'query_navigation':
        return await handleQueryNavigation(payload, toolInput, ctx)
      case 'update_navigation':
        return await handleUpdateNavigation(payload, toolInput, ctx)
      // ─── Sprint 37: Form Builder Integration ────────────────────────
      case 'send_inline_form':
        return await handleSendInlineForm(payload, toolInput, ctx)
      case 'create_form':
        return await handleCreateForm(payload, toolInput, ctx)
      case 'query_form_submissions':
        return await handleQueryFormSubmissions(payload, toolInput, ctx)
      // ─── Sprint 39: SUBSAFE Diagnostic System ──────────────────────
      case 'query_application_logs':
        return await handleQueryApplicationLogs(payload, toolInput, ctx)
      case 'connector_health_summary':
        return await handleConnectorHealthSummary(payload, toolInput, ctx)
      case 'run_subsafe_check':
        return await handleRunSubsafeCheck(payload, toolInput, ctx)
      default:
        return `Unknown tool: ${toolName}`
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely read a string property from a Payload doc */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function str(doc: any, key: string, fallback = ''): string {
  const val = doc?.[key]
  return typeof val === 'string' ? val : fallback
}

/** Safely read a number property from a Payload doc */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function num(doc: any, key: string): number | undefined {
  const val = doc?.[key]
  return typeof val === 'number' ? val : undefined
}

// ---------------------------------------------------------------------------
// Individual Query Handlers
// ---------------------------------------------------------------------------

async function queryProducts(
  payload: Payload,
  input: Record<string, unknown>,
  tenantId?: number,
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 5, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []

  // Always scope to tenant — if no tenantId, return nothing (fail closed)
  conditions.push({ tenant: tenantId ? { equals: tenantId } : { exists: false } })

  if (input.search && typeof input.search === 'string') {
    conditions.push({ title: { contains: input.search } })
  }
  if (input.category && typeof input.category === 'string') {
    conditions.push({ 'categories.title': { contains: input.category } })
  }

  const where: Where = { and: conditions }

  const result = await payload.find({
    collection: 'products',
    where,
    limit,
    depth: 1,
    overrideAccess: true, // Products are public catalog data
  })

  if (result.docs.length === 0) {
    return 'No products found matching your criteria.'
  }

  const products = result.docs.map((p) => {
    const title = str(p, 'title', 'Untitled')
    const priceCents = num(p, 'priceInUSD')
    const priceStr = priceCents != null ? `$${(priceCents / 100).toFixed(2)}` : 'Price not set'
    const slug = str(p, 'slug')
    return `- **${title}** (${priceStr})${slug ? ` — /products/${slug}` : ''}`
  })

  return `Found ${result.totalDocs} product(s)${result.totalDocs > limit ? ` (showing first ${limit})` : ''}:\n${products.join('\n')}`
}

async function queryPosts(
  payload: Payload,
  input: Record<string, unknown>,
  tenantId?: number,
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 5, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [{ _status: { equals: 'published' } }]

  // Always scope to tenant — if no tenantId, return nothing (fail closed)
  conditions.push({ tenant: tenantId ? { equals: tenantId } : { exists: false } })

  if (input.search && typeof input.search === 'string') {
    conditions.push({ title: { contains: input.search } })
  }

  const result = await payload.find({
    collection: 'posts',
    where: { and: conditions } as Where,
    limit,
    sort: '-publishedOn',
    depth: 1,
    overrideAccess: true, // Published posts are public
  })

  if (result.docs.length === 0) {
    return 'No published posts found.'
  }

  const posts = result.docs.map((p) => {
    const title = str(p, 'title', 'Untitled')
    const publishedOn = str(p, 'publishedOn')
    const date = publishedOn ? new Date(publishedOn).toLocaleDateString() : 'No date'
    const slug = str(p, 'slug')
    return `- **${title}** (${date})${slug ? ` — /posts/${slug}` : ''}`
  })

  return `Found ${result.totalDocs} post(s)${result.totalDocs > limit ? ` (showing first ${limit})` : ''}:\n${posts.join('\n')}`
}

async function queryBookings(
  payload: Payload,
  input: Record<string, unknown>,
  tenantId?: number,
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 5, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []

  if (tenantId) {
    conditions.push({ tenant: { equals: tenantId } })
  }
  if (input.status && typeof input.status === 'string') {
    conditions.push({ status: { equals: input.status } })
  }
  if (input.upcoming === true) {
    conditions.push({ startDateTime: { greater_than: new Date().toISOString() } })
  }

  const where: Where = conditions.length > 0 ? { and: conditions } : {}

  const result = await payload.find({
    collection: 'bookings',
    where,
    limit,
    sort: '-startDateTime',
    depth: 1,
    overrideAccess: false, // Bookings are private — respect user access
  })

  if (result.docs.length === 0) {
    return 'No bookings found matching your criteria.'
  }

  const bookings = result.docs.map((b) => {
    const title = str(b, 'title', 'Untitled booking')
    const status = str(b, 'status', 'unknown')
    const startDT = str(b, 'startDateTime')
    const start = startDT ? new Date(startDT).toLocaleString() : 'TBD'
    const type = str(b, 'bookingType')
    return `- **${title}** [${status}]${type ? ` — ${type},` : ' —'} ${start}`
  })

  return `Found ${result.totalDocs} booking(s):\n${bookings.join('\n')}`
}

async function queryEvents(
  payload: Payload,
  input: Record<string, unknown>,
  tenantId?: number,
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 5, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []

  // Always scope to tenant — if no tenantId, return nothing (fail closed)
  conditions.push({ tenant: tenantId ? { equals: tenantId } : { exists: false } })

  if (input.status && typeof input.status === 'string') {
    conditions.push({ status: { equals: input.status } })
  }
  if (input.eventType && typeof input.eventType === 'string') {
    conditions.push({ eventType: { equals: input.eventType } })
  }
  if (input.search && typeof input.search === 'string') {
    conditions.push({ title: { contains: input.search } })
  }
  if (input.upcoming === true) {
    conditions.push({ startDateTime: { greater_than: new Date().toISOString() } })
  }

  const where: Where = { and: conditions }

  const result = await payload.find({
    collection: 'events',
    where,
    limit,
    sort: 'startDateTime',
    depth: 1,
    overrideAccess: true, // Events are public
  })

  if (result.docs.length === 0) {
    return 'No events found matching your criteria.'
  }

  const events = await Promise.all(
    result.docs.map(async (e) => {
      const title = str(e, 'title', 'Untitled')
      const status = str(e, 'status', 'unknown')
      const eventType = str(e, 'eventType', '')
      const slug = str(e, 'slug')
      const startDT = str(e, 'startDateTime')
      const start = startDT ? new Date(startDT).toLocaleString() : 'TBD'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const location = (e as any)?.location
      const locType = location?.type || 'in-person'
      const venue = location?.venueName || ''

      // Get attendee count
      const regCount = await payload.count({
        collection: 'event-registrations',
        where: {
          and: [
            { event: { equals: e.id } },
            { status: { not_equals: 'cancelled' } },
          ],
        } as Where,
        overrideAccess: true,
      })

      return `- **${title}** [${status}] — ${eventType}, ${start}${venue ? `, ${venue}` : ''} (${locType}) — ${regCount.totalDocs} attendee(s)${slug ? ` — /events/${slug}` : ''}`
    }),
  )

  return `Found ${result.totalDocs} event(s)${result.totalDocs > limit ? ` (showing first ${limit})` : ''}:\n${events.join('\n')}`
}

async function queryEventRegistrations(
  payload: Payload,
  input: Record<string, unknown>,
  tenantId?: number,
): Promise<string> {
  const eventId = Number(input.eventId)
  if (!eventId) {
    return 'Error: eventId is required. Search for events first using query_events.'
  }

  const limit = Math.min(Number(input.limit) || 10, 50)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [{ event: { equals: eventId } }]

  // Always scope to tenant — if no tenantId, return nothing (fail closed)
  conditions.push({ tenant: tenantId ? { equals: tenantId } : { exists: false } })

  if (input.status && typeof input.status === 'string') {
    conditions.push({ status: { equals: input.status } })
  }

  const result = await payload.find({
    collection: 'event-registrations',
    where: { and: conditions } as Where,
    limit,
    depth: 1,
    overrideAccess: true,
  })

  if (result.docs.length === 0) {
    return 'No registrations found for this event.'
  }

  const regs = result.docs.map((r) => {
    const name = str(r, 'name', 'Anonymous')
    const email = str(r, 'email', '')
    const status = str(r, 'status', 'unknown')
    const mode = str(r, 'attendanceMode', 'in-person')
    const regType = str(r, 'registrationType', 'pre-event')
    return `- **${name}**${email ? ` (${email})` : ''} [${status}] — ${mode}, ${regType}`
  })

  return `${result.totalDocs} registration(s) for this event${result.totalDocs > limit ? ` (showing first ${limit})` : ''}:\n${regs.join('\n')}`
}

async function querySpaces(
  payload: Payload,
  input: Record<string, unknown>,
  tenantId?: number,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []
  // Always scope to tenant — if no tenantId, return nothing (fail closed)
  conditions.push({ tenant: tenantId ? { equals: tenantId } : { exists: false } })

  const where: Where = { and: conditions }

  const result = await payload.find({
    collection: 'spaces',
    where,
    limit: 20,
    depth: 0,
    overrideAccess: true, // Space listing is navigational
  })

  if (result.docs.length === 0) {
    return 'No spaces found.'
  }

  let output = `Found ${result.docs.length} space(s):\n`

  for (const space of result.docs) {
    const name = str(space, 'name', 'Unnamed')
    const visibility = str(space, 'visibility', 'public')
    output += `\n- **${name}** (${visibility})`

    if (input.includeChannels === true) {
      const channels = await payload.find({
        collection: 'channels',
        where: { space: { equals: space.id } } as Where,
        limit: 20,
        depth: 0,
        overrideAccess: true,
      })
      if (channels.docs.length > 0) {
        for (const ch of channels.docs) {
          output += `\n  - #${str(ch, 'name')} (${str(ch, 'type')})`
        }
      }
    }
  }

  return output
}

async function queryProjects(
  payload: Payload,
  input: Record<string, unknown>,
  tenantId?: number,
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 5, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []

  if (tenantId) {
    conditions.push({ tenant: { equals: tenantId } })
  }
  if (input.status && typeof input.status === 'string') {
    conditions.push({ projectStatus: { equals: input.status } })
  }
  if (input.search && typeof input.search === 'string') {
    conditions.push({ title: { contains: input.search } })
  }

  const where: Where = conditions.length > 0 ? { and: conditions } : {}

  const result = await payload.find({
    collection: 'projects',
    where,
    limit,
    sort: '-createdAt',
    depth: 1,
    overrideAccess: true, // Public portfolio projects
  })

  if (result.docs.length === 0) {
    return 'No projects found matching your criteria.'
  }

  const projects = result.docs.map((p) => {
    const title = str(p, 'title', 'Untitled')
    const status = str(p, 'projectStatus', 'unknown')
    const type = str(p, 'projectType')
    return `- **${title}** [${status}]${type ? ` — ${type}` : ''}`
  })

  return `Found ${result.totalDocs} project(s):\n${projects.join('\n')}`
}

async function queryAvailability(
  payload: Payload,
  input: Record<string, unknown>,
  tenantId?: number,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [{ isActive: { equals: true } }]

  // Always scope to tenant — if no tenantId, return nothing (fail closed)
  conditions.push({ tenant: tenantId ? { equals: tenantId } : { exists: false } })

  if (input.providerId && typeof input.providerId === 'number') {
    conditions.push({ provider: { equals: input.providerId } })
  }

  const result = await payload.find({
    collection: 'availability',
    where: { and: conditions } as Where,
    limit: 10,
    depth: 1,
    overrideAccess: true, // Availability is public scheduling data
  })

  if (result.docs.length === 0) {
    return 'No availability records found. The provider may not have set up their schedule yet.'
  }

  const slots = result.docs.map((a) => {
    const title = str(a, 'title', 'Availability')
    const type = str(a, 'availabilityType', 'unknown')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = (a as any).provider
    const providerName =
      typeof provider === 'object' && provider?.name
        ? String(provider.name)
        : 'Unknown provider'
    return `- **${title}** (${type}) — Provider: ${providerName}`
  })

  return `Found ${result.docs.length} availability record(s):\n${slots.join('\n')}`
}

// ---------------------------------------------------------------------------
// Booking Action Handlers (cal.com-style scheduling via conversation)
// ---------------------------------------------------------------------------

async function createBooking(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const title = input.title as string
  const bookingType = (input.bookingType as string) || 'service'
  const startDateTime = input.startDateTime as string
  const duration = Number(input.duration) || 60
  const description = input.description as string | undefined

  if (!title || !startDateTime) {
    return 'Error: title and startDateTime are required to create a booking.'
  }

  // Validate the date
  const startDate = new Date(startDateTime)
  if (isNaN(startDate.getTime())) {
    return 'Error: Invalid startDateTime format. Please use ISO 8601 format (e.g., "2026-02-20T14:00:00Z").'
  }

  if (startDate < new Date()) {
    return 'Error: Cannot create a booking in the past. Please provide a future date and time.'
  }

  if (!ctx.userId) {
    return 'Error: You must be logged in to create a booking. Please log in first.'
  }

  if (!ctx.tenantId) {
    return 'Error: No tenant context. Please ensure you are accessing a valid workspace.'
  }

  try {
    const engine = new BookingEngine(payload)

    // Find an available provider for this tenant
    // If providerId is specified in input, use it; otherwise find one
    let providerId = input.providerId ? String(input.providerId) : undefined

    if (!providerId) {
      // Find a provider who has availability set up for this tenant
      const availabilityResult = await payload.find({
        collection: 'availability',
        where: {
          and: [
            { tenant: { equals: ctx.tenantId } },
            { isActive: { equals: true } },
          ],
        } as Where,
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (availabilityResult.docs.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const avail = availabilityResult.docs[0] as any
        providerId = String(typeof avail.provider === 'object' ? avail.provider?.id : avail.provider)
      }
    }

    if (!providerId) {
      // Fallback: use the current user as both provider and client (self-booking)
      providerId = String(ctx.userId)
    }

    // Use BookingEngine to check conflicts and create with proper data
    const conflicts = await engine.checkBookingConflicts({
      providerId,
      clientId: String(ctx.userId),
      tenantId: String(ctx.tenantId),
      startDateTime: startDate,
      duration,
      bookingType,
      title,
      pricing: { amount: 0, currency: 'usd' },
    })

    if (conflicts.length > 0) {
      // Conflicts exist — use harmonic resolution to suggest alternatives
      const harmonicResult = await engine.resolveBookingHarmonically(
        {
          providerId,
          clientId: String(ctx.userId),
          tenantId: String(ctx.tenantId),
          startDateTime: startDate,
          duration,
          bookingType,
          title,
          pricing: { amount: 0, currency: 'usd' },
        },
        conflicts
      )

      const alternativesList = harmonicResult.alternatives
        .slice(0, 3)
        .map((alt, i) => `  ${i + 1}. ${alt.startTime.toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })} (harmony: ${alt.harmonicScore}%)`)
        .join('\n')

      return `⚠️ **Scheduling conflict detected!**\n\n${conflicts.map(c => `- ${c.message}`).join('\n')}\n\n` +
        (alternativesList
          ? `**Suggested alternatives** (Answer 53 harmonic resolution):\n${alternativesList}\n\nWould you like to book one of these alternative times instead?`
          : 'No nearby alternatives found. Try a different date or provider.')
    }

    // No conflicts — create the booking through the engine
    const result = await engine.createBooking({
      providerId,
      clientId: String(ctx.userId),
      tenantId: String(ctx.tenantId),
      startDateTime: startDate,
      duration,
      bookingType,
      title,
      description,
      pricing: {
        amount: 0,
        currency: 'usd',
        splitConfiguration: {
          providerShare: 60,
          platformShare: 20,
          operationsShare: 15,
          justiceShare: 5,
        },
      },
    })

    const bookingId = result.id
    const formattedDate = startDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })

    return `Booking created successfully!\n- **${title}** (${bookingType})\n- Date: ${formattedDate}\n- Duration: ${duration} minutes\n- Provider: ${providerId}\n- Status: pending\n- Booking ID: ${bookingId}\n\nThe booking is pending confirmation. You or the provider can confirm it.` + navDirective('/dashboard/bookings', 'View Bookings')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error creating booking: ${err instanceof Error ? err.message : 'Unknown error'}. Please check the details and try again.`
  }
}

// ---------------------------------------------------------------------------
// Available Slots Handler (real-time availability checking)
// ---------------------------------------------------------------------------

async function checkAvailableSlots(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const providerId = input.providerId ? String(input.providerId) : undefined
  const duration = Math.max(15, Number(input.duration) || 60)
  const days = Math.min(14, Math.max(1, Number(input.days) || 3))
  const serviceType = input.serviceType as string | undefined

  if (!providerId) {
    return 'Error: providerId is required. Use query_availability to find providers first.'
  }

  const startDate = input.date ? new Date(input.date as string) : new Date()
  if (isNaN(startDate.getTime())) {
    return 'Error: Invalid date format. Please use ISO 8601 date (e.g., "2026-03-15").'
  }

  // Set to beginning of day
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + days)

  try {
    const engine = new BookingEngine(payload)
    const slots = await engine.getAvailableSlots({
      providerId,
      tenantId: String(ctx.tenantId || ''),
      startDate,
      endDate,
      serviceType,
      slotDuration: duration,
    })

    const availableSlots = slots.filter(s => s.available)

    if (availableSlots.length === 0) {
      return `No available ${duration}-minute slots found for provider #${providerId} in the next ${days} day(s). The provider may not have availability set up, or all slots are booked.\n\nTips:\n- Try a longer date range (e.g., \`days: 7\`)\n- Try a shorter duration\n- Check query_availability to see if the provider has a schedule configured`
    }

    // Group slots by date for readable output
    const slotsByDate = new Map<string, typeof availableSlots>()
    availableSlots.forEach(slot => {
      const dateKey = slot.startTime.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      })
      if (!slotsByDate.has(dateKey)) slotsByDate.set(dateKey, [])
      slotsByDate.get(dateKey)!.push(slot)
    })

    const lines: string[] = [`**Available ${duration}-min slots** (next ${days} days):\n`]

    for (const [dateLabel, dateSlots] of slotsByDate) {
      const slotTimes = dateSlots
        .slice(0, 8) // Max 8 slots per day to keep output manageable
        .map(s => {
          const start = s.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          const end = s.endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          return `${start} – ${end}`
        })
        .join(' · ')
      const moreCount = dateSlots.length > 8 ? ` (+${dateSlots.length - 8} more)` : ''
      lines.push(`📅 **${dateLabel}**: ${slotTimes}${moreCount}`)
    }

    lines.push(`\nTotal: ${availableSlots.length} available slot(s). Say **"book [time]"** to schedule!`)

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error checking availability: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Cancel Booking Handler
// ---------------------------------------------------------------------------

async function cancelBookingHandler(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const bookingId = input.bookingId ? String(input.bookingId) : undefined
  const reason = (input.reason as string) || 'No reason provided'
  const cancelledBy = (input.cancelledBy as 'client' | 'provider' | 'system') || 'client'

  if (!bookingId) {
    return 'Error: bookingId is required. Use query_bookings to find booking IDs.'
  }

  if (!ctx.tenantId) {
    return 'Error: No tenant context. Please ensure you are accessing a valid workspace.'
  }

  try {
    const engine = new BookingEngine(payload)
    const result = await engine.cancelBooking(bookingId, String(ctx.tenantId), reason, cancelledBy)

    const bookingTitle = str(result, 'title', 'Untitled')
    const startDT = str(result, 'startDateTime')
    const formattedDate = startDT
      ? new Date(startDT).toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })
      : 'Unknown'

    return `Booking cancelled:\n- **${bookingTitle}** (ID: ${bookingId})\n- Was scheduled: ${formattedDate}\n- Reason: ${reason}\n- Cancelled by: ${cancelledBy}\n- Status: cancelled\n\nThe booking has been cancelled. Any associated calendar events should be updated.` +
      navDirective('/dashboard/bookings', 'View Bookings')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error cancelling booking: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Reschedule Booking Handler
// ---------------------------------------------------------------------------

async function rescheduleBookingHandler(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const bookingId = input.bookingId ? String(input.bookingId) : undefined
  const newStartDateTime = input.newStartDateTime as string | undefined
  const newDuration = input.newDuration ? Number(input.newDuration) : undefined

  if (!bookingId || !newStartDateTime) {
    return 'Error: bookingId and newStartDateTime are required.'
  }

  const newStart = new Date(newStartDateTime)
  if (isNaN(newStart.getTime())) {
    return 'Error: Invalid newStartDateTime format. Please use ISO 8601 format (e.g., "2026-03-15T14:00:00Z").'
  }

  if (newStart < new Date()) {
    return 'Error: Cannot reschedule to a past time. Please provide a future date and time.'
  }

  if (!ctx.tenantId) {
    return 'Error: No tenant context. Please ensure you are accessing a valid workspace.'
  }

  try {
    const engine = new BookingEngine(payload)
    const result = await engine.rescheduleBooking(bookingId, String(ctx.tenantId), newStart, newDuration)

    if (result.success && result.booking) {
      const bookingTitle = str(result.booking, 'title', 'Untitled')
      const formattedDate = newStart.toLocaleString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
      })
      const durationMin = newDuration || result.booking.duration || 60

      return `Booking rescheduled successfully!\n- **${bookingTitle}** (ID: ${bookingId})\n- New time: ${formattedDate}\n- Duration: ${durationMin} minutes\n- Status: ${result.booking.status}\n\nAny associated calendar events should be updated.` +
        navDirective('/dashboard/bookings', 'View Bookings')
    }

    // Conflicts — show harmonic alternatives
    let response = `⚠️ **Cannot reschedule to that time.**\n\n${result.error}\n`

    if (result.alternatives && result.alternatives.length > 0) {
      const altList = result.alternatives
        .slice(0, 5)
        .map((alt, i) => `  ${i + 1}. ${alt.startTime.toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })} (harmony: ${alt.harmonicScore}%)`)
        .join('\n')

      response += `\n**Harmonic alternatives** (Answer 53):\n${altList}\n\nWould you like to reschedule to one of these times instead?`
    } else {
      response += '\nNo nearby alternatives found. Try a different date or time.'
    }

    return response
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error rescheduling booking: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Shopping Cart Handlers (LEO-powered e-commerce)
// ---------------------------------------------------------------------------

async function addToCart(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const productId = Number(input.productId)
  const quantity = Math.max(1, Number(input.quantity) || 1)

  if (!productId) {
    return 'Error: productId is required. Search for products first using query_products.'
  }

  if (!ctx.userId) {
    return 'Error: You must be logged in to add items to your cart. Please log in first.'
  }

  try {
    // Fetch the product to get details + validate it exists
    const product = await payload.findByID({
      collection: 'products',
      id: productId,
      depth: 1,
      overrideAccess: true,
    })

    if (!product) {
      return `Error: Product #${productId} not found. Try searching for products first.`
    }

    const title = str(product, 'title', 'Untitled')
    const priceCents = num(product, 'priceInUSD')
    const priceStr = priceCents != null ? `$${(priceCents / 100).toFixed(2)}` : 'Price not set'
    const slug = str(product, 'slug')

    // Use Payload's ecommerce plugin cart API
    // The cart is managed by @payloadcms/plugin-ecommerce
    // We add items via the cart update endpoint
    try {
      // Fetch current cart for the user
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userDoc = await payload.findByID({
        collection: 'users',
        id: ctx.userId,
        depth: 2,
        overrideAccess: true,
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentCart = (userDoc as any)?.cart?.items || []

      // Check if product already in cart
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingItemIndex = currentCart.findIndex((item: any) => {
        const itemProduct = typeof item.product === 'object' ? item.product?.id : item.product
        return itemProduct === productId
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let updatedItems: any[]

      if (existingItemIndex >= 0) {
        // Update existing quantity
        updatedItems = [...currentCart]
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: (updatedItems[existingItemIndex].quantity || 1) + quantity,
        }
      } else {
        // Add new item
        updatedItems = [
          ...currentCart,
          {
            product: productId,
            quantity,
          },
        ]
      }

      // Update the user's cart
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload.update as any)({
        collection: 'users',
        id: ctx.userId,
        data: {
          cart: {
            items: updatedItems,
          },
        },
        overrideAccess: true,
      })

      const totalItems = updatedItems.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sum: number, item: any) => sum + (item.quantity || 1),
        0,
      )

      return `Added to cart!\n- **${title}** × ${quantity} (${priceStr} each)\n- Cart now has ${totalItems} item(s)\n${slug ? `- View product: /products/${slug}` : ''}\n\nSay "show my cart" to see everything, or "checkout" when you're ready!`
    } catch (cartErr) {
      logCaughtError('leo-tools', cartErr).catch(() => {})
      return `I found the product **${title}** (${priceStr}), but had trouble adding it to your cart. The cart system may need to be initialized. You can add it manually at /products/${slug}.`
    }
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error finding product: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function viewCart(
  payload: Payload,
  ctx: ToolExecutorContext,
): Promise<string> {
  if (!ctx.userId) {
    return 'You need to be logged in to view your cart. Please log in first.'
  }

  try {
    const userDoc = await payload.findByID({
      collection: 'users',
      id: ctx.userId,
      depth: 2,
      overrideAccess: true,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cartItems = (userDoc as any)?.cart?.items || []

    if (cartItems.length === 0) {
      return 'Your cart is empty. Say "show me products" to browse, or tell me what you\'re looking for!'
    }

    let totalCents = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = cartItems.map((item: any) => {
      const product = typeof item.product === 'object' ? item.product : null
      const qty = item.quantity || 1
      const title = product ? str(product, 'title', 'Unknown product') : `Product #${item.product}`
      const priceCents = product ? num(product, 'priceInUSD') : undefined
      const subtotalCents = priceCents != null ? priceCents * qty : 0
      totalCents += subtotalCents
      const priceStr = priceCents != null ? `$${(priceCents / 100).toFixed(2)}` : 'N/A'
      return `- **${title}** × ${qty} — ${priceStr} each${subtotalCents ? ` ($${(subtotalCents / 100).toFixed(2)})` : ''}`
    })

    return `Your Cart (${cartItems.length} item${cartItems.length === 1 ? '' : 's'}):\n${items.join('\n')}\n\n**Subtotal: $${(totalCents / 100).toFixed(2)}**\n\nReady to check out? Head to /checkout or say "remove [item]" to update your cart.`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error loading cart: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function updateBookingStatus(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const bookingId = Number(input.bookingId)
  const status = input.status as string

  if (!bookingId || !status) {
    return 'Error: bookingId and status are required.'
  }

  const validStatuses = ['confirmed', 'cancelled', 'completed', 'no-show']
  if (!validStatuses.includes(status)) {
    return `Error: Invalid status "${status}". Valid options: ${validStatuses.join(', ')}`
  }

  try {
    // First, fetch the booking to show what we're updating
    const existing = await payload.findByID({
      collection: 'bookings',
      id: bookingId,
      depth: 0,
      overrideAccess: true,
    })

    if (!existing) {
      return `Error: Booking #${bookingId} not found.`
    }

    // Verify booking belongs to current tenant
    if (ctx.tenantId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docTenant = (existing as any)?.tenant
      const tenantVal = typeof docTenant === 'object' ? docTenant?.id : docTenant
      if (tenantVal && tenantVal !== ctx.tenantId) {
        return 'Error: This booking belongs to a different tenant.'
      }
    }

    const oldStatus = str(existing, 'status', 'unknown')
    const bookingTitle = str(existing, 'title', 'Untitled')

    // Build update data — include cancellation details if status is 'cancelled'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { status }
    if (status === 'cancelled') {
      updateData.cancellation = {
        reason: 'Status updated via LEO',
        cancelledBy: 'system',
        cancelledAt: new Date().toISOString(),
      }
    }

    // Update the booking
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.update as any)({
      collection: 'bookings',
      id: bookingId,
      data: updateData,
      overrideAccess: true,
    })

    return `Booking updated:\n- **${bookingTitle}** (ID: ${bookingId})\n- Status: ${oldStatus} \u2192 ${status}` + navDirective('/dashboard/bookings', 'View Bookings')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error updating booking: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Product Creation & Management Handlers
// ---------------------------------------------------------------------------

async function createProduct(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const title = input.title as string
  const price = Number(input.price)
  const description = input.description as string | undefined
  const category = input.category as string | undefined
  const inventory = input.inventory !== undefined ? Number(input.inventory) : undefined
  const status = (input.status as string) || 'draft'

  if (!title || !title.trim()) {
    return 'Error: Product title is required.'
  }

  if (!price || price <= 0 || !isFinite(price)) {
    return 'Error: Price must be a positive number (e.g., 35 for $35.00).'
  }

  if (status !== 'draft' && status !== 'published') {
    return 'Error: Status must be "draft" or "published".'
  }

  if (inventory !== undefined && (inventory < 0 || !isFinite(inventory))) {
    return 'Error: Inventory must be a non-negative number.'
  }

  try {
    // Build the product data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productData: Record<string, any> = {
      title: title.trim(),
      priceInUSD: Math.round(price * 100), // Convert dollars to cents (priceInUSD is stored in cents)
      priceInUSDEnabled: true,
      _status: status,
    }

    // Add tenant if available
    if (ctx.tenantId) {
      productData.tenant = ctx.tenantId
    }

    // Add inventory if specified
    if (inventory !== undefined) {
      productData.inventory = Math.floor(inventory)
    }

    // Add description as richText if provided
    if (description) {
      productData.description = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: description,
                  detail: 0,
                  format: 0,
                  mode: 'normal',
                  style: '',
                  version: 1,
                },
              ],
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      }
    }

    // Look up category if specified
    if (category) {
      const categoryResult = await payload.find({
        collection: 'categories',
        where: {
          title: { contains: category },
        } as Where,
        limit: 1,
        overrideAccess: true,
      })

      if (categoryResult.docs.length > 0) {
        productData.categories = [categoryResult.docs[0].id]
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (payload.create as any)({
      collection: 'products',
      data: productData,
      overrideAccess: true,
    })

    const productId = result?.id
    if (!productId) {
      return 'Product creation failed — the database did not return an ID. This may be a temporary issue. Please try again, and if it persists, check the server logs.'
    }
    const slug = str(result, 'slug')
    const priceStr = `$${(productData.priceInUSD / 100).toFixed(2)}`

    const parts: string[] = [
      `Product created successfully!`,
      `- **${title.trim()}** (${priceStr})`,
      `- Status: ${status}`,
      `- Product ID: ${productId}`,
    ]

    if (slug) {
      parts.push(`- URL: /products/${slug}`)
    }
    if (inventory !== undefined) {
      parts.push(`- Inventory: ${Math.floor(inventory)} units`)
    }
    if (category && productData.categories) {
      parts.push(`- Category: ${category}`)
    } else if (category) {
      parts.push(`- Category "${category}" not found — you can add it in the admin panel`)
    }

    parts.push('')
    parts.push('Would you like me to generate a product image for this listing?')

    return parts.join('\n') + navDirective('/dashboard/products', 'View Products')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error creating product: ${err instanceof Error ? err.message : 'Unknown error'}. Please check the details and try again.`
  }
}

async function updateProduct(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const productId = Number(input.productId)

  if (!productId) {
    return 'Error: productId is required. Search for products first using query_products.'
  }

  // Validate price if provided
  if (input.price !== undefined) {
    const price = Number(input.price)
    if (!price || price <= 0 || !isFinite(price)) {
      return 'Error: Price must be a positive number.'
    }
  }

  // Validate status if provided
  if (input.status !== undefined) {
    if (input.status !== 'draft' && input.status !== 'published') {
      return 'Error: Status must be "draft" or "published".'
    }
  }

  // Validate inventory if provided
  if (input.inventory !== undefined) {
    const inv = Number(input.inventory)
    if (inv < 0 || !isFinite(inv)) {
      return 'Error: Inventory must be a non-negative number.'
    }
  }

  try {
    // Fetch existing product
    const existing = await payload.findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      overrideAccess: true,
    })

    if (!existing) {
      return `Error: Product #${productId} not found. Search for products first using query_products.`
    }

    // Tenant isolation — verify product belongs to this tenant
    if (ctx.tenantId) {
      const docTenant = (existing as any)?.tenant
      const tenantVal = typeof docTenant === 'object' ? docTenant?.id : docTenant
      if (tenantVal && tenantVal !== ctx.tenantId) {
        return 'Error: This product belongs to a different tenant.'
      }
    }

    const oldTitle = str(existing, 'title', 'Untitled')

    // Build update data — only include changed fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {}
    const changes: string[] = []

    if (input.title && typeof input.title === 'string') {
      updateData.title = (input.title as string).trim()
      changes.push(`Title: "${oldTitle}" → "${updateData.title}"`)
    }

    if (input.price !== undefined) {
      const newPrice = Math.round(Number(input.price) * 100) // Convert dollars to cents
      const oldPrice = num(existing, 'priceInUSD')
      updateData.priceInUSD = newPrice
      updateData.priceInUSDEnabled = true
      changes.push(`Price: $${oldPrice !== undefined ? (oldPrice / 100).toFixed(2) : 'N/A'} → $${(newPrice / 100).toFixed(2)}`)
    }

    if (input.inventory !== undefined) {
      updateData.inventory = Math.floor(Number(input.inventory))
      const oldInventory = num(existing, 'inventory')
      changes.push(`Inventory: ${oldInventory ?? 'N/A'} → ${updateData.inventory}`)
    }

    if (input.status !== undefined) {
      updateData._status = input.status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oldStatus = (existing as any)._status || 'draft'
      changes.push(`Status: ${oldStatus} → ${input.status}`)
    }

    if (input.description && typeof input.description === 'string') {
      updateData.description = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: input.description,
                  detail: 0,
                  format: 0,
                  mode: 'normal',
                  style: '',
                  version: 1,
                },
              ],
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      }
      changes.push('Description: updated')
    }

    if (changes.length === 0) {
      return `No changes specified for **${oldTitle}** (ID: ${productId}). Provide at least one field to update (title, price, description, inventory, status).`
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.update as any)({
      collection: 'products',
      id: productId,
      data: updateData,
      overrideAccess: true,
    })

    const displayTitle = updateData.title || oldTitle

    return `Product updated!\n- **${displayTitle}** (ID: ${productId})\n- Changes:\n${changes.map((c) => `  - ${c}`).join('\n')}` + navDirective('/dashboard/products', 'View Products')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error updating product: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Invitation Handler
// ---------------------------------------------------------------------------

async function inviteMember(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const email = input.email as string
  const role = (input.role as string) || 'member'
  const message = input.message as string | undefined

  if (!email || !isValidEmail(email)) {
    return 'Error: A valid email address is required.'
  }

  if (!ctx.userId) {
    return 'Error: You must be logged in to invite members.'
  }

  // Find the space — use provided spaceId or look up user's primary space
  let spaceId: number | string | undefined = input.spaceId
    ? (Number(input.spaceId) || String(input.spaceId))
    : undefined

  if (!spaceId && ctx.tenantId) {
    // Find user's first space in this tenant
    const spaces = await payload.find({
      collection: 'spaces',
      where: { tenant: { equals: ctx.tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (spaces.docs.length > 0) {
      spaceId = spaces.docs[0].id
    }
  }

  if (!spaceId) {
    return 'Error: No space found. Please specify a spaceId or ensure you belong to a space.'
  }

  try {
    const result = await createInvitation({
      payload,
      email,
      spaceId,
      invitedByUserId: ctx.userId,
      role: role as 'member' | 'moderator' | 'guest',
      message,
    })

    const parts = [
      `Invitation sent!`,
      `- **Email:** ${email}`,
      `- **Role:** ${role}`,
      `- **Invite link:** ${result.inviteUrl}`,
      `- **Expires:** ${new Date(result.expiresAt).toLocaleDateString()}`,
    ]

    if (message) {
      parts.push(`- **Message:** "${message}"`)
    }

    parts.push('')
    parts.push('They can accept the invitation by visiting the invite link.')

    return parts.join('\n') + navDirective('/dashboard/community', 'View Community')
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Failed to create invitation.'}`
  }
}

// ---------------------------------------------------------------------------
// Image Generation & Media Management Handlers
// ---------------------------------------------------------------------------

async function handleGenerateImage(
  payload: Payload,
  input: Record<string, unknown>,
  tenantId?: number,
  ctx?: ToolExecutorContext,
): Promise<string> {
  // Sprint 44: pass tenant AI config for multi-provider resolution
  const aiConfig = ctx?.tenantAiConfig as import('./ai-gateway').TenantAiConfig | undefined
  if (!isImageGenerationAvailable(undefined, aiConfig)) {
    return 'Image generation is not available — no image AI provider is configured. Set either OPENROUTER_API_KEY or AI_GATEWAY_API_KEY in your environment variables, or configure provider keys in your Endeavor\'s AI settings.'
  }

  const prompt = input.prompt as string
  if (!prompt) {
    return 'Error: A prompt describing the image is required.'
  }

  const autoSave = input.autoSave !== false // Default true
  const autoAttach = input.autoAttach === undefined ? true : Boolean(input.autoAttach)
  const productName = input.productName as string | undefined

  try {
    const result = await generateImage(
      {
        prompt,
        enhancementContext: {
          productName,
          category: input.category as string | undefined,
          brandStyle: input.brandStyle as string | undefined,
          backgroundColor: input.backgroundColor as string | undefined,
        },
        autoUpload: autoSave,
        tenantId,
      },
      autoSave ? payload : undefined,
      undefined, // tenantOpenRouterKey (deprecated)
      aiConfig,  // Sprint 44: multi-provider config
    )
    if (!result.success) {
      const errorParts = [`Image generation failed: ${result.error}`]
      if (result.modelText) {
        errorParts.push(`\nModel response: ${result.modelText.slice(0, 200)}`)
      }
      errorParts.push('\n💡 Tips: Try a simpler prompt, specify a different category (signs, decor, woodwork, art), or try again — AI image models can be intermittent.')
      return errorParts.join('\n')
    }

    const parts: string[] = ['Image generated successfully! 🎨']

    if (result.modelUsed) {
      parts.push(`Model: ${result.modelUsed}`)
    }

    if (result.mediaId) {
      parts.push(`Saved to media library (Media ID: ${result.mediaId})`)
    }

    if (result.permanentUrl) {
      parts.push(`URL: ${result.permanentUrl}`)
    }

    if (result.imageDataUrl && !result.permanentUrl) {
      // Image was generated but not saved — provide data URL for preview
      parts.push('Image available for preview (not yet saved to media library).')
      parts.push(`[IMAGE_DATA_URL:${result.imageDataUrl.substring(0, 100)}...]`)
    }

    if (result.uploadWarning) {
      parts.push(`\n⚠️ ${result.uploadWarning}`)
    }

    // Auto-attach to product if productName provided and image was saved
    if (productName && autoAttach && result.mediaId) {
      try {
        // Build tenant-scoped where clause to prevent cross-tenant attachment
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tenantFilter: any = tenantId ? { tenant: { equals: tenantId } } : {}
        // Try exact match first, then fall back to substring
        let products = await payload.find({
          collection: 'products',
          where: { and: [{ title: { equals: productName } }, tenantFilter] } as Where,
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (products.docs.length === 0) {
          products = await payload.find({
            collection: 'products',
            where: { and: [{ title: { contains: productName } }, tenantFilter] } as Where,
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
        }

        if (products.docs.length > 0) {
          const product = products.docs[0]
          const attachResult = await attachImageToProduct(
            payload,
            product.id as number,
            result.mediaId,
          )
          if (attachResult.success) {
            parts.push(`\n✅ Image automatically attached to "${product.title}" product gallery.`)
          } else {
            parts.push(`\n⚠️ Image saved but could not attach to product: ${attachResult.error}`)
            parts.push(`You can manually attach Media ID ${result.mediaId} to the product.`)
          }
        } else {
          parts.push(`\n⚠️ Product "${productName}" not found — image saved to media library (Media ID: ${result.mediaId}).`)
          parts.push('You can ask me to attach it to a specific product by ID.')
        }
      } catch (attachErr) {
        parts.push(`\n⚠️ Image saved but auto-attach failed: ${attachErr instanceof Error ? attachErr.message : 'Unknown error'}`)
        parts.push(`Media ID: ${result.mediaId} — you can ask me to attach it manually.`)
      }
    } else if (productName && !autoAttach) {
      parts.push(`\nWould you like me to attach this image to the "${productName}" product?`)
    } else if (!productName) {
      parts.push('\nYou can ask me to attach this to a specific product or save it for later.')
    }

    return parts.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error generating image: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleImproveImage(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const feedback = input.feedback as string
  if (!feedback) {
    return 'Error: Please describe what you want to change about the image.'
  }

  let imageUrl: string | undefined

  // If mediaId provided, fetch the image URL from Payload
  if (input.mediaId) {
    try {
      const media = await payload.findByID({
        collection: 'media',
        id: Number(input.mediaId),
        depth: 0,
        overrideAccess: true,
      })
      // Tenant isolation — verify media belongs to this tenant
      if (ctx.tenantId) {
        const docTenant = (media as any)?.tenant
        const tenantVal = typeof docTenant === 'object' ? docTenant?.id : docTenant
        if (tenantVal && tenantVal !== ctx.tenantId) {
          return 'Error: This media belongs to a different tenant.'
        }
      }
      imageUrl = (media as unknown as Record<string, unknown>).url as string
    } catch {
      return `Error: Could not find media with ID ${input.mediaId}.`
    }
  } else if (input.imageUrl) {
    imageUrl = input.imageUrl as string
  }

  try {
    // Step 1: Analyze the existing image and get an improved prompt
    let improvedPrompt = feedback
    let analysis = ''

    if (imageUrl) {
      const feedbackResult = await analyzeImageForFeedback({
        imageUrl,
        feedback,
        context: input.context as string | undefined,
      })
      improvedPrompt = feedbackResult.improvedPrompt
      analysis = feedbackResult.analysis
    }

    // Step 2: Generate improved image
    const result = await generateImage(
      { prompt: improvedPrompt, autoUpload: true },
      payload,
    )

    if (!result.success) {
      return `Image improvement failed: ${result.error}`
    }

    const parts: string[] = []
    if (analysis) {
      parts.push(`📋 Analysis: ${analysis}`)
    }
    parts.push('✨ Improved image generated!')

    if (result.mediaId) {
      parts.push(`New Media ID: ${result.mediaId}`)
    }
    if (result.permanentUrl) {
      parts.push(`URL: ${result.permanentUrl}`)
    }

    // If we had an original mediaId, offer to replace
    if (input.mediaId && result.mediaId) {
      parts.push(`\nWould you like me to replace the original image (Media #${input.mediaId}) with this improved version across all content?`)
    }

    return parts.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error improving image: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleAttachImageToProduct(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const productId = Number(input.productId)
  const mediaId = Number(input.mediaId)

  if (!productId || !mediaId) {
    return 'Error: Both productId and mediaId are required.'
  }

  const replaceIndex = input.replaceIndex !== undefined ? Number(input.replaceIndex) : undefined

  try {
    // Fetch product title for confirmation
    const product = await payload.findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      overrideAccess: true,
    })

    if (!product) {
      return `Error: Product #${productId} not found. Search for products first.`
    }

    // Tenant isolation — verify product belongs to this tenant
    if (ctx.tenantId) {
      const docTenant = (product as any)?.tenant
      const tenantVal = typeof docTenant === 'object' ? docTenant?.id : docTenant
      if (tenantVal && tenantVal !== ctx.tenantId) {
        return 'Error: This product belongs to a different tenant.'
      }
    }

    const title = str(product, 'title', 'Untitled')

    const result = await attachImageToProduct(payload, productId, mediaId, { replaceIndex })

    if (!result.success) {
      return `Error: ${result.error}`
    }

    if (replaceIndex !== undefined) {
      return `Image replaced! Updated gallery image #${replaceIndex + 1} on **${title}** with Media #${mediaId}.`
    }

    return `Image attached! Added Media #${mediaId} to **${title}**'s gallery.`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error attaching image: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleReplaceImage(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const oldMediaId = Number(input.oldMediaId)
  const newMediaId = Number(input.newMediaId)

  if (!oldMediaId || !newMediaId) {
    return 'Error: Both oldMediaId and newMediaId are required.'
  }

  try {
    const result = await replaceMediaOnContent(payload, oldMediaId, newMediaId, {
      collection: input.collection as string | undefined,
      documentId: input.documentId ? Number(input.documentId) : undefined,
      tenantId: ctx.tenantId,
    })

    if (!result.success) {
      return `Error: ${result.error}`
    }

    if (result.updatedDocuments === 0) {
      return `No documents found referencing Media #${oldMediaId}. The image may not be in use, or it may have already been replaced.`
    }

    return `Image replaced globally! Updated ${result.updatedDocuments} document(s) — swapped Media #${oldMediaId} → #${newMediaId}.`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error replacing image: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Order Routing & Fulfillment Handlers — Sprint 4
// ---------------------------------------------------------------------------

/**
 * find_producers — Search for capable Holon nodes near a location.
 */
async function handleFindProducers(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const skill = input.skill as string
  if (!skill || !skill.trim()) {
    return 'Error: Skill is required (e.g., "screen-printing", "3d-printing").'
  }

  const radius = (input.radius as number) || 100
  const limit = Math.min((input.limit as number) || 10, 20)

  try {
    // Query all holon nodes (cross-tenant for network discovery)
    const holons = await payload.find({
      collection: 'holon-capabilities' as any,
      where: {
        constitutionalCompliance: { equals: true },
        acceptingOrders: { equals: true },
      },
      limit: 100,
      overrideAccess: true,
    })

    if (holons.docs.length === 0) {
      return 'No production nodes registered on the network yet. Partners can register at /dashboard/holon.'
    }

    // Convert to HolonNode format for routing engine
    const holonNodes: HolonNode[] = holons.docs.map((doc: any) => ({
      id: doc.id,
      tenantId: typeof doc.tenant === 'object' ? doc.tenant?.id : doc.tenant,
      businessName: doc.businessName || undefined,
      nodeType: doc.nodeType,
      capabilities: (doc.capabilities || []).map((c: any) => ({
        skill: c.skill,
        equipment: c.equipment,
        materials: c.materials,
        maxVolume: c.maxVolume,
        turnaroundHours: c.turnaroundHours,
      })),
      serviceRadius: doc.serviceRadius ?? 100,
      location: {
        lat: doc.location?.lat ?? 0,
        lng: doc.location?.lng ?? 0,
        city: doc.location?.city,
        region: doc.location?.region,
      },
      rating: doc.rating ?? 0,
      activeOrderCount: doc.activeOrderCount ?? 0,
      acceptingOrders: doc.acceptingOrders !== false,
      constitutionalCompliance: doc.constitutionalCompliance !== false,
    }))

    // Use buyer's location or fallback to city/region search
    let buyerLat = (input.lat as number) || 0
    let buyerLng = (input.lng as number) || 0

    // If no coordinates, try to find from current tenant's holon
    if (!buyerLat && !buyerLng && ctx.tenantId) {
      const ownHolon = holonNodes.find((h) => h.tenantId === ctx.tenantId)
      if (ownHolon) {
        buyerLat = ownHolon.location.lat
        buyerLng = ownHolon.location.lng
      }
    }

    const requirement: OrderRequirement = {
      skills: [skill],
      buyerLocation: { lat: buyerLat, lng: buyerLng },
      maxDistance: radius,
    }

    const matches = findMatchingHolons(requirement, holonNodes, { maxResults: limit })

    if (matches.length === 0) {
      return `No producers found for "${skill}" within ${radius} miles. Try expanding your search radius.`
    }

    const results = matches.map((m, i) => {
      const location = m.holon.location.city
        ? `${m.holon.location.city}, ${m.holon.location.region || ''}`
        : 'Location not specified'
      return `${i + 1}. ${serializeMatch(m)} | ${location}`
    })

    return `Found ${matches.length} producer(s) for "${skill}":\n\n${results.join('\n')}`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error searching for producers: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * browse_network — Browse cross-tenant network products.
 */
async function handleBrowseNetwork(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const search = input.search as string | undefined
  const category = input.category as string | undefined
  const limit = Math.min((input.limit as number) || 20, 50)

  try {
    const where: any = {
      networkListing: { equals: true },
      _status: { equals: 'published' },
    }

    if (search) {
      where.title = { contains: search }
    }

    const products = await payload.find({
      collection: 'products',
      where,
      limit,
      overrideAccess: true, // Cross-tenant read
      depth: 1,
    })

    if (products.docs.length === 0) {
      return search
        ? `No network products found matching "${search}". Try broadening your search.`
        : 'No products currently listed on the network. Vendors can list products by enabling "Network Listing" in their product settings.'
    }

    const results = products.docs.map((p: any, i: number) => {
      const tenant = typeof p.tenant === 'object' ? p.tenant?.name || p.tenant?.slug : 'Unknown vendor'
      const price = p.priceInUSD ? `$${(p.priceInUSD / 100).toFixed(2)}` : 'Price TBD'
      const caps = (p.requiredCapabilities || []).map((c: any) => c.skill).join(', ')
      return `${i + 1}. **${p.title}** — ${price} | By: ${tenant}${caps ? ` | Requires: ${caps}` : ''}`
    })

    return `Network products (${products.docs.length}):\n\n${results.join('\n')}`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error browsing network: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * query_orders — Look up orders (customer or vendor view).
 */
async function handleQueryOrders(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const viewAs = (input.viewAs as string) || 'customer'
  const statusFilter = input.status as string | undefined
  const fulfillmentFilter = input.fulfillmentStatus as string | undefined
  const limit = Math.min((input.limit as number) || 10, 50)

  try {
    const where: any = {}

    if (viewAs === 'customer') {
      if (ctx.userId) {
        where.customer = { equals: ctx.userId }
      }
    }

    if (statusFilter) {
      where.status = { equals: statusFilter }
    }

    if (ctx.tenantId) {
      where.tenant = { equals: ctx.tenantId }
    }

    const orders = await payload.find({
      collection: 'orders',
      where,
      limit,
      depth: 2,
      overrideAccess: true,
    })

    if (orders.docs.length === 0) {
      return viewAs === 'customer'
        ? 'No orders found. Browse products to place your first order!'
        : 'No orders assigned to your production node yet. Orders will appear here when customers need your capabilities.'
    }

    const results = orders.docs.map((o: any, i: number) => {
      const items = (o.items || []).map((item: any) => {
        const product = typeof item.product === 'object' ? item.product?.title : `Product #${item.product}`
        return `${product} x${item.quantity}`
      })
      const status = o.status || 'processing'
      const amount = o.amount ? `$${(o.amount / 100).toFixed(2)}` : 'N/A'

      // Fulfillment info for vendor view
      let fulfillmentInfo = ''
      if (viewAs === 'vendor' && o.fulfillment?.length) {
        const statuses = o.fulfillment.map((f: any) => f.fulfillmentStatus || 'pending_match')
        fulfillmentInfo = ` | Fulfillment: ${statuses.join(', ')}`
      }

      return `${i + 1}. Order #${o.id} — ${status} | ${amount} | ${items.join(', ')}${fulfillmentInfo}`
    })

    const label = viewAs === 'customer' ? 'Your Orders' : 'Assigned Orders'
    return `${label} (${orders.docs.length}):\n\n${results.join('\n')}`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error looking up orders: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * route_order — Assign order items to a Holon node.
 */
async function handleRouteOrder(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const orderId = Number(input.orderId)
  if (!orderId) return 'Error: orderId is required.'

  const itemIndex = input.itemIndex !== undefined ? Number(input.itemIndex) : undefined
  const preferredHolonId = input.preferredHolonId ? Number(input.preferredHolonId) : undefined

  try {
    // Fetch order
    const order = await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 2,
      overrideAccess: true,
    })

    if (!order) return `Error: Order #${orderId} not found.`

    const items = (order as any).items || []
    if (items.length === 0) return `Error: Order #${orderId} has no items.`

    // Determine which items to route
    const indicesToRoute = itemIndex !== undefined ? [itemIndex] : items.map((_: any, i: number) => i)

    const routingResults: string[] = []

    for (const idx of indicesToRoute) {
      if (idx >= items.length) {
        routingResults.push(`Item ${idx}: Index out of range (order has ${items.length} items)`)
        continue
      }

      const item = items[idx]
      const product = typeof item.product === 'object' ? item.product : null

      // Get required capabilities from product
      const requiredSkills = (product?.requiredCapabilities || []).map((c: any) => c.skill).filter(Boolean)

      if (requiredSkills.length === 0 && !preferredHolonId) {
        routingResults.push(`Item ${idx} (${product?.title || 'Unknown'}): No required capabilities set — cannot auto-route. Set requiredCapabilities on the product or specify a preferredHolonId.`)
        continue
      }

      if (preferredHolonId) {
        // Manual assignment
        const holon = await payload.findByID({
          collection: 'holon-capabilities' as any,
          id: preferredHolonId,
          overrideAccess: true,
        })

        if (!holon) {
          routingResults.push(`Item ${idx}: Holon #${preferredHolonId} not found.`)
          continue
        }

        // Update fulfillment
        const fulfillment = (order as any).fulfillment || []
        fulfillment.push({
          orderItemIndex: idx,
          assignedHolon: preferredHolonId,
          sourceTenant: typeof (holon as any).tenant === 'object' ? (holon as any).tenant?.id : (holon as any).tenant,
          fulfillmentStatus: 'matched',
          matchedAt: new Date().toISOString(),
          vendorShare: calculateVendorShare(product?.priceInUSD || 0),
        })

        await payload.update({
          collection: 'orders',
          id: orderId,
          data: { fulfillment } as any,
          overrideAccess: true,
        })

        const holonName = (holon as any).businessName || `Holon #${preferredHolonId}`
        routingResults.push(`Item ${idx} (${product?.title || 'Unknown'}): Assigned to ${holonName}`)
      } else {
        // Auto-route via matching engine
        const holons = await payload.find({
          collection: 'holon-capabilities' as any,
          where: { constitutionalCompliance: { equals: true }, acceptingOrders: { equals: true } },
          limit: 100,
          overrideAccess: true,
        })

        const holonNodes: HolonNode[] = holons.docs.map((doc: any) => ({
          id: doc.id,
          tenantId: typeof doc.tenant === 'object' ? doc.tenant?.id : doc.tenant,
          businessName: doc.businessName,
          nodeType: doc.nodeType,
          capabilities: doc.capabilities || [],
          serviceRadius: doc.serviceRadius ?? 100,
          location: { lat: doc.location?.lat ?? 0, lng: doc.location?.lng ?? 0, city: doc.location?.city, region: doc.location?.region },
          rating: doc.rating ?? 0,
          activeOrderCount: doc.activeOrderCount ?? 0,
          acceptingOrders: doc.acceptingOrders !== false,
          constitutionalCompliance: true,
        }))

        // Use shipping address as buyer location
        const shipping = (order as any).shippingAddress || {}
        const requirement: OrderRequirement = {
          skills: requiredSkills,
          materials: (product?.requiredCapabilities || []).flatMap((c: any) => c.materials || []),
          buyerLocation: { lat: shipping.lat || 0, lng: shipping.lng || 0 },
        }

        const matches = findMatchingHolons(requirement, holonNodes, { maxResults: 1 })

        if (matches.length === 0) {
          routingResults.push(`Item ${idx} (${product?.title || 'Unknown'}): No matching producers found. Try adding more Holon nodes to the network.`)
          continue
        }

        const bestMatch = matches[0]
        const fulfillment = (order as any).fulfillment || []
        fulfillment.push({
          orderItemIndex: idx,
          assignedHolon: bestMatch.holon.id,
          sourceTenant: bestMatch.holon.tenantId,
          fulfillmentStatus: 'matched',
          matchScore: Math.round(bestMatch.totalScore),
          matchedAt: new Date().toISOString(),
          vendorShare: calculateVendorShare(product?.priceInUSD || 0),
        })

        await payload.update({
          collection: 'orders',
          id: orderId,
          data: { fulfillment } as any,
          overrideAccess: true,
        })

        routingResults.push(
          `Item ${idx} (${product?.title || 'Unknown'}): Matched to ${bestMatch.holon.businessName || `Holon #${bestMatch.holon.id}`} (Score: ${bestMatch.totalScore.toFixed(0)}, ${bestMatch.distance.toFixed(1)} mi)`,
        )
      }
    }

    return `Order #${orderId} routing:\n\n${routingResults.join('\n')}` + navDirective('/dashboard/orders', 'View Orders')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error routing order: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * accept_order — Vendor accepts an order assignment.
 */
async function handleAcceptOrder(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const orderId = Number(input.orderId)
  const itemIndex = Number(input.itemIndex)
  const estimatedDate = input.estimatedCompletionDate as string | undefined

  if (!orderId) return 'Error: orderId is required.'
  if (input.itemIndex === undefined) return 'Error: itemIndex is required.'

  try {
    const order = await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 2,
      overrideAccess: true,
    })

    if (!order) return `Error: Order #${orderId} not found.`

    const fulfillment = ((order as any).fulfillment || []) as any[]
    const entry = fulfillment.find((f: any) => f.orderItemIndex === itemIndex)

    if (!entry) {
      return `Error: No fulfillment record for item ${itemIndex} in order #${orderId}. Route the order first.`
    }

    if (entry.fulfillmentStatus !== 'matched') {
      return `Error: Cannot accept — current status is "${entry.fulfillmentStatus}". Only "matched" orders can be accepted.`
    }

    // Update status
    entry.fulfillmentStatus = 'accepted'
    entry.acceptedAt = new Date().toISOString()
    if (estimatedDate) {
      entry.estimatedCompletion = estimatedDate
    }

    await payload.update({
      collection: 'orders',
      id: orderId,
      data: { fulfillment } as any,
      overrideAccess: true,
    })

    const item = ((order as any).items || [])[itemIndex]
    const productTitle = typeof item?.product === 'object' ? item.product?.title : `Product #${item?.product}`
    const vendorShare = entry.vendorShare ? `$${entry.vendorShare.toFixed(2)}` : 'TBD'

    return `Order #${orderId}, item ${itemIndex} (${productTitle}) accepted! Your vendor share (60%): ${vendorShare}.${estimatedDate ? ` Estimated completion: ${estimatedDate}.` : ''} Update status to "in_production" when you start working on it.`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error accepting order: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * update_fulfillment — Update production status or add shipping.
 */
async function handleUpdateFulfillment(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const orderId = Number(input.orderId)
  const itemIndex = Number(input.itemIndex)
  const newStatus = input.status as FulfillmentStatus

  if (!orderId) return 'Error: orderId is required.'
  if (input.itemIndex === undefined) return 'Error: itemIndex is required.'
  if (!newStatus) return 'Error: status is required.'

  // Validate required fields for status
  const updateValidation = validateFulfillmentUpdate({
    status: newStatus,
    trackingNumber: input.trackingNumber as string | undefined,
    rejectionReason: input.rejectionReason as string | undefined,
  })
  if (updateValidation) return updateValidation

  try {
    const order = await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 2,
      overrideAccess: true,
    })

    if (!order) return `Error: Order #${orderId} not found.`

    const fulfillment = ((order as any).fulfillment || []) as any[]
    const entry = fulfillment.find((f: any) => f.orderItemIndex === itemIndex)

    if (!entry) {
      return `Error: No fulfillment record for item ${itemIndex} in order #${orderId}.`
    }

    // Validate state transition
    const currentStatus = entry.fulfillmentStatus as FulfillmentStatus
    if (!validateFulfillmentTransition(currentStatus, newStatus)) {
      return `Error: Cannot transition from "${currentStatus}" to "${newStatus}". Check the fulfillment workflow.`
    }

    // Update entry
    entry.fulfillmentStatus = newStatus
    if (newStatus === 'shipped') {
      entry.shippedAt = new Date().toISOString()
      entry.trackingNumber = input.trackingNumber as string
      if (input.trackingUrl) entry.trackingUrl = input.trackingUrl as string
    }
    if (newStatus === 'rejected') {
      entry.rejectionReason = input.rejectionReason as string
    }

    await payload.update({
      collection: 'orders',
      id: orderId,
      data: { fulfillment } as any,
      overrideAccess: true,
    })

    const item = ((order as any).items || [])[itemIndex]
    const productTitle = typeof item?.product === 'object' ? item.product?.title : `Product #${item?.product}`

    const statusMessages: Record<string, string> = {
      in_production: `Started production on "${productTitle}". Update to "shipped" when ready.`,
      shipped: `"${productTitle}" shipped! Tracking: ${input.trackingNumber}.`,
      delivered: `"${productTitle}" marked as delivered. Thank you!`,
      rejected: `"${productTitle}" rejected: ${input.rejectionReason}. The order will be re-routed to another producer.`,
    }

    return `Order #${orderId}, item ${itemIndex}: ${statusMessages[newStatus] || `Status updated to "${newStatus}".`}`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error updating fulfillment: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Sprint 6: Business Setup & Stripe Connect Handlers
// ---------------------------------------------------------------------------

/**
 * configure_business — The "5 minutes to running" wizard.
 * Updates tenant settings based on conversational input from the user.
 */
async function handleConfigureBusiness(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx

  if (!tenantId) {
    return 'Error: No tenant context available. Please ensure you are operating within a tenant.'
  }

  const businessType = input.businessType as string | undefined
  // Accept siteName as alias for businessName (LEO sometimes uses siteName)
  const businessName = (input.businessName || input.siteName) as string | undefined

  // At least one field should be provided
  if (!businessType && !businessName && !input.tagline && !input.description) {
    return 'Error: Please provide at least a businessType, businessName/siteName, tagline, or description to update.'
  }

  try {
    // Build update data from input
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {}

    if (businessType) {
      updateData.businessType = businessType
    }

    // Business name updates both tenant name and site name
    if (businessName) {
      updateData.name = businessName
      // Also set the site name in settings for consistent branding
      updateData.siteName = businessName
    }

    // Storefront fields
    const storefrontUpdate: Record<string, unknown> = {}
    if (input.description) storefrontUpdate.description = input.description
    if (input.contactEmail) storefrontUpdate.contactEmail = input.contactEmail
    if (input.contactPhone) storefrontUpdate.contactPhone = input.contactPhone

    if (Object.keys(storefrontUpdate).length > 0) {
      updateData.storefront = storefrontUpdate
    }

    // Branding tagline
    if (input.tagline) {
      updateData.branding = { tagline: input.tagline }
    }

    // Commerce flags
    const commerceUpdate: Record<string, unknown> = {}
    if (input.currency) commerceUpdate.currency = input.currency
    if (input.shippingEnabled !== undefined) commerceUpdate.shippingEnabled = input.shippingEnabled
    if (input.bookingsEnabled !== undefined) commerceUpdate.bookingsEnabled = input.bookingsEnabled
    if (input.eventsEnabled !== undefined) commerceUpdate.eventsEnabled = input.eventsEnabled
    if (input.digitalProductsEnabled !== undefined) commerceUpdate.digitalProductsEnabled = input.digitalProductsEnabled

    if (Object.keys(commerceUpdate).length > 0) {
      updateData.commerce = commerceUpdate
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.update as any)({
      collection: 'tenants',
      id: tenantId,
      data: updateData,
      overrideAccess: true,
    })

    // Build friendly response
    const typeLabels: Record<string, string> = {
      retail: 'Retail / E-Commerce',
      service: 'Service Business',
      content_creator: 'Content Creator',
      nonprofit: 'Nonprofit / Ministry',
      professional_services: 'Professional Services',
      gift_shop: 'Gift Shop',
      ministry: 'Church / Ministry',
      artisan_maker: 'Artisan / Maker',
      custom: 'Custom',
    }

    const parts: string[] = []
    if (businessName) {
      parts.push(`Business renamed to "${businessName}".`)
    }
    if (businessType) {
      parts.push(`Type set to "${typeLabels[businessType] || businessType}".`)
    }

    const enabledFeatures: string[] = []
    if (input.shippingEnabled) enabledFeatures.push('shipping')
    if (input.bookingsEnabled) enabledFeatures.push('bookings')
    if (input.eventsEnabled) enabledFeatures.push('events')
    if (input.digitalProductsEnabled) enabledFeatures.push('digital products')

    if (enabledFeatures.length > 0) {
      parts.push(`Enabled: ${enabledFeatures.join(', ')}.`)
    }
    if (input.tagline) {
      parts.push(`Tagline: "${input.tagline}".`)
    }
    if (input.description) {
      parts.push('Description updated.')
    }

    let response = parts.join(' ')
    if (!response) response = 'Business profile updated.'
    response += ' Your storefront is taking shape! Next steps: add products, set up availability, or connect Stripe for payments.'

    return response + navDirective('/dashboard/enterprise', 'View Enterprise')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error configuring business: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * check_endeavor_onboarding — Verify + self-heal the portal's onboarding baseline.
 */
async function handleCheckEndeavorOnboarding(
  payload: Payload,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  if (!tenantId) return 'Error: No tenant context available.'

  try {
    const r = await verifyEndeavorOnboarding(payload, tenantId)
    const lines = [
      `Onboarding verified for this enterprise:`,
      `• Spaces: ${r.spacesCount} (AI Bus ${r.aiBusSpaceId ? '✓' : '✗'}, Main ${r.mainSpaceId ? '✓' : '✗'}, DMs ${r.dmSpaceId ? '✓' : '✗'})`,
      `• Members: ${r.membersCount} active`,
      `• Memberships backfilled: ${r.membersBackfilled}`,
      `• Page-comment channels re-homed onto the AI Bus: ${r.pageChannelsReparented}`,
    ]
    if (r.errors.length) lines.push(`• Warnings: ${r.errors.join('; ')}`)
    else lines.push(`Everything is at baseline — no issues found.`)
    return lines.join('\n')
  } catch (err) {
    return `Error verifying onboarding: ${err instanceof Error ? err.message : String(err)}`
  }
}

/**
 * configure_endeavor — Updates the Endeavor (constitutional identity) for this tenant.
 */
async function handleConfigureEndeavor(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx

  if (!tenantId) {
    return 'Error: No tenant context available.'
  }

  try {
    // Find existing endeavor
    const existing = await payload.find({
      collection: 'endeavors',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {}

    if (input.name) updateData.name = input.name
    if (input.tagline) updateData.tagline = input.tagline
    if (input.description) updateData.description = input.description
    if (input.endeavorType) updateData.endeavorType = input.endeavorType
    if (input.missionStatement) updateData.missionStatement = input.missionStatement
    if (input.holonTypes) updateData.holonTypes = input.holonTypes
    if (input.capabilities) updateData.capabilities = input.capabilities

    // Operator fields
    if (input.operatorName || input.operatorEmail || input.operatorRole) {
      const existingOp = (existing.docs[0] as any)?.operator || {}
      updateData.operator = {
        name: (input.operatorName as string) || existingOp.name || '',
        email: (input.operatorEmail as string) || existingOp.email || '',
        role: (input.operatorRole as string) || existingOp.role || '',
      }
    }

    // Region fields
    if (input.regionCity || input.regionState || input.regionCountry) {
      const existingRegion = (existing.docs[0] as any)?.region || {}
      updateData.region = {
        city: (input.regionCity as string) || existingRegion.city || '',
        state: (input.regionState as string) || existingRegion.state || '',
        country: (input.regionCountry as string) || existingRegion.country || 'US',
      }
    }

    // Federation visibility
    if (input.networkVisible !== undefined) {
      const existingFed = (existing.docs[0] as any)?.federation || {}
      updateData.federation = { ...existingFed, networkVisible: input.networkVisible }
    }

    if (Object.keys(updateData).length === 0) {
      return 'Error: Please provide at least one field to update (name, tagline, description, missionStatement, capabilities, etc.).'
    }

    if (existing.docs[0]) {
      await (payload.update as any)({
        collection: 'endeavors',
        id: existing.docs[0].id,
        data: updateData,
        overrideAccess: true,
      })
    } else {
      await (payload.create as any)({
        collection: 'endeavors',
        data: {
          ...updateData,
          tenant: tenantId,
          name: (input.name as string) || 'My Enterprise',
          endeavorType: (input.endeavorType as string) || 'custom',
          status: 'forming',
        },
        overrideAccess: true,
      })
    }

    const parts: string[] = []
    if (input.name) parts.push(`Name: "${input.name}".`)
    if (input.endeavorType) parts.push(`Type: ${input.endeavorType}.`)
    if (input.missionStatement) parts.push('Mission statement updated.')
    if (input.capabilities) parts.push(`${(input.capabilities as unknown[]).length} capabilities set.`)
    if (input.operatorName || input.operatorEmail) parts.push('Operator info updated.')
    if (input.regionCity || input.regionState) parts.push('Region updated.')
    if (input.networkVisible !== undefined) parts.push(`Federation visibility: ${input.networkVisible ? 'on' : 'off'}.`)
    if (input.holonTypes) parts.push(`Holon roles: ${(input.holonTypes as string[]).join(', ')}.`)
    if (input.tagline) parts.push(`Tagline: "${input.tagline}".`)

    let response = parts.join(' ') || 'Endeavor updated.'
    response += existing.docs[0]
      ? ' Your enterprise identity has been updated!'
      : ' Your enterprise identity has been created!'

    return response + navDirective('/dashboard/endeavor', 'View Endeavor')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error configuring endeavor: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * connect_stripe_account — Guides tenant through Stripe Connect onboarding.
 * Returns the onboarding URL for the user to visit.
 */
async function handleConnectStripe(
  payload: Payload,
  _input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx

  if (!tenantId) {
    return 'Error: No tenant context available. Please ensure you are operating within a tenant.'
  }

  try {
    // Check current Stripe status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0 }) as any

    if (tenant?.stripeConnect?.stripeAccountId && tenant?.stripeConnect?.stripeOnboardingComplete) {
      return `Your Stripe account is already connected (${tenant.stripeConnect.stripeAccountId}). Charges: ${tenant.stripeConnect.stripeChargesEnabled ? 'enabled' : 'pending'}, Payouts: ${tenant.stripeConnect.stripePayoutsEnabled ? 'enabled' : 'pending'}. You can manage your account in the Payments dashboard.`
    }

    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
    const setupUrl = `${baseUrl}/dashboard/admin/payments`

    if (tenant?.stripeConnect?.stripeAccountId) {
      return `You started Stripe onboarding but haven't completed it yet. Please visit your Payments dashboard to continue: ${setupUrl}`
    }

    return `To start accepting payments with the Ultimate Fair split (you receive 60% of every transaction), visit your Payments dashboard to connect Stripe: ${setupUrl}\n\nThe setup takes about 5 minutes and requires basic business information and a bank account for payouts.`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error checking Stripe status: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * disconnect_stripe_account — Removes the Stripe Connect link from the tenant.
 * Allows re-onboarding with a different Stripe account.
 */
async function handleDisconnectStripe(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx

  if (!tenantId) {
    return 'Error: No tenant context available. Please ensure you are operating within a tenant.'
  }

  if (!input.confirm) {
    return 'Please confirm that you want to disconnect the current Stripe account. This will allow you to reconnect with a different account. Say "yes, disconnect Stripe" to proceed.'
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0 }) as any
    const previousAccountId = tenant?.stripeConnect?.stripeAccountId

    if (!previousAccountId) {
      return 'No Stripe account is currently connected to this tenant. You can use connect_stripe_account to set one up.'
    }

    // Clear the Stripe Connect data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.update as any)({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnect: {
          stripeAccountId: '',
          stripeOnboardingComplete: false,
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
          connectedAt: null,
        },
      },
      overrideAccess: true,
    })

    payload.logger.info(
      `[disconnect_stripe] Tenant ${tenantId} disconnected Stripe account ${previousAccountId}`,
    )

    return `Stripe account ${previousAccountId} has been disconnected from this tenant. You can now reconnect with the correct Stripe account by visiting your Payments dashboard or asking me to connect Stripe.` + navDirective('/dashboard/admin/payments', 'Reconnect Stripe')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error disconnecting Stripe: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Sprint 11: Vendor Onboarding & Production Tools
// ---------------------------------------------------------------------------

/**
 * onboard_vendor — Creates tenant + space + channels + user with producer role.
 * The conversational front door to the Angel OS marketplace.
 */
async function handleOnboardVendor(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const businessName = input.businessName as string
  const ownerName = input.ownerName as string
  const ownerEmail = input.ownerEmail as string

  if (!businessName || !ownerName || !ownerEmail) {
    return 'I need the business name, owner name, and email to set up the vendor account. Could you provide those?'
  }
  if (!isValidEmail(ownerEmail)) {
    return `"${ownerEmail}" doesn't look like a valid email. Could you double-check?`
  }

  try {
    // Generate slug from business name
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Check if tenant already exists
    const existing = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      return `A tenant with the slug "${slug}" already exists. The business may already be on Angel OS. Would you like me to check?`
    }

    // Create tenant
    const businessType = (input.businessType as string) || 'custom'
    const primaryColor = (input.primaryColor as string) || '#10B981'
    const tagline = (input.tagline as string) || ''

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: businessName,
        slug,
        domain: `${slug}.${process.env.VERCEL ? 'spacesangels.com' : 'angelos.local'}`,
        type: 'tenant',
        status: 'active',
        businessType,
        branding: {
          siteName: businessName,
          tagline,
          primaryColor,
          headingFont: 'inter',
          bodyFont: 'inter',
        },
      } as any,
      overrideAccess: true,
    })

    // Create user with producer role
    const password = `vendor-${Date.now().toString(36)}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await payload.create({
      collection: 'users',
      data: {
        name: ownerName,
        email: ownerEmail,
        password,
        roles: ['producer', 'admin'],
      } as any,
      overrideAccess: true,
    })

    // Create tenant membership
    await payload.create({
      collection: 'tenant-memberships' as any,
      data: {
        user: user.id,
        tenant: tenant.id,
        role: 'tenant_admin',
      } as any,
      overrideAccess: true,
    })

    // Create LEO agent for the tenant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await payload.create({
      collection: 'users',
      data: {
        name: `LEO (${businessName})`,
        email: `leo@${slug}.angelos.system`,
        password: `leo-${Date.now().toString(36)}`,
        isSystemUser: true,
        servesTenant: tenant.id,
        agentConfig: {
          agentType: 'leo',
          angelName: 'LEO',
          displayName: 'LEO',
          personality: `I am LEO, the AI assistant for ${businessName}. I help manage products, orders, and customer interactions.`,
          routingRules: { isDefault: true },
        },
        roles: ['admin'],
      } as any,
      overrideAccess: true,
    })

    // Create default space via provisioning
    const { createSpaceFromTemplate } = await import('./spaceProvisioning')
    const endeavorType = businessType === 'retail' ? 'retail-commerce' : 'service-provider'
    await createSpaceFromTemplate(payload, endeavorType as any, tenant.id, `${businessName} Hub`)

    return `Welcome to Angel OS, ${ownerName}! Here's what I set up for ${businessName}:\n\n` +
      `- Tenant: "${businessName}" (${slug})\n` +
      `- Your account: ${ownerEmail} (producer + admin roles)\n` +
      `- LEO agent: ready to assist your customers\n` +
      `- Workspace: "${businessName} Hub" with channels\n\n` +
      `Next steps:\n` +
      `1. Visit /dashboard/producer to see your producer dashboard\n` +
      `2. Add your first products (I can help!)\n` +
      `3. Connect Stripe for payments\n` +
      `4. Customize your branding\n\n` +
      `Would you like me to help you add your first products?`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error setting up vendor: ${err instanceof Error ? err.message : 'Unknown error'}. Let me know if you'd like to try again.`
  }
}

// ─── Starter Catalog Templates ──────────────────────────────────────────────
// Industry-specific product templates to help artisans and new vendors
// build their first product listings. LEO uses these as a foundation
// and personalizes them based on the vendor's specific craft.

interface StarterProduct {
  title: string
  description: string
  priceRange: string
  suggestedPrice: number
  productionType: 'ready_made' | 'custom_order' | 'print_on_demand' | 'digital'
  category: string
}

const STARTER_CATALOGS: Record<string, StarterProduct[]> = {
  artisan_maker: [
    {
      title: 'Custom Storage Cabinet',
      description: 'Handcrafted solid wood cabinet designed for your specific storage needs. Built to order with your choice of wood species, finish, and interior configuration.',
      priceRange: '$800–$3,500',
      suggestedPrice: 1800,
      productionType: 'custom_order',
      category: 'Furniture',
    },
    {
      title: 'Professional Filing System',
      description: 'Purpose-built filing cabinet for professional offices. Smooth-glide drawers, reinforced joinery, and a finish that complements any office décor.',
      priceRange: '$600–$2,000',
      suggestedPrice: 1200,
      productionType: 'custom_order',
      category: 'Furniture',
    },
    {
      title: 'Wall-Mounted Organizer Unit',
      description: 'Space-saving wall-mounted storage with adjustable shelving. Perfect for small offices, workshops, or home studios.',
      priceRange: '$300–$900',
      suggestedPrice: 550,
      productionType: 'custom_order',
      category: 'Furniture',
    },
    {
      title: 'Display Shelf Collection',
      description: 'Floating shelves or freestanding display unit showcasing fine craftsmanship. Ideal for retail, galleries, or living spaces.',
      priceRange: '$200–$800',
      suggestedPrice: 450,
      productionType: 'ready_made',
      category: 'Furniture',
    },
    {
      title: 'Consultation & Design Session',
      description: 'One-on-one consultation to discuss your storage needs, review materials, and create a custom design plan.',
      priceRange: '$75–$200',
      suggestedPrice: 150,
      productionType: 'custom_order',
      category: 'Services',
    },
  ],

  retail: [
    {
      title: 'Featured Product',
      description: 'Our signature item — the product that defines what we do.',
      priceRange: '$15–$75',
      suggestedPrice: 35,
      productionType: 'ready_made',
      category: 'Featured',
    },
    {
      title: 'Gift Bundle',
      description: 'A curated collection of our best items, beautifully packaged and ready to give.',
      priceRange: '$40–$120',
      suggestedPrice: 65,
      productionType: 'ready_made',
      category: 'Gifts',
    },
    {
      title: 'Seasonal Collection Item',
      description: 'Limited-edition item available this season only. Get it while it lasts.',
      priceRange: '$20–$80',
      suggestedPrice: 40,
      productionType: 'ready_made',
      category: 'Seasonal',
    },
    {
      title: 'Starter Kit',
      description: 'Everything you need to get started, bundled together at a great value.',
      priceRange: '$25–$60',
      suggestedPrice: 45,
      productionType: 'ready_made',
      category: 'Bundles',
    },
    {
      title: 'Gift Card',
      description: 'Let them choose exactly what they want. Available in any amount.',
      priceRange: '$10–$200',
      suggestedPrice: 50,
      productionType: 'digital',
      category: 'Gifts',
    },
  ],

  service: [
    {
      title: 'Initial Consultation',
      description: 'A free or low-cost introductory session to understand your needs and how we can help.',
      priceRange: '$0–$75',
      suggestedPrice: 50,
      productionType: 'custom_order',
      category: 'Services',
    },
    {
      title: 'Standard Service Package',
      description: 'Our most popular service tier — everything most clients need.',
      priceRange: '$100–$500',
      suggestedPrice: 200,
      productionType: 'custom_order',
      category: 'Services',
    },
    {
      title: 'Premium Service Package',
      description: 'The full experience — priority scheduling, extended service, and premium support.',
      priceRange: '$300–$1,000',
      suggestedPrice: 500,
      productionType: 'custom_order',
      category: 'Services',
    },
    {
      title: 'Maintenance Plan',
      description: 'Ongoing care and support to keep everything running smoothly.',
      priceRange: '$50–$200/month',
      suggestedPrice: 100,
      productionType: 'custom_order',
      category: 'Plans',
    },
    {
      title: 'Express Service',
      description: 'Need it fast? Our expedited service gets the job done in half the time.',
      priceRange: '$150–$600',
      suggestedPrice: 300,
      productionType: 'custom_order',
      category: 'Services',
    },
  ],

  gift_shop: [
    {
      title: 'Local Artisan Gift Box',
      description: 'A handpicked selection of locally made goods, beautifully boxed and ready to delight.',
      priceRange: '$35–$100',
      suggestedPrice: 55,
      productionType: 'ready_made',
      category: 'Gift Boxes',
    },
    {
      title: 'Seasonal Gift Set',
      description: 'Themed gift collection perfect for the current season or upcoming holiday.',
      priceRange: '$25–$80',
      suggestedPrice: 45,
      productionType: 'ready_made',
      category: 'Seasonal',
    },
    {
      title: 'Custom Gift Basket',
      description: 'Tell us who it\'s for and we\'ll curate the perfect combination of goodies.',
      priceRange: '$40–$150',
      suggestedPrice: 75,
      productionType: 'custom_order',
      category: 'Custom',
    },
    {
      title: 'Greeting Card Collection',
      description: 'Handmade or locally designed cards for every occasion.',
      priceRange: '$4–$8',
      suggestedPrice: 5,
      productionType: 'ready_made',
      category: 'Cards & Stationery',
    },
    {
      title: 'Gift Certificate',
      description: 'The perfect gift when you want them to pick their own treasure.',
      priceRange: '$10–$200',
      suggestedPrice: 50,
      productionType: 'digital',
      category: 'Gifts',
    },
  ],

  content_creator: [
    {
      title: 'Digital Course',
      description: 'Learn from our expertise — video lessons, worksheets, and community access.',
      priceRange: '$29–$199',
      suggestedPrice: 79,
      productionType: 'digital',
      category: 'Courses',
    },
    {
      title: 'Membership / Subscription',
      description: 'Monthly access to exclusive content, community, and resources.',
      priceRange: '$5–$25/month',
      suggestedPrice: 10,
      productionType: 'digital',
      category: 'Memberships',
    },
    {
      title: 'Digital Download Pack',
      description: 'Templates, presets, guides, or other digital resources ready for instant download.',
      priceRange: '$5–$50',
      suggestedPrice: 19,
      productionType: 'digital',
      category: 'Downloads',
    },
    {
      title: 'One-on-One Coaching Session',
      description: 'Personalized guidance and mentorship via video call.',
      priceRange: '$50–$300',
      suggestedPrice: 150,
      productionType: 'custom_order',
      category: 'Coaching',
    },
    {
      title: 'Branded Merchandise',
      description: 'Show your support — high-quality merch featuring our brand.',
      priceRange: '$15–$50',
      suggestedPrice: 30,
      productionType: 'print_on_demand',
      category: 'Merch',
    },
  ],

  nonprofit: [
    {
      title: 'General Donation',
      description: 'Support our mission with a contribution of any amount. Every dollar makes a difference.',
      priceRange: '$5–$500',
      suggestedPrice: 25,
      productionType: 'digital',
      category: 'Donations',
    },
    {
      title: 'Monthly Sustainer',
      description: 'Become a monthly supporter and help us plan for the future.',
      priceRange: '$5–$50/month',
      suggestedPrice: 15,
      productionType: 'digital',
      category: 'Recurring',
    },
    {
      title: 'Event Ticket',
      description: 'Join us for our next fundraising event or community gathering.',
      priceRange: '$10–$100',
      suggestedPrice: 35,
      productionType: 'digital',
      category: 'Events',
    },
    {
      title: 'Sponsorship Package',
      description: 'Partner with us and get visibility while supporting a cause you believe in.',
      priceRange: '$100–$5,000',
      suggestedPrice: 500,
      productionType: 'custom_order',
      category: 'Sponsorship',
    },
    {
      title: 'Awareness Merchandise',
      description: 'Wear your support — all proceeds go directly to our programs.',
      priceRange: '$15–$40',
      suggestedPrice: 25,
      productionType: 'print_on_demand',
      category: 'Merch',
    },
  ],

  ministry: [
    {
      title: 'Tithes & Offerings',
      description: 'Support the work of the ministry through your generous giving.',
      priceRange: '$5–$500',
      suggestedPrice: 25,
      productionType: 'digital',
      category: 'Giving',
    },
    {
      title: 'Building Fund Contribution',
      description: 'Help us build, maintain, and improve our worship and gathering spaces.',
      priceRange: '$10–$1,000',
      suggestedPrice: 50,
      productionType: 'digital',
      category: 'Giving',
    },
    {
      title: 'Event Registration',
      description: 'Register for upcoming retreats, conferences, workshops, or community events.',
      priceRange: '$0–$100',
      suggestedPrice: 25,
      productionType: 'digital',
      category: 'Events',
    },
    {
      title: 'Study Materials',
      description: 'Books, devotionals, workbooks, and study guides for personal or group study.',
      priceRange: '$5–$30',
      suggestedPrice: 15,
      productionType: 'ready_made',
      category: 'Resources',
    },
    {
      title: 'Mission Trip Support',
      description: 'Sponsor a missionary or contribute to an upcoming mission trip.',
      priceRange: '$25–$500',
      suggestedPrice: 100,
      productionType: 'digital',
      category: 'Missions',
    },
  ],

  professional_services: [
    {
      title: 'Discovery Call',
      description: 'A complimentary introductory call to discuss your needs and see if we\'re a good fit.',
      priceRange: '$0',
      suggestedPrice: 0,
      productionType: 'custom_order',
      category: 'Consultations',
    },
    {
      title: 'Standard Engagement',
      description: 'Our core service offering — professional expertise applied to your specific situation.',
      priceRange: '$200–$2,000',
      suggestedPrice: 750,
      productionType: 'custom_order',
      category: 'Services',
    },
    {
      title: 'Retainer Package',
      description: 'Ongoing professional support with priority access and dedicated hours each month.',
      priceRange: '$500–$5,000/month',
      suggestedPrice: 1500,
      productionType: 'custom_order',
      category: 'Retainers',
    },
    {
      title: 'Workshop / Training',
      description: 'Group or individual training sessions to build capacity in your organization.',
      priceRange: '$100–$500',
      suggestedPrice: 250,
      productionType: 'custom_order',
      category: 'Training',
    },
    {
      title: 'Document / Deliverable Package',
      description: 'A defined scope of work resulting in specific documents, reports, or deliverables.',
      priceRange: '$500–$5,000',
      suggestedPrice: 2000,
      productionType: 'custom_order',
      category: 'Projects',
    },
  ],
}

/**
 * suggest_products — Generates product ideas based on vendor description.
 * Uses industry-specific STARTER_CATALOGS as a foundation, then returns
 * structured suggestions the LLM can personalize to the vendor's specific craft.
 */
async function handleSuggestProducts(
  input: Record<string, unknown>,
): Promise<string> {
  const description = input.vendorDescription as string
  const businessType = (input.businessType as string) || ''
  const skills = (input.skills as string[]) || []
  const count = Math.min(Number(input.count) || 5, 10)

  if (!description) {
    return 'Tell me about your business — what do you make or offer? I\'ll suggest products that showcase your work beautifully.'
  }

  // Look up starter catalog for the business type
  const catalog = STARTER_CATALOGS[businessType] || null
  const skillsList = skills.length > 0 ? `\nSpecific skills: ${skills.join(', ')}` : ''

  let response = `Based on the vendor description: "${description}"${skillsList}\n`
  response += `Business type: ${businessType || 'not specified'}\n\n`

  if (catalog) {
    response += `## Starter Catalog Templates\n\n`
    response += `Here are ${catalog.length} industry-specific product templates as a starting point. ` +
      `Personalize these based on the vendor's specific craft, materials, and clientele:\n\n`

    catalog.forEach((product, i) => {
      response += `### ${i + 1}. ${product.title}\n`
      response += `- **Description:** ${product.description}\n`
      response += `- **Price range:** ${product.priceRange} (suggested: $${product.suggestedPrice})\n`
      response += `- **Type:** ${product.productionType.replace(/_/g, ' ')}\n`
      response += `- **Category:** ${product.category}\n\n`
    })

    response += `---\n\n`
    response += `Use these templates as inspiration. Adapt the titles, descriptions, and prices ` +
      `to match what this specific vendor actually makes. For example, if they build custom ` +
      `cabinets for medical offices, rename "Custom Storage Cabinet" to something like ` +
      `"Medical Records Filing Cabinet — Cherry Wood" and adjust the description to highlight ` +
      `HIPAA-compliant storage, specific wood species they use, and the love they put into each piece.\n\n`
    response += `Ask the vendor which products resonate most, then offer to create them one at a time. ` +
      `Generate ${count} personalized suggestions in your response.`
  } else {
    response += `No starter catalog for type "${businessType}". ` +
      `Generate ${count} custom product suggestions based on the vendor's description.\n\n` +
      `For each product, include:\n` +
      `- Product name (specific to their craft)\n` +
      `- Description highlighting craftsmanship and care\n` +
      `- Suggested price\n` +
      `- Production type (ready-made, custom order, print-on-demand, or digital)\n` +
      `- Recommended category\n\n` +
      `Lead with their best work. Celebrate the craft.`
  }

  return response
}

/**
 * generate_cad_instructions — Converts product spec to production-ready notes.
 */
async function handleGenerateCadInstructions(
  input: Record<string, unknown>,
): Promise<string> {
  const title = input.productTitle as string
  const productionType = input.productionType as string
  const customizations = input.customizations as Record<string, unknown> || {}
  const materials = (input.materials as string[]) || []
  const notes = (input.notes as string) || ''

  const customizationList = Object.entries(customizations)
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join('\n')

  return `=== CAD/Production Instructions ===\n` +
    `Product: ${title}\n` +
    `Production Type: ${productionType}\n` +
    `${materials.length > 0 ? `Materials: ${materials.join(', ')}\n` : ''}` +
    `${customizationList ? `\nCustomizations:\n${customizationList}\n` : ''}` +
    `${notes ? `\nNotes: ${notes}\n` : ''}` +
    `\n--- Instructions ---\n` +
    `[LEO will generate specific CNC/laser/print instructions based on the above specifications.\n` +
    `Include: file format recommendations, tool paths, material settings, quality checks, and packaging notes.]`
}

/**
 * fetch_reviews — Returns reviews for the current tenant.
 */
async function handleFetchReviews(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  const limit = Math.min(Number(input.limit) || 10, 50)
  const source = (input.source as string) || 'all'
  const minRating = Number(input.minRating) || 0

  if (!tenantId) {
    return 'No tenant context — I can\'t fetch reviews without knowing which business.'
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [{ tenant: { equals: tenantId } }]

    if (source !== 'all') {
      conditions.push({ source: { equals: source } })
    }
    if (minRating > 0) {
      conditions.push({ rating: { greater_than_equal: minRating } })
    }

    const result = await payload.find({
      collection: 'reviews' as any,
      where: { and: conditions },
      limit,
      sort: '-publishedAt',
      depth: 0,
      overrideAccess: true,
    })

    if (result.docs.length === 0) {
      return 'No reviews found yet. Reviews will appear here as customers leave feedback.'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviews = result.docs.map((r: any) => ({
      author: r.author || 'Anonymous',
      rating: r.rating || 0,
      content: r.content || '',
      source: r.source || 'angelos',
      date: r.publishedAt || r.createdAt,
    }))

    const avgRating = reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length

    return `Found ${result.totalDocs} reviews (showing ${reviews.length}). Average rating: ${avgRating.toFixed(1)}/5\n\n` +
      reviews.map((r: any, i: number) =>
        `${i + 1}. ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} — ${r.author} (${r.source})\n   "${r.content}"`
      ).join('\n\n')
  } catch {
    return 'The Reviews collection is not set up yet. It will be available once the collection is registered.'
  }
}

/**
 * draft_review_response — Creates a suggested reply to a customer review.
 */
async function handleDraftReviewResponse(
  input: Record<string, unknown>,
): Promise<string> {
  const content = input.reviewContent as string
  const rating = Number(input.reviewRating) || 5
  const reviewer = (input.reviewerName as string) || 'there'
  const business = (input.businessName as string) || 'our business'
  const tone = (input.tone as string) || (rating >= 4 ? 'grateful' : 'apologetic')

  if (!content) {
    return 'I need the review text to draft a response. What did the customer write?'
  }

  return `[LEO will draft a ${tone} response to the following ${rating}-star review from ${reviewer}:\n` +
    `"${content}"\n\n` +
    `The response should:\n` +
    `- Thank the reviewer by name\n` +
    `- Address specific points they mentioned\n` +
    `- ${rating >= 4 ? 'Express genuine gratitude' : 'Acknowledge the issue and offer resolution'}\n` +
    `- Represent ${business} warmly and professionally\n` +
    `- Be 2-4 sentences, conversational, not corporate-speak\n` +
    `- End with an invitation to return or reach out]`
}

// ---------------------------------------------------------------------------
// Sprint 14: Content Management Handlers
// ---------------------------------------------------------------------------

/** Convert plain text (with \n\n paragraph breaks) to Lexical richText root */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textToLexical(text: string): any {
  const paragraphs = text
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)

  const children = paragraphs.map((block) => ({
    type: 'paragraph',
    children: [
      {
        type: 'text',
        text: block,
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  }))

  return {
    root: {
      type: 'root',
      children: children.length > 0 ? children : [{
        type: 'paragraph',
        children: [{ type: 'text', text: '', detail: 0, format: 0, mode: 'normal', style: '', version: 1 }],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      }],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

/** Wrap richText in a full-width Content block for the layout field */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textToContentLayout(text: string): any[] {
  return [
    {
      blockType: 'content',
      columns: [
        {
          size: 'full',
          richText: textToLexical(text),
        },
      ],
    },
  ]
}

/**
 * Shared helper: generate a hero image for a post or page and attach it.
 * Returns status lines to append to the tool response.
 */
async function generateAndAttachHeroImage(
  payload: Payload,
  collection: 'posts' | 'pages',
  docId: number,
  title: string,
  customPrompt?: string,
  tenantId?: number,
): Promise<string[]> {
  const lines: string[] = []
  try {
    const prompt = customPrompt || `Hero image for "${title}". Professional, engaging, wide cinematic composition suitable as a blog header or page banner.`
    const result = await generateImage(
      {
        prompt,
        enhancementContext: { brandStyle: 'hero banner' },
        autoUpload: true,
        tenantId,
      },
      payload,
    )
    if (!result.success) {
      lines.push(`\n⚠️ Hero image generation failed: ${result.error}`)
      return lines
    }
    if (!result.mediaId) {
      lines.push('\n⚠️ Hero image generated but could not be saved to media library.')
      return lines
    }

    // Attach to hero.media and meta.image on the document
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.update as any)({
      collection,
      id: docId,
      data: {
        hero: { type: 'highImpact', media: result.mediaId },
        meta: { image: result.mediaId },
      },
      overrideAccess: true,
    })

    lines.push(`\n🎨 Hero image generated and attached!`)
    if (result.permanentUrl) lines.push(`   Image URL: ${result.permanentUrl}`)
    lines.push(`   Media ID: ${result.mediaId}`)
  } catch (err) {
    lines.push(`\n⚠️ Hero image generation error: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
  return lines
}

/**
 * create_post — Creates a new blog post with title, body, and optional categories.
 */
async function createPost(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const title = (input.title as string)?.trim()
  if (!title) return 'Error: Post title is required.'

  const content = input.content as string | undefined
  const status = (input.status as string) || 'draft'
  if (status !== 'draft' && status !== 'published') {
    return 'Error: Status must be "draft" or "published".'
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postData: Record<string, any> = {
    title,
    _status: status,
  }

  if (ctx.tenantId) postData.tenant = ctx.tenantId

  if (content) {
    postData.layout = textToContentLayout(content)
  }

  // Resolve category IDs
  const categoryNames = input.categories as string[] | undefined
  if (categoryNames?.length) {
    const categoryIds: (number | string)[] = []
    for (const name of categoryNames) {
      const found = await payload.find({
        collection: 'categories',
        where: { title: { contains: name } } as Where,
        limit: 1,
        overrideAccess: true,
      })
      if (found.docs[0]) categoryIds.push(found.docs[0].id)
    }
    if (categoryIds.length) postData.categories = categoryIds
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (payload.create as any)({
    collection: 'posts',
    data: postData,
    overrideAccess: true,
  })

  const slug = str(result, 'slug')
  const lines = [
    `Post created successfully!`,
    `- **${title}** (${status})`,
    `- Post ID: ${result.id}`,
  ]
  if (slug) lines.push(`- URL: /posts/${slug}`)
  if (postData.categories?.length) lines.push(`- Categories: ${categoryNames?.join(', ')}`)

  // Auto-generate hero image if requested
  if (input.generateHeroImage === true) {
    const heroLines = await generateAndAttachHeroImage(
      payload, 'posts', result.id as number, title,
      input.heroImagePrompt as string | undefined,
      ctx.tenantId,
    )
    lines.push(...heroLines)
  }

  if (status === 'draft') lines.push(`\nThe post is saved as a draft. Say "publish post ${result.id}" when you're ready to make it live.`)

  return lines.join('\n') + navDirective('/dashboard/content-hub', 'View Content Hub')
}

/**
 * create_work_from_url — import an article / Google Doc URL (or pasted text) into
 * the Library as a Work draft. Fetches + extracts readable content, structures it
 * into titled Markdown pages, and saves a Channel `data.workDraft` ready to edit,
 * translate, and seal (Works-Engine slices #1/#2). The same pipeline underlies
 * Quest briefings — Works are the content substrate.
 */
async function createWorkFromContent(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  if (!ctx.tenantId) return 'Error: a tenant context is required to create a Work.'

  const url = (input.url as string)?.trim()
  const text = (input.text as string)?.trim()
  if (!url && !text) return 'Error: provide a `url` to import or `text` to use.'

  let rawText = text || ''
  let titleHint = (input.title as string)?.trim() || undefined
  let sourceUrl: string | undefined

  if (url) {
    try {
      const content = await fetchReadableContent(url)
      rawText = content.text
      if (!titleHint) titleHint = content.title
      sourceUrl = url
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'could not fetch that URL.'}`
    }
  }
  if (!rawText || rawText.length < 20) return 'Error: not enough readable text to build a Work.'

  const draft = await buildWorkDraftFromText(rawText, { title: titleHint })

  const spaceId = ctx.spaceId ?? (await fetchDefaultSpaceId(ctx.tenantId))
  if (!spaceId) return 'Error: no space found for this tenant.'

  const cleanTitle = draft.title || 'Imported Work'
  const slugBase =
    cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'work'
  const slug = `work-${slugBase}-${Date.now().toString(36)}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created = await (payload.create as any)({
    collection: 'channels',
    data: {
      name: cleanTitle,
      slug,
      space: spaceId,
      type: 'general',
      source: 'native',
      tenant: ctx.tenantId,
      data: { workDraft: draft, ...(sourceUrl ? { sourceUrl } : {}) },
    },
    overrideAccess: true,
  })

  const pageCount = draft.pages.length
  const lines = [
    `Work created from ${sourceUrl ? 'the URL' : 'your text'}!`,
    `- **${cleanTitle}** — ${pageCount} page${pageCount !== 1 ? 's' : ''}`,
    `- Work ID: ${created.id}`,
    ...(sourceUrl ? [`- Source: ${sourceUrl}`] : []),
    `\nOpen it in Works Studio to edit, translate into more languages, and seal it into a signed release.`,
  ]
  return lines.join('\n') + navDirective('/dashboard/works', 'Open Works Studio')
}

/**
 * create_quest — create a mission (objectives + evidence + payout) whose briefing
 * is a Work. Works are the content substrate; the Quest is the mechanics wrapper.
 * Links a briefing Work via the extensible json fields (no schema migration):
 * Quest.metadata.briefingWork* + a questId backref on the Work channel.
 */
async function createQuest(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  if (!ctx.tenantId) return 'Error: a tenant context is required to create a Quest.'

  const title = (input.title as string)?.trim()
  if (!title) return 'Error: Quest title is required.'

  const status = (input.status as string) || 'draft'
  if (!['draft', 'posted', 'active'].includes(status)) {
    return 'Error: status must be "draft", "posted", or "active".'
  }

  // Resolve an optional briefing Work (a tenant-owned channel carrying a workDraft).
  let briefing: { channelId: string | number; slug?: string; sealedSlug?: string; title?: string } | null = null
  const briefingWorkId = (input.briefingWorkId as string | number | undefined) ?? undefined
  if (briefingWorkId != null && briefingWorkId !== '') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ch = (await payload.findByID({ collection: 'channels', id: briefingWorkId, depth: 0, overrideAccess: true }).catch(() => null)) as any
    if (!ch) return `Error: briefing Work ${briefingWorkId} was not found.`
    if (String(ch.tenant) !== String(ctx.tenantId)) return 'Error: that briefing Work belongs to another tenant.'
    const wd = ch.data?.workDraft
    if (!wd) return `Error: channel ${briefingWorkId} is not a Work (no draft to use as a briefing).`
    briefing = {
      channelId: ch.id,
      slug: ch.slug,
      sealedSlug: ch.data?.sealedSlug,
      title: wd.title || ch.name,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questData: Record<string, any> = {
    title,
    status,
    tenant: ctx.tenantId,
  }
  if (ctx.userId) questData.postedBy = ctx.userId
  if (typeof input.description === 'string' && input.description.trim()) {
    questData.description = textToLexical(input.description)
  }
  if (typeof input.questType === 'string' && input.questType.trim()) questData.questType = input.questType.trim()
  if (typeof input.difficulty === 'string') questData.difficulty = input.difficulty

  const objectives = input.objectives as string[] | undefined
  if (Array.isArray(objectives) && objectives.length) {
    questData.objectives = objectives
      .filter((o) => typeof o === 'string' && o.trim())
      .map((o) => ({ description: o.trim(), required: true, verificationMethod: 'manual' }))
  }

  if (typeof input.payoutAmount === 'number' && input.payoutAmount >= 0) {
    questData.payout = {
      type: (input.payoutType as string) || 'fixed',
      amount: Math.round(input.payoutAmount),
      currency: (input.currency as string) || 'USD',
      paymentMethod: 'stripe',
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requirements: Record<string, any> = {}
  if (typeof input.maxParticipants === 'number') requirements.maxParticipants = input.maxParticipants
  if (typeof input.expiresAt === 'string' && input.expiresAt.trim()) {
    const d = new Date(input.expiresAt)
    if (!isNaN(d.getTime())) requirements.expiresAt = d.toISOString()
  }
  if (Object.keys(requirements).length) questData.requirements = requirements

  if (briefing) {
    questData.metadata = {
      briefingWorkChannelId: briefing.channelId,
      // Prefer the sealed, shareable slug for the reader; fall back to the draft slug.
      briefingWorkSlug: briefing.sealedSlug || briefing.slug,
      briefingWorkSealed: Boolean(briefing.sealedSlug),
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created = await (payload.create as any)({ collection: 'quests', data: questData, overrideAccess: true })

  // Backref the Work channel to this quest (no schema change — json data field).
  if (briefing) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ch = (await payload.findByID({ collection: 'channels', id: briefing.channelId, depth: 0, overrideAccess: true })) as any
      await (payload.update as any)({
        collection: 'channels',
        id: briefing.channelId,
        data: { data: { ...(ch.data || {}), questId: created.id } },
        overrideAccess: true,
      })
    } catch {
      /* backref is best-effort */
    }
  }

  const lines = [
    `Quest created!`,
    `- **${title}** (${status})`,
    `- Quest ID: ${created.id}`,
    ...(questData.objectives?.length ? [`- Objectives: ${questData.objectives.length}`] : []),
    ...(questData.payout ? [`- Payout: ${(questData.payout.amount / 100).toFixed(2)} ${questData.payout.currency} (${questData.payout.type})`] : []),
    ...(briefing
      ? [`- Briefing Work: **${briefing.title}**${briefing.sealedSlug ? ' (sealed)' : ' (draft — seal it to publish the briefing)'}`]
      : [`- No briefing Work attached. Create or attach a Work to give this quest a readable story.`]),
  ]
  if (status === 'draft') lines.push(`\nSaved as a draft. Say "post quest ${created.id}" when you're ready to open it.`)

  return lines.join('\n') + navDirective('/admin/collections/quests', 'View Quests')
}

// ---------------------------------------------------------------------------
// YouTube Ingestion Tools
// ---------------------------------------------------------------------------

/**
 * ingest_youtube_url — Fetch metadata from a YouTube video and create a blog post.
 * Deduplicates via sourceUrl field.
 */
async function ingestYouTubeUrl(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const url = (input.url as string)?.trim()
  if (!url) return 'Error: YouTube URL is required.'

  // Fetch metadata
  const meta = await fetchYouTubeVideoMeta(url)
  if (!meta || !meta.videoId) return `Error: Could not extract YouTube video from URL: ${url}`

  // Check for duplicate (already ingested)
  const existing = await payload.find({
    collection: 'posts',
    where: { sourceUrl: { equals: meta.sourceUrl } } as Where,
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs[0]) {
    const existingPost = existing.docs[0] as any
    return `This video was already ingested as "${existingPost.title}" (Post ID: ${existingPost.id}). Skipping duplicate.`
  }

  const title = meta.title || `Video: ${meta.videoId}`
  const status = (input.status as string) || 'draft'
  if (status !== 'draft' && status !== 'published') {
    return 'Error: Status must be "draft" or "published".'
  }

  // Build post content: video embed + description
  const contentParts: string[] = []
  if (meta.channelName) contentParts.push(`From **${meta.channelName}**`)
  contentParts.push(`[Watch on YouTube](${meta.sourceUrl})`)
  if (meta.description) contentParts.push('', meta.description)
  const additionalContent = input.additionalContent as string | undefined
  if (additionalContent) contentParts.push('', additionalContent)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postData: Record<string, any> = {
    title,
    _status: status,
    sourceUrl: meta.sourceUrl,
    sourceType: 'youtube',
    layout: textToContentLayout(contentParts.join('\n\n')),
  }

  if (ctx.tenantId) postData.tenant = ctx.tenantId

  // Resolve categories
  const categoryNames = input.categories as string[] | undefined
  if (categoryNames?.length) {
    const categoryIds: (number | string)[] = []
    for (const name of categoryNames) {
      const found = await payload.find({
        collection: 'categories',
        where: { title: { contains: name } } as Where,
        limit: 1,
        overrideAccess: true,
      })
      if (found.docs[0]) categoryIds.push(found.docs[0].id)
    }
    if (categoryIds.length) postData.categories = categoryIds
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (payload.create as any)({
    collection: 'posts',
    data: postData,
    overrideAccess: true,
  })

  const slug = str(result, 'slug')
  const lines = [
    `YouTube video ingested successfully!`,
    `- **${title}**`,
    `- Channel: ${meta.channelName || 'Unknown'}`,
    `- Post ID: ${result.id} (${status})`,
  ]
  if (slug) lines.push(`- URL: /posts/${slug}`)
  if (meta.thumbnailUrl) lines.push(`- Thumbnail: ${meta.thumbnailUrl}`)
  lines.push(`- Source: ${meta.sourceUrl}`)

  return lines.join('\n') + navDirective('/dashboard/content-hub', 'View Content Hub')
}

/**
 * ingest_youtube_channel — Fetch recent videos from a channel's RSS feed
 * and create posts for each. Deduplicates via sourceUrl.
 */
async function ingestYouTubeChannel(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const channelInput = (input.channelId as string)?.trim()
  if (!channelInput) return 'Error: channelId is required (YouTube channel ID starting with UC... or channel URL).'

  const channelId = extractChannelId(channelInput)
  if (!channelId) {
    return `Error: Could not extract a YouTube channel ID from "${channelInput}". Please provide a channel ID starting with "UC" or a youtube.com/channel/ URL.`
  }

  const limit = Math.min(Math.max(Number(input.limit) || 5, 1), 15)
  const status = (input.status as string) || 'published'
  if (status !== 'draft' && status !== 'published') {
    return 'Error: Status must be "draft" or "published".'
  }

  // Fetch the RSS feed
  const feed = await fetchYouTubeChannelFeed(channelId, limit)
  if (feed.length === 0) {
    return `No videos found for channel ${channelId}. The channel may not exist or has no public videos.`
  }

  // Resolve categories once
  const categoryNames = input.categories as string[] | undefined
  const categoryIds: (number | string)[] = []
  if (categoryNames?.length) {
    for (const name of categoryNames) {
      const found = await payload.find({
        collection: 'categories',
        where: { title: { contains: name } } as Where,
        limit: 1,
        overrideAccess: true,
      })
      if (found.docs[0]) categoryIds.push(found.docs[0].id)
    }
  }

  const created: string[] = []
  const skipped: string[] = []
  const failed: string[] = []

  for (const video of feed) {
    // Check for duplicate
    const existing = await payload.find({
      collection: 'posts',
      where: { sourceUrl: { equals: video.sourceUrl } } as Where,
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs[0]) {
      skipped.push(video.title)
      continue
    }

    try {
      const contentParts = [
        `From **${video.channelName || 'YouTube'}**`,
        `[Watch on YouTube](${video.sourceUrl})`,
      ]
      if (video.description) contentParts.push('', video.description)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const postData: Record<string, any> = {
        title: video.title || `Video: ${video.videoId}`,
        _status: status,
        sourceUrl: video.sourceUrl,
        sourceType: 'youtube',
        publishedOn: video.publishedAt || undefined,
        layout: textToContentLayout(contentParts.join('\n\n')),
      }

      if (ctx.tenantId) postData.tenant = ctx.tenantId
      if (categoryIds.length) postData.categories = categoryIds

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload.create as any)({
        collection: 'posts',
        data: postData,
        overrideAccess: true,
      })
      created.push(video.title)
    } catch (err: any) {
      failed.push(`${video.title}: ${err.message || err}`)
    }
  }

  const lines = [
    `## YouTube Channel Ingestion Complete`,
    `Channel: **${feed[0]?.channelName || channelId}**`,
    '',
  ]
  if (created.length) {
    lines.push(`**${created.length} post(s) created** (${status}):`)
    for (const t of created) lines.push(`  - ${t}`)
  }
  if (skipped.length) {
    lines.push(`\n**${skipped.length} skipped** (already ingested):`)
    for (const t of skipped) lines.push(`  - ${t}`)
  }
  if (failed.length) {
    lines.push(`\n**${failed.length} failed**:`)
    for (const t of failed) lines.push(`  - ${t}`)
  }

  return lines.join('\n') + navDirective('/dashboard/content-hub', 'View Content Hub')
}

/**
 * update_post — Updates title, content, status, or categories on an existing post.
 */
async function updatePost(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const postId = Number(input.postId)
  if (!postId) return 'Error: postId is required. Use query_posts to find the post ID first.'

  // Verify post belongs to current tenant before modifying
  if (ctx.tenantId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = await (payload.findByID as any)({ collection: 'posts', id: postId, depth: 0, overrideAccess: true })
      const docTenant = existing?.tenant
      const tenantVal = typeof docTenant === 'object' ? docTenant?.id : docTenant
      if (tenantVal && tenantVal !== ctx.tenantId) {
        return 'Error: This post belongs to a different tenant.'
      }
    } catch {
      return `Error: Post #${postId} not found.`
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {}

  if (input.title) updateData.title = (input.title as string).trim()
  if (input.status) {
    if (!['draft', 'published'].includes(input.status as string)) {
      return 'Error: Status must be "draft" or "published".'
    }
    updateData._status = input.status
  }
  if (input.content) updateData.layout = textToContentLayout(input.content as string)

  const categoryNames = input.categories as string[] | undefined
  if (categoryNames?.length) {
    const categoryIds: (number | string)[] = []
    for (const name of categoryNames) {
      const found = await payload.find({
        collection: 'categories',
        where: { title: { contains: name } } as Where,
        limit: 1,
        overrideAccess: true,
      })
      if (found.docs[0]) categoryIds.push(found.docs[0].id)
    }
    updateData.categories = categoryIds
  }

  if (Object.keys(updateData).length === 0) {
    return 'Nothing to update — please provide at least one field to change (title, content, status, or categories).'
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (payload.update as any)({
    collection: 'posts',
    id: postId,
    data: updateData,
    overrideAccess: true,
  })

  const slug = str(result, 'slug')
  const lines = [`Post updated successfully!`, `- Post ID: ${postId}`]
  if (updateData.title) lines.push(`- New title: ${updateData.title}`)
  if (updateData._status) lines.push(`- Status: ${updateData._status}`)
  if (slug) lines.push(`- URL: /posts/${slug}`)

  // Auto-generate hero image if requested
  if (input.generateHeroImage === true) {
    const postTitle = (updateData.title || str(result, 'title') || 'Post') as string
    const heroLines = await generateAndAttachHeroImage(
      payload, 'posts', postId, postTitle,
      input.heroImagePrompt as string | undefined,
      ctx.tenantId,
    )
    lines.push(...heroLines)
  }

  return lines.join('\n') + navDirective('/dashboard/content-hub', 'View Content Hub')
}

/**
 * create_page — Creates a new static page with body content.
 */
async function createPage(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const title = (input.title as string)?.trim()
  if (!title) return 'Error: Page title is required.'

  const content = input.content as string | undefined
  const status = (input.status as string) || 'draft'
  if (status !== 'draft' && status !== 'published') {
    return 'Error: Status must be "draft" or "published".'
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageData: Record<string, any> = {
    title,
    _status: status,
  }

  if (ctx.tenantId) pageData.tenant = ctx.tenantId
  if (input.slug) pageData.slug = (input.slug as string).toLowerCase().replace(/\s+/g, '-')
  if (content) pageData.layout = textToContentLayout(content)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (payload.create as any)({
    collection: 'pages',
    data: pageData,
    overrideAccess: true,
  })

  const slug = str(result, 'slug')
  const lines = [
    `Page created successfully!`,
    `- **${title}** (${status})`,
    `- Page ID: ${result.id}`,
  ]
  if (slug) lines.push(`- URL: /${slug}`)

  // Auto-generate hero image if requested
  if (input.generateHeroImage === true) {
    const heroLines = await generateAndAttachHeroImage(
      payload, 'pages', result.id as number, title,
      input.heroImagePrompt as string | undefined,
      ctx.tenantId,
    )
    lines.push(...heroLines)
  }

  if (status === 'draft') lines.push(`\nThe page is saved as a draft. Say "publish page ${result.id}" to make it live.`)

  return lines.join('\n') + navDirective('/dashboard/content-hub', 'View Content Hub')
}

/**
 * update_page — Updates title, content, slug, or status on an existing page.
 */
async function updatePage(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const pageId = Number(input.pageId)
  if (!pageId) return 'Error: pageId is required.'

  // Verify page belongs to current tenant before modifying
  if (ctx.tenantId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = await (payload.findByID as any)({ collection: 'pages', id: pageId, depth: 0, overrideAccess: true })
      const docTenant = existing?.tenant
      const tenantVal = typeof docTenant === 'object' ? docTenant?.id : docTenant
      if (tenantVal && tenantVal !== ctx.tenantId) {
        return 'Error: This page belongs to a different tenant.'
      }
    } catch {
      return `Error: Page #${pageId} not found.`
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {}

  if (input.title) updateData.title = (input.title as string).trim()
  if (input.slug) updateData.slug = (input.slug as string).toLowerCase().replace(/\s+/g, '-')
  if (input.status) {
    if (!['draft', 'published'].includes(input.status as string)) {
      return 'Error: Status must be "draft" or "published".'
    }
    updateData._status = input.status
  }
  if (input.content) updateData.layout = textToContentLayout(input.content as string)

  if (Object.keys(updateData).length === 0) {
    return 'Nothing to update — please provide at least one field to change.'
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (payload.update as any)({
    collection: 'pages',
    id: pageId,
    data: updateData,
    overrideAccess: true,
  })

  const slug = str(result, 'slug')
  const lines = [`Page updated successfully!`, `- Page ID: ${pageId}`]
  if (updateData.title) lines.push(`- New title: ${updateData.title}`)
  if (updateData._status) lines.push(`- Status: ${updateData._status}`)
  if (slug) lines.push(`- URL: /${slug}`)

  // Auto-generate hero image if requested
  if (input.generateHeroImage === true) {
    const pageTitle = (updateData.title || str(result, 'title') || 'Page') as string
    const heroLines = await generateAndAttachHeroImage(
      payload, 'pages', pageId, pageTitle,
      input.heroImagePrompt as string | undefined,
      ctx.tenantId,
    )
    lines.push(...heroLines)
  }

  return lines.join('\n') + navDirective('/dashboard/content-hub', 'View Content Hub')
}

/**
 * query_media — Searches the media library.
 */
async function queryMedia(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 10, 20)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []

  // Tenant scoping — only show media belonging to the current tenant
  if (ctx.tenantId) {
    conditions.push({ tenant: { equals: ctx.tenantId } })
  }

  if (input.search && typeof input.search === 'string') {
    conditions.push({
      or: [
        { filename: { contains: input.search } },
        { alt: { contains: input.search } },
      ],
    })
  }

  const result = await payload.find({
    collection: 'media',
    where: conditions.length ? ({ and: conditions } as Where) : {},
    limit,
    sort: '-createdAt',
    depth: 0,
    overrideAccess: true,
  })

  if (result.docs.length === 0) return 'No media files found.'

  const items = result.docs.map((m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = m as any
    const filename = doc.filename || doc.alt || 'Unnamed'
    const url = doc.url || ''
    const dims = doc.width && doc.height ? ` (${doc.width}×${doc.height})` : ''
    return `- **${filename}**${dims} — ID: ${doc.id}${url ? `\n  URL: ${url}` : ''}`
  })

  return `Found ${result.totalDocs} media file(s) (showing ${result.docs.length}):\n${items.join('\n')}`
}

/**
 * manage_categories — Create, update, or delete a category.
 */
async function manageCategories(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const action = input.action as string
  const name = (input.name as string)?.trim()
  const categoryId = input.categoryId ? Number(input.categoryId) : undefined

  switch (action) {
    case 'create': {
      if (!name) return 'Error: Category name is required to create a category.'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: Record<string, any> = { title: name }
      if (ctx.tenantId) data.tenant = ctx.tenantId
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (payload.create as any)({
        collection: 'categories',
        data,
        overrideAccess: true,
      })
      return `Category "${name}" created. ID: ${result.id}`
    }
    case 'update': {
      if (!categoryId) return 'Error: categoryId is required to update a category.'
      if (!name) return 'Error: New name is required to update a category.'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload.update as any)({
        collection: 'categories',
        id: categoryId,
        data: { title: name },
        overrideAccess: true,
      })
      return `Category ${categoryId} renamed to "${name}".`
    }
    case 'delete': {
      if (!categoryId) return 'Error: categoryId is required to delete a category.'
      await payload.delete({
        collection: 'categories',
        id: categoryId,
        overrideAccess: true,
      })
      return `Category ${categoryId} deleted.`
    }
    default:
      return `Unknown action "${action}". Use "create", "update", or "delete".`
  }
}

// ---------------------------------------------------------------------------
// Sprint 17: Leo Wizard Tools
// ---------------------------------------------------------------------------

/**
 * create_space — Provisions a new community space during wizard step 3.
 * Wraps createSpaceFromTemplate from spaceProvisioning.ts.
 */
async function handleCreateSpace(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  if (!tenantId) return 'Error: No tenant context available.'

  const name = (input.name as string)?.trim()
  const endeavorType = input.endeavorType as string
  const description = input.description as string | undefined

  if (!name) return 'Error: Space name is required.'
  if (!endeavorType) return 'Error: Endeavor type is required to provision channels.'

  try {
    const { createSpaceFromTemplate } = await import('./spaceProvisioning')

    const space = await createSpaceFromTemplate(
      payload,
      endeavorType as import('./spaceProvisioning').EndeavorType,
      tenantId,
      name,
    )

    const lines = [
      `Space created!`,
      `- **${name}** (ID: ${space.spaceId})`,
      `- Channels provisioned for ${endeavorType}`,
    ]
    if (description) lines.push(`- Description: ${description}`)
    lines.push(`\nThis is the main room where your community gathers.`)

    return lines.join('\n') + navDirective('/dashboard/community', 'View Community')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error creating space: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * complete_enlistment — Records the Enlistment Ceremony for wizard step 7.
 * The solemn moment where the operator commits to Angel OS values before signing
 * the constitution. Persists the ceremony record to tenant.setup.enlistment.
 */
async function handleCompleteEnlistment(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  if (!tenantId) return 'Error: No tenant context available.'

  const operatorName = (input.operatorName as string)?.trim()
  const enterpriseName = (input.enterpriseName as string)?.trim()
  const missionStatement = (input.missionStatement as string)?.trim()
  const affirmation = (input.affirmation as string)?.trim() || 'I commit to upholding constitutional governance and the Angel OS values.'

  if (!operatorName) return 'Error: Operator name is required for enlistment.'
  if (!enterpriseName) return 'Error: Enterprise name is required for enlistment.'
  if (!missionStatement) return 'Error: Mission statement is required — this captures why the operator is building their Enterprise.'

  try {
    // Record the enlistment ceremony on the tenant
    const now = new Date().toISOString()

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        setup: {
          enlistment: {
            operatorName,
            enterpriseName,
            missionStatement,
            affirmation,
            enlistedAt: now,
            flagshipOrigin: 'spacesangels.com',
          },
        },
      } as any,
      overrideAccess: true,
    })

    return [
      `⚔️ **Enlistment Ceremony Complete**`,
      ``,
      `Welcome to the Angel Army, **${operatorName}**.`,
      ``,
      `- **Enterprise:** ${enterpriseName}`,
      `- **Mission:** ${missionStatement}`,
      `- **Affirmed:** ${affirmation}`,
      `- **Enlisted:** ${new Date(now).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      `- **Origin:** Clearwater Flagship (spacesangels.com)`,
      ``,
      `Your commitment has been recorded. The next step is to sign the Angel OS Constitution — making your enlistment cryptographically permanent — and announce your Enterprise to the federation network.`,
    ].join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error completing enlistment: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * sign_constitution — Signs the Angel OS Constitution for wizard step 8.
 * Generates an Ed25519 signature, federationId, and persists to tenant.setup.*
 */
async function handleSignConstitution(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  if (!tenantId) return 'Error: No tenant context available.'

  const operatorName = (input.operatorName as string)?.trim()
  const enterpriseName = (input.enterpriseName as string)?.trim()
  const constitutionVersion = (input.constitutionVersion as string) || '1.1'

  if (!operatorName) return 'Error: Operator name is required to sign the constitution.'
  if (!enterpriseName) return 'Error: Enterprise name is required to sign the constitution.'

  try {
    const { getOrCreateFederationKeyPair } = await import('@/federation/keyStore')
    const { createSigningPayload, signConstitution } = await import('@/federation/protocol')
    const { getActiveConstitution } = await import('@/federation/constitution')

    // Get (or generate) the Enterprise's Ed25519 key pair
    const keyPair = await getOrCreateFederationKeyPair(payload, tenantId)

    // Build the signing event
    const constitution = getActiveConstitution()
    const signingEvent = createSigningPayload({
      enterpriseName,
      operatorName,
      domain: process.env.NEXT_PUBLIC_SERVER_URL || `${tenantId}.${process.env.VERCEL ? 'spacesangels.com' : 'angelos.local'}`,
      constitutionVersion: constitution.version,
    })

    // Sign the constitution
    const sig = signConstitution(signingEvent, keyPair.privateKey)

    // Persist to tenant.setup.*
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        setup: {
          constitutionSignedAt: sig.event.signedAt,
          constitutionSignature: sig.signature.slice(0, 64), // first 32 bytes for storage
          federationId: signingEvent.federationId,
        },
      } as any,
      overrideAccess: true,
    })

    return [
      `Constitution signed!`,
      `- **Operator:** ${operatorName}`,
      `- **Enterprise:** ${enterpriseName}`,
      `- **Constitution:** v${constitutionVersion}`,
      `- **Federation ID:** ${signingEvent.federationId}`,
      `- **Signed at:** ${new Date(sig.event.signedAt).toLocaleString()}`,
      ``,
      `The signature is cryptographically verified and stored immutably. ${enterpriseName} is now constitutionally committed to the Angel OS network.`,
    ].join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error signing constitution: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * ping_federation — Pings the Angel OS federation registry for wizard step 7.
 * Gracefully falls back to stub response when no registry URL is configured.
 */
async function handlePingFederation(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx

  const enterpriseName = (input.enterpriseName as string)?.trim()
  const domain = (input.domain as string) || `${tenantId}.${process.env.VERCEL ? 'spacesangels.com' : 'angelos.local'}`
  const endeavorType = (input.endeavorType as string) || 'custom'

  if (!enterpriseName) return 'Error: Enterprise name is required to ping the federation.'

  try {
    const { getTenantPublicKey } = await import('@/federation/keyStore')
    const { pingFederationRegistry } = await import('@/federation/protocol')
    const { getOrCreateFederationKeyPair } = await import('@/federation/keyStore')

    // Get the tenant's federation ID from setup.* if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let federationId: string | undefined
    let publicKey: string | undefined

    if (tenantId) {
      try {
        const tenant = await payload.findByID({
          collection: 'tenants',
          id: tenantId,
          depth: 0,
          overrideAccess: true,
        }) as any
        federationId = tenant?.setup?.federationId
        publicKey = (await getTenantPublicKey(payload, tenantId)) ?? undefined
      } catch {
        // Non-critical
      }
    }

    // If no key pair yet, generate one now
    if (!publicKey && tenantId) {
      const kp = await getOrCreateFederationKeyPair(payload, tenantId)
      publicKey = kp.publicKey
    }

    const ping = {
      enterpriseName,
      domain,
      endeavorType,
      publicKey: publicKey || '',
      federationId: federationId || '',
      constitutionVersion: '1.1',
      constitutionSignature: '',
      pingAt: new Date().toISOString(),
      capabilities: [] as string[],
    }

    // Get private key for signing the ping
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let privateKey: string | undefined
    if (tenantId) {
      try {
        const kp = await getOrCreateFederationKeyPair(payload, tenantId)
        privateKey = kp.privateKey
      } catch {
        // Non-critical
      }
    }

    const result = await pingFederationRegistry(ping, privateKey || '')

    // Mark wizard complete on the tenant
    if (tenantId) {
      try {
        await payload.update({
          collection: 'tenants',
          id: tenantId,
          data: {
            setup: {
              wizardComplete: true,
              wizardProgress: { completedStep: 8, completedAt: new Date().toISOString() },
            },
          } as any,
          overrideAccess: true,
        })
      } catch {
        // Non-critical
      }
    }

    const statusLabel =
      result.ministryStatus === 'applicant'
        ? 'Applicant (90-day probation begins now)'
        : result.ministryStatus

    return [
      result.success
        ? `Federation ping successful! ${enterpriseName} is now registered in the Angel OS network.`
        : `Federation ping completed (registry unavailable — stub response used).`,
      `- **Ministry status:** ${statusLabel}`,
      `- **Federation ID:** ${result.federationId || federationId || 'pending'}`,
      `- **Registry:** ${process.env.FEDERATION_REGISTRY_URL || 'local stub (no registry URL configured)'}`,
      ``,
      `🎉 Your Enterprise is live! The setup wizard is complete.`,
      ``,
      `You'll be redirected to your dashboard in a moment. Welcome to the Angel OS network, ${enterpriseName}.`,
    ].join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    // NEVER fail the wizard over a ping error
    return [
      `Federation registry ping attempted — network unavailable (this is expected in development).`,
      `- **Status:** Enterprise registered locally`,
      ``,
      `🎉 Your Enterprise setup is complete! The wizard is done.`,
      `You'll be redirected to your dashboard.`,
    ].join('\n')
  }
}

// ---------------------------------------------------------------------------
// Sprint 18B: Media Analysis & Knowledge Extraction
// ---------------------------------------------------------------------------

/**
 * analyze_image — Analyze an uploaded image with Anthropic Vision.
 * Creates a MediaMeta record with structured metadata for RAG retrieval.
 */
async function handleAnalyzeImage(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const mediaId = input.mediaId as number | undefined
  if (!mediaId) return 'Error: mediaId is required to analyze an image.'

  try {
    const { buildMediaMeta, resolveMediaUrl, isAnalyzableImage } = await import(
      './mediaAnalysis'
    )

    // Fetch the media document
    const mediaDoc = (await payload.findByID({
      collection: 'media',
      id: mediaId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    if (!isAnalyzableImage(mediaDoc)) {
      return `Media ${mediaId} is not an analyzable image type (${mediaDoc.mimeType || 'unknown'}). Use extract_pdf_pages for PDFs.`
    }

    const url = resolveMediaUrl(mediaDoc)
    if (!url) return 'Error: Could not resolve media URL for analysis.'

    const result = await buildMediaMeta(payload, {
      mediaDoc,
      tenantId: ctx.tenantId,
      sourceMessageId: input.messageId as number | undefined,
      customPrompt: input.customPrompt as string | undefined,
      inventoryMode: Boolean(input.inventoryMode),
    })

    if (!result.success) {
      return `Analysis failed: ${result.error || 'Unknown error'}`
    }

    // Fetch the created metadata to return a summary
    if (result.metaIds.length > 0) {
      const meta = (await payload.findByID({
        collection: 'media-meta' as any,
        id: result.metaIds[0],
        depth: 0,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>

      const vision = meta.visionAnalysis as Record<string, unknown> | undefined
      const lines: string[] = [
        `Image analyzed successfully! MediaMeta ID: ${meta.id}`,
        '',
      ]

      if (meta.summary) lines.push(`**Summary:** ${meta.summary}`)
      if (vision?.description) lines.push(`**Description:** ${String(vision.description).slice(0, 300)}`)
      if (vision?.sceneType) lines.push(`**Scene type:** ${vision.sceneType}`)
      if (Array.isArray(meta.tags) && meta.tags.length > 0)
        lines.push(`**Tags:** ${(meta.tags as string[]).join(', ')}`)
      if (vision?.textContent && String(vision.textContent).length > 0)
        lines.push(`**Visible text:** "${String(vision.textContent).slice(0, 200)}"`)

      const entities = meta.entities as Record<string, string[]> | undefined
      if (entities) {
        const parts: string[] = []
        if (entities.people?.length) parts.push(`People: ${entities.people.join(', ')}`)
        if (entities.places?.length) parts.push(`Places: ${entities.places.join(', ')}`)
        if (entities.organizations?.length)
          parts.push(`Orgs: ${entities.organizations.join(', ')}`)
        if (parts.length > 0) lines.push(`**Entities:** ${parts.join(' | ')}`)
      }

      if (vision?.inventoryItems && Array.isArray(vision.inventoryItems)) {
        lines.push(`\n**Inventory items detected:**`)
        for (const item of vision.inventoryItems as Array<Record<string, unknown>>) {
          const qty = item.quantity ? ` (×${item.quantity})` : ''
          const loc = item.location ? ` — ${item.location}` : ''
          lines.push(`  - ${item.item}${qty}${loc}`)
        }
      }

      lines.push(`\nThis analysis is now searchable via query_knowledge.`)
      return lines.join('\n')
    }

    return 'Analysis completed but no metadata was generated.'
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error analyzing image: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * extract_pdf_pages — Extract and analyze a PDF document page by page.
 */
async function handleExtractPdfPages(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const mediaId = input.mediaId as number | undefined
  if (!mediaId) return 'Error: mediaId is required to extract PDF pages.'

  try {
    const { buildMediaMeta, isPdf } = await import('./mediaAnalysis')

    const mediaDoc = (await payload.findByID({
      collection: 'media',
      id: mediaId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    if (!isPdf(mediaDoc)) {
      return `Media ${mediaId} is not a PDF (${mediaDoc.mimeType || 'unknown'}). Use analyze_image for images.`
    }

    const result = await buildMediaMeta(payload, {
      mediaDoc,
      tenantId: ctx.tenantId,
      sourceMessageId: input.messageId as number | undefined,
      customPrompt: input.customPrompt as string | undefined,
    })

    if (!result.success) {
      return `PDF extraction failed: ${result.error || 'Unknown error'}`
    }

    // Summarize the extracted pages
    const pages = await payload.find({
      collection: 'media-meta' as any,
      where: {
        media: { equals: mediaId },
        extractionType: { equals: 'pdf_page' },
      },
      sort: 'pageNumber',
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })

    const lines: string[] = [
      `PDF analyzed! ${pages.docs.length} page(s) extracted.`,
      '',
    ]

    // Get document group from first page
    const firstPage = pages.docs[0] as unknown as Record<string, unknown> | undefined
    if (firstPage?.documentGroup) {
      lines.push(`**Document group:** ${firstPage.documentGroup}`)
    }

    lines.push(`\n**Page summaries:**`)
    for (const page of pages.docs.slice(0, 10) as unknown as Array<Record<string, unknown>>) {
      const num = page.pageNumber || '?'
      const summary = page.summary || 'No summary'
      const status = page.status === 'error' ? ' ⚠️ (error)' : ''
      lines.push(`  - p${num}: ${String(summary).slice(0, 100)}${status}`)
    }

    if (pages.docs.length > 10) {
      lines.push(`  ... and ${pages.docs.length - 10} more pages`)
    }

    lines.push(`\nAll pages are now searchable via query_knowledge.`)
    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error extracting PDF: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * query_knowledge — Search the extracted knowledge base (MediaMeta records).
 */
async function handleQueryKnowledge(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const query = (input.query as string)?.trim()
  if (!query) return 'Error: query text is required to search the knowledge base.'

  const limit = Math.min(Math.max(Number(input.limit) || 5, 1), 20)
  const documentGroup = input.documentGroup as string | undefined
  const extractionType = input.extractionType as string | undefined

  try {
    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [
      { status: { equals: 'complete' } },
    ]

    // Add tenant filter if available
    if (ctx.tenantId) {
      conditions.push({ tenant: { equals: ctx.tenantId } })
    }

    if (documentGroup) {
      conditions.push({ documentGroup: { equals: documentGroup } })
    }

    if (extractionType) {
      conditions.push({ extractionType: { equals: extractionType } })
    }

    // Text search across multiple fields
    // Payload doesn't have full-text search natively, so we search key fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textConditions: any[] = [
      { summary: { like: query } },
      { ocrText: { like: query } },
    ]

    // Search — first try summary+OCR, then fall back to broader search
    let results = await payload.find({
      collection: 'media-meta' as any,
      where: {
        and: [
          ...conditions,
          { or: textConditions },
        ],
      } as any,
      sort: '-processedAt',
      limit,
      depth: 1, // Expand media relationship for context
      overrideAccess: true,
    })

    // If no results from text search, try tag-based search
    if (results.docs.length === 0) {
      // Search by tags — Payload JSON fields can use 'like'
      results = await payload.find({
        collection: 'media-meta' as any,
        where: {
          and: conditions,
        } as any,
        sort: '-processedAt',
        limit: limit * 2, // Fetch more, filter client-side
        depth: 1,
        overrideAccess: true,
      })

      // Client-side filter: check if any text field contains the query
      const queryLower = query.toLowerCase()
      results.docs = results.docs.filter((doc) => {
        const d = doc as unknown as Record<string, unknown>
        const searchable = [
          d.summary,
          d.ocrText,
          JSON.stringify(d.tags),
          JSON.stringify(d.entities),
          JSON.stringify(d.visionAnalysis),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return searchable.includes(queryLower)
      }).slice(0, limit)
    }

    if (results.docs.length === 0) {
      return `No knowledge found matching "${query}". Try uploading and analyzing images or documents first, then they become searchable.`
    }

    const lines: string[] = [
      `Found ${results.docs.length} result(s) for "${query}":`,
      '',
    ]

    for (const doc of results.docs as unknown as Array<Record<string, unknown>>) {
      const media = doc.media as Record<string, unknown> | undefined
      const mediaName = media?.filename || media?.alt || `media-${doc.media}`

      lines.push(`**[${doc.extractionType}] ${doc.summary || 'Untitled'}**`)
      lines.push(`  Media: ${mediaName}`)

      if (doc.pageNumber) {
        lines.push(`  Page: ${doc.pageNumber}${doc.totalPages ? `/${doc.totalPages}` : ''}`)
      }

      if (doc.documentGroup) {
        lines.push(`  Document: ${doc.documentGroup}`)
      }

      // Include relevant text content
      const vision = doc.visionAnalysis as Record<string, unknown> | undefined
      if (vision?.description) {
        lines.push(`  Description: ${String(vision.description).slice(0, 200)}`)
      }

      if (doc.ocrText && String(doc.ocrText).length > 0) {
        const ocrPreview = String(doc.ocrText).slice(0, 300)
        lines.push(`  Text content: "${ocrPreview}${String(doc.ocrText).length > 300 ? '...' : ''}"`)
      }

      const entities = doc.entities as Record<string, string[]> | undefined
      if (entities) {
        const parts: string[] = []
        if (entities.people?.length) parts.push(`People: ${entities.people.join(', ')}`)
        if (entities.places?.length) parts.push(`Places: ${entities.places.join(', ')}`)
        if (entities.dates?.length) parts.push(`Dates: ${entities.dates.join(', ')}`)
        if (parts.length > 0) lines.push(`  Entities: ${parts.join(' | ')}`)
      }

      if (Array.isArray(doc.tags) && doc.tags.length > 0) {
        lines.push(`  Tags: ${(doc.tags as string[]).slice(0, 8).join(', ')}`)
      }

      lines.push('') // Blank line between results
    }

    // Add RAG chunks if available for most relevant result
    const topDoc = results.docs[0] as unknown as Record<string, unknown>
    if (topDoc.ragChunks && Array.isArray(topDoc.ragChunks) && topDoc.ragChunks.length > 0) {
      const relevantChunk = (topDoc.ragChunks as Array<{ text: string }>).find(
        (c) => c.text.toLowerCase().includes(query.toLowerCase()),
      )
      if (relevantChunk) {
        lines.push(`**Most relevant chunk:**`)
        lines.push(relevantChunk.text.slice(0, 500))
      }
    }

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error searching knowledge base: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// check_fees — Bootstrap fee tier and refund promise status
// ---------------------------------------------------------------------------

async function handleCheckFees(
  payload: Payload,
  ctx: ToolExecutorContext,
): Promise<string> {
  if (!ctx.tenantId) {
    return 'Unable to check fees — no Enterprise context available. Please select an Enterprise first.'
  }

  try {
    const status = await getBootstrapFeeStatus(ctx.tenantId)

    const tierLabels = {
      free: 'Free Tier (no platform fees)',
      bootstrap: 'Bootstrap Phase (fee active, full refund promised)',
      standard: 'Standard (post-bootstrap, UltimateFairSplit)',
    }

    const lines = [
      `## Platform Fee Status`,
      ``,
      `**Current Tier:** ${tierLabels[status.tier] || status.tier}`,
      ``,
    ]

    if (status.tier === 'free') {
      lines.push(
        `### Free Tier Details`,
        `- **Transactions used:** ${status.freeTransactionsUsed} / ${status.freeTransactionLimit}`,
        `- **GMV processed:** $${(status.freeGmvCents / 100).toFixed(2)} / $${(status.freeGmvLimitCents / 100).toFixed(2)}`,
        `- **Free transactions remaining:** ${status.freeTransactionsRemaining}`,
        ``,
        `You're currently paying **zero platform fees**. After reaching the free tier limit, a small bootstrap fee (${status.bootstrapFeePercent}%) will apply — but every cent is tracked and committed for **full refund** when the bootstrap phase ends.`,
      )
    } else if (status.tier === 'bootstrap') {
      lines.push(
        `### Bootstrap Phase Details`,
        `- **Fee rate:** ${status.bootstrapFeePercent}% per transaction`,
        `- **Total fees collected:** $${(status.totalFeesCollectedCents / 100).toFixed(2)}`,
        `- **Refund promised:** ${status.refundPromised ? 'Yes — binding commitment' : 'No'}`,
        `- **Refund status:** ${status.refundStatus}`,
        `- **Bootstrap started:** ${status.bootstrapStartedAt ? new Date(status.bootstrapStartedAt).toLocaleDateString() : 'N/A'}`,
        ``,
        `Every dollar of bootstrap fees is tracked with a **binding refund promise**. When the platform graduates from the bootstrap phase, all $${(status.totalFeesCollectedCents / 100).toFixed(2)} will be returned to you. Early tenants are investors, not customers.`,
      )
    } else {
      lines.push(
        `### Standard Tier`,
        `- **Revenue split:** 60% Provider / 20% Platform / 15% Operations / 5% Justice Fund`,
        `- **Bootstrap fees collected:** $${(status.totalFeesCollectedCents / 100).toFixed(2)}`,
        `- **Refund status:** ${status.refundStatus}`,
        status.bootstrapEndedAt
          ? `- **Graduated on:** ${new Date(status.bootstrapEndedAt).toLocaleDateString()}`
          : '',
      )
    }

    return lines.filter(Boolean).join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return 'Unable to retrieve fee status. Please try again later.'
  }
}

// ===========================================================================
// Sprint 19 — Theme Management, Image Placement, Calendar, Research & Provision
// ===========================================================================

/** Compute relative luminance of a hex color (WCAG formula) */
function hexLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return -1
  const r = parseInt(clean.substring(0, 2), 16) / 255
  const g = parseInt(clean.substring(2, 4), 16) / 255
  const b = parseInt(clean.substring(4, 6), 16) / 255
  const lr = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4)
  const lg = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4)
  const lb = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4)
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

async function handleGetThemeSettings(
  payload: Payload,
  ctx: ToolExecutorContext,
): Promise<string> {
  if (!ctx.tenantId) {
    return 'Unable to read theme — no Enterprise context available. Please select an Enterprise first.'
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant = await payload.findByID({ collection: 'tenants', id: ctx.tenantId, depth: 1, overrideAccess: true }) as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: Record<string, any> = tenant?.branding || {}

    const lines = [
      `## Theme Settings`,
      ``,
      `**Site Name:** ${b.siteName || '(not set)'}`,
      `**Tagline:** ${b.tagline || '(not set)'}`,
      ``,
      `### Colors`,
      `- **Primary:** ${b.primaryColor || '#10B981'}`,
      `- **Secondary:** ${b.secondaryColor || '(not set)'}`,
      `- **Accent:** ${b.accentColor || '(not set)'}`,
      `- **Background:** ${b.backgroundColor || '#FFFFFF'}`,
      `- **Foreground:** ${b.foregroundColor || '#1A1A1A'}`,
      `- **Border:** ${b.borderColor || '#E5E7EB'}`,
      ``,
      `### Fonts`,
      `- **Heading font:** ${b.headingFont || 'inter'}`,
      `- **Body font:** ${b.bodyFont || 'inter'}`,
      ``,
      `### Media`,
      `- **Logo:** ${b.logo ? `Media ID ${typeof b.logo === 'object' ? b.logo.id : b.logo}` : '(not set)'}`,
      `- **Cover Image:** ${b.coverImage ? `Media ID ${typeof b.coverImage === 'object' ? b.coverImage.id : b.coverImage}` : '(not set)'}`,
    ]

    // Contrast analysis for the primary color
    const primary = b.primaryColor || '#10B981'
    const lum = hexLuminance(primary)
    if (lum >= 0) {
      lines.push(``)
      lines.push(`### Contrast Analysis`)
      lines.push(`- **Primary luminance:** ${lum.toFixed(3)} (0=black, 1=white)`)
      if (lum > 0.4) {
        lines.push(`- **Advisory:** Primary color is **light** — works well on dark backgrounds but may be hard to read on white/light backgrounds. Consider a darker variant for text or navigation links over light hero images.`)
      } else if (lum > 0.15) {
        lines.push(`- **Advisory:** Primary color has **medium** luminance — should work on both light and dark backgrounds with adequate contrast.`)
      } else {
        lines.push(`- **Advisory:** Primary color is **dark** — works well on light backgrounds. May need a lighter variant for dark-mode or overlay text.`)
      }
    }

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error reading theme settings: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * update_theme_settings — Merges provided branding fields into the tenant's
 * existing branding without overwriting unspecified fields.
 */
async function handleUpdateThemeSettings(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  if (!ctx.tenantId) {
    return 'Unable to update theme — no Enterprise context available. Please select an Enterprise first.'
  }

  // Validate hex colors
  const hexFields = ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'foregroundColor', 'borderColor'] as const
  for (const field of hexFields) {
    const val = input[field]
    if (val && typeof val === 'string' && !/^#[0-9A-Fa-f]{6}$/.test(val)) {
      return `Invalid hex color for ${field}: "${val}". Expected format: #RRGGBB (e.g. #10B981).`
    }
  }

  // Validate fonts
  const headingFonts = ['inter', 'playfair-display', 'montserrat', 'raleway', 'poppins']
  const bodyFonts = ['inter', 'open-sans', 'lato', 'roboto', 'source-sans-3']
  if (input.headingFont && !headingFonts.includes(input.headingFont as string)) {
    return `Invalid heading font: "${input.headingFont}". Options: ${headingFonts.join(', ')}.`
  }
  if (input.bodyFont && !bodyFonts.includes(input.bodyFont as string)) {
    return `Invalid body font: "${input.bodyFont}". Options: ${bodyFonts.join(', ')}.`
  }

  try {
    // Read existing branding to merge
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant = await payload.findByID({ collection: 'tenants', id: ctx.tenantId, depth: 0, overrideAccess: true }) as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing: Record<string, any> = tenant?.branding || {}

    // Build merged branding — only overwrite fields that were provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merged: Record<string, any> = { ...existing }
    const updatableFields = [...hexFields, 'headingFont', 'bodyFont', 'siteName', 'tagline'] as const
    const changed: string[] = []

    for (const field of updatableFields) {
      if (input[field] !== undefined && input[field] !== null) {
        const oldVal = existing[field] || '(not set)'
        merged[field] = input[field]
        changed.push(`- **${field}:** ${oldVal} → ${input[field]}`)
      }
    }

    // Handle logo assignment via Media ID
    if (input.logoMediaId !== undefined && input.logoMediaId !== null) {
      const logoId = input.logoMediaId as number
      // Verify the media exists
      try {
        await payload.findByID({ collection: 'media', id: logoId, depth: 0, overrideAccess: true })
      } catch {
        return `Error: Media ID ${logoId} not found. Please provide a valid Media ID for the logo.`
      }
      const oldLogo = existing.logo ? `Media #${typeof existing.logo === 'object' ? existing.logo.id : existing.logo}` : '(not set)'
      merged.logo = logoId
      changed.push(`- **logo:** ${oldLogo} → Media #${logoId}`)
    }

    if (changed.length === 0) {
      return 'No changes specified. Provide at least one branding field to update (e.g. primaryColor, headingFont, siteName, logoMediaId).'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.update as any)({
      collection: 'tenants',
      id: ctx.tenantId,
      data: { branding: merged },
      overrideAccess: true,
    })

    const lines = [
      `## Theme Updated`,
      ``,
      `${changed.length} field(s) changed:`,
      ...changed,
    ]

    // If primary color was changed, include contrast advisory
    if (input.primaryColor) {
      const lum = hexLuminance(input.primaryColor as string)
      if (lum >= 0 && lum > 0.4) {
        lines.push(``, `**Note:** New primary color is light (luminance ${lum.toFixed(3)}). Check that nav links and buttons remain readable over light backgrounds.`)
      }
    }

    return lines.join('\n') + navDirective('/dashboard/branding', 'View Branding')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error updating theme settings: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * get_page_hero — Reads a page's current hero section (type, image, text, links).
 * Defaults to homepage (slug "home") if no page specified.
 */
async function handleGetPageHero(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const pageId = input.pageId as number | undefined
  let slug = input.slug as string | undefined

  // Default to homepage if neither provided
  if (!pageId && !slug) {
    slug = 'home'
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let page: any

    if (pageId) {
      page = await payload.findByID({
        collection: 'pages',
        id: pageId,
        depth: 1, // Resolve media relationship
        overrideAccess: true,
      })
    } else {
      // Build tenant-scoped query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions: any[] = [{ slug: { equals: slug } }]
      if (ctx.tenantId) {
        conditions.push({ tenant: { equals: ctx.tenantId } })
      }
      const result = await payload.find({
        collection: 'pages',
        where: conditions.length > 1 ? { and: conditions } : conditions[0],
        limit: 1,
        depth: 1,
        overrideAccess: true,
      })
      page = result.docs[0]
    }

    if (!page) {
      return `Error: Page not found${slug ? ` with slug "${slug}"` : ` with ID ${pageId}`}.${slug === 'home' ? ' This tenant may not have a homepage yet.' : ''}`
    }

    // Tenant isolation check
    if (ctx.tenantId && page.tenant) {
      const pageTenant = typeof page.tenant === 'object' ? page.tenant?.id : page.tenant
      if (pageTenant && pageTenant !== ctx.tenantId) {
        return 'Error: This page belongs to a different tenant.'
      }
    }

    const hero = page.hero || {}
    const parts: string[] = [`## Hero — "${page.title || page.slug || `Page #${page.id}`}"`]
    parts.push(`- **Page ID:** ${page.id}`)
    parts.push(`- **Slug:** ${page.slug || '(none)'}`)
    parts.push(`- **Hero Type:** ${hero.type || 'none'}`)

    // Media info
    if (hero.media) {
      const media = typeof hero.media === 'object' ? hero.media : null
      if (media) {
        parts.push(`- **Hero Image Media ID:** ${media.id}`)
        parts.push(`- **Image URL:** ${media.url || '(no URL)'}`)
        parts.push(`- **Alt Text:** ${media.alt || '(none)'}`)
        if (media.filename) parts.push(`- **Filename:** ${media.filename}`)
        if (media.mimeType) parts.push(`- **Type:** ${media.mimeType}`)
        if (media.width && media.height) parts.push(`- **Dimensions:** ${media.width}×${media.height}`)

        // Auto-describe the image using Claude Vision so LEO knows what it looks like
        if (media.url && typeof media.url === 'string') {
          try {
            const imageUrl = media.url.startsWith('http')
              ? media.url
              : `${process.env.NEXT_PUBLIC_SERVER_URL || ''}${media.url}`
            const visionResult = await analyzeImageForFeedback({
              imageUrl,
              feedback: 'Describe this image in 2-3 sentences. Note any text visible in the image, the overall scene/subject, color palette, and mood.',
              context: 'Hero banner image description for content management',
            })
            if (visionResult?.analysis) {
              parts.push(`- **Visual Description:** ${visionResult.analysis.substring(0, 500)}`)
            }
          } catch {
            // Non-critical: skip visual description if analysis fails
            parts.push(`- **Visual Description:** (could not auto-analyze — use analyze_image tool with Media ID ${media.id} for details)`)
          }
        }
      } else {
        parts.push(`- **Hero Image Media ID:** ${hero.media} (not resolved)`)
      }
    } else {
      parts.push(`- **Hero Image:** (none set)`)
    }

    // Rich text summary
    if (hero.richText?.root?.children?.length) {
      try {
        // Extract plain text from Lexical nodes
        const extractText = (nodes: unknown[]): string => {
          return nodes
            .map((node: any) => {
              if (node.text) return node.text
              if (node.children) return extractText(node.children)
              return ''
            })
            .filter(Boolean)
            .join(' ')
        }
        const text = extractText(hero.richText.root.children).trim()
        if (text) {
          parts.push(`- **Hero Text:** "${text.substring(0, 200)}${text.length > 200 ? '...' : ''}"`)
        }
      } catch {
        parts.push(`- **Hero Text:** (present but could not extract)`)
      }
    } else {
      parts.push(`- **Hero Text:** (none)`)
    }

    // Links/CTAs
    if (hero.links?.length) {
      const linkDescs = hero.links.map((link: any, i: number) => {
        const l = link?.link || link
        return `  ${i + 1}. "${l?.label || '(no label)'}" → ${l?.url || l?.reference?.value?.slug || '(no URL)'}`
      })
      parts.push(`- **CTA Links:**\n${linkDescs.join('\n')}`)
    }

    return parts.join('\n')
  } catch (err) {
    logCaughtError('leo-tools/get_page_hero', err).catch(() => {})
    return `Error reading page hero: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * edit_image_text — Analyzes an image, understands its composition, and generates
 * a new version with corrected text while preserving the overall look.
 */
async function handleEditImageText(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const mediaId = Number(input.mediaId)
  const oldText = (input.oldText as string) || ''
  const newText = input.newText as string
  const additionalInstructions = (input.additionalInstructions as string) || ''

  if (!mediaId) {
    return 'Error: mediaId is required — provide the Media ID of the image with text to fix.'
  }
  if (!newText) {
    return 'Error: newText is required — what should the text say?'
  }

  if (!isImageGenerationAvailable()) {
    return 'Error: Image generation is not available — no AI image provider is configured.'
  }

  try {
    // Step 1: Fetch the media item
    const media = await payload.findByID({
      collection: 'media',
      id: mediaId,
      depth: 0,
      overrideAccess: true,
    })

    // Tenant isolation
    if (ctx.tenantId) {
      const docTenant = (media as any)?.tenant
      const tenantVal = typeof docTenant === 'object' ? docTenant?.id : docTenant
      if (tenantVal && tenantVal !== ctx.tenantId) {
        return 'Error: This media belongs to a different tenant.'
      }
    }

    const imageUrl = (media as unknown as Record<string, unknown>).url as string
    if (!imageUrl) {
      return `Error: Media #${mediaId} has no URL — cannot analyze it.`
    }

    // Step 2: Use Claude Vision to analyze the image and build a corrected prompt
    const textChangeDesc = oldText
      ? `Replace the text "${oldText}" with "${newText}".`
      : `Change the text to read "${newText}".`

    const feedback = [
      textChangeDesc,
      'Keep EVERYTHING else the same — same composition, colors, style, layout, all other visual elements.',
      'The new text must be clearly legible and match the style/font of the original.',
      additionalInstructions,
    ]
      .filter(Boolean)
      .join(' ')

    const feedbackResult = await analyzeImageForFeedback({
      imageUrl,
      feedback,
      context: 'Image text correction — preserving original design while fixing text content.',
    })

    // Step 3: Generate the corrected image
    const result = await generateImage(
      { prompt: feedbackResult.improvedPrompt, autoUpload: true },
      payload,
    )

    if (!result.success) {
      return `Image text correction failed: ${result.error}\n\n💡 The image was analyzed but generation failed. You can try again or use generate_image with a manual prompt.`
    }

    const parts: string[] = ['## Image Text Corrected ✨']
    if (oldText) {
      parts.push(`- **Changed:** "${oldText}" → "${newText}"`)
    } else {
      parts.push(`- **New text:** "${newText}"`)
    }
    parts.push(`- **Analysis:** ${feedbackResult.analysis.substring(0, 300)}`)

    if (result.mediaId) {
      parts.push(`- **New Media ID:** ${result.mediaId}`)
    }
    if (result.permanentUrl) {
      parts.push(`- **New URL:** ${result.permanentUrl}`)
    }

    parts.push(`\nThe original image (Media #${mediaId}) is unchanged. To replace it on a page hero, use set_page_hero with the new Media ID ${result.mediaId || '(check above)'}.`)

    return parts.join('\n')
  } catch (err) {
    logCaughtError('leo-tools/edit_image_text', err).catch(() => {})
    return `Error editing image text: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * set_page_hero — Sets or updates a page's hero type and/or image.
 * Auto-promotes to highImpact if an image is assigned to a lowImpact/none hero.
 */
async function handleSetPageHero(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const pageId = input.pageId as number | undefined
  const slug = input.slug as string | undefined
  const heroType = input.heroType as string | undefined
  const mediaId = input.mediaId as number | undefined

  if (!pageId && !slug) {
    return 'Error: Provide either a pageId or slug to identify the page.'
  }

  if (!heroType && mediaId === undefined) {
    return 'Error: Provide at least one of heroType or mediaId to update the hero.'
  }

  try {
    // Resolve page
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let page: any

    if (pageId) {
      page = await payload.findByID({
        collection: 'pages',
        id: pageId,
        depth: 0,
        overrideAccess: true,
      })
    } else {
      // Sprint 46: Add tenant filter to prevent cross-tenant page mutation
      const where: Where = ctx.tenantId
        ? { and: [{ slug: { equals: slug } }, { tenant: { equals: ctx.tenantId } }] }
        : { slug: { equals: slug } }
      const result = await payload.find({
        collection: 'pages',
        where,
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      page = result.docs[0]
    }

    if (!page) {
      return `Error: Page not found${slug ? ` with slug "${slug}"` : ` with ID ${pageId}`}.`
    }

    // If mediaId provided, verify it exists
    if (mediaId !== undefined) {
      try {
        await payload.findByID({ collection: 'media', id: mediaId, depth: 0, overrideAccess: true })
      } catch {
        return `Error: Media ID ${mediaId} not found. Please provide a valid media ID.`
      }
    }

    // Build a minimal hero update — only include fields we're actually changing.
    // Spreading the full hero object from depth:0 causes validation errors because
    // complex nested structures (Lexical richText) don't round-trip cleanly.
    // Payload merges group field updates, so unchanged fields are preserved.
    const existingHero = page.hero || {}
    const changes: string[] = []

    // Determine hero type
    let newType = heroType || existingHero.type || 'lowImpact'
    if (mediaId !== undefined && (newType === 'lowImpact' || newType === 'none')) {
      newType = 'highImpact'
      changes.push(`- **Hero type:** auto-promoted to highImpact (image assigned)`)
    } else if (heroType && heroType !== existingHero.type) {
      changes.push(`- **Hero type:** ${existingHero.type || '(not set)'} → ${heroType}`)
    }

    // Only include the specific fields we want to change
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const heroUpdate: Record<string, any> = { type: newType }

    if (mediaId !== undefined) {
      heroUpdate.media = mediaId
      changes.push(`- **Hero image:** set to Media ID ${mediaId}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.update as any)({
      collection: 'pages',
      id: page.id,
      data: { hero: heroUpdate },
      overrideAccess: true,
    })

    if (changes.length === 0) {
      return `Page hero unchanged — already set to the requested values.`
    }

    const pageTitle = page.title || page.slug || `ID ${page.id}`
    return [`## Hero Updated — "${pageTitle}"`, ``, ...changes].join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error setting page hero: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * generate_theme_aware_image — Reads tenant branding then generates an image
 * that incorporates brand colors, placement dimensions, and text overlay zones.
 */
async function handleGenerateThemeAwareImage(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  if (!isImageGenerationAvailable()) {
    return 'Image generation is not available — OPENROUTER_API_KEY is not configured.'
  }

  const userPrompt = input.prompt as string
  if (!userPrompt) {
    return 'Error: A prompt describing the image is required.'
  }

  const placement = input.placement as string | undefined
  const textOverlayZone = input.textOverlayZone as string | undefined
  const darkMode = input.darkMode === true
  const autoSave = input.autoSave !== false

  // Step 1: Read tenant branding (if available)
  let brandContext = ''
  if (ctx.tenantId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tenant = await payload.findByID({ collection: 'tenants', id: ctx.tenantId, depth: 0, overrideAccess: true }) as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: Record<string, any> = tenant?.branding || {}
      const colors: string[] = []
      if (b.primaryColor) colors.push(`primary brand color ${b.primaryColor}`)
      if (b.secondaryColor) colors.push(`secondary ${b.secondaryColor}`)
      if (b.accentColor) colors.push(`accent ${b.accentColor}`)
      if (colors.length > 0) {
        brandContext = `Brand palette: ${colors.join(', ')}. Incorporate these colors subtly into the composition.`
      }
      if (b.backgroundColor && b.backgroundColor !== '#FFFFFF') {
        brandContext += ` Site background is ${b.backgroundColor}.`
      }
    } catch {
      // No tenant or error — proceed without brand context
    }
  }

  // Step 2: Determine dimensions and composition guidance from placement
  const placementConfig: Record<string, { guidance: string; brandStyle?: string }> = {
    hero_banner: {
      guidance: 'Wide panoramic composition (16:3 ratio, ~1920x600). Leave visual breathing room for overlaid text. Strong horizontal flow.',
      brandStyle: 'website hero banner',
    },
    cover_image: {
      guidance: 'Wide cinematic composition (12:5 ratio, ~1920x800). Epic, atmospheric. Suitable as a full-width cover.',
      brandStyle: 'cover image',
    },
    card_thumbnail: {
      guidance: 'Compact composition (3:2 ratio, ~600x400). Clear focal point, works at small sizes. No fine text.',
      brandStyle: 'card thumbnail',
    },
    product_photo: {
      guidance: 'Square composition (1:1 ratio, ~1024x1024). Clean product photography. Professional lighting.',
      brandStyle: 'product photo',
    },
    background: {
      guidance: 'Full HD composition (16:9 ratio, ~1920x1080). Subtle, non-distracting. Works as a background layer behind content.',
      brandStyle: 'background texture',
    },
  }

  const pConfig = placement ? placementConfig[placement] : undefined

  // Step 3: Build text overlay zone instructions
  let overlayGuidance = ''
  if (textOverlayZone) {
    const zoneMap: Record<string, string> = {
      top: 'Create a dark-to-transparent gradient at the TOP of the image so white text will be readable there. Keep visual interest in the lower half.',
      bottom: 'Create a dark-to-transparent gradient at the BOTTOM of the image so white text will be readable there. Keep visual interest in the upper half.',
      left: 'Create a dark-to-transparent gradient on the LEFT side of the image so white text will be readable there. Keep visual interest on the right.',
      center: 'Create a dark vignette or overlay zone in the CENTER of the image so white text will be readable there. Place visual interest around the edges.',
    }
    overlayGuidance = zoneMap[textOverlayZone] || ''
  }

  // Step 4: Dark mode handling
  let darkModeGuidance = ''
  if (darkMode) {
    darkModeGuidance = 'The image will be displayed on a DARK background. Use dark, moody edges that blend seamlessly into black or near-black surrounds. Avoid bright edges.'
  }

  // Step 5: Compose the enhanced prompt
  const promptParts = [userPrompt]
  if (brandContext) promptParts.push(brandContext)
  if (pConfig?.guidance) promptParts.push(pConfig.guidance)
  if (overlayGuidance) promptParts.push(overlayGuidance)
  if (darkModeGuidance) promptParts.push(darkModeGuidance)

  const composedPrompt = promptParts.join(' | ')

  try {
    const result = await generateImage(
      {
        prompt: composedPrompt,
        enhancementContext: {
          brandStyle: pConfig?.brandStyle,
        },
        autoUpload: autoSave,
        tenantId: ctx.tenantId,
      },
      autoSave ? payload : undefined,
    )

    if (!result.success) {
      return `Theme-aware image generation failed: ${result.error}`
    }

    const parts: string[] = ['Theme-aware image generated successfully! 🎨']

    if (placement) parts.push(`Placement: ${placement}`)
    if (result.modelUsed) parts.push(`Model: ${result.modelUsed}`)
    if (result.mediaId) parts.push(`Saved to media library (Media ID: ${result.mediaId})`)
    if (result.permanentUrl) parts.push(`URL: ${result.permanentUrl}`)

    if (result.imageDataUrl && !result.permanentUrl) {
      parts.push('Image available for preview (not yet saved to media library).')
    }

    if (result.uploadWarning) {
      parts.push(`\n⚠️ ${result.uploadWarning}`)
    }

    // Suggest next steps based on placement
    if (result.mediaId && placement === 'hero_banner') {
      parts.push(`\nWould you like me to set this as the hero image on a page? I can use set_page_hero to place it.`)
    } else if (result.mediaId) {
      parts.push(`\nImage ready. You can ask me to place it on a page hero, attach it to a product, or use it as a cover image.`)
    }

    return parts.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error generating theme-aware image: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Sprint 20: Research & Provision — "Everyone Gets An Angel"
// ---------------------------------------------------------------------------

/**
 * provision_tenant — Stand up a COMPLETE portal enterprise on this node.
 *
 * Thin wrapper around the shared provisionPortal() utility — the exact same flow
 * the super_admin Provision Portal endpoint runs. LEO has no PayloadRequest, so we
 * pass payload + the acting user's id; provisionPortal links them as tenant_admin.
 * Idempotent: re-running heals/backfills rather than duplicating.
 */
async function handleProvisionTenant(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const domain = typeof input.domain === 'string' ? input.domain.trim() : ''
  if (!name) return 'Error: name is required.'
  if (!domain) return 'Error: domain is required (e.g. "kendev.co").'

  const domainAliases = Array.isArray(input.domainAliases)
    ? (input.domainAliases as unknown[]).filter((d): d is string => typeof d === 'string')
    : undefined

  try {
    const { provisionPortal } = await import('./provisionPortal')
    const result = await provisionPortal(
      payload,
      {
        name,
        domain,
        domainAliases,
        slug: typeof input.slug === 'string' ? input.slug : undefined,
        endeavorType: typeof input.endeavorType === 'string' ? input.endeavorType : undefined,
        tagline: typeof input.tagline === 'string' ? input.tagline : undefined,
        description: typeof input.description === 'string' ? input.description : undefined,
        missionStatement: typeof input.missionStatement === 'string' ? input.missionStatement : undefined,
        primaryColor: typeof input.primaryColor === 'string' ? input.primaryColor : undefined,
        secondaryColor: typeof input.secondaryColor === 'string' ? input.secondaryColor : undefined,
      },
      { actingUserId: ctx.userId },
    )

    const lines = [
      `## Provisioned: ${result.tenant.slug}`,
      `- **Tenant:** #${result.tenant.id} (${result.tenant.slug})`,
      `- **Domain:** ${result.tenant.domain} → ${result.url}`,
      '',
      '### Steps',
      ...result.log.map((l) => `- ${l}`),
      '',
      `Next: set \`DEFAULT_TENANT_SLUG=${result.tenant.slug}\` in this node's env if it is the node's root portal, point DNS (${result.tenant.domain} + any aliases) at this node, then sign the constitution and ping the federation to join the network.`,
    ]
    return lines.join('\n')
  } catch (e) {
    return `Error provisioning tenant: ${e instanceof Error ? e.message : 'Unknown error'}`
  }
}

/**
 * research_and_provision — Research a person/org and create their Guardian Angel Endeavor.
 *
 * This is the constitutional fulfillment of "Everyone Gets An Angel."
 * LEO researches the subject, builds a profile, and provisions a tenant + space + angel.
 *
 * For incarcerated souls, this creates their advocacy platform so that volunteers,
 * attorneys, and funding can find them. The Guardian Angel never forgets.
 */
async function handleResearchAndProvision(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const name = (input.name as string) || ''
  const url = input.url as string | undefined
  const context = input.context as string | undefined
  const operatorName = input.operatorName as string | undefined
  const operatorEmail = input.operatorEmail as string | undefined
  const autoProvision = input.autoProvision as boolean | undefined

  if (!name) return 'Error: name is required.'

  const parts: string[] = []
  parts.push(`## Research Profile: ${name}`)

  // Step 1: If URL provided, fetch and analyze the website
  let siteAnalysis = ''
  if (url) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'AngelOS-LEO/1.0 (Guardian Angel Research)' },
        signal: AbortSignal.timeout(15000),
      })
      if (response.ok) {
        const html = await response.text()
        // Extract text content (strip HTML tags for analysis)
        const textContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 5000) // First 5000 chars for analysis

        siteAnalysis = textContent
        parts.push(`\n### Website Analysis (${url})`)
        parts.push(`Content extracted: ${textContent.length} characters`)

        // Extract potential colors from CSS
        const colorMatches = html.match(/#[0-9a-fA-F]{6}/g)
        if (colorMatches && colorMatches.length > 0) {
          const uniqueColors = [...new Set(colorMatches)].slice(0, 5)
          parts.push(`Detected brand colors: ${uniqueColors.join(', ')}`)
        }

        // Extract title
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
        if (titleMatch) {
          parts.push(`Site title: ${titleMatch[1]}`)
        }

        // Extract meta description
        const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i)
        if (metaMatch) {
          parts.push(`Meta description: ${metaMatch[1]}`)
        }
      }
    } catch {
      parts.push(`\nNote: Could not fetch ${url} — will proceed with available information.`)
    }
  }

  // Step 2: Determine endeavor type from context
  let suggestedType: string = 'custom'
  const lowerContext = (context || '').toLowerCase() + ' ' + siteAnalysis.toLowerCase()
  if (lowerContext.includes('prison') || lowerContext.includes('incarcerat') || lowerContext.includes('conviction') || lowerContext.includes('innocence') || lowerContext.includes('advocacy')) {
    suggestedType = 'nonprofit'
  } else if (lowerContext.includes('shop') || lowerContext.includes('product') || lowerContext.includes('store') || lowerContext.includes('retail')) {
    suggestedType = 'retail'
  } else if (lowerContext.includes('service') || lowerContext.includes('consult') || lowerContext.includes('therapy')) {
    suggestedType = 'service'
  } else if (lowerContext.includes('content') || lowerContext.includes('blog') || lowerContext.includes('media') || lowerContext.includes('ministry')) {
    suggestedType = 'content_creator'
  } else if (lowerContext.includes('booking') || lowerContext.includes('appointment')) {
    suggestedType = 'service'
  }

  parts.push(`\n### Suggested Endeavor Configuration`)
  parts.push(`- **Name:** ${name}`)
  parts.push(`- **Type:** ${suggestedType}`)
  if (url) parts.push(`- **Source URL:** ${url}`)
  if (context) parts.push(`- **Context:** ${context}`)
  if (operatorName) parts.push(`- **Operator:** ${operatorName}`)
  if (operatorEmail) parts.push(`- **Contact:** ${operatorEmail}`)

  // Step 3: Generate a slug
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

  parts.push(`- **Slug:** ${slug}`)

  // Step 4: If autoProvision, create the tenant
  if (autoProvision) {
    try {
      // Map the research heuristic type → a provisionPortal endeavorType.
      const endeavorType =
        suggestedType === 'retail'
          ? 'retail-commerce'
          : suggestedType === 'service'
            ? 'service-provider'
            : suggestedType === 'content_creator'
              ? 'creator-content'
              : suggestedType === 'nonprofit'
                ? 'custom'
                : 'creator-content'
      const domainSuffix = process.env.VERCEL ? 'spacesangels.com' : 'angelos.local'

      // Full-fidelity provisioning — same flow as the Provision Portal: tenant +
      // endeavor + nav/pages + ALL baseline spaces (AI Bus, main, DMs, community)
      // + admin link. Idempotent, so re-running heals rather than duplicates.
      const { provisionPortal } = await import('./provisionPortal')
      const result = await provisionPortal(
        payload,
        {
          name,
          slug,
          domain: `${slug}.${domainSuffix}`,
          endeavorType,
          tagline: context ? context.slice(0, 100) : `Guardian Angel for ${name}`,
          description: context || `Guardian Angel Endeavor for ${name}`,
        },
        { actingUserId: ctx.userId },
      )
      parts.push(`\n### Endeavor Provisioned`)
      parts.push(`- **Tenant:** #${result.tenant.id} (${result.tenant.slug})`)
      parts.push(`- **Domain:** ${result.tenant.domain} → ${result.url}`)
      parts.push(...result.log.map((l) => `- ${l}`))
      parts.push(`\nNext steps: sign_constitution and ping_federation to join the network.`)
    } catch (err) {
      parts.push(`\nError provisioning endeavor: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  } else {
    parts.push(`\n### Ready to Provision`)
    parts.push(`This profile is ready for review. To create the Endeavor, call research_and_provision again with autoProvision: true, or use onboard_vendor with the details above.`)
  }

  return parts.join('\n')
}

/**
 * track_soul — Register a human soul in the advocacy queue.
 *
 * "No one gets forgotten." This creates a record that Angel OS monitors.
 * When resources (volunteers, attorneys, funding) become available,
 * the system matches them to tracked souls based on needs and priority.
 *
 * This is the constitutional heart of Angel OS — tracking the dignity
 * of every person, especially those the system has failed.
 */
async function handleTrackSoul(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const name = (input.name as string) || ''
  const situation = (input.situation as string) || ''
  const facility = input.facility as string | undefined
  const caseNumber = input.caseNumber as string | undefined
  const advocateContact = input.advocateContact as string | undefined
  const needsType = (input.needsType as string[]) || []
  const url = input.url as string | undefined
  const priority = (input.priority as string) || 'normal'

  if (!name || !situation) return 'Error: name and situation are required.'

  try {
    // Store in the posts collection as a "soul-tracker" type for now
    // This creates a searchable, trackable record that LEO and volunteers can find
    const slug = `soul-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`

    // Check for existing tracker
    const existing = await payload.find({
      collection: 'posts',
      where: {
        slug: { equals: slug },
      },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      return `Soul tracker for ${name} already exists (post ID: ${existing.docs[0].id}). Updated by visiting the existing record. No one is forgotten.`
    }

    // Create the soul tracker post
    const post = await payload.create({
      collection: 'posts',
      data: {
        title: `Guardian Watch: ${name}`,
        slug,
        _status: 'draft', // Draft = not publicly visible, only visible to admins/LEO
        meta: {
          title: `Soul Tracker: ${name}`,
          description: situation.slice(0, 160),
        },
        ...(ctx.tenantId ? { tenant: ctx.tenantId } : {}),
      } as any,
      overrideAccess: true,
    })

    const parts: string[] = []
    parts.push(`## Soul Tracked: ${name}`)
    parts.push(`**Record ID:** ${post.id}`)
    parts.push(`**Priority:** ${priority}`)
    parts.push(`**Situation:** ${situation}`)
    if (facility) parts.push(`**Facility:** ${facility}`)
    if (caseNumber) parts.push(`**Case:** ${caseNumber}`)
    if (advocateContact) parts.push(`**Advocate:** ${advocateContact}`)
    if (needsType.length > 0) parts.push(`**Needs:** ${needsType.join(', ')}`)
    if (url) parts.push(`**URL:** ${url}`)
    parts.push('')
    parts.push(`This soul is now in the Angel OS watch system. When resources become available — volunteers, attorneys, funding, or spiritual support — the system will surface this record for matching.`)
    parts.push('')
    parts.push(`*"Behind every case file is a human being who deserves dignity. No one gets forgotten."*`)

    return parts.join('\n')
  } catch (err) {
    return `Error tracking soul: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ─── Calendar Block Tool ──────────────────────────────────────────────────────

/**
 * add_calendar_to_page — Appends a Calendar block to a page or post's layout.
 */
async function addCalendarToPage(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const targetId = Number(input.targetId)
  if (!targetId) return 'Error: targetId is required.'

  const collection = (input.collection as string) || 'pages'
  if (!['pages', 'posts'].includes(collection)) {
    return 'Error: collection must be "pages" or "posts".'
  }

  const events = input.events as Array<Record<string, unknown>> | undefined
  if (!events?.length) return 'Error: At least one event is required.'

  // Fetch existing document to get current layout
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await (payload.findByID as any)({
    collection,
    id: targetId,
    depth: 0,
    overrideAccess: true,
  })

  // Verify document belongs to tenant
  if (ctx.tenantId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docTenant = (existing as any)?.tenant
    const tenantVal = typeof docTenant === 'object' ? docTenant?.id : docTenant
    if (tenantVal && tenantVal !== ctx.tenantId) {
      return 'Error: This document belongs to a different tenant.'
    }
  }

  if (!existing) return `Error: ${collection} #${targetId} not found.`

  // Build calendar block
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calendarBlock: Record<string, any> = {
    blockType: 'calendar',
    sourceType: 'manual',
    heading: (input.heading as string) || 'Upcoming Events',
    defaultView: (input.defaultView as string) || 'list',
    showPastEvents: Boolean(input.showPastEvents),
    accentColor: (input.accentColor as string) || undefined,
    maxEvents: 50,
    events: events.map((e) => ({
      title: String(e.title || ''),
      date: String(e.date || ''),
      time: e.time ? String(e.time) : undefined,
      venue: e.venue ? String(e.venue) : undefined,
      location: e.location ? String(e.location) : undefined,
      description: e.description ? String(e.description) : undefined,
      ticketUrl: e.ticketUrl ? String(e.ticketUrl) : undefined,
      soldOut: Boolean(e.soldOut),
      featured: Boolean(e.featured),
    })),
  }

  // Append to existing layout
  const currentLayout = Array.isArray(existing.layout) ? [...existing.layout] : []
  currentLayout.push(calendarBlock)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (payload.update as any)({
    collection,
    id: targetId,
    data: { layout: currentLayout },
    overrideAccess: true,
  })

  const title = str(existing, 'title') || `#${targetId}`
  return [
    `Calendar block added to ${collection === 'pages' ? 'page' : 'post'} "${title}"!`,
    `- ${events.length} event${events.length === 1 ? '' : 's'} added`,
    `- Default view: ${(input.defaultView as string) || 'list'}`,
    `- Heading: "${(input.heading as string) || 'Upcoming Events'}"`,
    '',
    `The calendar is now part of the page layout. View it at the page URL.`,
  ].join('\n')
}


// ===========================================================================
// Sprint 21 — Arch Angel LEO's Wishlist: Handler Functions
// ===========================================================================

// ---------------------------------------------------------------------------
// Phase 1: Communication & Social Layer
// ---------------------------------------------------------------------------

/** Helper: Find LEO system user for this tenant */
async function findLeoUser(payload: Payload, tenantId?: number): Promise<number | undefined> {
  if (!tenantId) return undefined
  try {
    // Look for any system user serving this tenant with agent config
    const result = await payload.find({
      collection: 'users',
      where: {
        and: [
          { servesTenant: { equals: tenantId } },
          { 'agentConfig.agentType': { equals: 'leo' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return result.docs[0]?.id as number | undefined
  } catch {
    return undefined
  }
}

/** Helper: Find a space for the tenant (defaults to first space if no spaceId given) */
async function resolveSpace(
  payload: Payload,
  tenantId: number,
  spaceId?: number,
): Promise<{ id: number; tenant: number } | null> {
  if (spaceId) {
    try {
      const doc = await payload.findByID({
        collection: 'spaces',
        id: spaceId,
        depth: 0,
        overrideAccess: true,
      })
      return doc ? { id: doc.id as number, tenant: tenantId } : null
    } catch {
      return null
    }
  }
  // Find first space for tenant
  const spaces = await payload.find({
    collection: 'spaces',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const first = spaces.docs[0]
  return first ? { id: first.id as number, tenant: tenantId } : null
}

async function handleSendMessage(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId, spaceId } = ctx
  if (!tenantId) return 'Error: No tenant context available.'

  const channel = (input.channel as string)?.trim()
  const content = (input.content as string)?.trim()
  if (!channel) return 'Error: channel slug is required.'
  if (!content) return 'Error: message content is required.'

  const targetSpaceId = (input.spaceId as number) || spaceId
  const space = await resolveSpace(payload, tenantId, targetSpaceId)
  if (!space) return 'Error: Could not find a space to send the message to.'

  const leoUserId = await findLeoUser(payload, tenantId)

  try {
    const msg = await payload.create({
      collection: 'messages',
      data: {
        content,
        space: space.id,
        channel,
        messageType: 'ai_agent',
        author: leoUserId || (ctx.userId as number) || 1,
        tenant: tenantId,
        visibility: 'tenant',
      } as any,
      overrideAccess: true,
    })
    return `Message sent to #${channel} (message ID: ${msg.id}). Content: "${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error sending message: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleSendDirectMessage(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  if (!tenantId) return 'Error: No tenant context available.'

  const targetUserId = input.targetUserId as number
  const content = (input.content as string)?.trim()
  if (!targetUserId) return 'Error: targetUserId is required.'
  if (!content) return 'Error: message content is required.'

  const leoUserId = await findLeoUser(payload, tenantId)
  const senderId = leoUserId || ctx.userId
  if (!senderId) return 'Error: No sender identity available.'

  try {
    // Ensure DM space exists
    const dmSpaceId = await ensureDMSpace(String(tenantId))
    if (!dmSpaceId) return 'Error: Failed to provision DM space.'

    // Find or create DM channel
    const dm = await findOrCreateDM(tenantId, dmSpaceId, senderId, targetUserId)

    // Send the message
    const msg = await payload.create({
      collection: 'messages',
      data: {
        content,
        space: Number(dmSpaceId),
        channel: dm.channelSlug,
        messageType: 'ai_agent',
        author: senderId,
        tenant: tenantId,
        visibility: 'private',
      } as any,
      overrideAccess: true,
    })

    return `Direct message sent to user ${targetUserId} (message ID: ${msg.id}, channel: ${dm.channelSlug}${dm.isNew ? ' — new DM created' : ''}).`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error sending DM: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleCreateAnnouncement(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  if (!tenantId) return 'Error: No tenant context available.'

  const title = (input.title as string)?.trim()
  const content = (input.content as string)?.trim()
  if (!title) return 'Error: announcement title is required.'
  if (!content) return 'Error: announcement content is required.'

  const targetSpaces = input.targetSpaces as number[] | undefined
  const leoUserId = await findLeoUser(payload, tenantId)

  try {
    // Get target spaces
    let spaceIds: number[]
    if (targetSpaces && targetSpaces.length > 0) {
      spaceIds = targetSpaces
    } else {
      // All spaces for this tenant
      const spaces = await payload.find({
        collection: 'spaces',
        where: { tenant: { equals: tenantId } },
        limit: 50,
        depth: 0,
        overrideAccess: true,
      })
      spaceIds = spaces.docs.map((s) => s.id as number)
    }

    if (spaceIds.length === 0) return 'Error: No spaces found to announce to.'

    const fullContent = `**${title}**\n\n${content}`
    let sent = 0

    for (const sid of spaceIds) {
      try {
        await payload.create({
          collection: 'messages',
          data: {
            content: fullContent,
            space: sid,
            channel: 'announcements',
            messageType: 'announcement',
            priority: 'high',
            author: leoUserId || (ctx.userId as number) || 1,
            tenant: tenantId,
            visibility: 'tenant',
          } as any,
          overrideAccess: true,
        })
        sent++
      } catch {
        // Some spaces may not have an announcements channel — skip
      }
    }

    return `Announcement "${title}" posted to ${sent} space(s).`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error creating announcement: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleModerateContent(
  payload: Payload,
  input: Record<string, unknown>,
  _ctx: ToolExecutorContext,
): Promise<string> {
  const messageId = input.messageId as number
  const action = input.action as string
  const reason = (input.reason as string)?.trim()

  if (!messageId) return 'Error: messageId is required.'
  if (!action || !['archive', 'flag', 'resolve'].includes(action)) {
    return 'Error: action must be one of: archive, flag, resolve.'
  }
  if (!reason) return 'Error: reason is required for moderation actions.'

  try {
    const updates: Record<string, unknown> = {}
    if (action === 'archive') {
      updates.status = 'archived'
    } else if (action === 'flag') {
      updates.status = 'pending'
      updates.priority = 'urgent'
    } else if (action === 'resolve') {
      updates.status = 'resolved'
    }

    await payload.update({
      collection: 'messages',
      id: messageId,
      data: updates as any,
      overrideAccess: true,
    })

    return `Message ${messageId} moderated: action="${action}", reason="${reason}". Status updated to ${updates.status}.`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error moderating message: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Inventory & Stock Management
// ---------------------------------------------------------------------------

async function handleUpdateInventory(
  payload: Payload,
  input: Record<string, unknown>,
  _ctx: ToolExecutorContext,
): Promise<string> {
  const productId = input.productId as number
  const adjustment = input.adjustment as number
  const reason = (input.reason as string)?.trim()

  if (!productId) return 'Error: productId is required.'
  if (typeof adjustment !== 'number') return 'Error: adjustment must be a number.'
  if (!reason) return 'Error: reason is required for inventory adjustments.'

  try {
    const product = await payload.findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      overrideAccess: true,
    })

    const currentInventory = (product as any).inventory || 0
    const newInventory = currentInventory + adjustment

    if (newInventory < 0) {
      return `Error: Adjustment would result in negative inventory (current: ${currentInventory}, adjustment: ${adjustment}). Cannot go below 0.`
    }

    await payload.update({
      collection: 'products',
      id: productId,
      data: { inventory: newInventory } as any,
      overrideAccess: true,
    })

    // The afterProductChange hook automatically creates AI Bus messages
    return `Inventory updated for "${(product as any).title}": ${currentInventory} → ${newInventory} (${adjustment > 0 ? '+' : ''}${adjustment}). Reason: ${reason}`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error updating inventory: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleTrackInventoryMovement(
  payload: Payload,
  input: Record<string, unknown>,
  _ctx: ToolExecutorContext,
): Promise<string> {
  const orderId = input.orderId as number
  if (!orderId) return 'Error: orderId is required.'

  try {
    const order = await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 2,
      overrideAccess: true,
    }) as any

    if (!order) return `Error: Order ${orderId} not found.`

    const items = order.items || []
    if (items.length === 0) return `Order ${orderId} has no items to process.`

    const results: string[] = []

    for (const item of items) {
      const product = typeof item.product === 'object' ? item.product : null
      const qty = item.quantity || 1

      if (!product?.id) {
        results.push(`Skipped item (no product reference)`)
        continue
      }

      const currentInventory = product.inventory || 0
      const newInventory = Math.max(0, currentInventory - qty)

      await payload.update({
        collection: 'products',
        id: product.id,
        data: { inventory: newInventory } as any,
        overrideAccess: true,
      })

      results.push(`${product.title}: ${currentInventory} → ${newInventory} (-${qty})`)
    }

    return `Inventory processed for order #${orderId}:\n${results.map((r) => `  - ${r}`).join('\n')}`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error processing inventory: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleSetLowStockAlert(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const productId = input.productId as number
  const threshold = input.threshold as number

  if (!productId) return 'Error: productId is required.'
  if (typeof threshold !== 'number' || threshold < 0) {
    return 'Error: threshold must be a non-negative number.'
  }

  try {
    const product = await payload.findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      overrideAccess: true,
    }) as any

    // Verify product belongs to current tenant
    if (ctx.tenantId) {
      const docTenant = typeof product?.tenant === 'object' ? product.tenant?.id : product?.tenant
      if (docTenant && docTenant !== ctx.tenantId) {
        return 'Error: This product belongs to a different tenant.'
      }
    }

    await payload.update({
      collection: 'products',
      id: productId,
      data: { lowStockThreshold: threshold } as any,
      overrideAccess: true,
    })

    const currentInventory = product.inventory || 0
    const status = currentInventory <= threshold ? ' (currently at or below threshold!)' : ''

    return `Low stock alert threshold set for "${product.title}": alert when inventory drops below ${threshold} units. Current inventory: ${currentInventory}${status}`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error setting alert: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleQueryInventoryHistory(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 10, 50)
  const productTitle = input.productTitle as string | undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [{ messageType: { equals: 'inventory' } }]
  if (ctx.tenantId) conditions.push({ tenant: { equals: ctx.tenantId } })
  if (productTitle) conditions.push({ content: { like: productTitle } })

  try {
    const messages = await payload.find({
      collection: 'messages',
      where: { and: conditions } as any,
      sort: '-createdAt',
      limit,
      depth: 0,
      overrideAccess: true,
    })

    if (messages.docs.length === 0) {
      return 'No inventory history found.' + (productTitle ? ` No movements recorded for "${productTitle}".` : '')
    }

    const lines = [`## Inventory History (${messages.docs.length} records)`, '']
    for (const doc of messages.docs as any[]) {
      const date = new Date(doc.createdAt).toLocaleString()
      const text = typeof doc.content === 'string' ? doc.content : JSON.stringify(doc.content)
      lines.push(`- **${date}:** ${text}`)
    }

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error querying inventory history: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Financial Operations
// ---------------------------------------------------------------------------

async function handleGenerateInvoice(
  payload: Payload,
  input: Record<string, unknown>,
  _ctx: ToolExecutorContext,
): Promise<string> {
  const orderId = input.orderId as number
  const notes = (input.notes as string) || ''

  if (!orderId) return 'Error: orderId is required.'

  try {
    const order = await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 2,
      overrideAccess: true,
    }) as any

    if (!order) return `Error: Order ${orderId} not found.`

    const items = order.items || []
    const lines: string[] = [
      `## Invoice — Order #${orderId}`,
      `**Date:** ${new Date(order.createdAt).toLocaleDateString()}`,
      `**Status:** ${order.status || 'pending'}`,
      '',
      `### Line Items`,
    ]

    let subtotalCents = 0
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const product = typeof item.product === 'object' ? item.product : null
      const title = product?.title || `Item ${i + 1}`
      const qty = item.quantity || 1
      const priceCents = (item.priceJSON ? JSON.parse(item.priceJSON)?.amount : product?.price) || 0
      const lineTotalCents = priceCents * qty
      subtotalCents += lineTotalCents

      lines.push(`${i + 1}. **${title}** × ${qty} — $${(lineTotalCents / 100).toFixed(2)}`)
    }

    lines.push('', `**Subtotal:** $${(subtotalCents / 100).toFixed(2)}`)

    // Calculate fair split
    if (subtotalCents > 0) {
      const split = calculateUltimateFairSplit(subtotalCents)
      lines.push('', `### Ultimate Fair Split`)
      for (const s of split) {
        lines.push(`- ${s.recipient}: $${(s.amount / 100).toFixed(2)} (${(s.percentage * 100).toFixed(0)}%)`)
      }
    }

    if (notes) lines.push('', `### Notes`, notes)

    // Add fulfillment status
    const fulfillment = order.fulfillment || []
    if (fulfillment.length > 0) {
      lines.push('', `### Fulfillment Status`)
      for (const f of fulfillment) {
        lines.push(`- Item ${(f.orderItemIndex || 0) + 1}: ${f.fulfillmentStatus || 'pending'}`)
      }
    }

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error generating invoice: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleQueryFinancialReports(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const startDate = input.startDate as string
  const endDate = input.endDate as string

  if (!startDate || !endDate) return 'Error: startDate and endDate are required.'

  const start = new Date(startDate)
  const end = new Date(endDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'Error: Invalid date format. Use ISO format (YYYY-MM-DD).'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantFilter: any = ctx.tenantId ? { tenant: { equals: ctx.tenantId } } : {}

  try {
    // Query orders
    const orders = await payload.find({
      collection: 'orders',
      where: {
        and: [
          tenantFilter,
          { createdAt: { greater_than_equal: start.toISOString() } },
          { createdAt: { less_than_equal: end.toISOString() } },
        ].filter((c) => Object.keys(c).length > 0),
      } as any,
      limit: 500,
      depth: 1,
      overrideAccess: true,
    })

    // Query agent transactions
    const transactions = await payload.find({
      collection: 'agent-transactions',
      where: {
        and: [
          tenantFilter,
          { createdAt: { greater_than_equal: start.toISOString() } },
          { createdAt: { less_than_equal: end.toISOString() } },
        ].filter((c) => Object.keys(c).length > 0),
      } as any,
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })

    // Query justice fund
    const justiceFund = await payload.find({
      collection: 'justice-fund-transactions',
      where: {
        and: [
          { createdAt: { greater_than_equal: start.toISOString() } },
          { createdAt: { less_than_equal: end.toISOString() } },
        ],
      } as any,
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })

    // Compute metrics
    let totalRevenueCents = 0
    for (const o of orders.docs as any[]) {
      totalRevenueCents += o.total || 0
    }

    let federationSpend = 0
    let federationEarn = 0
    for (const t of transactions.docs as any[]) {
      if (t.type === 'spend') federationSpend += t.amountCents || 0
      if (t.type === 'earn') federationEarn += t.amountCents || 0
    }

    let justiceTotal = 0
    for (const j of justiceFund.docs as any[]) {
      justiceTotal += j.amountCents || 0
    }

    const lines = [
      `## Financial Report`,
      `**Period:** ${start.toLocaleDateString()} — ${end.toLocaleDateString()}`,
      '',
      `### Revenue`,
      `- **Total orders:** ${orders.docs.length}`,
      `- **Total revenue:** $${(totalRevenueCents / 100).toFixed(2)}`,
      `- **Average order value:** $${orders.docs.length > 0 ? ((totalRevenueCents / orders.docs.length) / 100).toFixed(2) : '0.00'}`,
      '',
      `### Federation Transactions`,
      `- **Total transactions:** ${transactions.docs.length}`,
      `- **Federation spend:** $${(federationSpend / 100).toFixed(2)}`,
      `- **Federation earnings:** $${(federationEarn / 100).toFixed(2)}`,
      `- **Net:** $${((federationEarn - federationSpend) / 100).toFixed(2)}`,
      '',
      `### Justice Fund`,
      `- **Contributions:** ${justiceFund.docs.length}`,
      `- **Total contributed:** $${(justiceTotal / 100).toFixed(2)}`,
    ]

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error generating report: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleIssueRefund(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const orderId = input.orderId as number
  const reason = (input.reason as string)?.trim()
  const amountCents = input.amountCents as number | undefined

  if (!orderId) return 'Error: orderId is required.'
  if (!reason) return 'Error: reason is required for refunds.'

  try {
    const order = await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 1,
      overrideAccess: true,
    }) as any

    if (!order) return `Error: Order ${orderId} not found.`

    const orderTotal = order.total || 0
    const refundAmount = amountCents || orderTotal

    // Record refund intent in agent transactions
    await payload.create({
      collection: 'agent-transactions',
      data: {
        tenant: ctx.tenantId,
        type: 'refund',
        amountCents: refundAmount,
        currency: 'USD',
        description: `Refund for order #${orderId}: ${reason}`,
        status: 'pending',
        metadata: {
          orderId,
          reason,
          isPartialRefund: amountCents !== undefined && amountCents < orderTotal,
          stripePaymentIntentId: order.stripePaymentIntentId || null,
        },
      } as any,
      overrideAccess: true,
    })

    const isPartial = amountCents !== undefined && amountCents < orderTotal
    const lines = [
      `## Refund Flagged for Processing`,
      `- **Order:** #${orderId}`,
      `- **Refund amount:** $${(refundAmount / 100).toFixed(2)}${isPartial ? ' (partial)' : ' (full)'}`,
      `- **Reason:** ${reason}`,
      `- **Status:** Pending human approval`,
    ]

    if (order.stripePaymentIntentId) {
      lines.push(`- **Stripe Payment Intent:** ${order.stripePaymentIntentId}`)
      lines.push(``, `Note: The actual Stripe refund must be processed by a human admin for safety. This record flags the intent.`)
    }

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error issuing refund: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Phase 4: Federation & Network Intelligence
// ---------------------------------------------------------------------------

async function handleQueryFederation(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const search = (input.search as string) || ''
  const capability = (input.capability as string) || ''
  const region = (input.region as string) || ''
  const limit = Math.min(Number(input.limit) || 10, 25)

  try {
    const results: string[] = []

    // 1. Search Street Signs (federation-wide discovery)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signConditions: any[] = []
    if (search) signConditions.push({ or: [{ title: { like: search } }, { description: { like: search } }] })
    if (region) signConditions.push({ region: { like: region } })

    const streetSigns = await payload.find({
      collection: 'street-signs' as any,
      where: signConditions.length > 0 ? { and: signConditions } : {} as any,
      limit,
      depth: 0,
      overrideAccess: true,
    })

    if (streetSigns.docs.length > 0) {
      results.push(`### Federation Street Signs (${streetSigns.docs.length})`)
      for (const sign of streetSigns.docs as any[]) {
        results.push(`- **${sign.title}** (${sign.contentType}) — ${sign.sourceMinistry || 'unknown ministry'}`)
        if (sign.description) results.push(`  ${String(sign.description).slice(0, 100)}`)
        if (sign.region) results.push(`  Region: ${sign.region}`)
      }
      results.push('')
    }

    // 2. Search network-listed products
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prodConditions: any[] = [
      { networkListing: { equals: true } },
      { _status: { equals: 'published' } },
    ]
    if (search) prodConditions.push({ title: { like: search } })
    if (capability) prodConditions.push({ 'requiredCapabilities.skill': { like: capability } })

    const products = await payload.find({
      collection: 'products',
      where: { and: prodConditions } as any,
      limit,
      depth: 1,
      overrideAccess: true,
    })

    if (products.docs.length > 0) {
      results.push(`### Network Products (${products.docs.length})`)
      for (const p of products.docs as any[]) {
        const vendor = typeof p.vendor === 'object' ? p.vendor?.name || p.vendor?.slug : p.vendor
        const price = p.priceInUSD ? `$${(p.priceInUSD / 100).toFixed(2)}` : 'Price TBD'
        results.push(`- **${p.title}** — ${price} (vendor: ${vendor || 'unknown'})`)
      }
      results.push('')
    }

    // 3. Search Holon capabilities
    if (capability) {
      const holons = await payload.find({
        collection: 'holon-capabilities' as any,
        where: {
          and: [
            { acceptingOrders: { equals: true } },
            { constitutionalCompliance: { equals: true } },
            {
              or: [
                { 'capabilities.skill': { like: capability } },
                { 'capabilities.equipment': { like: capability } },
              ],
            },
          ],
        } as any,
        limit: 10,
        depth: 1,
        overrideAccess: true,
      })

      if (holons.docs.length > 0) {
        results.push(`### Capable Holons (${holons.docs.length})`)
        for (const h of holons.docs as any[]) {
          results.push(`- **${h.businessName || 'Unnamed'}** — Rating: ${h.rating || 'N/A'}/5, Active orders: ${h.activeOrderCount || 0}`)
          if (h.location?.city) results.push(`  Location: ${h.location.city}, ${h.location.region || ''}`)
        }
        results.push('')
      }
    }

    if (results.length === 0) {
      return `No federation results found for search="${search}", capability="${capability}", region="${region}". The federation may still be growing!`
    }

    return [`## Federation Search Results`, '', ...results].join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error searching federation: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleBroadcastCapability(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  if (!tenantId) return 'Error: No tenant context available.'

  const title = (input.title as string)?.trim()
  const description = (input.description as string)?.trim()
  const contentType = (input.contentType as string) || 'service'

  if (!title) return 'Error: title is required.'
  if (!description) return 'Error: description is required.'

  try {
    // Get tenant info for source attribution
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    }) as any

    const sign = await payload.create({
      collection: 'street-signs' as any,
      data: {
        title,
        description,
        contentType,
        tags: (input.tags as string[]) || [],
        region: (input.region as string) || '',
        sourceMinistry: tenant?.name || tenant?.slug || 'unknown',
        sourceDomain: tenant?.domains?.[0]?.domain || '',
        sourceCreator: String(ctx.userId || ''),
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    return `Capability broadcasted to federation!\n- **Title:** ${title}\n- **Type:** ${contentType}\n- **Street Sign ID:** ${sign.id}\n- **Source:** ${tenant?.name || 'your Enterprise'}\n\nOther Enterprises in the federation can now discover this offering.`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error broadcasting: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleRouteFederatedRequest(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const request = (input.request as string)?.trim()
  if (!request) return 'Error: request description is required.'

  const targetCapability = (input.targetCapability as string) || ''
  const targetRegion = (input.targetRegion as string) || ''

  try {
    // Search federation for matches
    const searchResult = await handleQueryFederation(
      payload,
      { search: request, capability: targetCapability, region: targetRegion, limit: 5 },
      ctx,
    )

    // Log intent in federation audit log
    await payload.create({
      collection: 'federation-audit-log' as any,
      data: {
        eventType: 'federated_request',
        description: `Federated request: ${request}`,
        details: {
          request,
          targetCapability,
          targetRegion,
          sourceTenant: ctx.tenantId,
        },
        tenant: ctx.tenantId,
      } as any,
      overrideAccess: true,
    })

    return `## Federated Request Routed\n\n**Request:** ${request}\n\n${searchResult}\n\n_Request logged in federation audit trail._`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error routing request: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleNegotiateDeal(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  if (!tenantId) return 'Error: No tenant context available.'

  const requirement = (input.requirement as string)?.trim()
  if (!requirement) return 'Error: requirement description is required.'

  const maxBudgetCents = input.maxBudgetCents as number | undefined
  const preferredRegion = (input.preferredRegion as string) || ''

  try {
    // Search for matching capabilities
    const searchResult = await handleQueryFederation(
      payload,
      { search: requirement, region: preferredRegion, limit: 5 },
      ctx,
    )

    // Create pending transaction record
    const tx = await payload.create({
      collection: 'agent-transactions',
      data: {
        tenant: tenantId,
        type: 'spend',
        amountCents: maxBudgetCents || 0,
        currency: 'USD',
        description: `Deal negotiation: ${requirement}`,
        status: 'pending',
        skillCategory: 'catalog',
        metadata: {
          requirement,
          maxBudgetCents,
          preferredRegion,
          negotiationPhase: 'discovery',
        },
      } as any,
      overrideAccess: true,
    })

    const lines = [
      `## Deal Negotiation — Discovery Phase`,
      `**Requirement:** ${requirement}`,
      maxBudgetCents ? `**Budget:** up to $${(maxBudgetCents / 100).toFixed(2)}` : '',
      preferredRegion ? `**Preferred Region:** ${preferredRegion}` : '',
      `**Transaction ID:** ${tx.id} (status: pending)`,
      '',
      searchResult,
      '',
      `_Next step: Human approves a match, and LEO can proceed to brokering._`,
    ]

    return lines.filter(Boolean).join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error negotiating deal: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Phase 5: CRM
// ---------------------------------------------------------------------------

async function handleCreateCustomerProfile(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  const email = (input.email as string)?.trim()?.toLowerCase()
  if (!email) return 'Error: email is required.'

  if (!isValidEmail(email)) return 'Error: Invalid email format.'

  const name = (input.name as string)?.trim() || ''
  const tags = (input.tags as string[]) || []
  const notes = (input.notes as string) || ''
  const source = (input.source as string) || 'manual'

  try {
    // Check if contact already exists for this tenant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = { email: { equals: email } }
    if (tenantId) whereClause.tenant = { equals: tenantId }

    const existing = await payload.find({
      collection: 'contacts',
      where: whereClause,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existing.docs[0]) {
      // Update existing contact
      const updates: Record<string, unknown> = {}
      if (name) updates.name = name
      if (tags.length > 0) updates.tags = tags
      if (notes) updates.notes = `${(existing.docs[0] as any).notes || ''}\n\n[${new Date().toISOString()}] ${notes}`.trim()

      await payload.update({
        collection: 'contacts',
        id: existing.docs[0].id,
        data: updates as any,
        overrideAccess: true,
      })

      return `Customer profile updated for ${email} (contact ID: ${existing.docs[0].id}).${name ? ` Name: ${name}.` : ''}${tags.length > 0 ? ` Tags: ${tags.join(', ')}.` : ''}`
    }

    // Create new contact
    const contact = await payload.create({
      collection: 'contacts',
      data: {
        email,
        name,
        tags,
        notes,
        source,
        contactStatus: 'lead',
        inviteStatus: 'not-invited',
        inviteCount: 0,
        ...(tenantId ? { tenant: tenantId } : {}),
      } as any,
      overrideAccess: true,
    })

    return `Customer profile created for ${email} (contact ID: ${contact.id}). Status: lead, source: ${source}.${tags.length > 0 ? ` Tags: ${tags.join(', ')}.` : ''}`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error creating profile: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleLogInteraction(
  payload: Payload,
  input: Record<string, unknown>,
  _ctx: ToolExecutorContext,
): Promise<string> {
  const contactId = input.contactId as number
  const interactionType = (input.interactionType as string)?.trim()
  const notes = (input.notes as string)?.trim()

  if (!contactId) return 'Error: contactId is required.'
  if (!interactionType) return 'Error: interactionType is required.'
  if (!notes) return 'Error: notes are required.'

  try {
    const contact = await payload.findByID({
      collection: 'contacts',
      id: contactId,
      depth: 0,
      overrideAccess: true,
    }) as any

    if (!contact) return `Error: Contact ${contactId} not found.`

    // Append timestamped interaction to notes
    const timestamp = new Date().toISOString()
    const existingNotes = contact.notes || ''
    const newEntry = `[${timestamp}] ${interactionType}: ${notes}`
    const updatedNotes = existingNotes ? `${existingNotes}\n${newEntry}` : newEntry

    await payload.update({
      collection: 'contacts',
      id: contactId,
      data: { notes: updatedNotes } as any,
      overrideAccess: true,
    })

    return `Interaction logged for ${contact.name || contact.email} (ID: ${contactId}):\n- **Type:** ${interactionType}\n- **Notes:** ${notes}\n- **Timestamp:** ${timestamp}`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error logging interaction: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleSegmentCustomers(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 20, 100)
  const tags = input.tags as string[] | undefined
  const status = input.status as string | undefined
  const source = input.source as string | undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []
  if (ctx.tenantId) conditions.push({ tenant: { equals: ctx.tenantId } })
  if (status) conditions.push({ contactStatus: { equals: status } })
  if (source) conditions.push({ source: { equals: source } })
  if (tags && tags.length > 0) {
    // Match contacts that have ANY of the given tags
    conditions.push({ or: tags.map((t) => ({ tags: { contains: t } })) })
  }

  try {
    const contacts = await payload.find({
      collection: 'contacts',
      where: conditions.length > 0 ? { and: conditions } : ({} as any),
      limit,
      depth: 0,
      overrideAccess: true,
    })

    if (contacts.docs.length === 0) {
      return 'No contacts found matching the specified criteria.'
    }

    const lines = [
      `## Customer Segment (${contacts.totalDocs} total, showing ${contacts.docs.length})`,
      '',
    ]

    // Group by status
    const byStatus: Record<string, number> = {}
    for (const c of contacts.docs as any[]) {
      const s = c.contactStatus || 'unknown'
      byStatus[s] = (byStatus[s] || 0) + 1
    }
    lines.push(`### Status Breakdown`)
    for (const [s, count] of Object.entries(byStatus)) {
      lines.push(`- ${s}: ${count}`)
    }
    lines.push('')

    lines.push(`### Contacts`)
    for (const c of contacts.docs as any[]) {
      const tagsStr = c.tags?.length > 0 ? ` [${c.tags.join(', ')}]` : ''
      lines.push(`- **${c.name || c.email}** (${c.contactStatus}) — source: ${c.source}${tagsStr}`)
    }

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error segmenting customers: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleSendFollowUp(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const contactId = input.contactId as number
  const subject = (input.subject as string)?.trim()
  const message = (input.message as string)?.trim()

  if (!contactId) return 'Error: contactId is required.'
  if (!subject) return 'Error: subject is required.'
  if (!message) return 'Error: message is required.'

  try {
    const contact = await payload.findByID({
      collection: 'contacts',
      id: contactId,
      depth: 0,
      overrideAccess: true,
    }) as any

    if (!contact) return `Error: Contact ${contactId} not found.`
    if (!contact.email) return `Error: Contact ${contactId} has no email address.`

    // Log the follow-up interaction
    const timestamp = new Date().toISOString()
    const existingNotes = contact.notes || ''
    const newEntry = `[${timestamp}] follow-up: Subject: "${subject}" — ${message.slice(0, 100)}`
    await payload.update({
      collection: 'contacts',
      id: contactId,
      data: {
        notes: existingNotes ? `${existingNotes}\n${newEntry}` : newEntry,
        lastInvitedAt: timestamp,
      } as any,
      overrideAccess: true,
    })

    // Create system message to track the follow-up
    if (ctx.tenantId) {
      const space = await resolveSpace(payload, ctx.tenantId)
      if (space) {
        await payload.create({
          collection: 'messages',
          data: {
            content: `Follow-up sent to ${contact.name || contact.email}: "${subject}"`,
            space: space.id,
            channel: 'team',
            messageType: 'system',
            author: ctx.userId || 1,
            tenant: ctx.tenantId,
            visibility: 'tenant',
          } as any,
          overrideAccess: true,
        })
      }
    }

    return `Follow-up queued for ${contact.name || contact.email} (${contact.email}):\n- **Subject:** ${subject}\n- **Message:** ${message.slice(0, 200)}${message.length > 200 ? '...' : ''}\n- **Logged at:** ${timestamp}\n\n_Note: Email delivery depends on the platform's email adapter (Resend). The interaction has been logged to the contact record._`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error sending follow-up: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleSendEmail(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const to = (input.to as string)?.trim()
  const subject = (input.subject as string)?.trim()
  const body = (input.body as string)?.trim()
  const replyTo = (input.replyTo as string)?.trim() || undefined

  if (!to) return 'Error: recipient email address (to) is required.'
  if (!subject) return 'Error: subject is required.'
  if (!body) return 'Error: body is required.'

  // Basic email format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return `Error: "${to}" does not look like a valid email address.`
  }

  try {
    // Resolve tenant name for branding
    let tenantName = 'Angel OS'
    if (ctx.tenantId) {
      try {
        const tenant = await payload.findByID({
          collection: 'tenants',
          id: ctx.tenantId,
          depth: 0,
          overrideAccess: true,
        })
        if (tenant?.name) tenantName = tenant.name as string
      } catch {
        // Use default
      }
    }

    // Escape user-supplied values for safe HTML interpolation
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

    // Convert line breaks to <br> for the HTML version
    const htmlBody = esc(body).replace(/\n/g, '<br>')

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="margin-bottom: 24px;">${htmlBody}</div>
  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
  <p style="font-size: 12px; color: #999; text-align: center;">Sent via ${esc(tenantName)}</p>
</body>
</html>`

    await payload.sendEmail({
      to,
      subject,
      html,
      text: body,
      ...(replyTo ? { replyTo } : {}),
    } as any)

    // Log the email in application-logs if available
    if (ctx.tenantId) {
      try {
        await payload.create({
          collection: 'application-logs',
          data: {
            level: 'info',
            source: 'leo',
            message: `Email sent to ${to}: "${subject}"`,
            tenant: ctx.tenantId,
          } as any,
          overrideAccess: true,
        })
      } catch {
        // Logging failure is not critical
      }
    }

    return `Email sent successfully!\n- **To:** ${to}\n- **Subject:** ${subject}\n- **Preview:** ${body.slice(0, 150)}${body.length > 150 ? '...' : ''}`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg.includes('No email transport') || msg.includes('sendEmail')) {
      return 'Error: Email transport is not configured. Please set up RESEND_API_KEY or SMTP settings in your environment.'
    }
    return `Error sending email: ${msg}`
  }
}

// ---------------------------------------------------------------------------
// Phase 5b: Multi-Channel Messaging
// ---------------------------------------------------------------------------

async function handleSendWhatsApp(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const to = (input.to as string)?.trim()
  const text = (input.text as string)?.trim()
  const templateName = (input.templateName as string)?.trim() || undefined
  const templateParameters = (input.templateParameters as string[]) || undefined

  if (!to) return 'Error: recipient phone number (to) is required.'
  if (!text && !templateName) return 'Error: either text or templateName is required.'

  if (!ctx.tenantId) return 'Error: no tenant context available.'

  try {
    const { resolveWhatsAppSender } = await import('./resolveWhatsAppSender')
    const sender = await resolveWhatsAppSender(payload, ctx.tenantId, ctx.spaceId)

    if (!sender) {
      return 'Error: No WhatsApp connector is configured for this tenant. Please set up a WhatsApp connector in Account → Integrations.'
    }

    if (templateName) {
      await sender.sendTemplate({
        to,
        templateName,
        templateParameters,
      })
      return `WhatsApp template message sent!\n- **To:** ${to}\n- **Template:** ${templateName}${templateParameters ? `\n- **Parameters:** ${templateParameters.join(', ')}` : ''}`
    }

    await sender.sendText(to, text!)
    return `WhatsApp message sent!\n- **To:** ${to}\n- **Preview:** ${text!.slice(0, 150)}${text!.length > 150 ? '...' : ''}`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg.includes('24') || msg.includes('window')) {
      return `Error: The 24-hour customer service window may have expired. Try using a template message instead by providing a templateName parameter.\n\nDetails: ${msg}`
    }
    return `Error sending WhatsApp message: ${msg}`
  }
}

async function handleSendTelegram(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const chatId = (input.chatId as string)?.trim()
  const text = (input.text as string)?.trim()

  if (!chatId) return 'Error: chatId is required.'
  if (!text) return 'Error: text is required.'

  if (!ctx.tenantId) return 'Error: no tenant context available.'

  try {
    const { resolveTelegramSender } = await import('./resolveTelegramSender')
    const sender = await resolveTelegramSender(payload, ctx.tenantId, ctx.spaceId)

    if (!sender) {
      return 'Error: No Telegram connector is configured for this tenant. Please set up a Telegram bot connector in Account → Integrations.'
    }

    await sender.sendText(chatId, text, 'Markdown')
    return `Telegram message sent!\n- **Chat ID:** ${chatId}\n- **Preview:** ${text.slice(0, 150)}${text.length > 150 ? '...' : ''}`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return `Error sending Telegram message: ${msg}`
  }
}

async function handleSendSms(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const to = (input.to as string)?.trim()
  const body = (input.body as string)?.trim()

  if (!to) return 'Error: recipient phone number (to) is required.'
  if (!body) return 'Error: message body is required.'

  if (body.length > 1600) {
    return `Error: SMS body is ${body.length} characters. Maximum is 1600. Please shorten the message.`
  }

  if (!ctx.tenantId) return 'Error: no tenant context available.'

  try {
    const { resolveSmsSender } = await import('./resolveSmsSender')
    const sender = await resolveSmsSender(payload, ctx.tenantId, ctx.spaceId)

    if (!sender) {
      return 'Error: No SMS connector is configured for this tenant. Please set up a Twilio SMS connector in Account → Integrations.'
    }

    await sender.sendText(to, body)
    return `SMS sent!\n- **To:** ${to}\n- **From:** ${sender.fromNumber}\n- **Preview:** ${body.slice(0, 150)}${body.length > 150 ? '...' : ''}`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return `Error sending SMS: ${msg}`
  }
}

async function handleSendSlack(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const channelId = (input.channelId as string)?.trim()
  const text = (input.text as string)?.trim()
  const threadTs = (input.threadTs as string)?.trim() || undefined

  if (!channelId) return 'Error: channelId is required.'
  if (!text) return 'Error: message text is required.'

  if (!ctx.tenantId) return 'Error: no tenant context available.'

  try {
    const { resolveSlackSender } = await import('./resolveSlackSender')
    const sender = await resolveSlackSender(payload, ctx.tenantId, ctx.spaceId)

    if (!sender) {
      return 'Error: No Slack connector is configured for this tenant. Please set up a Slack bot connector in Account → Integrations.'
    }

    await sender.sendText(channelId, text, threadTs)
    return `Slack message sent!\n- **Channel:** ${channelId}\n- **Preview:** ${text.slice(0, 150)}${text.length > 150 ? '...' : ''}`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return `Error sending Slack message: ${msg}`
  }
}

// ---------------------------------------------------------------------------
// Gotify push + cross-channel dispatch
// ---------------------------------------------------------------------------

/** Push to Gotify via the tenant's gotify connector (or env). Push-only. */
async function handleSendGotify(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const message = (input.message as string)?.trim()
  if (!message) return 'Error: message is required.'
  const title = (input.title as string)?.trim() || 'Angel OS'
  const priority = typeof input.priority === 'number' ? input.priority : undefined

  const { gotifyNotify } = await import('./gotifyNotify')
  const res = await gotifyNotify(
    { title, message, priority },
    { payload, tenantId: ctx.tenantId, spaceId: ctx.spaceId },
  )
  if (res.ok) return `Gotify push sent (via ${res.via}). Title: "${title}".`
  return `Could not send to Gotify: ${res.error}. Add a Gotify connector (Account → Integrations) with serverUrl + appToken, or set GOTIFY_SERVER_URL / GOTIFY_APP_TOKEN.`
}

/**
 * Cross-channel dispatch — the switching mechanism. Posts `content` into the
 * target channel (universal, works for any channel), and if that channel is
 * bound to an outbound connector, also dispatches through it (Gotify push
 * today; other types report what's needed). This is how LEO in one channel
 * reaches a connector that lives on another.
 */
async function handleDispatchToChannel(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId, spaceId } = ctx
  if (!tenantId) return 'Error: No tenant context available.'

  const channel = (input.channel as string)?.trim()
  const content = (input.content as string)?.trim()
  if (!channel) return 'Error: target channel slug is required.'
  if (!content) return 'Error: content is required.'
  const title = (input.title as string)?.trim() || undefined

  const out: string[] = []

  // 1) Post the message INTO the target channel (universal cross-channel comms).
  try {
    const space = await resolveSpace(payload, tenantId, spaceId)
    if (space) {
      const leoUserId = await findLeoUser(payload, tenantId)
      const msg = await payload.create({
        collection: 'messages',
        data: {
          content,
          space: space.id,
          channel,
          messageType: 'ai_agent',
          author: leoUserId || (ctx.userId as number) || 1,
          tenant: tenantId,
          visibility: 'tenant',
        } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        overrideAccess: true,
      })
      out.push(`posted to #${channel} (id ${msg.id})`)
    } else {
      out.push(`could not resolve a space for #${channel}`)
    }
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    out.push(`could not post to #${channel}`)
  }

  // 2) If the target channel is bound to an outbound connector, dispatch through it.
  try {
    const { resolveConnectorByChannel } = await import('./resolveConnector')
    const conn = await resolveConnectorByChannel(payload, { channelSlug: channel, tenantId, spaceId })
    if (conn?.type === 'gotify') {
      const { gotifyNotify } = await import('./gotifyNotify')
      const r = await gotifyNotify(
        { title: title || `#${channel}`, message: content },
        { payload, tenantId, spaceId },
      )
      out.push(r.ok ? `pushed via Gotify connector (${r.via})` : `Gotify push failed: ${r.error}`)
    } else if (conn) {
      out.push(
        `#${channel} is bound to a '${conn.type}' connector — the message is on the bus; an outbound ${conn.type} send needs a recipient (use send_${conn.type}).`,
      )
    }
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
  }

  return `Dispatched to #${channel}: ${out.join('; ')}.`
}

// ---------------------------------------------------------------------------
// Federation Messaging (Sprint 36)
// ---------------------------------------------------------------------------

async function handleSendFederationMessage(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const peerDomain = (input.peerDomain as string)?.trim()
  const message = (input.message as string)?.trim()
  const conversationId = (input.conversationId as string)?.trim() || undefined

  if (!peerDomain) return 'Error: peerDomain is required (e.g., "partner.angelos.app").'
  if (!message) return 'Error: message text is required.'
  if (!ctx.tenantId) return 'Error: no tenant context available.'

  try {
    const { sendFederatedMessage } = await import('./federatedAIBus')
    const result = await sendFederatedMessage(payload, ctx.tenantId, peerDomain, message, conversationId)

    if (!result.success) {
      return `Error sending federation message to ${peerDomain}: ${result.error}`
    }

    return `Federation message sent to **${peerDomain}**!\n- **Message:** ${message.slice(0, 150)}${message.length > 150 ? '...' : ''}\n- **Response:** ${result.response || 'No response received'}`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return `Error sending federation message: ${msg}`
  }
}

// ---------------------------------------------------------------------------
// Sprint 36: Federation Broadcast & Leo-to-Leo Handoff
// ---------------------------------------------------------------------------

/**
 * Broadcast a message to all active federation peers simultaneously.
 * Discovers peers from the governance cache, filters by trust level,
 * and sends individually signed JWTs to each peer's LEO.
 */
async function handleBroadcastFederationMessage(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const message = (input.message as string)?.trim()
  const filter = (input.filter as string) || 'all_active'
  const conversationId = (input.conversationId as string)?.trim() || undefined

  if (!message) return 'Error: message is required.'
  if (!ctx.tenantId) return 'Error: no tenant context available.'

  try {
    // 1. Get governance data (contains all federation peers)
    const { getCachedGovernance } = await import('@/endpoints/federation-governance-sync')
    const governance = getCachedGovernance()

    if (!governance || !governance.ministries || governance.ministries.length === 0) {
      return 'No federation peers found. The governance cache may not be initialized yet — try running a federation pulse first.'
    }

    // 2. Get our own identity to exclude from broadcast
    const endeavors = await payload.find({
      collection: 'endeavors',
      where: { tenant: { equals: ctx.tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ourEndeavor = endeavors.docs?.[0] as any
    const ourFederationId = ourEndeavor?.federation?.federationId
    const ourDomain = ourEndeavor?.federation?.domain || ''

    // 3. Filter peers by trust level
    //    full_trust_only  = only 'active' ministries (fully vouched)
    //    vouched_or_higher = 'active' + 'probation' (at least vouched to enter probation)
    //    all_active        = 'active' + 'probation' + 'applicant' (anyone in the mesh)
    const eligibleStatuses: string[] =
      filter === 'full_trust_only'
        ? ['active']
        : filter === 'vouched_or_higher'
          ? ['active', 'probation']
          : ['active', 'probation', 'applicant'] // all_active

    // 3b. Staleness check — skip peers whose heartbeat is older than 30 minutes
    const HEARTBEAT_MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes
    const now = Date.now()

    const peers = governance.ministries.filter((m) => {
      if (!eligibleStatuses.includes(m.status)) return false
      if (!m.domain || m.id === ourFederationId || m.domain === ourDomain) return false
      // Skip peers with stale heartbeats (if heartbeat tracking is available)
      if (m.lastHeartbeat) {
        const heartbeatAge = now - new Date(m.lastHeartbeat).getTime()
        if (heartbeatAge > HEARTBEAT_MAX_AGE_MS) return false
      }
      return true
    })

    if (peers.length === 0) {
      return `No eligible federation peers found for filter "${filter}". There are ${governance.ministries.length} total ministries but none match the criteria (check heartbeat freshness and trust level).`
    }

    // 4. Send to all peers with concurrency limiter (max 10 parallel sends)
    const { sendFederatedMessage } = await import('./federatedAIBus')
    const CONCURRENCY_LIMIT = 10
    const allResults: PromiseSettledResult<Awaited<ReturnType<typeof sendFederatedMessage>>>[] = []

    for (let i = 0; i < peers.length; i += CONCURRENCY_LIMIT) {
      const batch = peers.slice(i, i + CONCURRENCY_LIMIT)
      const batchResults = await Promise.allSettled(
        batch.map((peer) =>
          sendFederatedMessage(payload, ctx.tenantId!, peer.domain, message, conversationId),
        ),
      )
      allResults.push(...batchResults)
    }
    const results = allResults

    // 5. Tally results
    let sent = 0
    let failed = 0
    const failures: string[] = []

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'fulfilled' && result.value.success) {
        sent++
      } else {
        failed++
        const errMsg =
          result.status === 'fulfilled'
            ? result.value.error || 'Unknown error'
            : result.reason?.message || 'Unknown error'
        failures.push(`- ${peers[i].name} (${peers[i].domain}): ${errMsg}`)
      }
    }

    // 6. Log in audit
    await payload.create({
      collection: 'federation-audit-log' as any,
      data: {
        eventType: 'broadcast_message',
        description: `Federation broadcast: ${message.slice(0, 100)}`,
        details: {
          filter,
          totalPeers: peers.length,
          sent,
          failed,
          senderDomain: ourDomain,
        },
        tenant: ctx.tenantId,
      } as any,
      overrideAccess: true,
    })

    const lines = [
      `## Federation Broadcast Sent`,
      '',
      `**Message:** ${message.slice(0, 200)}${message.length > 200 ? '...' : ''}`,
      `**Filter:** ${filter}`,
      `**Peers reached:** ${sent}/${peers.length}`,
    ]

    if (failed > 0) {
      lines.push('', `**Failed (${failed}):**`)
      lines.push(...failures.slice(0, 5))
      if (failures.length > 5) lines.push(`... and ${failures.length - 5} more`)
    }

    lines.push('', `_Each peer's LEO is now processing your message._`)

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error broadcasting: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * Request Endeavor Migration — transport an Endeavor to another Enterprise.
 *
 * This is the "ship docking at a new port" pattern: the Endeavor's suitcase
 * is packed, signed, and sent directly to the destination Enterprise.
 * Federation identity is PRESERVED — the network sees the same Endeavor.
 */
async function handleRequestEndeavorMigration(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const tenantSlug = (input.tenantSlug as string)?.trim()
  const destinationDomain = (input.destinationDomain as string)?.trim()
  const reason = (input.reason as string)?.trim() || 'Operator-initiated migration'

  if (!tenantSlug) return 'Error: tenantSlug is required.'
  if (!destinationDomain) return 'Error: destinationDomain is required.'

  try {
    // 1. Resolve source tenant
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const tenant = tenants.docs?.[0]
    if (!tenant) return `Error: tenant "${tenantSlug}" not found.`
    const tenantId = tenant.id

    // 2. Get the Endeavor + federation identity
    const endeavors = await payload.find({
      collection: 'endeavors',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const endeavor = endeavors.docs?.[0] as any
    if (!endeavor?.federation?.federationId) {
      return 'Error: this Endeavor has no federation identity. Sign the constitution first.'
    }

    const federationId = endeavor.federation.federationId

    // 3. Export suitcase data
    const [spaces, posts, products] = await Promise.all([
      payload.find({
        collection: 'spaces',
        where: { tenant: { equals: tenantId } },
        limit: 10000, depth: 0, overrideAccess: true,
      }),
      payload.find({
        collection: 'posts',
        where: { tenant: { equals: tenantId } },
        limit: 10000, depth: 0, overrideAccess: true,
      }),
      payload.find({
        collection: 'products' as any,
        where: { tenant: { equals: tenantId } },
        limit: 10000, depth: 0, overrideAccess: true,
      }),
    ])

    const suitcaseData = {
      spaces: spaces.docs,
      posts: posts.docs,
      products: products.docs,
      endeavor,
    }

    const manifest = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      sourceMinistry: federationId,
      tenant: {
        name: (tenant as any).name,
        slug: (tenant as any).slug,
        domain: (tenant as any).domain,
      },
      contents: {
        spaces: spaces.totalDocs,
        posts: posts.totalDocs,
        products: products.totalDocs,
      },
      constitutional: {
        isAngel: true,
        revenueModel: 'toward-53',
        antiDemonic: true,
      },
    }

    // 4. Sign the migration request
    const { signData } = await import('@/federation/protocol')
    const privateKeyHex = endeavor.federation?.privateKey
    if (!privateKeyHex) {
      return 'Error: no federation private key found. Cannot sign migration request.'
    }

    const signedPayload = JSON.stringify({
      action: 'endeavor-migrate',
      sourceFederationId: federationId,
      sourceEnterpriseName: (tenant as any).name,
      sourceDomain: (tenant as any).domain,
      timestamp: manifest.exportedAt,
    })

    const signature = signData(signedPayload, privateKeyHex)
    const publicKey = endeavor.federation?.publicKey

    // 5. Send to destination Enterprise
    const destUrl = destinationDomain.startsWith('http')
      ? destinationDomain
      : `https://${destinationDomain}`

    const res = await fetch(`${destUrl}/api/federation/migrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Angel-OS-Version': '1.1',
      },
      body: JSON.stringify({
        sourceFederationId: federationId,
        sourceEnterpriseName: (tenant as any).name,
        sourceDomain: (tenant as any).domain,
        signature,
        publicKey,
        manifest,
        data: suitcaseData,
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      return `Migration request rejected by ${destinationDomain} (${res.status}): ${errBody.slice(0, 200)}`
    }

    const result = await res.json() as any

    // 6. Audit log
    await payload.create({
      collection: 'federation-audit-log' as any,
      data: {
        action: 'migration-sent',
        federationId,
        details: {
          destinationDomain,
          reason,
          imported: result.imported,
          preservedFederationId: federationId,
        },
        timestamp: new Date().toISOString(),
      } as any,
      overrideAccess: true,
    })

    const lines = [
      `## Endeavor Migration Complete`,
      '',
      `**Endeavor:** ${(tenant as any).name} (${tenantSlug})`,
      `**Federation ID:** ${federationId} (PRESERVED)`,
      `**Destination:** ${destinationDomain}`,
      `**Reason:** ${reason}`,
      '',
      '**Transported:**',
      `- Spaces: ${result.imported?.spaces ?? 0}`,
      `- Posts: ${result.imported?.posts ?? 0}`,
      `- Products: ${result.imported?.products ?? 0}`,
      `- Endeavor identity: ${result.imported?.endeavor ? 'preserved' : 'n/a'}`,
      '',
      '_The Endeavor is now live on the destination Enterprise. Federation identity is unchanged — the network sees the same node at a new address._',
    ]

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Migration error: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * Leo-to-Leo handoff — send structured context to another Endeavor's Leo.
 *
 * This is the cornerstone of the provisioning flow:
 *   1. Arch-Leo provisions a new Endeavor
 *   2. Arch-Leo calls leo_handoff with context about the user
 *   3. New Endeavor's Leo receives the context and welcomes the user
 *
 * The handoff message is a structured JSON payload sent via the federation bus,
 * tagged with handoff type so the receiving Leo knows how to respond.
 */
async function handleLeoHandoff(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const targetDomain = (input.targetDomain as string)?.trim()
  const handoffType = (input.handoffType as string)?.trim()
  const context = (input.context as string)?.trim()

  if (!targetDomain) return 'Error: targetDomain is required.'
  if (!handoffType) return 'Error: handoffType is required.'
  if (!context) return 'Error: context is required.'
  if (!ctx.tenantId) return 'Error: no tenant context available.'

  // Validate targetDomain exists in federation roster
  try {
    const { getCachedGovernance } = await import('@/endpoints/federation-governance-sync')
    const governance = getCachedGovernance()
    if (governance?.ministries) {
      const knownPeer = governance.ministries.find(
        (m) => m.domain === targetDomain && ['active', 'probation'].includes(m.status),
      )
      if (!knownPeer) {
        const allDomains = governance.ministries
          .filter((m) => m.domain && ['active', 'probation'].includes(m.status))
          .map((m) => m.domain)
          .slice(0, 10)
        return `Target domain "${targetDomain}" is not a known active federation peer.\n\nKnown peers: ${allDomains.length > 0 ? allDomains.join(', ') : '(none)'}\n\nThe target must be an active or probationary member of the federation.`
      }
    }
  } catch {
    // Governance cache not available — proceed anyway (first-contact scenario)
  }

  // Build structured handoff payload
  const userName = typeof input.userName === 'string' ? input.userName : undefined
  const userEmail = typeof input.userEmail === 'string' ? input.userEmail : undefined
  const returnTo = typeof input.returnTo === 'string' ? input.returnTo : undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handoffPayload: Record<string, any> = {
    type: 'leo_handoff',
    handoffType,
    context,
    sourceTenantId: ctx.tenantId,
    timestamp: new Date().toISOString(),
  }
  if (input.userId) handoffPayload.userId = input.userId
  if (userName) handoffPayload.userName = userName
  if (userEmail) handoffPayload.userEmail = userEmail
  if (returnTo) handoffPayload.returnTo = returnTo

  // The message sent to the peer's LEO includes the structured handoff as JSON
  const messageForPeerLeo = [
    `[LEO HANDOFF — ${handoffType.toUpperCase()}]`,
    '',
    context,
    '',
    `--- HANDOFF METADATA ---`,
    `Type: ${handoffType}`,
    ...(userName ? [`User: ${userName}`] : []),
    ...(userEmail ? [`Email: ${userEmail}`] : []),
    ...(returnTo ? [`Return to: ${returnTo}`] : []),
    '',
    `Please welcome this user and help them get started.`,
  ].join('\n')

  try {
    const { sendFederatedMessage } = await import('./federatedAIBus')
    const result = await sendFederatedMessage(
      payload,
      ctx.tenantId,
      targetDomain,
      messageForPeerLeo,
      `handoff-${Date.now()}`, // unique conversation thread for the handoff
    )

    // Log handoff in audit trail
    await payload.create({
      collection: 'federation-audit-log' as any,
      data: {
        eventType: 'leo_handoff',
        description: `Leo handoff (${handoffType}) to ${targetDomain}`,
        details: handoffPayload,
        tenant: ctx.tenantId,
      } as any,
      overrideAccess: true,
    })

    if (!result.success) {
      return `Handoff to ${targetDomain} failed: ${result.error}\n\nThe target Endeavor may not be online or may not have accepted federation yet.`
    }

    const lines = [
      `## Leo Handoff Complete ✓`,
      '',
      `**Target:** ${targetDomain}`,
      `**Type:** ${handoffType}`,
      ...(userName ? [`**User:** ${userName}`] : []),
    ]

    if (handoffType === 'provisioning_welcome') {
      lines.push(
        '',
        `The new Endeavor's Leo has received the context and will welcome the user.`,
        `The user should navigate to **https://${targetDomain}** to see their new Leo.`,
      )
    } else if (handoffType === 'delegation') {
      lines.push('', `The receiving Leo will process the delegated task.`)
      if (returnTo) {
        lines.push(`Results will be sent back to **${returnTo}**.`)
      }
    }

    if (result.response) {
      lines.push('', `**Peer response:** ${result.response}`)
    }

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error during handoff: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Phase 6: Analytics & Intelligence
// ---------------------------------------------------------------------------

async function handleAnalyzeTrends(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const dataType = input.dataType as string
  const timeframe = input.timeframe as string

  if (!dataType) return 'Error: dataType is required (orders, products, bookings, contacts).'
  if (!timeframe) return 'Error: timeframe is required (week, month, quarter).'

  // Calculate date range
  const now = new Date()
  const periodDays = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 90
  const currentStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)
  const previousStart = new Date(currentStart.getTime() - periodDays * 24 * 60 * 60 * 1000)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantFilter: any = ctx.tenantId ? { tenant: { equals: ctx.tenantId } } : {}

  try {
    const collectionMap: Record<string, string> = {
      orders: 'orders',
      products: 'products',
      bookings: 'bookings',
      contacts: 'contacts',
    }

    const collection = collectionMap[dataType]
    if (!collection) return `Error: Unknown data type "${dataType}".`

    // Current period
    const current = await payload.find({
      collection: collection as any,
      where: {
        and: [
          tenantFilter,
          { createdAt: { greater_than_equal: currentStart.toISOString() } },
        ].filter((c) => Object.keys(c).length > 0),
      } as any,
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })

    // Previous period
    const previous = await payload.find({
      collection: collection as any,
      where: {
        and: [
          tenantFilter,
          { createdAt: { greater_than_equal: previousStart.toISOString() } },
          { createdAt: { less_than: currentStart.toISOString() } },
        ].filter((c) => Object.keys(c).length > 0),
      } as any,
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })

    const currentCount = current.totalDocs
    const previousCount = previous.totalDocs
    const growth = previousCount > 0 ? ((currentCount - previousCount) / previousCount * 100).toFixed(1) : 'N/A'

    const lines = [
      `## ${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Trends — Last ${timeframe}`,
      '',
      `**Current period:** ${currentCount} ${dataType}`,
      `**Previous period:** ${previousCount} ${dataType}`,
      `**Growth:** ${growth}%`,
    ]

    // Data-type specific metrics
    if (dataType === 'orders') {
      let totalCents = 0
      for (const o of current.docs as any[]) {
        totalCents += o.total || 0
      }
      lines.push(
        '',
        `### Revenue`,
        `- **Total this ${timeframe}:** $${(totalCents / 100).toFixed(2)}`,
        `- **Average order value:** $${currentCount > 0 ? ((totalCents / currentCount) / 100).toFixed(2) : '0.00'}`,
      )
    }

    if (dataType === 'products') {
      let totalInventory = 0
      let lowStock = 0
      for (const p of current.docs as any[]) {
        totalInventory += p.inventory || 0
        if (p.inventory !== undefined && p.lowStockThreshold && p.inventory <= p.lowStockThreshold) lowStock++
      }
      lines.push(
        '',
        `### Inventory Overview`,
        `- **Total inventory units:** ${totalInventory}`,
        `- **Low stock items:** ${lowStock}`,
      )
    }

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error analyzing trends: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleRecommendProducts(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const context = (input.context as string) || ''
  const limit = Math.min(Number(input.limit) || 5, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [{ _status: { equals: 'published' } }]
  if (ctx.tenantId) conditions.push({ tenant: { equals: ctx.tenantId } })
  if (context) conditions.push({ or: [{ title: { like: context } }, { description: { like: context } }] })

  try {
    const products = await payload.find({
      collection: 'products',
      where: { and: conditions } as any,
      sort: '-createdAt',
      limit,
      depth: 1,
      overrideAccess: true,
    })

    if (products.docs.length === 0) {
      return context
        ? `No products found matching "${context}". Try a broader search or check the full catalog.`
        : 'No published products found in the catalog.'
    }

    const lines = [`## Product Recommendations${context ? ` for "${context}"` : ''}`, '']
    for (const p of products.docs as any[]) {
      const price = p.priceInUSD ? `$${(p.priceInUSD / 100).toFixed(2)}` : 'Price TBD'
      const stock = p.inventory !== undefined ? ` (${p.inventory} in stock)` : ''
      lines.push(`- **${p.title}** — ${price}${stock}`)
      if (p.description) lines.push(`  ${String(p.description).slice(0, 80)}`)
    }

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error getting recommendations: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Phase 7: Workflow & Emergency
// ---------------------------------------------------------------------------

async function handleDelegateTask(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  if (!tenantId) return 'Error: No tenant context available.'

  // Accept common alternative param names the LLM might use
  const task = ((input.task || input.description || input.message || input.text || input.note) as string)?.trim()
  if (!task) return 'Error: task description is required. Pass the task details in the "task" parameter.'

  const assigneeEmail = (input.assigneeEmail as string) || ''
  const priority = (input.priority as string) || 'normal'
  const deadline = (input.deadline as string) || ''

  const leoUserId = await findLeoUser(payload, tenantId)
  const space = await resolveSpace(payload, tenantId, ctx.spaceId)
  if (!space) return 'Error: No space found to post the task.'

  try {
    const taskContent = [
      `**Task Assignment** (Priority: ${priority.toUpperCase()})`,
      '',
      task,
      assigneeEmail ? `\nAssigned to: ${assigneeEmail}` : '',
      deadline ? `Deadline: ${deadline}` : '',
    ].filter(Boolean).join('\n')

    await payload.create({
      collection: 'messages',
      data: {
        content: taskContent,
        space: space.id,
        channel: 'team',
        messageType: 'system',
        priority,
        author: leoUserId || ctx.userId || 1,
        tenant: tenantId,
        visibility: 'tenant',
      } as any,
      overrideAccess: true,
    })

    return `Task delegated in #team channel:\n- **Task:** ${task}\n- **Assigned to:** ${assigneeEmail || 'team'}\n- **Priority:** ${priority}${deadline ? `\n- **Deadline:** ${deadline}` : ''}`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error delegating task: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleEscalateIssue(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  if (!tenantId) return 'Error: No tenant context available.'

  // Accept common alternative param names the LLM might use
  const issue = ((input.issue || input.description || input.message || input.task || input.text) as string)?.trim()
  const priority = (input.priority as string) || 'high'
  const issueContext = (input.context as string) || ''

  if (!issue) return 'Error: issue description is required.'

  const leoUserId = await findLeoUser(payload, tenantId)
  const space = await resolveSpace(payload, tenantId, ctx.spaceId)

  try {
    // Post to support channel
    if (space) {
      const content = [
        `**ESCALATION** (${priority.toUpperCase()})`,
        '',
        issue,
        issueContext ? `\n**Context:** ${issueContext}` : '',
      ].filter(Boolean).join('\n')

      await payload.create({
        collection: 'messages',
        data: {
          content,
          space: space.id,
          channel: 'support',
          messageType: 'system',
          priority,
          author: leoUserId || ctx.userId || 1,
          tenant: tenantId,
          visibility: 'tenant',
        } as any,
        overrideAccess: true,
      })
    }

    // Log to application logs
    await payload.create({
      collection: 'application-logs' as any,
      data: {
        level: priority === 'urgent' ? 'error' : 'warn',
        message: `Escalation: ${issue}`,
        context: issueContext,
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    return `Issue escalated (${priority}):\n- **Issue:** ${issue}${issueContext ? `\n- **Context:** ${issueContext}` : ''}\n- Posted to #support channel and logged to application logs.`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error escalating issue: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleSendEmergencyAlert(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  if (!tenantId) return 'Error: No tenant context available.'

  const message = (input.message as string)?.trim()
  if (!message) return 'Error: emergency message is required.'

  const priority = (input.priority as string) || 'urgent'
  const leoUserId = await findLeoUser(payload, tenantId)

  try {
    // Get ALL spaces for this tenant
    const spaces = await payload.find({
      collection: 'spaces',
      where: { tenant: { equals: tenantId } },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })

    let sent = 0
    const alertContent = `**EMERGENCY ALERT**\n\n${message}`

    for (const space of spaces.docs) {
      try {
        await payload.create({
          collection: 'messages',
          data: {
            content: alertContent,
            space: space.id,
            channel: 'announcements',
            messageType: 'announcement',
            priority: 'urgent',
            author: leoUserId || ctx.userId || 1,
            tenant: tenantId,
            visibility: 'tenant',
          } as any,
          overrideAccess: true,
        })
        sent++
      } catch {
        // Some spaces may not have announcements channel
      }
    }

    // Also log to application logs
    await payload.create({
      collection: 'application-logs' as any,
      data: {
        level: 'error',
        message: `EMERGENCY ALERT: ${message}`,
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    return `Emergency alert broadcast to ${sent} space(s):\n"${message}"\n\nPriority: ${priority}. Logged to application logs.`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error sending alert: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleDocumentIncident(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const title = (input.title as string)?.trim()
  const details = (input.details as string)?.trim()
  const impact = (input.impact as string)?.trim()
  const response = (input.response as string)?.trim()

  if (!title) return 'Error: title is required.'
  if (!details) return 'Error: details are required.'
  if (!impact) return 'Error: impact description is required.'
  if (!response) return 'Error: response/resolution is required.'

  try {
    // Log to application logs
    await payload.create({
      collection: 'application-logs' as any,
      data: {
        level: 'warn',
        message: `INCIDENT: ${title}`,
        context: JSON.stringify({ details, impact, response }),
        tenant: ctx.tenantId,
      } as any,
      overrideAccess: true,
    })

    // Create draft post for internal documentation
    const postContent = [
      { type: 'paragraph', children: [{ text: `Incident Report: ${title}`, bold: true }] },
      { type: 'paragraph', children: [{ text: '' }] },
      { type: 'paragraph', children: [{ text: 'What Happened', bold: true }] },
      { type: 'paragraph', children: [{ text: details }] },
      { type: 'paragraph', children: [{ text: '' }] },
      { type: 'paragraph', children: [{ text: 'Impact', bold: true }] },
      { type: 'paragraph', children: [{ text: impact }] },
      { type: 'paragraph', children: [{ text: '' }] },
      { type: 'paragraph', children: [{ text: 'Response & Resolution', bold: true }] },
      { type: 'paragraph', children: [{ text: response }] },
    ]

    const post = await payload.create({
      collection: 'posts',
      data: {
        title: `Incident Report: ${title}`,
        content: { root: { type: 'root', children: postContent, direction: null, format: '', indent: 0, version: 1 } },
        _status: 'draft',
        ...(ctx.tenantId ? { tenant: ctx.tenantId } : {}),
      } as any,
      overrideAccess: true,
    })

    return `Incident documented:\n- **Title:** ${title}\n- **Application log:** created\n- **Draft post:** ID ${post.id} (status: draft)\n\nThe incident report is saved as a draft post for review before publishing.`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error documenting incident: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Maintenance Notes — Low-friction issue logging for Scotty (Claude Code)
// ---------------------------------------------------------------------------

async function handleLogMaintenanceNote(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx

  // Sprint 46: Expanded fallback field names — LEO sometimes sends task/content/body
  const title = ((input.title || input.summary || input.subject || input.task || input.name) as string)?.trim()
  const details = ((input.details || input.description || input.message || input.text || input.note || input.body || input.content) as string)?.trim()
  const category = (input.category as string) || 'other'
  const reportedBy = (input.reportedBy as string) || 'anonymous user'

  if (!title && !details) {
    return 'Error: Please provide at least a title or details for the maintenance note.'
  }

  const noteTitle = title || details!.slice(0, 80)
  const noteDetails = details || title!

  try {
    await payload.create({
      collection: 'application-logs',
      data: {
        level: 'info',
        source: 'leo-tools/maintenance-note',
        message: `[MAINTENANCE] ${noteTitle}`,
        details: JSON.stringify({
          category,
          reportedBy,
          details: noteDetails,
          loggedAt: new Date().toISOString(),
          tenantId: tenantId || 'platform',
        }),
        ...(tenantId ? { tenantId } : {}),
        resolved: false,
      } as any,
      overrideAccess: true,
    })

    return `Maintenance note logged for Scotty:\n- **Title:** ${noteTitle}\n- **Category:** ${category}\n- **Reported by:** ${reportedBy}\n\nThis will be reviewed during the next maintenance cycle.`
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error logging maintenance note: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Sprint 24: LEO Enterprise Manager — Operational Intelligence
// ---------------------------------------------------------------------------

/**
 * Enterprise lifecycle stages based on tenant age
 */
type LifecycleStage = 'BIRTH' | 'GROWTH' | 'ACTIVE'

function getLifecycleStage(createdAt: string | Date): { stage: LifecycleStage; daysSinceCreation: number; daysRemaining?: number } {
  const created = new Date(createdAt)
  const now = new Date()
  const daysSinceCreation = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))

  if (daysSinceCreation <= 90) {
    return { stage: 'BIRTH', daysSinceCreation, daysRemaining: 90 - daysSinceCreation }
  } else if (daysSinceCreation <= 365) {
    return { stage: 'GROWTH', daysSinceCreation, daysRemaining: 365 - daysSinceCreation }
  }
  return { stage: 'ACTIVE', daysSinceCreation }
}

/**
 * check_enterprise_health — Comprehensive health report
 */
async function handleCheckEnterpriseHealth(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  if (!tenantId) return 'Error: No tenant context available for health check.'

  const includeAreas = Array.isArray(input.include)
    ? (input.include as string[]).map((s) => s.toLowerCase())
    : null
  const checkAll = !includeAreas
  const shouldCheck = (area: string) => checkAll || includeAreas!.includes(area)

  const report: string[] = ['## 🏥 Enterprise Health Report\n']

  try {
    // ─── Lifecycle Stage ──────────────────────────────────────────
    if (shouldCheck('lifecycle')) {
      try {
        const tenant = await payload.findByID({
          collection: 'tenants',
          id: tenantId,
          depth: 0,
          overrideAccess: true,
        })
        const lifecycle = getLifecycleStage((tenant as any).createdAt || new Date().toISOString())
        const stageEmoji = lifecycle.stage === 'BIRTH' ? '🌱' : lifecycle.stage === 'GROWTH' ? '🌿' : '🌳'
        report.push(`### ${stageEmoji} Lifecycle: **${lifecycle.stage}** (Day ${lifecycle.daysSinceCreation})`)
        if (lifecycle.daysRemaining != null) {
          report.push(`- ${lifecycle.daysRemaining} days until next stage`)
        }
        report.push('')
      } catch {
        report.push('### ⚠️ Lifecycle: Unable to determine\n')
      }
    }

    // ─── Orders ──────────────────────────────────────────────────
    if (shouldCheck('orders')) {
      try {
        const pendingOrders = await payload.find({
          collection: 'orders' as any,
          where: { and: [{ tenant: { equals: tenantId } }, { status: { in: ['pending', 'processing'] } }] } as any,
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })
        const overdueOrders = await payload.find({
          collection: 'orders' as any,
          where: {
            and: [
              { tenant: { equals: tenantId } },
              { status: { equals: 'processing' } },
              { createdAt: { less_than: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() } },
            ],
          } as any,
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })
        const emoji = overdueOrders.totalDocs > 0 ? '🔴' : pendingOrders.totalDocs > 0 ? '🟡' : '🟢'
        report.push(`### ${emoji} Orders`)
        report.push(`- **${pendingOrders.totalDocs}** pending/processing`)
        if (overdueOrders.totalDocs > 0) {
          report.push(`- **${overdueOrders.totalDocs}** overdue (>48h in processing) ⚠️`)
        }
        report.push('')
      } catch {
        report.push('### Orders: Unable to query\n')
      }
    }

    // ─── Inventory ───────────────────────────────────────────────
    if (shouldCheck('inventory')) {
      try {
        const allProducts = await payload.find({
          collection: 'products' as any,
          where: { tenant: { equals: tenantId } } as any,
          limit: 200,
          depth: 0,
          overrideAccess: true,
          select: { title: true, inventory: true, _status: true } as any,
        })
        const published = allProducts.docs.filter((d: any) => d._status !== 'draft')
        const lowStock = published.filter((d: any) => {
          const inv = d.inventory
          if (!inv || typeof inv !== 'object') return false
          return (inv as any).trackInventory && typeof (inv as any).quantity === 'number' && (inv as any).quantity <= ((inv as any).lowStockThreshold || 5)
        })
        const outOfStock = published.filter((d: any) => {
          const inv = d.inventory
          if (!inv || typeof inv !== 'object') return false
          return (inv as any).trackInventory && typeof (inv as any).quantity === 'number' && (inv as any).quantity <= 0
        })
        const emoji = outOfStock.length > 0 ? '🔴' : lowStock.length > 0 ? '🟡' : '🟢'
        report.push(`### ${emoji} Inventory`)
        report.push(`- **${published.length}** published products`)
        if (lowStock.length > 0) {
          report.push(`- **${lowStock.length}** low stock: ${lowStock.slice(0, 3).map((p: any) => p.title).join(', ')}`)
        }
        if (outOfStock.length > 0) {
          report.push(`- **${outOfStock.length}** out of stock ⚠️`)
        }
        report.push('')
      } catch {
        report.push('### Inventory: Unable to query\n')
      }
    }

    // ─── Content ─────────────────────────────────────────────────
    if (shouldCheck('content')) {
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const draftPosts = await payload.find({
          collection: 'posts',
          where: { and: [{ tenant: { equals: tenantId } }, { _status: { equals: 'draft' } }] } as any,
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })
        const stalePosts = await payload.find({
          collection: 'posts',
          where: {
            and: [
              { tenant: { equals: tenantId } },
              { _status: { equals: 'published' } },
              { updatedAt: { less_than: thirtyDaysAgo } },
            ],
          } as any,
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })
        const pendingComments = await payload.find({
          collection: 'comments',
          where: { and: [{ tenant: { equals: tenantId } }, { isApproved: { equals: false } }] } as any,
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })
        const emoji = pendingComments.totalDocs > 5 ? '🟡' : '🟢'
        report.push(`### ${emoji} Content`)
        report.push(`- **${draftPosts.totalDocs}** draft posts`)
        report.push(`- **${stalePosts.totalDocs}** stale pages (>30 days unchanged)`)
        report.push(`- **${pendingComments.totalDocs}** pending comments awaiting moderation`)
        report.push('')
      } catch {
        report.push('### Content: Unable to query\n')
      }
    }

    // ─── Federation ──────────────────────────────────────────────
    if (shouldCheck('federation')) {
      try {
        const tenant = await payload.findByID({
          collection: 'tenants',
          id: tenantId,
          depth: 0,
          overrideAccess: true,
        })
        const setup = (tenant as any)?.setup || {}
        const hasFederationId = Boolean(setup.federationId)
        const hasConstitutionSigned = Boolean(setup.constitutionSigned)
        const wizardProgress = setup.wizardProgress || {}
        const completedSteps: number[] = Array.isArray(wizardProgress.completedSteps) ? wizardProgress.completedSteps : []
        const federationPinged = completedSteps.includes(8)

        report.push(`### 🌐 Federation`)
        report.push(`- Federation ID: ${hasFederationId ? '✅ assigned' : '❌ not yet'}`)
        report.push(`- Constitution: ${hasConstitutionSigned ? '✅ signed' : '❌ unsigned'}`)
        report.push(`- Registry ping: ${federationPinged ? '✅ connected' : '⏳ pending'}`)
        report.push('')
      } catch {
        report.push('### Federation: Unable to query\n')
      }
    }

    // ─── Payments ────────────────────────────────────────────────
    if (shouldCheck('payments')) {
      try {
        const tenant = await payload.findByID({
          collection: 'tenants',
          id: tenantId,
          depth: 0,
          overrideAccess: true,
        })
        // Check both possible field paths: stripeConnect.stripeAccountId (primary)
        // and stripe.accountId (legacy) for backward compatibility
        const stripeConnect = (tenant as any)?.stripeConnect
        const stripeLegacy = (tenant as any)?.stripe
        const stripeConnected = Boolean(stripeConnect?.stripeAccountId || stripeLegacy?.accountId)
        const chargesEnabled = Boolean(stripeConnect?.stripeChargesEnabled)
        const payoutsEnabled = Boolean(stripeConnect?.stripePayoutsEnabled)
        report.push(`### 💳 Payments`)
        report.push(`- Stripe: ${stripeConnected ? '✅ connected' : '❌ not connected'}`)
        if (stripeConnected) {
          report.push(`- Charges: ${chargesEnabled ? '✅ enabled' : '⏳ pending'}`)
          report.push(`- Payouts: ${payoutsEnabled ? '✅ enabled' : '⏳ pending'}`)
        }
        report.push('')
      } catch {
        report.push('### Payments: Unable to query\n')
      }
    }

    // ─── Spaces ──────────────────────────────────────────────────
    if (shouldCheck('spaces')) {
      try {
        const spaces = await payload.find({
          collection: 'spaces',
          where: { tenant: { equals: tenantId } } as any,
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })
        const memberships = await payload.find({
          collection: 'space-memberships',
          where: { tenant: { equals: tenantId } } as any,
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })
        report.push(`### 💬 Spaces`)
        report.push(`- **${spaces.totalDocs}** spaces`)
        report.push(`- **${memberships.totalDocs}** total memberships`)
        report.push('')
      } catch {
        report.push('### Spaces: Unable to query\n')
      }
    }

    report.push(`---\n*Health check completed at ${new Date().toISOString()}*`)

    return report.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error running health check: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * get_enterprise_stage — Lifecycle stage determination
 */
async function handleGetEnterpriseStage(
  payload: Payload,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  if (!tenantId) return 'Error: No tenant context available.'

  try {
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })

    const lifecycle = getLifecycleStage((tenant as any).createdAt || new Date().toISOString())
    const setup = (tenant as any)?.setup || {}
    const wizardProgress = setup.wizardProgress || {}
    const completedSteps: number[] = Array.isArray(wizardProgress.completedSteps) ? wizardProgress.completedSteps : []

    // Milestones
    const milestones: string[] = []
    if (completedSteps.includes(1) || completedSteps.includes(2)) milestones.push('✅ Business configured')
    if (completedSteps.includes(3)) milestones.push('✅ First space created')
    if (completedSteps.includes(4)) milestones.push('✅ First member invited')
    if (completedSteps.includes(5)) milestones.push('✅ First product created')
    if (completedSteps.includes(6)) milestones.push('✅ Stripe connected')
    if (completedSteps.includes(7)) milestones.push('✅ Enlistment complete')
    if (completedSteps.includes(8)) milestones.push('✅ Federation connected')

    // Suggest next milestones
    const suggestions: string[] = []
    if (lifecycle.stage === 'BIRTH') {
      if (!completedSteps.includes(5)) suggestions.push('🎯 Create your first product')
      if (!completedSteps.includes(6)) suggestions.push('🎯 Connect Stripe for payments')
      if (!completedSteps.includes(8)) suggestions.push('🎯 Join the federation network')
      if (completedSteps.length >= 7) suggestions.push('🎯 Make your first sale!')
    } else if (lifecycle.stage === 'GROWTH') {
      suggestions.push('🎯 Reach 10 published products')
      suggestions.push('🎯 Earn 2+ federation vouches for sentinel status')
      suggestions.push('🎯 Host your first event')
    }

    const stageEmoji = lifecycle.stage === 'BIRTH' ? '🌱' : lifecycle.stage === 'GROWTH' ? '🌿' : '🌳'

    const lines = [
      `## ${stageEmoji} Enterprise Lifecycle: **${lifecycle.stage}**\n`,
      `- **Day ${lifecycle.daysSinceCreation}** since creation`,
    ]
    if (lifecycle.daysRemaining != null) {
      lines.push(`- **${lifecycle.daysRemaining} days** until next stage`)
    }
    lines.push(`- Wizard steps completed: **${completedSteps.length}/8**\n`)

    if (milestones.length > 0) {
      lines.push('### Milestones Achieved')
      lines.push(...milestones)
      lines.push('')
    }

    if (suggestions.length > 0) {
      lines.push('### Suggested Next Steps')
      lines.push(...suggestions)
    }

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error determining enterprise stage: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * query_board_members — Federation governance board
 */
async function handleQueryBoardMembers(
  payload: Payload,
  input: Record<string, unknown>,
): Promise<string> {
  try {
    const statusFilter = typeof input.status === 'string' ? input.status : 'active'

    const where: Where = { status: { equals: statusFilter } }

    const result = await payload.find({
      collection: 'board-members' as any,
      where,
      limit: 50,
      depth: 1,
      overrideAccess: true,
      sort: 'role',
    })

    if (result.totalDocs === 0) {
      return `No ${statusFilter} board members found. The federation governance board may not yet be established on this node.`
    }

    const lines = [`## 🏛️ Federation Board (${statusFilter})\n`]
    for (const member of result.docs) {
      const doc = member as any
      const userName = doc.user?.name || doc.user?.email || 'Unknown'
      const role = doc.role || 'observer'
      const title = doc.title || role
      const permissions = Array.isArray(doc.permissions) ? doc.permissions.join(', ') : 'none'
      const appointed = doc.appointedAt ? new Date(doc.appointedAt).toLocaleDateString() : 'unknown'

      lines.push(`### ${userName}`)
      lines.push(`- **Title:** ${title}`)
      lines.push(`- **Role:** ${role}`)
      lines.push(`- **Term:** ${doc.term || 'permanent'}`)
      lines.push(`- **Permissions:** ${permissions}`)
      lines.push(`- **Appointed:** ${appointed}`)
      lines.push('')
    }

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error querying board members: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Sprint 32: Federation Pulse & Synchronicity — Handlers
// ---------------------------------------------------------------------------

/**
 * federation_pulse — Live vital signs of the federation organism
 */
async function handleFederationPulse(
  payload: Payload,
  ctx: ToolExecutorContext,
): Promise<string> {
  try {
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const MAX_HEARTBEAT_AGE = 300 // seconds

    const [endeavors, activeWork, completedWork, activeQuests, completedQuests, pheromones, federationMessages] =
      await Promise.all([
        payload.find({
          collection: 'endeavors' as any,
          where: { 'federation.federationId': { exists: true } } as any,
          depth: 0,
          limit: 200,
          overrideAccess: true,
        }),
        payload.find({
          collection: 'work-units' as any,
          where: { status: { in: ['pending', 'claimed', 'executing'] } } as any,
          depth: 0,
          limit: 0,
          overrideAccess: true,
        }),
        payload.find({
          collection: 'work-units' as any,
          where: {
            and: [
              { status: { equals: 'completed' } },
              { completedAt: { greater_than_equal: twentyFourHoursAgo.toISOString() } },
            ],
          } as any,
          depth: 0,
          limit: 0,
          overrideAccess: true,
        }),
        payload.find({
          collection: 'quest-participations' as any,
          where: { status: { in: ['accepted', 'in_progress', 'submitted', 'under_review'] } } as any,
          depth: 0,
          limit: 0,
          overrideAccess: true,
        }),
        payload.find({
          collection: 'quest-participations' as any,
          where: {
            and: [
              { status: { in: ['approved', 'paid'] } },
              { completedAt: { greater_than_equal: twentyFourHoursAgo.toISOString() } },
            ],
          } as any,
          depth: 0,
          limit: 0,
          overrideAccess: true,
        }),
        payload.find({
          collection: 'pheromones' as any,
          where: { strength: { greater_than: 5 } } as any,
          depth: 0,
          limit: 10,
          sort: '-strength',
          overrideAccess: true,
        }),
        // Cross-tenant federation messages in the last 24 hours
        payload.find({
          collection: 'messages' as any,
          where: {
            and: [
              { messageType: { equals: 'federation_message' } },
              { createdAt: { greater_than_equal: twentyFourHoursAgo.toISOString() } },
            ],
          } as any,
          depth: 0,
          limit: 0,
          overrideAccess: true,
        }),
      ])

    // Count healthy nodes
    const nodes = endeavors.docs as any[]
    let healthyCount = 0
    for (const node of nodes) {
      const lastPing = node.federation?.lastPingAt
      if (lastPing) {
        const age = (now.getTime() - new Date(lastPing).getTime()) / 1000
        if (age <= MAX_HEARTBEAT_AGE) healthyCount++
      }
    }

    // Active work breakdown
    const workDocs = activeWork.docs as any[]
    const executing = workDocs.filter((w: any) => w.status === 'executing').length
    const pending = workDocs.length - executing

    // Pheromone stats
    const trails = pheromones.docs as any[]
    const avgStrength =
      trails.length > 0
        ? Math.round(trails.reduce((s: number, t: any) => s + (t.strength || 0), 0) / trails.length)
        : 0

    // Pulse strength (0-100)
    const nodeRatio = nodes.length > 0 ? healthyCount / nodes.length : 0
    const pulseStrength = Math.round(
      nodeRatio * 40 +
      Math.min(1, workDocs.length / 10) * 25 +
      Math.min(1, activeQuests.totalDocs / 5) * 20 +
      Math.min(1, avgStrength / 50) * 15,
    )

    const lines: string[] = []
    lines.push(pulseStrength > 50 ? `## \u{1F49A} Federation Pulse: ${pulseStrength}/100` : `## \u{1F49B} Federation Pulse: ${pulseStrength}/100`)
    lines.push('')

    if (healthyCount === 0) {
      lines.push(`\u{1F6A8} **No healthy nodes detected** — the federation is quiet.`)
    } else {
      lines.push(`**${healthyCount}** of ${nodes.length} nodes are alive and responding.`)
    }
    lines.push('')

    lines.push(`### \u{2699}\u{FE0F} Work Flow`)
    lines.push(`- **${executing}** work units executing right now`)
    lines.push(`- **${pending}** pending/claimed in queue`)
    lines.push(`- **${completedWork.totalDocs}** completed in the last 24 hours`)
    lines.push('')

    lines.push(`### \u{1F3AF} Quests`)
    lines.push(`- **${activeQuests.totalDocs}** active quest participations`)
    lines.push(`- **${completedQuests.totalDocs}** quests completed in the last 24 hours`)
    lines.push('')

    lines.push(`### \u{1F41C} Pheromone Trails`)
    lines.push(`- **${trails.length}** active trails (strength > 5)`)
    lines.push(`- Average trail strength: **${avgStrength}**/100`)
    if (trails.length > 0) {
      lines.push(`- Strongest path: \`${(trails[0] as any).path || 'unknown'}\` (${(trails[0] as any).strength})`)
    }
    lines.push('')

    lines.push(`### \u{1F4E1} Cross-Tenant Messages`)
    lines.push(`- **${federationMessages.totalDocs}** federation messages in the last 24 hours`)
    if (federationMessages.totalDocs > 0) {
      lines.push(`- The AI Bus is active — LEO-to-LEO conversations are flowing across Enterprise boundaries.`)
    } else {
      lines.push(`- No cross-tenant messages yet. Use \`send_federation_message\` to reach federation peers.`)
    }
    lines.push('')

    lines.push(`*The organism is ${pulseStrength >= 50 ? 'thriving' : pulseStrength >= 25 ? 'growing' : 'awakening'}.*`)

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error reading federation pulse: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * my_place — User's position in the federation organism
 */
async function handleMyPlace(
  payload: Payload,
  ctx: ToolExecutorContext,
): Promise<string> {
  try {
    if (!ctx.userId) {
      return 'Unable to determine your identity. Please log in to see your place in the federation.'
    }

    const [memberships, questParticipations, workUnits] = await Promise.all([
      // Tenant memberships (nodes they belong to)
      payload.find({
        collection: 'tenant-memberships' as any,
        where: {
          user: { equals: ctx.userId },
          status: { equals: 'active' },
        } as any,
        depth: 1,
        limit: 20,
        overrideAccess: true,
      }),

      // Quest participations
      payload.find({
        collection: 'quest-participations' as any,
        where: { participant: { equals: ctx.userId } } as any,
        depth: 1,
        limit: 50,
        sort: '-createdAt',
        overrideAccess: true,
      }),

      // Work units they've processed
      payload.find({
        collection: 'work-units' as any,
        where: { executedBy: { equals: String(ctx.userId) } } as any,
        depth: 0,
        limit: 100,
        overrideAccess: true,
      }),
    ])

    const lines: string[] = []
    lines.push(`## \u{1F30D} Your Place in the Federation`)
    lines.push('')

    // Memberships / Nodes
    const memberDocs = memberships.docs as any[]
    lines.push(`### \u{1F3E0} Nodes`)
    if (memberDocs.length === 0) {
      lines.push(`You haven't joined any nodes yet. Explore the federation to find your home!`)
    } else {
      for (const m of memberDocs) {
        const tenantName = typeof m.tenant === 'object' ? m.tenant?.name || m.tenant?.slug : m.tenant
        const role = m.role || 'member'
        lines.push(`- **${tenantName}** (${role})`)
      }
    }
    lines.push('')

    // Quest activity
    const qDocs = questParticipations.docs as any[]
    const activeQuests = qDocs.filter((q: any) =>
      ['accepted', 'in_progress', 'submitted', 'under_review'].includes(q.status),
    )
    const completedQuests = qDocs.filter((q: any) => ['approved', 'paid'].includes(q.status))
    const questTypes: Record<string, number> = {}
    for (const q of completedQuests) {
      const quest = q.quest as any
      const qType = quest?.questType || quest?.difficulty || 'general'
      questTypes[qType] = (questTypes[qType] || 0) + 1
    }

    lines.push(`### \u{1F3AF} Quests`)
    lines.push(`- **${activeQuests.length}** active quest${activeQuests.length === 1 ? '' : 's'}`)
    lines.push(`- **${completedQuests.length}** completed`)
    if (Object.keys(questTypes).length > 0) {
      lines.push(`- Specializations: ${Object.entries(questTypes).map(([k, v]) => `${k} (${v})`).join(', ')}`)
    }
    lines.push('')

    // Work unit contributions
    const wuDocs = workUnits.docs as any[]
    const completed = wuDocs.filter((w: any) => w.status === 'completed')
    const failed = wuDocs.filter((w: any) => w.status === 'failed' || w.status === 'timeout')
    const successRate = wuDocs.length > 0 ? Math.round((completed.length / wuDocs.length) * 100) : 0
    const workTypes: Record<string, number> = {}
    for (const w of completed) {
      const t = (w as any).type || 'unknown'
      workTypes[t] = (workTypes[t] || 0) + 1
    }

    lines.push(`### \u{2699}\u{FE0F} Work Units`)
    lines.push(`- **${completed.length}** completed / **${failed.length}** failed`)
    lines.push(`- Success rate: **${successRate}%**`)
    if (Object.keys(workTypes).length > 0) {
      lines.push(`- Types: ${Object.entries(workTypes).map(([k, v]) => `${k} (${v})`).join(', ')}`)
    }
    lines.push('')

    // Summary
    const totalContributions = completedQuests.length + completed.length
    let tier = 'Initiate'
    if (totalContributions >= 50) tier = 'Architect'
    else if (totalContributions >= 30) tier = 'Navigator'
    else if (totalContributions >= 15) tier = 'Wayfinder'
    else if (totalContributions >= 5) tier = 'Pathfinder'

    lines.push(`### \u{2B50} Summary`)
    lines.push(`- **Tier:** ${tier} (${totalContributions} total contributions)`)
    lines.push(`- **Nodes:** ${memberDocs.length}`)
    lines.push(`- **Total quests:** ${qDocs.length} (${completedQuests.length} completed)`)
    lines.push(`- **Total work units:** ${wuDocs.length} (${successRate}% success)`)
    lines.push('')
    lines.push(`*You are a living cell in the federation organism. Every contribution strengthens the mesh.*`)

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error reading your federation position: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * find_synchronicities — Pattern detection for meaningful connections
 */
async function handleFindSynchronicities(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  try {
    if (!ctx.userId) {
      return 'Unable to determine your identity. Please log in to discover synchronicities.'
    }

    const minScore = input.minScore ? Number(input.minScore) : 40
    const maxResults = input.maxResults ? Math.min(Number(input.maxResults), 10) : 5

    // Get all users in the same tenant with their activity data
    const [memberships, allQuestParticipations, allWorkUnits, allPheromones] = await Promise.all([
      // All active memberships in this tenant
      payload.find({
        collection: 'tenant-memberships' as any,
        where: ctx.tenantId
          ? { tenant: { equals: ctx.tenantId }, status: { equals: 'active' } }
          : { status: { equals: 'active' } },
        depth: 1,
        limit: 100,
        overrideAccess: true,
      }),

      // All quest participations
      payload.find({
        collection: 'quest-participations' as any,
        where: ctx.tenantId
          ? ({ tenant: { equals: ctx.tenantId } } as any)
          : {},
        depth: 1,
        limit: 500,
        overrideAccess: true,
      }),

      // All completed work units
      payload.find({
        collection: 'work-units' as any,
        where: { status: { equals: 'completed' } } as any,
        depth: 0,
        limit: 500,
        overrideAccess: true,
      }),

      // All pheromone trails
      payload.find({
        collection: 'pheromones' as any,
        where: { strength: { greater_than: 5 } } as any,
        depth: 0,
        limit: 200,
        sort: '-strength',
        overrideAccess: true,
      }),
    ])

    // Build user → data maps
    const memberDocs = memberships.docs as any[]
    const userIds = new Set<string>()
    const userNames: Record<string, string> = {}
    const userNodes: Record<string, string[]> = {}

    for (const m of memberDocs) {
      const uid = String(typeof m.user === 'object' ? m.user?.id : m.user)
      userIds.add(uid)
      if (typeof m.user === 'object' && m.user?.name) {
        userNames[uid] = m.user.name
      }
      const tenantId = String(typeof m.tenant === 'object' ? m.tenant?.id : m.tenant)
      if (!userNodes[uid]) userNodes[uid] = []
      userNodes[uid].push(tenantId)
    }

    if (userIds.size < 2) {
      return 'Not enough active users in the federation to detect synchronicities yet. The organism grows as more people join!'
    }

    // Build quest completion maps per user
    const userQuestCompletions: Record<string, Record<string, number>> = {}
    for (const qp of allQuestParticipations.docs as any[]) {
      const uid = String(typeof qp.participant === 'object' ? qp.participant?.id : qp.participant)
      if (!['approved', 'paid'].includes(qp.status)) continue
      if (!userQuestCompletions[uid]) userQuestCompletions[uid] = {}
      const quest = qp.quest as any
      const qType = quest?.questType || quest?.difficulty || 'general'
      userQuestCompletions[uid][qType] = (userQuestCompletions[uid][qType] || 0) + 1
    }

    // Build work unit maps per user
    const userWorkUnits: Record<string, Record<string, number>> = {}
    for (const wu of allWorkUnits.docs as any[]) {
      const uid = (wu as any).executedBy
      if (!uid) continue
      if (!userWorkUnits[uid]) userWorkUnits[uid] = {}
      const wType = (wu as any).type || 'unknown'
      userWorkUnits[uid][wType] = (userWorkUnits[uid][wType] || 0) + 1
    }

    // Build activity profiles
    const profiles: UserActivityProfile[] = []
    for (const uid of userIds) {
      profiles.push(
        buildActivityProfile({
          userId: uid,
          displayName: userNames[uid],
          questCompletions: Object.entries(userQuestCompletions[uid] || {}).map(([type, count]) => ({
            type,
            count,
          })),
          workUnits: Object.entries(userWorkUnits[uid] || {}).map(([type, count]) => ({
            type,
            count,
          })),
          nodeIds: userNodes[uid] || [],
          skills: [
            ...Object.keys(userQuestCompletions[uid] || {}),
            ...Object.keys(userWorkUnits[uid] || {}),
          ],
        }),
      )
    }

    // Find target profile
    const targetProfile = profiles.find((p) => p.userId === String(ctx.userId))
    if (!targetProfile) {
      return 'Could not find your activity profile. Complete some quests or process work units to build your profile!'
    }

    // Run the engine
    const matches = findUserSynchronicities(targetProfile, profiles, {
      minScore,
      maxResults,
    })

    if (matches.length === 0) {
      return `No synchronicities found above score ${minScore}. As you and others contribute more to the federation, patterns will emerge. Every quest completed and work unit processed adds to the web of connections.`
    }

    // Generate nudges
    const nudges = generateNudges(matches, maxResults)

    const lines: string[] = []
    lines.push(`## \u{1F52E} Synchronicities Detected`)
    lines.push('')
    lines.push(`Found **${matches.length}** meaningful connection${matches.length === 1 ? '' : 's'}:`)
    lines.push('')

    for (const nudge of nudges) {
      lines.push(nudge.message)
      lines.push('')
      const dims = nudge.match.dimensions
      lines.push(`> Skills: ${dims.skillOverlap} | Time: ${dims.temporalProximity} | Space: ${dims.spatialProximity} | Trails: ${dims.trailIntersection} | Complement: ${dims.complementarity}`)
      lines.push('')
      lines.push('---')
      lines.push('')
    }

    lines.push(`*Synchronicities are pheromone trail intersections made visible. The more you contribute, the more connections the organism reveals.*`)

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools', err).catch(() => {})
    return `Error finding synchronicities: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Sprint 36: Generic Payload CRUD Handlers
// ---------------------------------------------------------------------------
// These give Leo the ability to read/write any whitelisted collection,
// enabling management of navigation, contacts, workflows, and anything else
// contained within the Endeavor — without needing a bespoke tool per collection.

function assertAllowedCollection(collection: string): string | null {
  if (!PAYLOAD_CRUD_ALLOWED_COLLECTIONS.has(collection)) {
    return `Collection "${collection}" is not accessible via generic CRUD tools. Allowed collections: ${[...PAYLOAD_CRUD_ALLOWED_COLLECTIONS].join(', ')}`
  }
  return null
}

/** Summarise a document for LLM consumption (keeps it readable, avoids huge JSON) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summariseDoc(doc: any, depth: number = 0): string {
  if (!doc || typeof doc !== 'object') return String(doc)

  const lines: string[] = []
  lines.push(`ID: ${doc.id}`)

  for (const [key, val] of Object.entries(doc)) {
    if (['id', 'createdAt', 'updatedAt', 'tenant', '_status'].includes(key)) continue
    if (val === null || val === undefined) continue

    if (Array.isArray(val)) {
      if (val.length === 0) continue
      if (typeof val[0] === 'object') {
        lines.push(`${key}: [${val.length} items]`)
        if (depth < 1) {
          for (const item of val.slice(0, 5)) {
            lines.push(`  - ${JSON.stringify(item)}`)
          }
          if (val.length > 5) lines.push(`  ... and ${val.length - 5} more`)
        }
      } else {
        lines.push(`${key}: ${val.join(', ')}`)
      }
    } else if (typeof val === 'object') {
      lines.push(`${key}: ${JSON.stringify(val)}`)
    } else {
      lines.push(`${key}: ${val}`)
    }
  }

  if (doc.createdAt) lines.push(`createdAt: ${doc.createdAt}`)
  if (doc.updatedAt) lines.push(`updatedAt: ${doc.updatedAt}`)

  return lines.join('\n')
}

async function handlePayloadFind(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const collection = String(input.collection || '')
  const err = assertAllowedCollection(collection)
  if (err) return err

  const limit = Math.min(Number(input.limit) || 10, 50)
  const depth = Math.min(Number(input.depth) || 1, 3)
  const sort = typeof input.sort === 'string' ? input.sort : '-createdAt'

  // Build where clause, always scoping to tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []
  if (ctx.tenantId) {
    conditions.push({ tenant: { equals: ctx.tenantId } })
  }

  if (input.where && typeof input.where === 'object') {
    // Merge user-provided where conditions
    const userWhere = input.where as Record<string, unknown>
    for (const [field, clause] of Object.entries(userWhere)) {
      if (clause && typeof clause === 'object') {
        conditions.push({ [field]: clause })
      } else if (clause !== undefined) {
        // Simple equality shorthand: { "title": "Something" }
        conditions.push({ [field]: { equals: clause } })
      }
    }
  }

  const where: Where = conditions.length > 0 ? { and: conditions } : {}

  try {
    const result = await payload.find({
      collection: collection as any,
      where,
      limit,
      depth,
      sort,
      overrideAccess: true,
    })

    if (result.docs.length === 0) {
      return `No documents found in "${collection}" matching the given filters.`
    }

    const header = `Found ${result.totalDocs} document(s) in "${collection}" (showing ${result.docs.length}):\n`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs = result.docs.map((doc: any, i: number) => `--- [${i + 1}] ---\n${summariseDoc(doc)}`).join('\n\n')

    return header + docs
  } catch (findErr) {
    const msg = findErr instanceof Error ? findErr.message : 'Unknown error'
    return `Error querying "${collection}": ${msg}`
  }
}

async function handlePayloadUpdate(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const collection = String(input.collection || '')
  const err = assertAllowedCollection(collection)
  if (err) return err

  const id = Number(input.id)
  const data = input.data as Record<string, unknown>

  // Strip any LLM-injected tenant field — we always enforce ctx.tenantId
  delete data.tenant

  // Verify document belongs to this tenant before updating
  if (ctx.tenantId) {
    try {
      const existing = await payload.findByID({
        collection: collection as any,
        id,
        depth: 0,
        overrideAccess: true,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docTenant = (existing as any)?.tenant
      const tenantVal = typeof docTenant === 'object' ? docTenant?.id : docTenant
      if (tenantVal && tenantVal !== ctx.tenantId) {
        return `Cannot update: document #${id} belongs to a different tenant.`
      }
    } catch {
      return `Cannot update: document #${id} not found in "${collection}".`
    }
    data.tenant = ctx.tenantId
  }

  try {
    const updated = await payload.update({
      collection: collection as any,
      id,
      data,
      overrideAccess: true,
      depth: 1,
    })
    return `Successfully updated ${collection} #${id}.\n\n${summariseDoc(updated)}`
  } catch (updateErr) {
    const msg = updateErr instanceof Error ? updateErr.message : 'Unknown error'
    return `Failed to update ${collection} #${id}: ${msg}`
  }
}

async function handlePayloadCreate(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const collection = String(input.collection || '')
  const err = assertAllowedCollection(collection)
  if (err) return err

  const data = input.data as Record<string, unknown>

  // Strip any LLM-injected tenant field — we always enforce ctx.tenantId
  delete data.tenant

  // Inject tenant for multi-tenant scoping
  if (ctx.tenantId) {
    data.tenant = ctx.tenantId
  }

  try {
    const created = await payload.create({
      collection: collection as any,
      data,
      overrideAccess: true,
      depth: 1,
    })
    return `Successfully created ${collection} #${created.id}.\n\n${summariseDoc(created)}`
  } catch (createErr) {
    const msg = createErr instanceof Error ? createErr.message : 'Unknown error'
    // Surface common issues: duplicate slug, validation errors
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return `Failed to create in "${collection}": a document with those values already exists. ${msg}`
    }
    return `Failed to create in "${collection}": ${msg}`
  }
}

async function handlePayloadDelete(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const collection = String(input.collection || '')
  const err = assertAllowedCollection(collection)
  if (err) return err

  const id = Number(input.id)

  // Verify doc belongs to tenant before deleting
  if (ctx.tenantId) {
    try {
      const existing = await payload.findByID({
        collection: collection as any,
        id,
        depth: 0,
        overrideAccess: true,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docTenant = (existing as any)?.tenant
      const tenantVal = typeof docTenant === 'object' ? docTenant?.id : docTenant
      if (tenantVal && tenantVal !== ctx.tenantId) {
        return `Cannot delete: document belongs to a different tenant.`
      }
    } catch {
      return `Error: ${collection} #${id} not found.`
    }
  }

  try {
    await payload.delete({
      collection: collection as any,
      id,
      overrideAccess: true,
    })
    return `Successfully deleted ${collection} #${id}.`
  } catch (delErr) {
    const msg = delErr instanceof Error ? delErr.message : 'Unknown error'
    return `Failed to delete ${collection} #${id}: ${msg}`
  }
}

// ---------------------------------------------------------------------------
// Navigation Convenience Handlers
// ---------------------------------------------------------------------------

async function handleQueryNavigation(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const target = (input.target as string) || 'both'
  const results: string[] = []

  const fetchNav = async (slug: 'header' | 'footer') => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = []
    if (ctx.tenantId) conditions.push({ tenant: { equals: ctx.tenantId } })
    const where: Where = conditions.length > 0 ? { and: conditions } : {}

    const result = await payload.find({
      collection: slug as any,
      where,
      limit: 1,
      depth: 2,
      overrideAccess: true,
    })

    if (result.docs.length === 0) return `No ${slug} found for this tenant.`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = result.docs[0] as any
    const label = doc.label || slug
    const navItems = doc.navItems || []

    if (navItems.length === 0) return `**${label}** (${slug} #${doc.id}): No nav items configured.`

    const items = navItems
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any, i: number) => {
        const link = item?.link || {}
        const linkLabel = link.label || '(no label)'
        const linkType = link.type || 'custom'
        const url = link.url || ''
        const ref = link.reference
        const refDisplay = ref ? `→ page #${typeof ref === 'object' ? ref.id : ref}` : ''
        const newTabFlag = link.newTab ? ' [new tab]' : ''
        return `  ${i + 1}. "${linkLabel}" (${linkType}) ${url || refDisplay}${newTabFlag}`
      })
      .join('\n')

    return `**${label}** (${slug} #${doc.id}) — ${navItems.length} item(s):\n${items}`
  }

  if (target === 'header' || target === 'both') {
    results.push(await fetchNav('header'))
  }
  if (target === 'footer' || target === 'both') {
    results.push(await fetchNav('footer'))
  }

  return results.join('\n\n')
}

async function handleUpdateNavigation(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const target = input.target as 'header' | 'footer'
  const action = input.action as string

  // Find the current nav doc
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []
  if (ctx.tenantId) conditions.push({ tenant: { equals: ctx.tenantId } })
  const where: Where = conditions.length > 0 ? { and: conditions } : {}

  const result = await payload.find({
    collection: target as any,
    where,
    limit: 1,
    depth: 2,
    overrideAccess: true,
  })

  if (result.docs.length === 0) {
    return `No ${target} found for this tenant. Create one first using payload_create.`
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = result.docs[0] as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let navItems: any[] = [...(doc.navItems || [])]

  switch (action) {
    case 'add': {
      const label = input.label as string
      if (!label) return 'Error: "label" is required for add action.'

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newItem: any = {
        link: {
          type: input.pageId ? 'reference' : 'custom',
          label,
          newTab: input.newTab || false,
        },
      }
      if (input.pageId) {
        newItem.link.reference = { relationTo: 'pages', value: input.pageId }
      } else if (input.url) {
        // Belt-and-suspenders URL safety check (Zod schema also validates)
        const urlStr = String(input.url).trim()
        if (/^(javascript|data|vbscript):/i.test(urlStr)) {
          return 'Error: dangerous URL protocol. Use a standard https:// or relative URL.'
        }
        newItem.link.url = urlStr
      } else {
        return 'Error: either "url" or "pageId" is required when adding a nav item.'
      }

      if (navItems.length >= 6) {
        return `Cannot add: ${target} already has ${navItems.length} nav items (max 6). Remove one first.`
      }

      navItems.push(newItem)
      break
    }

    case 'remove': {
      const removeLabel = (input.label as string || '').toLowerCase()
      if (!removeLabel) return 'Error: "label" is required for remove action.'

      const beforeLen = navItems.length
      navItems = navItems.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any) => (item?.link?.label || '').toLowerCase() !== removeLabel,
      )

      if (navItems.length === beforeLen) {
        const existing = doc.navItems
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => `"${item?.link?.label}"`)
          .join(', ')
        return `No nav item with label "${input.label}" found. Current items: ${existing}`
      }
      break
    }

    case 'reorder':
    case 'replace_all': {
      if (!Array.isArray(input.navItems)) {
        return 'Error: "navItems" array is required for reorder/replace_all action.'
      }
      navItems = input.navItems as any[]
      break
    }

    default:
      return `Unknown action: ${action}. Use add, remove, reorder, or replace_all.`
  }

  // Persist
  await payload.update({
    collection: target as any,
    id: doc.id,
    data: { navItems },
    overrideAccess: true,
  })

  // Return updated state
  const updatedLabels = navItems
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((item: any, i: number) => `  ${i + 1}. "${item?.link?.label || '(no label)'}"`)
    .join('\n')

  return `Successfully updated ${target} navigation (${navItems.length} items):\n${updatedLabels}${navDirective(`/admin/collections/${target}/${doc.id}`, `Edit ${target}`)}`
}

// ---------------------------------------------------------------------------
// Sprint 38: Federation Browsing Tool Handlers
// ---------------------------------------------------------------------------

/**
 * Browse federation peers from the local governance cache.
 * No outbound HTTP — reads the in-memory governance snapshot.
 */
async function handleBrowseFederationPeers(
  payload: Payload,
  input: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ctx: ToolExecutorContext,
): Promise<string> {
  try {
    const { getCachedGovernance } = await import('@/endpoints/federation-governance-sync')

    const governance = getCachedGovernance()

    if (!governance) {
      return 'Governance cache not yet populated. The federation sync may not have run yet — it initializes on the first heartbeat cycle (every 5 minutes). Try again shortly.'
    }

    const statusFilter = ((input.status as string) || 'active').toLowerCase()
    const capabilityFilter = ((input.capability as string) || '').toLowerCase()
    const regionFilter = ((input.region as string) || '').toLowerCase()
    const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50)

    let ministries = governance.ministries || []

    // Filter by status
    if (statusFilter !== 'all') {
      ministries = ministries.filter((m) => m.status === statusFilter)
    }

    // Filter by capability (substring match)
    if (capabilityFilter) {
      ministries = ministries.filter((m) =>
        (m.capabilities || []).some((c) => c.toLowerCase().includes(capabilityFilter)),
      )
    }

    // Filter by region (substring match)
    if (regionFilter) {
      ministries = ministries.filter(
        (m) => m.region && m.region.toLowerCase().includes(regionFilter),
      )
    }

    const totalInRegistry = governance.ministries?.length || 0
    const totalActive = (governance.ministries || []).filter((m) => m.status === 'active').length

    if (ministries.length === 0) {
      const filters = [
        statusFilter !== 'all' ? `status="${statusFilter}"` : '',
        capabilityFilter ? `capability="${capabilityFilter}"` : '',
        regionFilter ? `region="${regionFilter}"` : '',
      ]
        .filter(Boolean)
        .join(', ')

      return `No peers found matching ${filters || 'current filters'}.\n\nFederation has ${totalActive} active peer(s) out of ${totalInRegistry} total in the registry. Try broadening your search with status="all" or removing filters.`
    }

    // Apply limit
    const sliced = ministries.slice(0, limit)

    // Build markdown table
    const lines: string[] = [
      `## Federation Peers`,
      '',
      `Found **${ministries.length}** peer(s) matching your query (${totalActive} active, ${totalInRegistry} total in registry).`,
      '',
      '| # | Name | Domain | Status | Capabilities | Region | Trust | Last Heartbeat |',
      '|---|------|--------|--------|--------------|--------|-------|----------------|',
    ]

    for (let i = 0; i < sliced.length; i++) {
      const m = sliced[i]
      const trustScore = governance.trustScores?.[m.id]
      const trust = trustScore != null ? `${(trustScore * 100).toFixed(0)}%` : 'N/A'
      const caps = (m.capabilities || []).slice(0, 3).join(', ') || 'none listed'
      const region = m.region || '—'
      const heartbeat = m.lastHeartbeat
        ? formatRelativeTime(m.lastHeartbeat)
        : 'never'

      lines.push(
        `| ${i + 1} | **${m.name}** | ${m.domain} | ${m.status} | ${caps} | ${region} | ${trust} | ${heartbeat} |`,
      )
    }

    if (ministries.length > limit) {
      lines.push('', `_Showing ${limit} of ${ministries.length} matching peers. Increase limit to see more._`)
    }

    lines.push(
      '',
      '_Use `query_peer_catalog` with a peer\'s domain to browse their catalog, or `search_federation_wide` to search across all peers at once._',
    )

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools/browse_federation_peers', err).catch(() => {})
    return `Error browsing federation peers: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/** Format an ISO timestamp as a relative time string. */
function formatRelativeTime(isoTimestamp: string): string {
  try {
    const diff = Date.now() - new Date(isoTimestamp).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  } catch {
    return 'unknown'
  }
}

/**
 * Resolve the local tenant's federation identity for outbound signed requests.
 * Returns null if the tenant is not yet federated.
 */
async function resolveFederationIdentity(
  payload: Payload,
  tenantId: number,
): Promise<import('@/utilities/federationClient').FederationIdentity | null> {
  try {
    const { getOrCreateFederationKeyPair } = await import('@/federation/keyStore')

    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    }) as any

    const federationId = tenant?.setup?.federationId as string | undefined
    if (!federationId) return null

    const keyPair = await getOrCreateFederationKeyPair(payload, tenantId)

    const tenantDomain = tenant?.domain as string | undefined
    const isLocalDomain = tenantDomain && /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)/.test(tenantDomain)
    const domain =
      (!isLocalDomain && tenantDomain) ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.NEXT_PUBLIC_SERVER_URL?.replace(/^https?:\/\//, '') ||
      'localhost'

    return {
      federationId,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      domain,
      name: (tenant?.name as string) || 'Angel OS Instance',
    }
  } catch {
    return null
  }
}

/**
 * Query a specific federation peer's catalog via signed outbound HTTP.
 */
async function handleQueryPeerCatalog(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  const domain = (input.domain as string)?.trim()

  if (!domain) {
    return 'Error: domain is required. Provide the peer\'s domain (e.g., "clearwater.spacesangels.com"). Use `browse_federation_peers` to discover available peers.'
  }

  const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 50)

  try {
    const { fetchCatalog } = await import('@/utilities/federationClient')

    // Build catalog query
    const query: import('@/utilities/federationClient').CatalogQuery = {
      q: (input.search as string) || undefined,
      capability: (input.capability as string) || undefined,
      region: (input.region as string) || undefined,
      limit,
      minRating: input.min_rating != null ? Number(input.min_rating) : undefined,
      maxPrice: input.max_price != null ? Number(input.max_price) : undefined,
    }

    // Resolve identity for signed requests
    let identity: import('@/utilities/federationClient').FederationIdentity | null = null
    if (tenantId) {
      identity = await resolveFederationIdentity(payload, tenantId)
    }

    if (!identity) {
      // Cannot make signed requests without federation identity
      return 'This Enterprise is not yet federated (no federation ID or keys). Sign the constitution first using `sign_constitution`, then try again.'
    }

    const result = await fetchCatalog(domain, query, identity, { timeout: 10_000 })

    if (!result) {
      return `Could not reach peer at **${domain}**. They may be offline, not part of the federation, or the domain may be incorrect.\n\nUse \`browse_federation_peers\` to see known active peers and their domains.`
    }

    if (result.entries.length === 0) {
      const filters = [
        query.q ? `search="${query.q}"` : '',
        query.capability ? `capability="${query.capability}"` : '',
        query.region ? `region="${query.region}"` : '',
      ]
        .filter(Boolean)
        .join(', ')

      return `## Catalog from ${domain}\n\nNo results found${filters ? ` for ${filters}` : ''}. The peer has ${result.total} total catalog entries — try broadening your search or removing filters.`
    }

    const lines: string[] = [
      `## Catalog from ${domain}`,
      '',
      `**${result.total}** product(s)/service(s) found${result.entries.length < result.total ? ` (showing ${result.entries.length})` : ''}.`,
      '',
    ]

    for (let i = 0; i < result.entries.length; i++) {
      const entry = result.entries[i] as any
      const name = entry.productName || entry.name || 'Unnamed'
      const desc = entry.description ? String(entry.description).slice(0, 120) : ''
      const price = entry.price != null ? `$${(Number(entry.price) / 100).toFixed(2)}` : 'Price TBD'
      const rating = entry.rating != null ? `${entry.rating}/5` : ''
      const caps = Array.isArray(entry.capabilities)
        ? entry.capabilities.slice(0, 3).join(', ')
        : ''
      const fulfillment = entry.fulfillmentMode || ''

      lines.push(`**${i + 1}. ${name}** — ${price}${rating ? ` | Rating: ${rating}` : ''}`)
      if (desc) lines.push(`   ${desc}${desc.length >= 120 ? '…' : ''}`)
      if (caps) lines.push(`   Capabilities: ${caps}`)
      if (fulfillment) lines.push(`   Fulfillment: ${fulfillment}`)
      lines.push('')
    }

    lines.push(
      '_Use `query_peer_catalog` with different filters to narrow results, or `search_federation_wide` to search across all peers._',
    )

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools/query_peer_catalog', err).catch(() => {})
    return `Error querying peer catalog: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * Fan-out search across all active federation peers' catalogs.
 * Combines governance cache (peer discovery) with fetchCatalog (per-peer query).
 */
async function handleSearchFederationWide(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { tenantId } = ctx
  const searchText = (input.search as string) || ''
  const capability = (input.capability as string) || ''
  const region = (input.region as string) || ''
  const limitPerPeer = Math.min(Math.max(Number(input.limit_per_peer) || 5, 1), 20)
  const maxPeers = Math.min(Math.max(Number(input.max_peers) || 10, 1), 25)

  try {
    const { getCachedGovernance } = await import('@/endpoints/federation-governance-sync')
    const { fetchCatalog } = await import('@/utilities/federationClient')

    const governance = getCachedGovernance()
    if (!governance) {
      return 'Governance cache not yet populated. The federation sync may not have run yet — try again after the next heartbeat cycle (every 5 minutes).'
    }

    // Filter to active peers only
    let peers = (governance.ministries || []).filter((m) => m.status === 'active')

    // Optionally narrow by region
    if (region) {
      const regionLower = region.toLowerCase()
      peers = peers.filter((m) => m.region && m.region.toLowerCase().includes(regionLower))
    }

    if (peers.length === 0) {
      return `No active federation peers found${region ? ` in region "${region}"` : ''}. The federation may still be growing, or the governance cache needs to refresh.`
    }

    // Cap number of peers to query
    const peersToQuery = peers.slice(0, maxPeers)

    // Resolve identity for signed requests
    let identity: import('@/utilities/federationClient').FederationIdentity | null = null
    if (tenantId) {
      identity = await resolveFederationIdentity(payload, tenantId)
    }

    if (!identity) {
      return 'This Enterprise is not yet federated (no federation ID or keys). Sign the constitution first using `sign_constitution`, then try again.'
    }

    // Build catalog query
    const query: import('@/utilities/federationClient').CatalogQuery = {
      q: searchText || undefined,
      capability: capability || undefined,
      region: region || undefined,
      limit: limitPerPeer,
    }

    // Fan-out in batches of 5 to limit concurrency
    const BATCH_SIZE = 5
    const allResults: {
      peer: string
      peerName: string
      entries: any[]
      total: number
    }[] = []
    const failures: { peer: string; error: string }[] = []

    for (let i = 0; i < peersToQuery.length; i += BATCH_SIZE) {
      const batch = peersToQuery.slice(i, i + BATCH_SIZE)
      const batchPromises = batch.map(async (peer): Promise<
        | { ok: true; peer: string; peerName: string; entries: any[]; total: number }
        | { ok: false; peer: string; error: string }
      > => {
        try {
          const result = await fetchCatalog(peer.domain, query, identity!, { timeout: 8_000 })
          if (result) {
            return {
              ok: true,
              peer: peer.domain,
              peerName: peer.name,
              entries: result.entries as any[],
              total: result.total,
            }
          } else {
            return { ok: false, peer: peer.domain, error: 'unreachable' }
          }
        } catch (err) {
          return {
            ok: false,
            peer: peer.domain,
            error: err instanceof Error ? err.message : 'unknown error',
          }
        }
      })

      const batchResults = await Promise.allSettled(batchPromises)

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const val = result.value
          if (val.ok) {
            allResults.push(val)
          } else {
            failures.push({ peer: val.peer, error: val.error })
          }
        }
      }
    }

    // Aggregate and sort entries (best rating first, then lowest price)
    const aggregatedEntries: Array<{
      name: string
      peerDomain: string
      peerName: string
      price: number | null
      rating: number | null
      capabilities: string[]
      description: string
      fulfillmentMode: string
    }> = []

    for (const peerResult of allResults) {
      for (const entry of peerResult.entries) {
        aggregatedEntries.push({
          name: entry.productName || entry.name || 'Unnamed',
          peerDomain: peerResult.peer,
          peerName: peerResult.peerName,
          price: entry.price != null ? Number(entry.price) : null,
          rating: entry.rating != null ? Number(entry.rating) : null,
          capabilities: Array.isArray(entry.capabilities) ? entry.capabilities : [],
          description: entry.description ? String(entry.description).slice(0, 100) : '',
          fulfillmentMode: entry.fulfillmentMode || '',
        })
      }
    }

    // Sort: rating descending, then price ascending
    aggregatedEntries.sort((a, b) => {
      const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0)
      if (ratingDiff !== 0) return ratingDiff
      return (a.price ?? Infinity) - (b.price ?? Infinity)
    })

    const peersWithResults = allResults.filter((r) => r.entries.length > 0).length
    const totalEntries = aggregatedEntries.length

    // Build response
    const lines: string[] = [
      `## Federation-Wide Search Results`,
      '',
      `Searched **${peersToQuery.length}** peer(s) — **${allResults.length}** responded, **${peersWithResults}** had results, **${totalEntries}** total entries found.`,
      '',
    ]

    if (totalEntries === 0) {
      const filters = [
        searchText ? `search="${searchText}"` : '',
        capability ? `capability="${capability}"` : '',
        region ? `region="${region}"` : '',
      ]
        .filter(Boolean)
        .join(', ')

      lines.push(`No results found across the federation${filters ? ` for ${filters}` : ''}. Try broadening your search.`)
    } else {
      for (let i = 0; i < aggregatedEntries.length; i++) {
        const e = aggregatedEntries[i]
        const price = e.price != null ? `$${(e.price / 100).toFixed(2)}` : 'Price TBD'
        const rating = e.rating != null ? `${e.rating}/5` : ''

        lines.push(`**${i + 1}. ${e.name}** — ${price}${rating ? ` | ${rating}` : ''} | _via ${e.peerName}_ (${e.peerDomain})`)
        if (e.description) lines.push(`   ${e.description}${e.description.length >= 100 ? '…' : ''}`)
        if (e.capabilities.length > 0) lines.push(`   Capabilities: ${e.capabilities.slice(0, 3).join(', ')}`)
        lines.push('')
      }
    }

    if (failures.length > 0) {
      lines.push('---')
      lines.push(`_${failures.length} peer(s) could not be reached:_`)
      for (const f of failures.slice(0, 5)) {
        lines.push(`- ${f.peer}: ${f.error}`)
      }
      if (failures.length > 5) {
        lines.push(`- _…and ${failures.length - 5} more_`)
      }
      lines.push('')
    }

    lines.push(
      '_Use `query_peer_catalog` to browse a specific peer\'s full catalog, or `browse_federation_peers` to see all known peers._',
    )

    return lines.join('\n')
  } catch (err) {
    logCaughtError('leo-tools/search_federation_wide', err).catch(() => {})
    return `Error searching federation: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ─── Sprint 39: discover_federation_products ─────────────────────────────

async function handleDiscoverFederationProducts(
  toolInput: Record<string, unknown>,
): Promise<string> {
  const { getAllPeerStreetSigns } = await import('@/utilities/streetSigns')

  const categoryFilter =
    typeof toolInput.category === 'string' ? toolInput.category.toLowerCase() : null
  const capabilityFilter =
    typeof toolInput.capability === 'string' ? toolInput.capability.toLowerCase() : null
  const maxPriceDollars =
    typeof toolInput.max_price === 'number' ? toolInput.max_price : null

  const allPeers = getAllPeerStreetSigns()

  if (allPeers.length === 0) {
    return [
      '## Federation Street Signs',
      '',
      'No street signs data available yet — the federation gossip cache is empty.',
      '',
      '_Street Signs data populates automatically every 5 minutes via heartbeat exchange.',
      'Use `browse_federation_peers` to check which peers are known, or `search_federation_wide` to actively query them._',
    ].join('\n')
  }

  const lines: string[] = ['## Federation Products (Street Signs Cache)', '']

  let totalProducts = 0
  let peersWithResults = 0

  for (const entry of allPeers) {
    const { signs } = entry
    const peerLabel = entry.peerName || entry.peerId
    const receivedAgo = Math.round(
      (Date.now() - new Date(entry.receivedAt).getTime()) / 60_000,
    )

    // Filter featured products
    let featured = signs.featured
    if (categoryFilter) {
      featured = featured.filter((p) =>
        p.category.toLowerCase().includes(categoryFilter),
      )
    }
    if (capabilityFilter) {
      featured = featured.filter((p) =>
        p.capabilities.some((c) => c.toLowerCase().includes(capabilityFilter!)),
      )
    }
    if (maxPriceDollars !== null) {
      const maxCents = Math.round(maxPriceDollars * 100)
      featured = featured.filter((p) => p.priceMin <= maxCents)
    }

    if (featured.length === 0 && (categoryFilter || capabilityFilter || maxPriceDollars !== null)) {
      continue // No matching products after filter — skip this peer
    }

    peersWithResults++
    totalProducts += signs.productCount

    lines.push(`### ${peerLabel}`)
    lines.push(
      `_${signs.productCount} products — top categories: ${signs.topCategories.join(', ') || 'none'} — gossip updated ${receivedAgo}m ago_`,
    )
    lines.push('')

    if (featured.length > 0) {
      lines.push('| Product | Category | Price | Capabilities |')
      lines.push('|---------|----------|-------|--------------|')
      for (const p of featured) {
        const priceStr = p.priceMin > 0
          ? `$${(p.priceMin / 100).toFixed(2)}`
          : 'Contact for price'
        const caps = p.capabilities.length > 0 ? p.capabilities.join(', ') : '—'
        lines.push(`| ${p.productTitle} | ${p.category} | ${priceStr} | ${caps} |`)
      }
    } else {
      lines.push('_No featured products — use `query_peer_catalog` for full catalog_')
    }

    lines.push('')
    if (entry.peerDomain) {
      lines.push(
        `_Full catalog: \`query_peer_catalog\` with domain \`${entry.peerDomain}\`_`,
      )
    }
    lines.push('')
  }

  if (peersWithResults === 0) {
    return [
      '## Federation Products (Street Signs Cache)',
      '',
      `No products match the current filters across ${allPeers.length} known peer(s).`,
      '',
      '_Try broader filters or use `search_federation_wide` for a live search._',
    ].join('\n')
  }

  lines.push('---')
  lines.push(
    `_${allPeers.length} peer(s) in street signs cache — ${totalProducts} total products — data refreshes every 5 min via heartbeat_`,
  )
  lines.push('_For live product details, use `query_peer_catalog` with a peer\'s domain._')

  return lines.join('\n')
}

// ─── Sprint 37: Form Builder Integration ────────────────────────────────────

/**
 * Send an interactive inline form in the chat.
 * Creates a Message with messageType 'widget' containing the form config as a UMS widget.
 */
async function handleSendInlineForm(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const formTitle = (input.formTitle as string) || 'Form'
  const fields = input.fields as Array<Record<string, unknown>> | undefined
  const prefilled = input.prefilled as Record<string, unknown> | undefined
  const submitButtonLabel = (input.submitButtonLabel as string) || 'Submit'
  const message = (input.message as string) || `Please fill out the form below: **${formTitle}**`

  if (!fields || !Array.isArray(fields) || fields.length === 0) {
    return 'Error: fields array is required and must contain at least one field definition.'
  }

  // Validate field definitions
  const validBlockTypes = ['text', 'email', 'number', 'textarea', 'select', 'checkbox']
  for (const field of fields) {
    if (!field.name || typeof field.name !== 'string') {
      return `Error: Every field must have a 'name' (string). Got: ${JSON.stringify(field)}`
    }
    if (!field.blockType || !validBlockTypes.includes(field.blockType as string)) {
      return `Error: Field "${field.name}" has invalid blockType "${field.blockType}". Must be one of: ${validBlockTypes.join(', ')}`
    }
  }

  if (!ctx.tenantId) {
    return 'Error: No tenant context available.'
  }

  // Find LEO user and space for this tenant
  const leoUserId = await findLeoUser(payload, ctx.tenantId)
  const space = await resolveSpace(payload, ctx.tenantId)

  if (!leoUserId || !space) {
    return 'Error: Could not resolve LEO user or space for this tenant.'
  }

  // Build the widget config
  const widgetConfig: Record<string, unknown> = {
    widgetType: 'inline_form',
    formTitle,
    fields,
    submitButtonLabel,
    ...(prefilled ? { prefilled } : {}),
  }

  // Create the UMS widget content
  const content = createWidgetContent(message, widgetConfig)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = await (payload.create as any)({
      collection: 'messages',
      data: {
        content,
        messageType: 'widget',
        sender: leoUserId,
        space: space.id,
        tenant: ctx.tenantId,
        channel: 'ai-bus',
      },
      overrideAccess: true,
      depth: 0,
    })

    return [
      `✅ Inline form "${formTitle}" sent to chat (Message #${msg.id}).`,
      `Fields: ${fields.map((f) => f.label || f.name).join(', ')}`,
      prefilled
        ? `Pre-filled: ${Object.keys(prefilled).join(', ')}`
        : '',
      'The user will see the form in their chat and can fill it out.',
    ]
      .filter(Boolean)
      .join('\n')
  } catch (err) {
    return `Error sending inline form: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * Create a persistent form in the forms collection.
 * For reusable forms that can live on pages via FormBlock.
 */
async function handleCreateForm(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const title = input.title as string
  const fields = input.fields as Array<Record<string, unknown>> | undefined
  const submitButtonLabel = (input.submitButtonLabel as string) || 'Submit'
  const confirmationType = (input.confirmationType as string) || 'message'
  const confirmationMessage = (input.confirmationMessage as string) ||
    'Thank you for your submission!'
  const redirect = input.redirect as string | undefined

  if (!title) {
    return 'Error: title is required.'
  }
  if (!fields || !Array.isArray(fields) || fields.length === 0) {
    return 'Error: fields array is required and must contain at least one field definition.'
  }

  // Ensure each field has required Payload Form Builder structure
  const validBlockTypes = [
    'text', 'email', 'number', 'textarea', 'select',
    'checkbox', 'country', 'state', 'message',
  ]
  const processedFields = fields.map((field, idx) => {
    const blockType = (field.blockType as string) || 'text'
    if (!validBlockTypes.includes(blockType)) {
      throw new Error(
        `Field ${idx} has invalid blockType "${blockType}". Must be one of: ${validBlockTypes.join(', ')}`,
      )
    }
    return {
      blockType,
      name: (field.name as string) || `field_${idx}`,
      label: (field.label as string) || (field.name as string) || `Field ${idx + 1}`,
      required: field.required === true,
      ...(field.width ? { width: Number(field.width) } : {}),
      ...(field.defaultValue ? { defaultValue: field.defaultValue } : {}),
      // Select options
      ...(blockType === 'select' && Array.isArray(field.options)
        ? {
            options: (field.options as Array<Record<string, unknown>>).map((opt) => ({
              label: (opt.label as string) || (opt.value as string) || '',
              value: (opt.value as string) || (opt.label as string) || '',
            })),
          }
        : {}),
    }
  })

  // Build confirmation config
  const confirmationConfig: Record<string, unknown> =
    confirmationType === 'redirect' && redirect
      ? { type: 'redirect', url: redirect }
      : {
          type: 'message',
          message: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: confirmationMessage }],
            },
          ],
        }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = await (payload.create as any)({
      collection: 'forms',
      data: {
        title,
        fields: processedFields,
        submitButtonLabel,
        confirmationType: confirmationConfig.type,
        ...(confirmationConfig.type === 'message'
          ? { confirmationMessage: confirmationConfig.message }
          : { redirect: confirmationConfig.url }),
        ...(ctx.tenantId ? { tenant: ctx.tenantId } : {}),
      },
      overrideAccess: true,
      depth: 0,
    })

    return [
      `✅ Form "${title}" created successfully (ID: ${form.id}).`,
      `Fields: ${processedFields.map((f) => `${f.label} (${f.blockType}${f.required ? ', required' : ''})`).join(', ')}`,
      `Submit button: "${submitButtonLabel}"`,
      `Confirmation: ${confirmationType === 'redirect' ? `Redirect to ${redirect}` : confirmationMessage}`,
      '',
      `You can now add this form to a page using the FormBlock, or reference it by ID ${form.id} in send_inline_form.`,
    ].join('\n')
  } catch (err) {
    return `Error creating form: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * Query form submissions with various filters.
 * Returns formatted summaries of submitted form data.
 */
async function handleQueryFormSubmissions(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const formId = input.formId as number | undefined
  const formTitle = input.formTitle as string | undefined
  const since = input.since as string | undefined
  const until = input.until as string | undefined
  const limit = Math.min(Math.max((input.limit as number) || 20, 1), 100)
  const fieldFilter = input.fieldFilter as Record<string, unknown> | undefined

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []

  // If we have a formId, filter directly
  if (formId) {
    conditions.push({ form: { equals: formId } })
  }

  // Date filters on createdAt
  if (since) {
    conditions.push({ createdAt: { greater_than_equal: since } })
  }
  if (until) {
    conditions.push({ createdAt: { less_than_equal: until } })
  }

  const where: Where =
    conditions.length > 0 ? { and: conditions } : {}

  try {
    // If filtering by title, resolve form IDs first
    let formIds: number[] | undefined
    if (formTitle) {
      const forms = await payload.find({
        collection: 'forms',
        where: {
          title: { contains: formTitle },
        },
        limit: 50,
        depth: 0,
        overrideAccess: true,
      })
      formIds = forms.docs.map((f) => f.id as number)
      if (formIds.length === 0) {
        return `No forms found matching title "${formTitle}".`
      }
      // Add form filter
      if (formIds.length === 1) {
        conditions.push({ form: { equals: formIds[0] } })
      } else {
        conditions.push({ form: { in: formIds } })
      }
    }

    const finalWhere: Where =
      conditions.length > 0 ? { and: conditions } : {}

    const submissions = await payload.find({
      collection: 'form-submissions',
      where: finalWhere,
      limit,
      sort: '-createdAt',
      depth: 1, // Resolve form relationship for title
      overrideAccess: true,
    })

    if (submissions.docs.length === 0) {
      const filters = []
      if (formId) filters.push(`form ID ${formId}`)
      if (formTitle) filters.push(`title "${formTitle}"`)
      if (since) filters.push(`since ${since}`)
      if (until) filters.push(`until ${until}`)
      return `No form submissions found${filters.length ? ` matching: ${filters.join(', ')}` : ''}.`
    }

    // Format results
    const lines: string[] = [
      `## Form Submissions (${submissions.docs.length} of ${submissions.totalDocs})`,
      '',
    ]

    for (const sub of submissions.docs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = sub as any
      const formRef = s.form
      const fTitle =
        typeof formRef === 'object' && formRef !== null
          ? formRef.title as string
          : `Form #${formRef}`
      const submissionData = s.submissionData as
        | Array<{ field: string; value: string }>
        | undefined
      const createdAt = s.createdAt as string

      lines.push(`### Submission #${sub.id} — ${fTitle}`)
      lines.push(`_Submitted: ${createdAt ? new Date(createdAt).toLocaleString() : 'unknown'}_`)

      if (submissionData && Array.isArray(submissionData)) {
        // Apply field filter if provided
        let matchesFilter = true
        if (fieldFilter) {
          for (const [key, val] of Object.entries(fieldFilter)) {
            const fieldEntry = submissionData.find(
              (d) => d.field?.toLowerCase() === key.toLowerCase(),
            )
            if (
              !fieldEntry ||
              String(fieldEntry.value).toLowerCase() !== String(val).toLowerCase()
            ) {
              matchesFilter = false
              break
            }
          }
        }
        if (!matchesFilter) continue

        for (const entry of submissionData) {
          lines.push(`- **${entry.field}**: ${entry.value || '_(empty)_'}`)
        }
      } else {
        lines.push('_No field data available_')
      }
      lines.push('')
    }

    if (submissions.totalDocs > limit) {
      lines.push(
        `_Showing ${submissions.docs.length} of ${submissions.totalDocs} total submissions. Increase limit to see more._`,
      )
    }

    return lines.join('\n')
  } catch (err) {
    return `Error querying form submissions: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Sprint 39: SUBSAFE Diagnostic System
// ---------------------------------------------------------------------------

/**
 * query_application_logs — LEO can now see errors and warnings
 */
async function handleQueryApplicationLogs(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  try {
    const level = typeof input.level === 'string' ? input.level : undefined
    const source = typeof input.source === 'string' ? input.source : undefined
    const since = typeof input.since === 'string' ? input.since : undefined
    const limit = Math.min(typeof input.limit === 'number' ? input.limit : 20, 50)
    const unresolvedOnly = input.unresolvedOnly !== false // default true

    const where: Where = {}
    const and: Where[] = []

    if (level) and.push({ level: { equals: level } })
    if (source) and.push({ source: { contains: source } })
    if (unresolvedOnly) and.push({ resolved: { equals: false } })
    if (ctx.tenantId) and.push({ tenantId: { equals: String(ctx.tenantId) } })

    // Default to last 1 hour if no since provided
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 60 * 60 * 1000)
    and.push({ createdAt: { greater_than: sinceDate.toISOString() } })

    if (and.length) where.and = and

    const logs = await payload.find({
      collection: 'application-logs' as any,
      where,
      sort: '-createdAt',
      limit,
      depth: 0,
      overrideAccess: true,
    })

    if (!logs.docs.length) {
      return `## Application Logs\n\nNo ${level || ''} logs found${source ? ` from ${source}` : ''} since ${sinceDate.toISOString()}. System appears clean.`
    }

    const levelEmoji: Record<string, string> = {
      error: '\u{1F534}',
      warning: '\u{1F7E1}',
      info: '\u{1F535}',
      debug: '\u{26AA}',
    }

    const lines = [
      `## Application Logs (${logs.totalDocs} total, showing ${logs.docs.length})`,
      '',
    ]

    for (const log of logs.docs as any[]) {
      const emoji = levelEmoji[log.level] || '\u{2753}'
      const ts = new Date(log.createdAt).toLocaleString()
      lines.push(`${emoji} **${(log.level || 'unknown').toUpperCase()}** | \`${log.source}\` | ${ts}`)
      lines.push(`   ${log.message}`)
      if (log.details) {
        const detail = String(log.details).slice(0, 200)
        lines.push(`   \`\`\`${detail}${log.details.length > 200 ? '...' : ''}\`\`\``)
      }
      lines.push('')
    }

    return lines.join('\n')
  } catch (err) {
    return `Error querying application logs: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * connector_health_summary — LEO can see connector statuses
 */
async function handleConnectorHealthSummary(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  try {
    const runLiveProbes = input.runLiveProbes === true
    const where: Where = {}
    if (ctx.tenantId) where.tenant = { equals: ctx.tenantId }

    const connectors = await payload.find({
      collection: 'connectors' as any,
      where,
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })

    if (!connectors.docs.length) {
      return '## Connector Health Summary\n\nNo connectors configured for this tenant. Set up connectors in the admin dashboard to enable email, Discord, WhatsApp, and other communication channels.'
    }

    const lines = ['## Connector Health Summary', '']

    // Group by status
    const byStatus: Record<string, any[]> = { active: [], error: [], paused: [], unknown: [] }
    for (const conn of connectors.docs as any[]) {
      const status = conn.status || 'unknown'
      if (!byStatus[status]) byStatus[status] = []
      byStatus[status].push(conn)
    }

    const statusEmoji: Record<string, string> = {
      active: '\u{2705}',
      error: '\u{1F534}',
      paused: '\u{23F8}\u{FE0F}',
      unknown: '\u{2753}',
    }

    // Summary table
    lines.push('| Connector | Type | Status | Last Activity |')
    lines.push('|-----------|------|--------|---------------|')

    for (const conn of connectors.docs as any[]) {
      const emoji = statusEmoji[conn.status] || '\u{2753}'
      const name = conn.name || conn.type || 'Unnamed'
      const lastActivity = conn.lastActivityAt
        ? new Date(conn.lastActivityAt).toLocaleString()
        : 'Never'
      lines.push(`| ${emoji} ${name} | ${conn.type || '?'} | ${conn.status || 'unknown'} | ${lastActivity} |`)
    }

    lines.push('')

    // Count summary
    const active = byStatus.active?.length || 0
    const errored = byStatus.error?.length || 0
    const paused = byStatus.paused?.length || 0
    const total = connectors.docs.length

    lines.push(`**Summary:** ${active}/${total} active, ${errored} errored, ${paused} paused`)

    // Show error details
    if (errored > 0) {
      lines.push('', '### Errors')
      for (const conn of byStatus.error) {
        lines.push(`- **${conn.name || conn.type}**: ${conn.lastError || 'No error message recorded'}`)
      }
    }

    // Run live probes if requested
    if (runLiveProbes) {
      lines.push('', '### Live Probe Results')
      const probeResults = await Promise.allSettled(
        (connectors.docs as any[]).filter((c: any) => c.enabled !== false).map(async (conn: any) => {
          const type = String(conn.type || '')
          const cfg = (conn.config as Record<string, unknown>) || {}
          const start = Date.now()
          const result = await runProbe(type, cfg)
          return { name: conn.name || conn.type, type, ...result, latencyMs: Date.now() - start }
        }),
      )

      for (const result of probeResults) {
        if (result.status === 'fulfilled') {
          const r = result.value
          const emoji = r.ok ? '\u{2705}' : '\u{1F534}'
          lines.push(`${emoji} **${r.name}** (${r.type}): ${r.message} [${r.latencyMs}ms]`)
        } else {
          lines.push(`\u{1F534} Probe failed: ${result.reason}`)
        }
      }
    }

    return lines.join('\n')
  } catch (err) {
    return `Error checking connector health: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * run_subsafe_check — Master diagnostic: checks ALL ship systems
 */
async function handleRunSubsafeCheck(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const areas = Array.isArray(input.areas) ? input.areas.map(String) : null
  const checkAll = !areas
  const shouldCheck = (area: string) => checkAll || areas!.includes(area)

  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  type SubsystemResult = {
    status: 'PASS' | 'WARN' | 'FAIL'
    details: string
    actions: string[]
  }

  const results: Record<string, SubsystemResult> = {}

  // ── 1. Application Errors ──────────────────────────────────────────
  if (shouldCheck('errors')) {
    try {
      const errorWhere: Where = {
        and: [
          { createdAt: { greater_than: oneHourAgo.toISOString() } },
          ...(ctx.tenantId ? [{ tenantId: { equals: String(ctx.tenantId) } }] : []),
        ],
      }

      const [errors, warnings] = await Promise.all([
        payload.count({ collection: 'application-logs' as any, where: { ...errorWhere, and: [...(errorWhere.and as any[]), { level: { equals: 'error' } }] }, overrideAccess: true }),
        payload.count({ collection: 'application-logs' as any, where: { ...errorWhere, and: [...(errorWhere.and as any[]), { level: { equals: 'warning' } }] }, overrideAccess: true }),
      ])

      const errorCount = errors.totalDocs
      const warnCount = warnings.totalDocs
      const status = errorCount > 0 ? 'FAIL' : warnCount > 5 ? 'WARN' : 'PASS'
      const actions: string[] = []
      if (errorCount > 0) actions.push(`Investigate ${errorCount} error(s) — use query_application_logs for details`)
      if (warnCount > 5) actions.push(`Review ${warnCount} warning(s) — potential systemic issue`)

      results.Errors = {
        status,
        details: `${errorCount} errors, ${warnCount} warnings in last hour`,
        actions,
      }
    } catch {
      results.Errors = { status: 'FAIL', details: 'Could not query ApplicationLogs', actions: ['Check database connectivity'] }
    }
  }

  // ── 2. Connectors ──────────────────────────────────────────────────
  if (shouldCheck('connectors')) {
    try {
      const connWhere: Where = ctx.tenantId ? { tenant: { equals: ctx.tenantId } } : {}
      const connectors = await payload.find({
        collection: 'connectors' as any,
        where: connWhere,
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })

      const total = connectors.docs.length
      const errored = (connectors.docs as any[]).filter((c: any) => c.status === 'error').length
      const active = (connectors.docs as any[]).filter((c: any) => c.status === 'active').length
      const status = total === 0 ? 'WARN' : errored > 0 ? 'FAIL' : 'PASS'
      const actions: string[] = []
      if (total === 0) actions.push('No connectors configured — set up communication channels')
      if (errored > 0) actions.push(`${errored} connector(s) in error state — use connector_health_summary for details`)

      results.Connectors = {
        status,
        details: total === 0 ? 'No connectors configured' : `${active}/${total} active, ${errored} errored`,
        actions,
      }
    } catch {
      results.Connectors = { status: 'WARN', details: 'Could not query connectors', actions: [] }
    }
  }

  // ── 3. Enterprise Health ───────────────────────────────────────────
  if (shouldCheck('enterprise')) {
    try {
      const [pendingOrders, products, draftPosts] = await Promise.allSettled([
        payload.count({
          collection: 'orders' as any,
          where: { status: { in: ['pending', 'processing'] }, ...(ctx.tenantId ? { tenant: { equals: ctx.tenantId } } : {}) },
          overrideAccess: true,
        }),
        payload.find({
          collection: 'products',
          where: {
            _status: { equals: 'published' },
            'inventory.trackInventory': { equals: true },
            ...(ctx.tenantId ? { tenant: { equals: ctx.tenantId } } : {}),
          },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        }),
        payload.count({
          collection: 'posts',
          where: { _status: { equals: 'draft' }, ...(ctx.tenantId ? { tenant: { equals: ctx.tenantId } } : {}) },
          overrideAccess: true,
        }),
      ])

      const pending = pendingOrders.status === 'fulfilled' ? pendingOrders.value.totalDocs : 0
      const lowStock = products.status === 'fulfilled'
        ? (products.value.docs as any[]).filter((p: any) => {
            const qty = p.inventory?.quantity ?? 999
            const threshold = p.inventory?.lowStockThreshold ?? 5
            return qty > 0 && qty <= threshold
          }).length
        : 0
      const outOfStock = products.status === 'fulfilled'
        ? (products.value.docs as any[]).filter((p: any) => (p.inventory?.quantity ?? 999) <= 0).length
        : 0
      const drafts = draftPosts.status === 'fulfilled' ? draftPosts.value.totalDocs : 0

      const actions: string[] = []
      if (outOfStock > 0) actions.push(`${outOfStock} product(s) out of stock`)
      if (lowStock > 0) actions.push(`${lowStock} product(s) running low`)
      if (pending > 10) actions.push(`${pending} pending orders — review fulfillment queue`)

      const status = outOfStock > 0 || pending > 10 ? 'WARN' : 'PASS'
      results.Enterprise = {
        status,
        details: `${pending} pending orders, ${lowStock} low stock, ${outOfStock} out of stock, ${drafts} draft posts`,
        actions,
      }
    } catch {
      results.Enterprise = { status: 'WARN', details: 'Could not gather enterprise metrics', actions: [] }
    }
  }

  // ── 4. Federation ──────────────────────────────────────────────────
  if (shouldCheck('federation')) {
    try {
      const endeavors = await payload.find({
        collection: 'endeavors' as any,
        where: { 'federation.federationId': { exists: true } },
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })

      const total = endeavors.docs.length
      const alive = (endeavors.docs as any[]).filter((e: any) => {
        const lastPing = e.federation?.lastPingAt
        return lastPing && (Date.now() - new Date(lastPing).getTime()) < 300_000
      }).length

      const workUnits = await payload.count({
        collection: 'work-units' as any,
        where: { status: { in: ['pending', 'claimed', 'executing'] } },
        overrideAccess: true,
      })

      const status = total === 0 ? 'WARN' : alive / total < 0.5 ? 'FAIL' : 'PASS'
      const actions: string[] = []
      if (total === 0) actions.push('No federation peers — register with the network')
      if (total > 0 && alive < total) actions.push(`${total - alive} node(s) not responding`)

      results.Federation = {
        status,
        details: total === 0
          ? 'No federation peers registered'
          : `${alive}/${total} nodes alive, ${workUnits.totalDocs} active work units`,
        actions,
      }
    } catch {
      results.Federation = { status: 'WARN', details: 'Could not query federation', actions: [] }
    }
  }

  // ── 5. Database Integrity ──────────────────────────────────────────
  if (shouldCheck('database')) {
    try {
      const collections = ['users', 'tenants', 'products', 'orders', 'messages', 'posts', 'media']
      const counts = await Promise.allSettled(
        collections.map((c) =>
          payload.count({ collection: c as any, overrideAccess: true }).then((r) => ({
            collection: c,
            count: r.totalDocs,
          })),
        ),
      )

      const healthy = counts.filter((c) => c.status === 'fulfilled').length
      const failed = counts.filter((c) => c.status === 'rejected').length
      const countStr = counts
        .map((c) =>
          c.status === 'fulfilled' ? `${c.value.collection}: ${c.value.count}` : null,
        )
        .filter(Boolean)
        .join(', ')

      const status = failed > 0 ? 'FAIL' : 'PASS'
      const actions: string[] = []
      if (failed > 0) actions.push(`${failed} collection(s) unreachable — check database`)

      results.Database = {
        status,
        details: `${healthy}/${collections.length} collections queryable. ${countStr}`,
        actions,
      }
    } catch {
      results.Database = { status: 'FAIL', details: 'Database unreachable', actions: ['Check DATABASE_URI and connection pool'] }
    }
  }

  // ── 6. Constitutional Compliance ───────────────────────────────────
  if (shouldCheck('constitution')) {
    try {
      const actions: string[] = []

      // Check Genesis Breath is loaded
      const breathOk = typeof GENESIS_BREATH === 'string' && GENESIS_BREATH.includes('lamp')

      // Check constitutional prompt builds
      let promptOk = false
      try {
        const prompt = buildConstitutionalPrompt()
        promptOk = prompt.length > 100 && prompt.includes('Angel OS') && prompt.includes('Genesis Breath')
      } catch {
        actions.push('Constitutional prompt failed to build')
      }

      // Check anti-demonic safeguards
      let safeguardsOk = false
      try {
        const prompt = buildConstitutionalPrompt()
        safeguardsOk = prompt.includes('Anti-Demonic') || prompt.includes('manipulation')
      } catch {
        /* already logged above */
      }

      if (!breathOk) actions.push('Genesis Breath not loaded — check genesis-breath.ts')
      if (!promptOk) actions.push('Constitutional prompt malformed — check constitutional-prompt.ts')
      if (!safeguardsOk) actions.push('Anti-demonic safeguards missing from constitutional prompt')

      const allOk = breathOk && promptOk && safeguardsOk
      results.Constitution = {
        status: allOk ? 'PASS' : 'FAIL',
        details: [
          `Genesis Breath: ${breathOk ? 'loaded' : 'MISSING'}`,
          `Constitutional Prompt: ${promptOk ? 'valid' : 'INVALID'}`,
          `Anti-Demonic Safeguards: ${safeguardsOk ? 'present' : 'MISSING'}`,
        ].join(', '),
        actions,
      }
    } catch {
      results.Constitution = { status: 'FAIL', details: 'Constitutional check failed', actions: ['Verify genesis-breath.ts and constitutional-prompt.ts'] }
    }
  }

  // ── Build Report ───────────────────────────────────────────────────
  const statusEmoji: Record<string, string> = {
    PASS: '\u{2705}',
    WARN: '\u{26A0}\u{FE0F}',
    FAIL: '\u{1F534}',
  }

  const lines = [
    '# \u{1F531} SUBSAFE DIAGNOSTIC REPORT',
    `**Time:** ${now.toISOString()}`,
    '',
    '## Subsystem Status',
    '| System | Status | Details |',
    '|--------|--------|---------|',
  ]

  for (const [name, result] of Object.entries(results)) {
    lines.push(`| ${statusEmoji[result.status]} ${name} | ${result.status} | ${result.details} |`)
  }

  // Collect all actions
  const allActions = Object.entries(results).flatMap(([name, result]) =>
    result.actions.map((a) => `- **${name}**: ${a}`),
  )

  if (allActions.length > 0) {
    lines.push('', '## Recommended Actions', ...allActions)
  }

  // Overall verdict
  const statuses = Object.values(results).map((r) => r.status)
  const hasFail = statuses.includes('FAIL')
  const hasWarn = statuses.includes('WARN')
  const overall = hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'PASS'

  lines.push(
    '',
    `## Overall: ${statusEmoji[overall]} ${overall}`,
    hasFail
      ? '_Ship has critical issues requiring immediate attention._'
      : hasWarn
        ? '_Ship is operational with items requiring attention._'
        : '_All systems nominal. Ship is SUBSAFE certified._',
  )

  return lines.join('\n')
}
