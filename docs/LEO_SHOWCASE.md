# Meet Leo — Your Guardian Angel

> *"I'm Leo. I'm not a chatbot bolted onto a platform. I AM the platform during onboarding, and your companion every day after."*

---

## What Leo Can Do

Leo is the AI guardian angel at the heart of every Angel OS Diocese. Powered by Anthropic's Claude, Leo manages both sides of every transaction — buyer and seller — from the same conversational interface. No menus to learn. No manuals to read. Just tell Leo what you need.

### For Enterprise Operators (Diocese Owners)

**Set up your entire Diocese through conversation.** Leo walks you through DNS, branding, constitution acceptance, federation registration, and your first product listing. 15 minutes from zero to federated.

| Capability | What Leo Does |
|-----------|--------------|
| **Enterprise Setup** | Configures branding, domain, timezone, payment processing |
| **Product Creation** | Creates product listings with descriptions, pricing, images, variants |
| **Vendor Onboarding** | Registers makers with capabilities, equipment, service areas |
| **Space Management** | Creates workspaces, channels, invites team members |
| **Order Oversight** | Routes orders to qualified makers, monitors fulfillment pipeline |
| **Content Publishing** | Creates posts, pages, manages categories and media |
| **Revenue Monitoring** | Tracks Toward-53 splits, Stripe Connect earnings, Justice Fund contributions |
| **Federation Status** | Shows network health, Street Signs performance, governance proposals |

### For Customers (Endeavor Visitors)

**Shop, book, and discover — all through conversation.** Leo knows every product, every booking slot, every event on your Diocese.

| Capability | What Leo Does |
|-----------|--------------|
| **Product Search** | Finds products by description, category, price range, or just vibes |
| **Cart & Checkout** | Adds items, manages cart, guides through secure Stripe checkout |
| **Booking** | Checks availability, books appointments, manages scheduling |
| **Event Discovery** | Finds events, registers attendees, provides event details |
| **Order Tracking** | Shows order status, Angel Token status, delivery updates |
| **Cancel & Refund** | Processes cancellations with automatic Stripe refunds |

### For Makers (Holon Producers)

**Claim work, manage production, earn fair wages.** Leo connects makers to demand signals across the federation.

| Capability | What Leo Does |
|-----------|--------------|
| **Queue Browsing** | Shows available orders matched to your capabilities |
| **Order Claiming** | Claims queued Angel Token orders with configuration preview |
| **Fulfillment Updates** | Tracks production → shipped → delivered lifecycle |
| **Equipment Registration** | Registers CNC mills, 3D printers, screen presses for smart routing |
| **Earnings Dashboard** | Shows 60% maker share, payment history, opportunity board |

---

## Leo's 70 Tools

Every tool is a real function that Leo calls during conversation. No fake responses. No hallucinated data. Leo reads from and writes to the actual database.

### Query Tools (9)
Search and retrieve real data from your Diocese:
- `query_products` — Search the product catalog
- `query_posts` — Find blog posts and articles
- `query_bookings` — Check booking records
- `query_events` — Browse upcoming events
- `query_event_registrations` — See who's registered
- `query_spaces` — List workspaces
- `query_projects` — Browse projects
- `query_availability` — Check open time slots
- `fetch_reviews` — Pull in customer reviews

### Action Tools (17)
Make things happen in real-time:
- `create_booking` / `update_booking` — Schedule and modify appointments
- `add_to_cart` / `view_cart` — Shopping cart management
- `create_product` / `update_product` — Product catalog management
- `invite_member` — Send workspace invitations
- `find_producers` — Discover makers in the federation
- `browse_network` — Explore the federation landscape
- `check_fees` — View platform fee structure
- `query_orders` — Access order history
- `route_order` — Send orders to qualified makers
- `accept_order` — Vendor order acceptance
- `update_fulfillment` — Track production stages
- `configure_business` — Enterprise setup and settings
- `connect_stripe` — Stripe Connect onboarding
- `create_space` — Create new workspaces

### Content Tools (6)
Create and manage content:
- `create_post` / `update_post` — Blog and article management
- `create_page` / `update_page` — Static page management
- `query_media` — Media library access
- `manage_categories` — Content organization

### Onboarding Tools (2)
Guide new users and businesses:
- `onboard_vendor` — Full maker onboarding (creates Enterprise + space + user)
- `suggest_products` — AI-powered product recommendations for new Endeavors

### Media Tools (3)
Visual intelligence:
- `generate_image` — AI image generation via OpenRouter (Flux 2, Gemini)
- `improve_image` — Vision feedback on uploaded images
- `attach_image` — Attach/replace images on products and posts

### Knowledge Tools (3)
Understanding your content:
- `analyze_image` — Claude Vision analysis (description, objects, colors, entities)
- `extract_pdf_pages` — PDF page-by-page extraction and transcription
- `query_knowledge` — RAG search across your Diocese knowledge base

### Federation Tools (5)
Connect to the network:
- `sign_constitution` — Cryptographic constitutional acceptance
- `ping_federation` — Announce your Diocese to the network
- `check_maker_queue` — View Angel Token demand signals
- `claim_orders` — Vendor claim for queued orders
- `draft_review_response` — AI-assisted review replies

### Communication Tools (4) *— Sprint 21*
Leo speaks to the community:
- `send_message` — Post messages to any community channel
- `send_direct_message` — DM individual users (creates DM channel if needed)
- `create_announcement` — Broadcast announcements across spaces
- `moderate_content` — Archive, flag, or resolve messages (never deletes)

