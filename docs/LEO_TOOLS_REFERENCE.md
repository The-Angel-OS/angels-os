# LEO AI Agent — Tools Reference

> Complete reference of all 108 LEO tools organized by operational phase.
> Last updated: 2026-03-04

---

## Tool Architecture

- **Engine**: ConversationEngine (src/utilities/ConversationEngine.ts)
- **Router**: AgentRouter (src/utilities/AgentRouter.ts)
- **Tools**: leo-data-tools.ts (src/utilities/leo-data-tools.ts, ~11,728 lines)
- **Constitution**: constitutional-prompt.ts (src/utilities/constitutional-prompt.ts)
- **LLM**: Claude Sonnet via Vercel AI Gateway (fallback: direct Anthropic SDK)
- **Max tool rounds**: 3 per conversation turn
- **Max response tokens**: 1,500

---

## Setup & Onboarding Tools

| Tool | Purpose | Confirmation Required |
|------|---------|----------------------|
| `onboard_vendor` | Create new vendor (tenant + space + user) | Yes (irreversible) |
| `configure_business` | Tenant business profile configuration | No |
| `connect_stripe_account` | Guide Stripe Connect onboarding | No |
| `create_space` | Create new community workspace | No |
| `complete_enlistment` | Complete onboarding ritual | No |
| `sign_constitution` | User signature on Angel OS Constitution | Yes |
| `track_soul` | Track user's spiritual/business journey | No |
| `suggest_products` | Generate product ideas for new vendors | No |

---

## Phase 1: Navigation & Discovery

| Tool | Purpose | Data Source |
|------|---------|------------|
| `query_products` | Search product catalog | Products collection |
| `query_posts` | Search blog posts | Posts collection |
| `query_spaces` | List available workspaces | Spaces collection |
| `query_projects` | Search projects | Projects collection |
| `query_events` | Search events | Events collection |
| `query_availability` | Check provider time slots | Availability collection |
| `query_navigation` | Get navigation menu structure | Header/Footer globals |

---

## Phase 2: Booking & Scheduling

| Tool | Purpose | Confirmation Required |
|------|---------|----------------------|
| `query_bookings` | Look up appointments | No |
| `query_event_registrations` | Get event attendee list | No |
| `create_booking` | Create new booking | Yes (Article III.2) |
| `update_booking_status` | Change booking status | No |
| `check_available_slots` | Find bookable time slots | No |
| `cancel_booking` | Cancel with reason | Yes |
| `reschedule_booking` | Reschedule with conflict checking | Yes |

---

## Phase 2.5: E-Commerce

| Tool | Purpose | Confirmation Required |
|------|---------|----------------------|
| `add_to_cart` | Add products to cart | No |
| `view_cart` | View cart contents | No |
| `create_product` | Create product listing | Yes |
| `update_product` | Update product details | No |
| `query_orders` | Look up orders | No |

---

## Phase 3: Media, Content & Financial

### Media Generation
| Tool | Purpose |
|------|---------|
| `generate_image` | Create AI images via OpenRouter (Flux 2, Gemini, GPT-4 Vision) |
| `improve_image` | Analyze + regenerate improved version |
| `attach_image_to_product` | Add image to product gallery |
| `replace_image` | Swap image across all content |
| `analyze_image` | Extract semantic info from images |
| `query_media` | Find media files in library |
| `generate_theme_aware_image` | Create brand-matched images |

### Content Management
| Tool | Purpose |
|------|---------|
| `create_post` | Create blog post (defaults to draft) |
| `update_post` | Update post (title, content, status) |
| `ingest_youtube_url` | Fetch metadata and embed YouTube video |
| `ingest_youtube_channel` | Subscribe to channel feed |
| `create_page` | Create static CMS page |
| `update_page` | Update page content |
| `add_calendar_to_page` | Embed calendar events on page |
| `set_page_hero` | Set page hero image |
| `manage_categories` | Create/update content categories |
| `update_navigation` | Update nav menus |

### Financial Operations
| Tool | Purpose | Confirmation Required |
|------|---------|----------------------|
| `generate_invoice` | Create invoice | Yes |
| `query_financial_reports` | View financial metrics | No |
| `issue_refund` | Process refund | Yes |
| `check_fees` | Display platform fees and bootstrap status | No |

### Inventory
| Tool | Purpose |
|------|---------|
| `update_inventory` | Change stock levels |
| `track_inventory_movement` | Log inventory transactions |
| `set_low_stock_alert` | Configure threshold alerts |
| `query_inventory_history` | View inventory audit trail |

---

## Phase 4: Federation & Network

