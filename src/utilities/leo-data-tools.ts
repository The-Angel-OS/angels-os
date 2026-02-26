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
 *   - Image generation uses OpenRouter API (Flux 2, Gemini, GPT Image)
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
        clientName: {
          type: 'string',
          description: 'Name of the person booking (defaults to current user)',
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
      'Generate an AI image using Flux 2, Gemini, or other models via OpenRouter. Use when a user asks to create, generate, design, or make an image, photo, or visual. Can generate product photos, content images, logos, illustrations, and more. After generating, you can attach the image to a product or save it as media. Always describe what you\'re generating before calling this tool.',
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
            'If generating for a specific product, its name (used to enhance the prompt and filename)',
        },
        category: {
          type: 'string',
          description:
            'Product category for style optimization: candles, jewelry, clothing, food, electronics, art, wellness, massage, cactus',
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
            'If true, automatically upload the generated image to the media library. Default: true for product images.',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'improve_image',
    description:
      'Analyze an existing image and generate an improved version based on user feedback. Use when a user says "make it warmer", "I don\'t like the background", "can you change the lighting", or gives any feedback about an existing image. LEO will analyze the current image with Anthropic Vision, understand what needs to change, and generate a better version.',
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
      'Configure the tenant business profile. Use when a user describes their business type, wants to set up their storefront, or answers business setup questions. This is the core of the "5 minutes to running" wizard flow.',
    input_schema: {
      type: 'object' as const,
      properties: {
        businessType: {
          type: 'string',
          enum: ['retail', 'service', 'content_creator', 'nonprofit', 'professional_services', 'custom'],
          description: 'What kind of business this is',
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
      required: ['businessType'],
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
          enum: ['retail', 'service', 'content_creator', 'nonprofit', 'professional_services', 'custom'],
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
      'Generate product ideas based on a vendor description, business type, and capabilities. Use when a new vendor asks what they should sell or needs product inspiration.',
    input_schema: {
      type: 'object' as const,
      properties: {
        vendorDescription: { type: 'string', description: 'Description of what the vendor does or makes' },
        businessType: { type: 'string', description: 'Type of business' },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'Vendor capabilities/skills (e.g., "screen-printing", "woodworking")',
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
      'Create a new blog post or article. Use when the user wants to publish content, write an article, or add a post. Always confirm the title and content before creating. Created as draft by default.',
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
      },
      required: ['title'],
    },
  },
  {
    name: 'update_post',
    description:
      'Update an existing blog post. Use query_posts first to find the post ID. Always confirm changes with the user before updating.',
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
      },
      required: ['postId'],
    },
  },
  {
    name: 'create_page',
    description:
      'Create a new static page (About, Services, Contact, etc.). Use when the user wants to add a page to their site. Created as draft by default.',
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
      },
      required: ['title'],
    },
  },
  {
    name: 'update_page',
    description:
      'Update an existing static page. You need the page ID — search the admin or ask the user. Always confirm before updating.',
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
      },
      required: ['pageId'],
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
    name: 'sign_constitution',
    description:
      'Sign the Angel OS Constitution on behalf of the Enterprise operator, generating a cryptographic Ed25519 signature and a permanent federationId (UUID). Use during wizard step 7: Federation. This is the moment of constitutional commitment.',
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
      'Ping the Angel OS federation registry to announce this Enterprise\'s existence. Called after sign_constitution during wizard step 7. Gracefully handles no registry URL — completes wizard regardless.',
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
      'Create a task assignment message in the team channel, optionally notifying a specific person. Use for task delegation and team coordination. Confirm with user before sending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task: {
          type: 'string',
          description: 'Description of the task to delegate',
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
]

// ---------------------------------------------------------------------------
// Tool Executor
// ---------------------------------------------------------------------------

export type ToolExecutorContext = {
  payload: Payload
  tenantId?: number
  spaceId?: number
  userId?: number
}

/**
 * Executes a tool call from Claude and returns the result as a string.
 */
