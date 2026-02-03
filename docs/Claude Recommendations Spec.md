Angel OS v3 - Booking System & Advanced Features Technical Spec
Overview
This document details the comprehensive booking/scheduling system and advanced features that extend Angel OS beyond basic e-commerce into a unified platform for services, rentals, and on-demand fulfillment.

1. Booking System Core Requirements
1.1 Appointment Configuration in Cart
Goal: Seamlessly integrate appointments/bookings as cart items alongside physical products.
Key Features:

Price Flexibility: Appointments can be configured with any price point ($0 to $∞)

Free consultations ($0)
Paid services (hourly rates, flat fees, packages)
Deposits with balance due later
Sliding scale/donation-based pricing



Technical Approach:

Extend Payload's e-commerce product schema to include bookingType discriminator
Products can be: physical, digital, service, rental, borrow
Each type has specific metadata:

typescript  interface BookingProduct extends Product {
    bookingType: 'service' | 'rental' | 'borrow';
    duration?: number; // in minutes for services
    rentalPeriod?: { unit: 'hour' | 'day' | 'week', quantity: number };
    availability: CalendarAvailability;
    requiresApproval?: boolean; // for borrows
    depositAmount?: number;
  }
1.2 Appointment Page Flow
User Journey:

Browse services/rentals
Select date/time from availability calendar
Configure options (duration, add-ons)
Add to cart (with selected time slot held temporarily)
Checkout (payment if required, or just confirmation for free bookings)
Confirmation with calendar invite + reminders

Free vs. Paid Handling:

Free bookings ($0): Skip payment step, go straight to confirmation
Paid bookings: Standard Stripe checkout flow
Deposits: Charge deposit at booking, remainder at appointment time or later

