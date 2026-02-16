/**
 * LEO Data Tools — P2.5
 *
 * Defines the tools LEO can use to query Payload collections.
 * Uses Claude's tool_use feature so LEO can decide when to fetch data.
 *
 * Architecture:
 *   - Tool definitions → sent to Claude API as `tools` parameter
 *   - Tool executor   → runs the Payload query when Claude requests a tool call
 *   - All queries use overrideAccess: true for public data, false for private data
 *
 * Note: We use `any` casts for Payload Where clauses and doc mappings because
 * the tool handlers build queries dynamically from LLM-provided inputs. The
 * Payload Where type system doesn't support runtime-constructed filter arrays
 * without explicit collection-specific generics.
 *
 * @see ConversationEngine.ts — integrates these tools into generateResponse()
 */

import type { Payload, Where } from 'payload'
import type Anthropic from '@anthropic-ai/sdk'

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
        return await queryProducts(payload, toolInput)
      case 'query_posts':
        return await queryPosts(payload, toolInput)
      case 'query_bookings':
        return await queryBookings(payload, toolInput)
      case 'query_spaces':
        return await querySpaces(payload, toolInput, tenantId)
      case 'query_projects':
        return await queryProjects(payload, toolInput)
      case 'query_availability':
        return await queryAvailability(payload, toolInput)
      case 'create_booking':
        return await createBooking(payload, toolInput, ctx)
      case 'update_booking_status':
        return await updateBookingStatus(payload, toolInput)
      case 'add_to_cart':
        return await addToCart(payload, toolInput, ctx)
      case 'view_cart':
        return await viewCart(payload, ctx)
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
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 5, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []

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
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 5, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [{ _status: { equals: 'published' } }]

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
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 5, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []

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
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 5, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []

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
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [{ isActive: { equals: true } }]

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
