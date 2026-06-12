/**
 * Canonical display names for LEO tool calls.
 * Single source of truth — used by both streaming indicators and message display.
 */
export const TOOL_LABELS: Record<string, string> = {
  // Queries
  query_products: 'Looking up products',
  query_posts: 'Searching posts',
  query_bookings: 'Checking bookings',
  query_spaces: 'Finding spaces',
  query_projects: 'Browsing projects',
  query_availability: 'Checking availability',
  query_orders: 'Looking up orders',

  // Cart & Commerce
  add_to_cart: 'Adding to cart',
  view_cart: 'Checking cart',

  // Image
  generate_image: '\u{1F3A8} Generating image',
  improve_image: '\u{2728} Improving image',
  attach_image_to_product: '\u{1F4CE} Attaching to product',
  replace_image: '\u{1F504} Replacing image',
  set_endeavor_image: '\u{1F5BC}\u{FE0F} Setting Endeavor image',

  // Bookings
  create_booking: 'Creating booking',
  update_booking_status: 'Updating booking',

  // Products
  create_product: 'Creating product',
  update_product: 'Updating product',

  // Collaboration
  invite_member: 'Sending invitation',

  // Network / Vendor
  find_producers: 'Finding capable producers',
  browse_network: 'Browsing network catalog',
  route_order: 'Routing order to vendor',
  accept_order: 'Accepting order',
  update_fulfillment: 'Updating fulfillment',

  // Platform / Fees
  check_fees: 'Checking platform fees',

  // Multi-Channel Messaging
  send_email: 'Sending email',
  send_whatsapp: 'Sending WhatsApp message',
  send_telegram: 'Sending Telegram message',
  send_sms: 'Sending SMS',
  send_slack: 'Sending Slack message',

  // Federation
  send_federation_message: 'Sending federation message',

  // Federation Broadcast & Handoff
  broadcast_federation_message: 'Broadcasting to federation',
  leo_handoff: 'Handing off to Leo',

  // Federation Browsing (Sprint 38)
  browse_federation_peers: 'Browsing federation peers',
  query_peer_catalog: 'Querying peer catalog',
  search_federation_wide: 'Searching federation network',

  // Street Signs Gossip (Sprint 39)
  discover_federation_products: 'Scanning federation street signs',

  // Generic Payload CRUD
  payload_find: 'Querying collection',
  payload_update: 'Updating record',
  payload_create: 'Creating record',
  payload_delete: 'Deleting record',

  // Navigation
  query_navigation: 'Checking site navigation',
  update_navigation: 'Updating navigation menu',
}