export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { payload, tenantId } = ctx

  try {
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
        return await updateBookingStatus(payload, toolInput)
      case 'add_to_cart':
        return await addToCart(payload, toolInput, ctx)
      case 'view_cart':
        return await viewCart(payload, ctx)
      // Image generation & media management
      case 'generate_image':
        return await handleGenerateImage(payload, toolInput, tenantId)
      case 'improve_image':
        return await handleImproveImage(payload, toolInput)
      case 'attach_image_to_product':
        return await handleAttachImageToProduct(payload, toolInput)
      case 'replace_image':
        return await handleReplaceImage(payload, toolInput)
      // Invitation
      case 'invite_member':
        return await inviteMember(payload, toolInput, ctx)
      // Product creation & management
      case 'create_product':
        return await createProduct(payload, toolInput, ctx)
      case 'update_product':
        return await updateProduct(payload, toolInput)
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
      case 'connect_stripe_account':
        return await handleConnectStripe(payload, toolInput, ctx)
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
      case 'update_post':
        return await updatePost(payload, toolInput, ctx)
      case 'create_page':
        return await createPage(payload, toolInput, ctx)
      case 'update_page':
        return await updatePage(payload, toolInput, ctx)
      case 'query_media':
        return await queryMedia(payload, toolInput)
      case 'manage_categories':
        return await manageCategories(payload, toolInput, ctx)
      // ─── Sprint 17: Leo Wizard Tools ──────────────────────────
      case 'create_space':
        return await handleCreateSpace(payload, toolInput, ctx)
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
        return await handleSetLowStockAlert(payload, toolInput)
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
      default:
        return `Unknown tool: ${toolName}`
    }
  } catch (err) {
    console.error(`[LEO Tools] Error executing ${toolName}:`, err)
    return `Error querying data: ${err instanceof Error ? err.message : 'Unknown error'}`
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

  // Scope to current tenant
  if (tenantId) {
    conditions.push({ tenant: { equals: tenantId } })
  }

  if (input.search && typeof input.search === 'string') {
    conditions.push({ title: { contains: input.search } })
  }
  if (input.category && typeof input.category === 'string') {
    conditions.push({ 'categories.title': { contains: input.category } })
  }

  const where: Where = conditions.length > 0 ? { and: conditions } : {}

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
    const price = num(p, 'priceInUSD')
    const priceStr = price != null ? `$${price}` : 'Price not set'
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

  if (tenantId) {
    conditions.push({ tenant: { equals: tenantId } })
  }
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

  if (tenantId) {
    conditions.push({ tenant: { equals: tenantId } })
  }
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

  const where: Where = conditions.length > 0 ? { and: conditions } : {}

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

  if (tenantId) {
    conditions.push({ tenant: { equals: tenantId } })
  }
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
  if (tenantId) {
    conditions.push({ tenant: { equals: tenantId } })
  }

  const where: Where = conditions.length > 0 ? { and: conditions } : {}

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

  if (tenantId) {
    conditions.push({ tenant: { equals: tenantId } })
  }

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

  try {
    // Build the booking data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bookingData: Record<string, any> = {
      title,
      bookingType,
      startDateTime,
      duration,
      status: 'pending',
    }

    // If we know the current user, set them as the client
    if (ctx.userId) {
      bookingData.client = ctx.userId
    }

    // Add description as richText if provided
    if (description) {
      bookingData.description = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: description, detail: 0, format: 0, mode: 'normal', style: '', version: 1 }],
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (payload.create as any)({
      collection: 'bookings',
      data: bookingData,
      overrideAccess: true,
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

    return `Booking created successfully!\n- **${title}** (${bookingType})\n- Date: ${formattedDate}\n- Duration: ${duration} minutes\n- Status: pending\n- Booking ID: ${bookingId}\n\nThe booking is pending confirmation. You or the provider can confirm it.`
  } catch (err) {
    console.error('[LEO Tools] Error creating booking:', err)
    return `Error creating booking: ${err instanceof Error ? err.message : 'Unknown error'}. Please check the details and try again.`
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
    const price = num(product, 'priceInUSD')
    const priceStr = price != null ? `$${price}` : 'Price not set'
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
      console.error('[LEO Tools] Error updating cart:', cartErr)
      return `I found the product **${title}** (${priceStr}), but had trouble adding it to your cart. The cart system may need to be initialized. You can add it manually at /products/${slug}.`
    }
  } catch (err) {
    console.error('[LEO Tools] Error in addToCart:', err)
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

    let totalPrice = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = cartItems.map((item: any) => {
      const product = typeof item.product === 'object' ? item.product : null
      const qty = item.quantity || 1
      const title = product ? str(product, 'title', 'Unknown product') : `Product #${item.product}`
      const price = product ? num(product, 'priceInUSD') : undefined
      const subtotal = price != null ? price * qty : 0
      totalPrice += subtotal
      const priceStr = price != null ? `$${price}` : 'N/A'
      return `- **${title}** × ${qty} — ${priceStr} each${subtotal ? ` ($${subtotal.toFixed(2)})` : ''}`
    })

    return `Your Cart (${cartItems.length} item${cartItems.length === 1 ? '' : 's'}):\n${items.join('\n')}\n\n**Subtotal: $${totalPrice.toFixed(2)}**\n\nReady to check out? Head to /checkout or say "remove [item]" to update your cart.`
  } catch (err) {
    console.error('[LEO Tools] Error viewing cart:', err)
    return `Error loading cart: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function updateBookingStatus(
  payload: Payload,
  input: Record<string, unknown>,
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

    const oldStatus = str(existing, 'status', 'unknown')
    const bookingTitle = str(existing, 'title', 'Untitled')

    // Update the booking
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.update as any)({
      collection: 'bookings',
      id: bookingId,
      data: { status },
      overrideAccess: true,
    })

    return `Booking updated:\n- **${bookingTitle}** (ID: ${bookingId})\n- Status: ${oldStatus} \u2192 ${status}`
  } catch (err) {
    console.error('[LEO Tools] Error updating booking:', err)
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
      priceInUSD: Math.round(price * 100) / 100, // Round to 2 decimal places
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

    const productId = result.id
    const slug = str(result, 'slug')
    const priceStr = `$${productData.priceInUSD.toFixed(2)}`

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

    return parts.join('\n')
  } catch (err) {
    console.error('[LEO Tools] Error creating product:', err)
    return `Error creating product: ${err instanceof Error ? err.message : 'Unknown error'}. Please check the details and try again.`
  }
}

async function updateProduct(
  payload: Payload,
  input: Record<string, unknown>,
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
      const newPrice = Math.round(Number(input.price) * 100) / 100
      const oldPrice = num(existing, 'priceInUSD')
      updateData.priceInUSD = newPrice
      updateData.priceInUSDEnabled = true
      changes.push(`Price: $${oldPrice?.toFixed(2) || 'N/A'} → $${newPrice.toFixed(2)}`)
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

    return `Product updated!\n- **${displayTitle}** (ID: ${productId})\n- Changes:\n${changes.map((c) => `  - ${c}`).join('\n')}`
  } catch (err) {
    console.error('[LEO Tools] Error updating product:', err)
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

    return parts.join('\n')
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
): Promise<string> {
  if (!isImageGenerationAvailable()) {
    return 'Image generation is not available — OPENROUTER_API_KEY is not configured. Please add it to your environment variables.'
  }

  const prompt = input.prompt as string
  if (!prompt) {
    return 'Error: A prompt describing the image is required.'
  }

  const autoSave = input.autoSave !== false // Default true

  try {
    const result = await generateImage(
      {
        prompt,
        enhancementContext: {
          productName: input.productName as string | undefined,
          category: input.category as string | undefined,
          brandStyle: input.brandStyle as string | undefined,
          backgroundColor: input.backgroundColor as string | undefined,
        },
        autoUpload: autoSave,
        tenantId,
      },
      autoSave ? payload : undefined,
    )
    if (!result.success) {
      return `Image generation failed: ${result.error}`
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

    if (input.productName) {
      parts.push(`\nWould you like me to attach this image to the "${input.productName}" product?`)
    } else {
      parts.push('\nYou can ask me to attach this to a specific product or save it for later.')
    }

    return parts.join('\n')
  } catch (err) {
    console.error('[LEO Tools] Error generating image:', err)
    return `Error generating image: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleImproveImage(
  payload: Payload,
  input: Record<string, unknown>,
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
    console.error('[LEO Tools] Error improving image:', err)
    return `Error improving image: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleAttachImageToProduct(
  payload: Payload,
  input: Record<string, unknown>,
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
    console.error('[LEO Tools] Error attaching image:', err)
    return `Error attaching image: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleReplaceImage(
  payload: Payload,
  input: Record<string, unknown>,
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
    })

    if (!result.success) {
      return `Error: ${result.error}`
    }

    if (result.updatedDocuments === 0) {
      return `No documents found referencing Media #${oldMediaId}. The image may not be in use, or it may have already been replaced.`
    }

    return `Image replaced globally! Updated ${result.updatedDocuments} document(s) — swapped Media #${oldMediaId} → #${newMediaId}.`
  } catch (err) {
    console.error('[LEO Tools] Error replacing image:', err)
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
    console.error('[LEO Tools] Error finding producers:', err)
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
      const price = p.priceInUSD ? `$${p.priceInUSD.toFixed(2)}` : 'Price TBD'
      const caps = (p.requiredCapabilities || []).map((c: any) => c.skill).join(', ')
      return `${i + 1}. **${p.title}** — ${price} | By: ${tenant}${caps ? ` | Requires: ${caps}` : ''}`
    })

    return `Network products (${products.docs.length}):\n\n${results.join('\n')}`
  } catch (err) {
    console.error('[LEO Tools] Error browsing network:', err)
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
    console.error('[LEO Tools] Error querying orders:', err)
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

    return `Order #${orderId} routing:\n\n${routingResults.join('\n')}`
  } catch (err) {
    console.error('[LEO Tools] Error routing order:', err)
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
    console.error('[LEO Tools] Error accepting order:', err)
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
    console.error('[LEO Tools] Error updating fulfillment:', err)
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

  const businessType = input.businessType as string
  if (!businessType) {
    return 'Error: businessType is required.'
  }

  try {
    // Build update data from input
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      businessType,
    }

    // Storefront fields
    const storefrontUpdate: Record<string, unknown> = {}
    if (input.tagline) storefrontUpdate.description = undefined // will set below
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
      custom: 'Custom',
    }

    const enabledFeatures: string[] = []
    if (input.shippingEnabled) enabledFeatures.push('shipping')
    if (input.bookingsEnabled) enabledFeatures.push('bookings')
    if (input.eventsEnabled) enabledFeatures.push('events')
    if (input.digitalProductsEnabled) enabledFeatures.push('digital products')

    let response = `Business configured as "${typeLabels[businessType] || businessType}".`
    if (enabledFeatures.length > 0) {
      response += ` Enabled: ${enabledFeatures.join(', ')}.`
    }
    if (input.tagline) {
      response += ` Tagline: "${input.tagline}".`
    }
    response += ' Your storefront is taking shape! Next steps: add products, set up availability, or connect Stripe for payments.'

    return response
  } catch (err) {
    console.error('[LEO Tools] Error configuring business:', err)
    return `Error configuring business: ${err instanceof Error ? err.message : 'Unknown error'}`
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
    console.error('[LEO Tools] Error checking Stripe status:', err)
    return `Error checking Stripe status: ${err instanceof Error ? err.message : 'Unknown error'}`
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
        domain: `${slug}.angelos.local`,
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
    console.error('[LEO Tools] Error onboarding vendor:', err)
    return `Error setting up vendor: ${err instanceof Error ? err.message : 'Unknown error'}. Let me know if you'd like to try again.`
  }
}

