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
}