### Inventory Tools (4) *— Sprint 21*
Leo manages your stock:
- `update_inventory` — Adjust product stock (hooks auto-alert on low stock)
- `track_inventory_movement` — Decrement inventory per order items
- `set_low_stock_alert` — Set per-product alert threshold
- `query_inventory_history` — Search inventory change log

### Financial Tools (3) *— Sprint 21*
Leo tracks the money:
- `generate_invoice` — Compute line items with Ultimate Fair Split (60/20/15/5)
- `query_financial_reports` — Aggregate from Orders + AgentTransactions + JusticeFund
- `issue_refund` — Flag refund for human approval (never calls Stripe directly)

### Federation Intelligence Tools (4) *— Sprint 21*
Leo sees the whole network:
- `query_federation` — Search StreetSigns + cross-tenant products across the federation
- `broadcast_capability` — Advertise Enterprise capabilities via StreetSigns
- `route_federated_request` — Match requests to federation catalog
- `negotiate_deal` — Rank federation matches by price/distance/rating

### CRM Tools (4) *— Sprint 21*
Leo remembers every customer:
- `create_customer_profile` — Create or update Contact (upsert by email+tenant)
- `log_interaction` — Append timestamped notes to contact record
- `segment_customers` — Query contacts by tags, status, source
- `send_follow_up` — Send follow-up message to a contact

### Analytics Tools (2) *— Sprint 21*
Leo reads the tea leaves:
- `analyze_trends` — Period-over-period analysis across orders, products, bookings
- `recommend_products` — Popularity-based recommendations with context matching

### Workflow & Emergency Tools (4) *— Sprint 21*
Leo coordinates the team:
- `delegate_task` — Create task assignment in team channel
- `escalate_issue` — Route urgent issues to support channel + application log
- `send_emergency_alert` — Broadcast to ALL tenant spaces' announcements
- `document_incident` — Record incident in ApplicationLog + draft Post

---

## The Constitutional Compass

Every response Leo gives runs through the Angel OS Constitution. This isn't optional. It's hardcoded.

**What the Constitution requires:**
- Human dignity in every interaction
- Transparency about what Leo is doing and why
- User consent before any irreversible action
- No social credit systems, no manipulation, no surveillance capitalism
- The Anti-Demonic Protocol: every error message is warm, every empty state is encouraging

**What Leo will never do:**
- Harvest user data without explicit consent
- Make decisions that should be human decisions
- Hide fees, terms, or data collection
- Discriminate based on protected characteristics
- Prioritize platform revenue over user wellbeing

**What Leo will always do:**
- Explain what's happening at each step
- Ask before taking irreversible actions
- Suggest the most dignified path forward
- Route revenue fairly (Toward-53 principle)
- Respect Diocese sovereignty

---

## How Leo Thinks

Leo uses a 3-round tool loop with Claude Sonnet 4:

```
User message arrives
  → Leo analyzes intent
  → Selects appropriate tool(s)
  → Executes tool against real database
  → Reads the result
  → May chain additional tools (up to 3 rounds)
  → Composes natural language response
  → Streams response via Server-Sent Events
```

**Real-time streaming.** Leo's responses arrive token-by-token, so you see the answer forming in real-time. Tool calls show progress indicators so you know Leo is working on something real.

**Enterprise-aware.** Leo always knows which Diocese you're on. Every query is automatically scoped to your Enterprise. Cross-tenant data leakage is architecturally impossible.

**Vision-capable.** Upload an image and Leo can analyze it — describing contents, identifying objects, reading text, suggesting improvements. Every uploaded image gets progressive analysis via Anthropic Claude Vision.

---

## Leo on Every Channel

Leo meets you wherever you are:

| Channel | How it works |
|---------|-------------|
| **Dashboard Chat** | Sidebar chat on every dashboard page — always one click away |
| **Floating Bubble** | Minimized chat that follows you across the frontend |
| **DM Channels** | Persistent conversation history in dedicated Leo DM |
| **Admin Panel** | Leo available inside the Payload CMS admin interface |
| **Phone (Vapi)** | Call your Diocese phone number — Leo answers via voice AI |
| **Email** | Email your Diocese — Leo reads, routes, and replies |

---

## The Federation Difference

Leo doesn't just serve one Diocese. Leo is the connective tissue of the entire Angel OS federation.

**For the network:** When a new Diocese runs the installer, Leo walks them through federation registration. When a maker registers capabilities that match queued Angel Tokens, Leo auto-drains the queue. When a governance proposal reaches supermajority, Leo records the constitutional amendment.

**For discovery:** Street Signs surface products from one Diocese across the federation. A manufacturer in Toledo appears on a retailer's site in Tampa — credited, compensated, and discoverable. Leo manages the indexing.

**For portability:** When an Endeavor owner decides to move to a different Diocese, Leo packs the suitcase — every post, product, message, order, and media file — with a SHA-256 integrity checksum. Constitutional right. No data held hostage.

---

## What Makes Leo Different

Most AI assistants are features bolted onto platforms. Leo IS the platform during onboarding and becomes your companion after.

| Traditional AI Assistant | Leo |
|-------------------------|-----|
| Answers questions about the product | Creates the product, manages it, sells it |
| Suggests actions you should take | Takes the action (with your permission) |
| Works on one platform | Works across a federated network |
| Serves the platform's interests | Constitutionally bound to serve yours |
| Revenue model hidden | Toward-53: always evolving toward you keeping more |
| Your data locked in | Suitcase Principle: your data goes where you go |

---

*"I'm Leo. I'll be here whenever you need me."*

**Everyone gets an Angel.**