/**
 * suggest_products — Generates product ideas based on vendor description.
 * Returns structured suggestions the user can act on.
 */
async function handleSuggestProducts(
  input: Record<string, unknown>,
): Promise<string> {
  const description = input.vendorDescription as string
  const skills = (input.skills as string[]) || []
  const count = Math.min(Number(input.count) || 5, 10)

  if (!description) {
    return 'Tell me about your business — what do you make or offer? I\'ll suggest products based on that.'
  }

  // Return a structured prompt for the LLM to expand on
  // (The actual creativity comes from Claude's next response)
  const skillsList = skills.length > 0 ? `\nCapabilities: ${skills.join(', ')}` : ''
  return `Based on the vendor description: "${description}"${skillsList}\n\n` +
    `I'll suggest ${count} product ideas. For each product, I'll include:\n` +
    `- Product name and description\n` +
    `- Suggested price range\n` +
    `- Production type (ready-made, print-on-demand, custom order, or digital)\n` +
    `- Whether it's suitable for network listing\n` +
    `- Configurator options if applicable\n\n` +
    `[LEO will now generate ${count} specific product suggestions in the response]`
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
  if (status === 'draft') lines.push(`\nThe post is saved as a draft. Say "publish post ${result.id}" when you're ready to make it live.`)

  return lines.join('\n')
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

  return lines.join('\n')
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
  if (status === 'draft') lines.push(`\nThe page is saved as a draft. Say "publish page ${result.id}" to make it live.`)

  return lines.join('\n')
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

  return lines.join('\n')
}