1.3 Booking Types
Service Bookings (People's Time)

Examples: Consultations, haircuts, pressure washing, HVAC service calls
Configuration:

Service provider's calendar availability
Duration (30min, 1hr, 2hr, custom)
Pricing: hourly, flat rate, or sliding scale
Buffer time between appointments
Travel time for mobile services



Item Rentals

Examples: Equipment rental, venue booking, tool lending
Configuration:

Item availability calendar (one item can't be rented to multiple people simultaneously)
Rental periods (hourly, daily, weekly)
Pricing tiers (1 day, 3 days, week, month)
Deposit requirements
Late fee structure
Condition documentation (photos before/after)



Free Borrows

Examples: Community tool libraries, book lending, equipment sharing
Configuration:

Approval workflow (optional)
Borrowing periods
Waitlist for popular items
Reputation/trust scoring
Insurance/liability waivers




2. E-Commerce Template Extension Strategy
2.1 Current State

Payload's e-commerce template provides: products, categories, cart, checkout, orders
It's in beta but approaching stable release
Recent major breaking changes, but lead dev committed to stability

2.2 Extension Approach
Option A: Fork & Customize (Not recommended)

Creates maintenance burden
Diverges from upstream updates

Option B: Plugin/Hook Architecture (Recommended)

Create Angel OS Booking Plugin for Payload
Uses Payload's hook system to extend collections
Maintains compatibility with template updates
Can be shared with broader Payload community

Implementation:
typescript// angel-os-bookings plugin structure
export const angelOSBookingsPlugin = () => ({
  collections: {
    Bookings: BookingCollection,
    Availability: AvailabilityCollection,
    TimeSlots: TimeSlotCollection,
  },
  hooks: {
    'products.beforeChange': enhanceProductWithBookingFields,
    'cart.beforeChange': validateTimeSlotAvailability,
    'orders.afterChange': sendBookingConfirmations,
  },
  endpoints: [
    {
      path: '/availability/:productId',
      method: 'get',
      handler: getAvailableSlots,
    },
    {
      path: '/hold-slot',
      method: 'post',
      handler: temporarilyHoldTimeSlot,
    },
  ],
});
2.3 Data Model Extensions
New Collections:

Bookings - Confirmed appointments/rentals

Links to: Order, Product, User, TimeSlot
Status: pending, confirmed, in-progress, completed, cancelled
Metadata: start time, end time, notes, special requests


Availability - Provider/resource availability

Links to: Product (service/rental item)
Recurring schedules (e.g., "Mon-Fri 9am-5pm")
Exceptions (holidays, blocked times)
Buffer times


TimeSlots - Specific bookable time windows

Generated from Availability rules
Status: available, held (15min temp hold), booked
Prevent double-booking race conditions



Extended Collections:

Products - Add booking-specific fields

isBookable: boolean
bookingConfig: BookingConfiguration
requiresApproval: boolean (for borrows)


Orders - Link to Bookings

bookings: Booking[]
Special handling for booking confirmations




3. Federation Vision (Future Enhancement)
3.1 Cross-Instance Discovery
Scenario: User searches "pressure washer rental near Clearwater, FL"
Federation Flow:

Search query hits local Angel OS instance
Local instance returns local results
If federated search enabled, query propagates to federated network
Results aggregated from multiple Angel OS instances
User sees combined results with instance badges

Technical Approach:

ActivityPub protocol (used by Mastodon, etc.) for federation
Each Angel OS instance is a federated node
Bookable resources published to federated timeline
Search queries can traverse network
Trust/reputation scores at instance level

3.2 Benefits

Network effects: More resources available = more value
Community resilience: No single point of failure
Local-first, global-aware: Prioritize local results, but expand options
Privacy-respecting: Instances control what they share

3.3 Technical Considerations

Performance: Caching, CDN for federated queries
Security: Instance authentication, rate limiting
Privacy: Configurable sharing levels per tenant
Moderation: Block/trust lists for instances


4. LEO-Assisted Site Provisioning
4.1 Concept
User Experience:
User: "I want to start a pressure washing business"

LEO: "Great! I'll set up a professional site for you. What's your business name?"

User: "Crystal Clean Pressure Washing"

LEO: "Perfect. I'm creating your site now with:
     - Professional homepage with before/after gallery
     - Services: Residential, Commercial, Driveways, Roofs
     - Online booking for estimates and service
     - Pricing calculator
     - Customer testimonials section
     - Google Reviews integration
     - Contact form
     - Schwag store (t-shirts, hats with your logo)
     
     Your site is ready at: crystalclean.angel-os.com
     Let me know if you want to customize anything!"
4.2 Technical Implementation
LEO (Large Language Model + Orchestration):

Uses Claude/GPT API for conversation
Contextual understanding of business type
Template selection based on industry
Content generation (copy, SEO metadata)
Asset generation (placeholder images via AI, logo suggestions)

Provisioning Engine:
typescriptinterface ProvisioningRequest {
  businessName: string;
  industry: string; // 'pressure-washing', 'hvac', 'consulting', etc.
  location?: string;
  serviceTypes?: string[];
  preferences?: UserPreferences;
}

async function provisionTenant(request: ProvisioningRequest) {
  // 1. Create tenant in multi-tenant system
  const tenant = await createTenant(request.businessName);
  
  // 2. Select and apply industry template
  const template = await getTemplate(request.industry);
  await applyTemplate(tenant, template);
  
  // 3. Generate content via LEO
  const content = await generateContent(request);
  await populateContent(tenant, content);
  
  // 4. Configure services/products
  const services = await configureServices(request.serviceTypes);
  await createProducts(tenant, services);
  
  // 5. Set up integrations (Google Reviews, etc.)
  await setupIntegrations(tenant, request.location);
  
  // 6. Generate subdomain/custom domain
  const url = await assignDomain(tenant);
  
  return { tenant, url, credentials };
}
Industry Templates:

Pressure Washing: Services, before/after galleries, pricing calculator
HVAC: Emergency service, seasonal maintenance plans, financing info
Consulting: Services, case studies, booking for discovery calls
Cleaning: Residential/commercial toggle, recurring service plans
Event Services: Portfolio, package deals, availability calendar

4.3 "Looks Like They've Been in Business for Years"
Key Elements:

Professional Homepage:

Hero image (AI-generated or stock)
Compelling copy (LEO-generated)
Trust signals (testimonials, reviews, certifications)
Clear CTAs


Pre-populated Content:

Service descriptions
FAQ section
About Us (template + customizable)
Blog posts (industry tips - shows expertise)


Social Proof:

Google Reviews widget (connected to their GMB)
Testimonials (template examples they can replace)
"Years in Business" counter (they set the actual date)


Functionality:

Working contact form
Online booking
Price calculator/quote request
Newsletter signup


SEO Ready:

Meta descriptions
Schema.org markup
Sitemap
Local business structured data




5. Google Reviews Integration
5.1 Goals

Automatically display Google Reviews on site
Encourage customers to leave reviews post-service
Monitor review sentiment
Respond to reviews (via LEO assistance)

5.2 Technical Approach
Google My Business API Integration:
typescriptinterface GoogleReviewsIntegration {
  // Configuration
  gmb_account_id: string;
  location_id: string;
  
  // Sync reviews
  syncReviews(): Promise<Review[]>;
  
  // Display widget
  getReviewsWidget(): ReviewsWidgetComponent;
  
  // Post-booking follow-up
  sendReviewRequest(booking: Booking): Promise<void>;
  
  // AI-assisted responses
  generateReviewResponse(review: Review): Promise<string>;
}
Features:

Automatic Sync: Pull reviews from GMB hourly/daily
Display Widget: Configurable widget for homepage
Review Requests: Automated email/SMS after service completion
Sentiment Monitoring: Alert tenant to negative reviews
LEO Response Drafts: AI suggests responses to reviews

5.3 Review Request Flow
Post-Service Automation:

Booking marked as "completed"
Wait 24-48 hours (configurable)
Send review request email with direct GMB link
Track if review is left
Send thank-you message for positive reviews
Offer to address issues for negative reviews


6. On-Demand Schwag Fulfillment
6.1 Concept
Problem: Many businesses want branded merchandise but can't afford inventory.
Solution: On-demand printing integrated into e-commerce flow.
6.2 Print-on-Demand Integration
Partner Example: Largo Publishing (or similar)
Flow:

Customer clicks "Buy Now" on branded t-shirt
Order placed in Angel OS
Angel OS webhook triggers to Largo's API
Specifications + design files sent to Largo
Largo prints and ships directly to customer
Tracking info sent back to Angel OS
Customer receives product

Technical Integration:
typescriptinterface PrintOnDemandOrder {
  product: {
    type: 'tshirt' | 'hat' | 'mug' | 'poster' | 'sticker';
    size?: string;
    color?: string;
    quantity: number;
  };
  design: {
    file_url: string; // URL to design file (PNG, SVG, etc.)
    placement: 'front' | 'back' | 'both';
    print_type: 'screen' | 'dtg' | 'embroidery';
  };
  shipping: ShippingAddress;
  rush?: boolean;
}

class PrintFulfillmentService {
  async submitOrder(order: PrintOnDemandOrder): Promise<FulfillmentResult> {
    // 1. Generate print-ready files
    const printFiles = await this.preparePrintFiles(order.design);
    
    // 2. Submit to print partner API
    const fulfillmentOrder = await this.partnerAPI.createOrder({
      items: [order.product],
      files: printFiles,
      shipping: order.shipping,
    });
    
    // 3. Track status
    await this.createTrackingRecord(fulfillmentOrder);
    
    return fulfillmentOrder;
  }
  
  async checkStatus(orderId: string): Promise<OrderStatus> {
    return await this.partnerAPI.getOrderStatus(orderId);
  }
}
6.3 Multiple Partner Strategy
Why Multiple Partners:

Geographic coverage (reduce shipping times)
Product specialization (one for apparel, one for signage)
Pricing competition
Redundancy (if one is backlogged)

Partner Selection Logic:
typescriptasync function selectFulfillmentPartner(
  product: Product,
  location: Location
): Promise<Partner> {
  const partners = await getFulfillmentPartners({
    productType: product.type,
    servingRegion: location.region,
  });
  
  // Score partners on:
  // - Geographic proximity (faster shipping)
  // - Pricing
  // - Quality rating
  // - Current lead time
  const scored = partners.map(p => ({
    partner: p,
    score: calculateScore(p, product, location),
  }));
  
  return scored.sort((a, b) => b.score - a.score)[0].partner;
}
6.4 Spec-Driven Relationship
Partnership Agreement Template:
yamlpartner:
  name: "Largo Publishing"
  api_endpoint: "https://api.largopublishing.com/v1"
  authentication: "api_key"
  
products_supported:
  - type: "tshirt"
    sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"]
    colors: ["white", "black", "gray", "navy", "red"]
    base_price: 12.50
    print_methods: ["screen", "dtg"]
    
  - type: "hat"
    styles: ["baseball", "trucker", "beanie"]
    base_price: 15.00
    print_methods: ["embroidery"]

lead_times:
  standard: "5-7 business days"
  rush: "2-3 business days"
  
shipping:
  domestic: "4-6 days"
  international: "10-14 days"
  
file_requirements:
  formats: ["PNG", "SVG", "PDF"]
  min_resolution: "300 DPI"
  max_file_size: "50MB"
  color_mode: "CMYK or RGB"

revenue_share:
  model: "cost_plus"
  angel_os_markup: "40%"  # We charge customer 40% above partner's cost
Benefits:

Clear expectations for each partner
Easy to compare partners
Automated order routing based on specs
Consistent experience across partners


7. Integration Summary & MVP Scope
7.1 MVP (6-8 weeks)
Must Have:

 Basic booking system (services only, paid appointments)
 Calendar availability configuration
 Booking in cart + checkout
 Email confirmations for bookings
 Multi-tenant isolation working and tested

Should Have:

 Free appointment support
 Basic LEO conversational interface (text-based)
 Simple Google Reviews display widget

Won't Have (Post-MVP):

Federation (complex, requires network)
Full LEO site provisioning (can start with templates)
On-demand fulfillment (requires partner agreements)
Rental/borrow functionality (services are simpler to start)

7.2 Post-MVP Roadmap
Phase 2 (Months 3-6):

Rental/borrow system
LEO site provisioning (automated template setup)
Google Reviews full integration
First print-on-demand partner (Largo or similar)

Phase 3 (Months 6-12):

Multiple fulfillment partners
Federation protocol v1
Advanced LEO features (image generation, multi-turn setup)
Mobile apps

Phase 4 (Year 2+):

Full federated network
AI-powered business insights
Marketplace for templates and plugins
White-label opportunities


8. Technical Risks & Mitigations
8.1 Booking System Complexity
Risk: Integrating bookings with e-commerce is complex, many edge cases.
Mitigation:

Start with services only (simpler than rentals)
Use existing scheduling libraries (FullCalendar, react-big-calendar)
Implement double-booking prevention carefully (database locks)
Extensive testing of booking flows

8.2 Multi-Tenant Isolation
Risk: Tenant data leakage would be catastrophic.
Mitigation:

Row-level security in PostgreSQL
Every query includes tenant context
Automated tests for tenant isolation
Security audit before launch

8.3 Print-on-Demand Integration
Risk: Partner APIs change, or partner goes out of business.
Mitigation:

Abstract partner integrations behind adapter pattern
Multiple partners from the start (reduces single point of failure)
Contract with partners for API stability
Fallback to manual order processing if API fails

8.4 LEO Provisioning Quality
Risk: AI-generated sites might be low quality or inappropriate.
Mitigation:

Human review step before site goes live (at least initially)
Template-based with AI filling in blanks (safer than full generation)
User can edit everything LEO creates
Start with limited industries, expand as we refine

8.5 Google Reviews API Limitations
Risk: API rate limits, costs, or policy changes.
Mitigation:

Cache reviews locally (sync periodically, not real-time)
Graceful degradation if API unavailable
Alternative: manual review entry as backup
Clear ToS compliance (follow Google's rules)


9. Success Metrics
9.1 MVP Success Criteria

10 beta tenants actively using booking system
50+ bookings successfully processed
Zero tenant data leakage incidents
95%+ booking flow completion rate (cart to confirmation)
<5% booking cancellation rate due to technical issues

9.2 Phase 2 Success Criteria

100+ tenants
1000+ bookings per month
First print-on-demand orders successfully fulfilled
LEO provisions 50+ sites
4.5+ star average rating on generated sites

9.3 Long-Term Success

1000+ tenants
Federation network with 10+ Angel OS instances
$100K+ MRR
Print-on-demand partnerships with 3+ partners
Industry recognition as innovative platform


10. Development Priorities
Immediate (Weeks 1-2)

Finalize booking data model
Extend Payload collections for bookings
Build availability configuration UI
Implement time slot generation algorithm

Short-term (Weeks 3-4)

Booking flow in cart/checkout
Calendar UI component
Email confirmation system
Multi-tenant testing framework

Medium-term (Weeks 5-8)

Free appointment support
Basic LEO text interface
Google Reviews display widget
Production deployment + testing

Post-MVP (Months 3+)

Rental/borrow system
Full LEO provisioning
Print-on-demand integration
Federation research and prototyping


Conclusion
The booking system is the bridge between basic e-commerce and the full Angel OS vision. It's complex but essential. By starting with services (simpler than rentals), using Payload's extension points, and building systematically, we can deliver a production-ready booking system within the MVP timeline while laying the foundation for the more ambitious features (federation, LEO provisioning, on-demand fulfillment) in subsequent phases.
The key is to not let the scope of the vision delay the MVP. Ship the core booking functionality first, prove it works, then iterate toward the full vision.