| Tool | Purpose |
|------|---------|
| `find_producers` | Search Holon nodes by skill/location |
| `browse_network` | Browse cross-tenant products for resale |
| `browse_federation_peers` | List federation peer instances |
| `query_peer_catalog` | Query specific peer's product catalog |
| `search_federation_wide` | Search across all federation members |
| `discover_federation_products` | Browse network products ("street signs gossip") |
| `ping_federation` | Check federation health |
| `federation_pulse` | Get federation status |

---

## Phase 5: CRM & Communication

### Reviews & Feedback
| Tool | Purpose |
|------|---------|
| `fetch_reviews` | Fetch reviews (internal + Google Places) |
| `draft_review_response` | Draft professional response to review |

### Messaging
| Tool | Purpose | Confirmation Required |
|------|---------|----------------------|
| `send_message` | Post to community channel | Yes |
| `send_direct_message` | Send private DM | Yes |
| `create_announcement` | Platform-wide announcement | Yes |
| `send_email` | Email outreach | Yes |
| `send_whatsapp` | WhatsApp messaging | Yes |
| `send_telegram` | Telegram messaging | Yes |
| `send_sms` | SMS outreach | Yes |
| `send_slack` | Slack integration | Yes |
| `send_follow_up` | Send follow-up messages | Yes |

### CRM
| Tool | Purpose |
|------|---------|
| `create_customer_profile` | Create CRM contact profile |
| `log_interaction` | Track customer interactions |
| `segment_customers` | Group customers by attributes |
| `invite_member` | Invite person to space by email |

---

## Phase 5b: Federation Messaging

| Tool | Purpose | Confirmation Required |
|------|---------|----------------------|
| `send_federation_message` | Message across federation | Yes |
| `broadcast_federation_message` | Broadcast to multiple peers | Yes |
| `request_endeavor_migration` | Facilitate business migration | Yes |
| `leo_handoff` | Hand off conversation to another agent | No |

---

## Phase 6: Analytics & Intelligence

| Tool | Purpose |
|------|---------|
| `analyze_trends` | Analyze business/product trends |
| `recommend_products` | Generate product recommendations |
| `find_synchronicities` | Find user activity patterns |
| `my_place` | Show user's enterprise position |
| `check_enterprise_health` | Get tenant health metrics |
| `get_enterprise_stage` | Get lifecycle stage |
| `query_board_members` | List board members |

---

## Phase 7: Workflow & Emergency

| Tool | Purpose | Confirmation Required |
|------|---------|----------------------|
| `delegate_task` | Assign tasks | Yes |
| `escalate_issue` | Escalate to human support | No |
| `send_emergency_alert` | Send critical alert | Yes |
| `document_incident` | Log incident for audit trail | No |
| `moderate_content` | Content moderation (review/flag/remove) | Yes |

---

## Generic Payload CRUD (Sprint 36)

| Tool | Purpose |
|------|---------|
| `payload_find` | Generic finder for any collection |
| `payload_create` | Generic create for any collection |
| `payload_update` | Generic update for any collection |
| `payload_delete` | Generic delete for any collection |

---

## Special Tools

### Knowledge & Documents
| Tool | Purpose |
|------|---------|
| `extract_pdf_pages` | Parse PDF and extract pages |
| `query_knowledge` | Search RAG knowledge base |
| `research_and_provision` | Research topics and provision content |

### Theme & Brand
| Tool | Purpose |
|------|---------|
| `get_theme_settings` | Retrieve brand/theme config |
| `update_theme_settings` | Update colors, fonts, branding |

### Order Fulfillment
| Tool | Purpose | Confirmation Required |
|------|---------|----------------------|
| `route_order` | Assign order to vendor Holon | Yes |
| `accept_order` | Accept order as vendor | Yes |
| `update_fulfillment` | Update production/shipping status | No |

### Manufacturing
| Tool | Purpose |
|------|---------|
| `generate_cad_instructions` | Convert product specs to CNC-ready notes |

---

## Constitutional Constraints

All tools operate under Article III of the Herald Constitution:

1. **Article III.2**: No irreversible actions without human confirmation
2. **Article II**: Anti-demonic safeguards permanently prohibit social credit, behavioral manipulation, automated punishment, surveillance capitalism, permanent marking
3. **Article IV**: All AI communication through AI Bus at `tenant` visibility minimum
4. **Tenant isolation**: All queries scoped to current tenant via `where: { tenant: { equals: tenantId } }`
5. **Rate limiting**: 10/min authenticated, 5/min guest

---

## Tool Execution Context

Each tool receives:
- `payload` — Payload CMS instance
- `tenantId` — Current tenant
- `spaceId` — Current space (optional)
- `channel` — Current channel
- `userContext` — User info (id, name, email, roles)
- `pageContext` — Current page path
- `federatedContext` — Federation peer info (if applicable)
- `tenantAnthropicApiKey` — BYOAI key (if tenant provides own)

---

*This reference enables LEO to understand its own capabilities and guide users to the right tools.*