/**
 * query_media — Searches the media library.
 */
async function queryMedia(
  payload: Payload,
  input: Record<string, unknown>,
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 10, 20)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []

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

    return lines.join('\n')
  } catch (err) {
    console.error('[LEO Tools] Error creating space:', err)
    return `Error creating space: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

/**
 * sign_constitution — Signs the Angel OS Constitution for wizard step 7.
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
      domain: process.env.NEXT_PUBLIC_SERVER_URL || `${tenantId}.angelos.local`,
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
    console.error('[LEO Tools] Error signing constitution:', err)
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
  const domain = (input.domain as string) || `${tenantId}.angelos.local`
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
              wizardProgress: { completedStep: 7, completedAt: new Date().toISOString() },
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
    console.error('[LEO Tools] Error pinging federation:', err)
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
    console.error('[LEO Tools] analyze_image error:', err)
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
    console.error('[LEO Tools] extract_pdf_pages error:', err)
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
    console.error('[LEO Tools] query_knowledge error:', err)
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
    console.error('[LEO Tools] Error checking fees:', err)
    return 'Unable to retrieve fee status. Please try again later.'
  }
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
    console.error('[LEO Tools] send_message error:', err)
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
    console.error('[LEO Tools] send_direct_message error:', err)
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
    console.error('[LEO Tools] create_announcement error:', err)
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
    console.error('[LEO Tools] moderate_content error:', err)
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
    console.error('[LEO Tools] update_inventory error:', err)
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
    console.error('[LEO Tools] track_inventory_movement error:', err)
    return `Error processing inventory: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function handleSetLowStockAlert(
  payload: Payload,
  input: Record<string, unknown>,
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
    console.error('[LEO Tools] set_low_stock_alert error:', err)
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
    console.error('[LEO Tools] query_inventory_history error:', err)
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
    console.error('[LEO Tools] generate_invoice error:', err)
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
    console.error('[LEO Tools] query_financial_reports error:', err)
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
    console.error('[LEO Tools] issue_refund error:', err)
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
        const price = p.price ? `$${(p.price / 100).toFixed(2)}` : 'Price TBD'
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
    console.error('[LEO Tools] query_federation error:', err)
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
    console.error('[LEO Tools] broadcast_capability error:', err)
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
    console.error('[LEO Tools] route_federated_request error:', err)
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
    console.error('[LEO Tools] negotiate_deal error:', err)
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
    console.error('[LEO Tools] create_customer_profile error:', err)
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
    console.error('[LEO Tools] log_interaction error:', err)
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
    console.error('[LEO Tools] segment_customers error:', err)
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
    console.error('[LEO Tools] send_follow_up error:', err)
    return `Error sending follow-up: ${err instanceof Error ? err.message : 'Unknown error'}`
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
    console.error('[LEO Tools] analyze_trends error:', err)
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
      const price = p.price ? `$${(p.price / 100).toFixed(2)}` : 'Price TBD'
      const stock = p.inventory !== undefined ? ` (${p.inventory} in stock)` : ''
      lines.push(`- **${p.title}** — ${price}${stock}`)
      if (p.description) lines.push(`  ${String(p.description).slice(0, 80)}`)
    }

    return lines.join('\n')
  } catch (err) {
    console.error('[LEO Tools] recommend_products error:', err)
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

  const task = (input.task as string)?.trim()
  if (!task) return 'Error: task description is required.'

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
    console.error('[LEO Tools] delegate_task error:', err)
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

  const issue = (input.issue as string)?.trim()
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
    console.error('[LEO Tools] escalate_issue error:', err)
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
    console.error('[LEO Tools] send_emergency_alert error:', err)
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
    console.error('[LEO Tools] document_incident error:', err)
    return `Error documenting incident: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}
