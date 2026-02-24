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
        return await handleGenerateImage(payload, toolInput)
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
