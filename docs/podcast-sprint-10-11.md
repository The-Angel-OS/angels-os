# Angel OS Podcast Script — Sprints 10 & 11
## "From Chat Foundation to Vendor Marketplace"

**Duration:** ~12 minutes
**Host:** Kenneth Courtney
**Format:** Solo narrative / dev log

---

### COLD OPEN (30 seconds)

So we had a working AI. LEO could talk, LEO could stream, LEO had 24 tools and could route orders across a constitutional manufacturing network. Cool. But you know what LEO couldn't do? Look at a picture. You couldn't attach a photo and say "Hey LEO, what do you think of this design?" That's like having an assistant who's brilliant but keeps their eyes closed.

Sprint 10 and 11 changed that. And a whole lot more.

---

### SEGMENT 1: THE ROLE MAPPING BUG (2 minutes)

Let me start with the smallest fix that had the biggest impact. Five minutes of work.

LEO would respond to you in the chat. Beautiful streaming response, markdown, tool calls, the works. But if you switched tabs for ten seconds and came back, LEO's message would look like it came from a regular user. Same content, wrong styling. The purple gradient avatar? Gone. Just a plain message bubble.

Here's what was happening. When LEO streams a response, the frontend renders it as role "leo" — that's the streaming state. But when the poll cycle replaces the streamed message with the persisted version from the database, the `mapMessage` function was checking for `isSystem` flags and `messageType` values. The database message had `messageType: 'ai_agent'`, but the mapping function didn't know that meant LEO. It fell through to the default: 'user'.

One line. Add `msg.messageType === 'ai_agent'` to the LEO role condition. Done. Now LEO stays LEO even after the poll replaces the stream.

This is why you test the full cycle, not just the happy path.

---

### SEGMENT 2: TEACHING LEO TO SEE (3 minutes)

Image attachments in chat. This was Sprint 10's centerpiece.

Start at the input. We added a paperclip button to MessageInput. Tap it, pick images, and you get a thumbnail preview row below the textarea. Each thumbnail has an X to remove it. On mobile, the file picker offers camera or gallery — the `capture` attribute handles that natively.

When you hit send, the files upload to the media endpoint first. Each comes back with an ID. Those IDs go into the `attachments` array on the message — and the Messages collection already had that field defined, it was just never populated from the frontend.

The interesting part is LEO's side. When images are attached, the leo-stream endpoint constructs Anthropic's multi-part content format — `type: 'image'` blocks alongside the text. Claude sees the actual pixels. So you can photograph a product, a design sketch, a competitor's listing, and LEO gives you real visual feedback.

The MessageList component already had an image grid renderer from an earlier sprint — we just made sure user-attached images flow through the same display path as LEO-generated ones.

---

### SEGMENT 3: LEO IN THE ADMIN PANEL (1.5 minutes)

Payload CMS has a great admin UI. But it's an admin UI — forms, tables, filters. What if you're in there managing products and you want to ask LEO something?

PayloadAdminLEO is a floating toggle button in the bottom-right corner of the admin viewport. Click it, and you get a minimalist chat overlay scoped to whatever tenant you're working in. It reads the `payload-tenant` cookie, so LEO already knows context.

We also replaced the BeforeDashboard component. Payload ships with template boilerplate there — "Welcome to your dashboard" with links to their docs. Now it says "Welcome to Angel OS" with quick links to View Site, Dashboard, and Seed Data.

Small touches. But they make the platform feel like *ours*, not a template.

---

### SEGMENT 4: CHANNEL AWARENESS (1.5 minutes)

We had channels — nine types of them. General, announcements, support, commerce, the works. But the chat UI was hardcoded to general. The SidebarChat component just pointed at one channel slug and that was that.

Sprint 10 wired the channel switcher. SidebarChat gets a dropdown in the header. FloatingBubble resolves the user's default space from the API instead of hardcoding `spaceId: '1'`. The ChannelTabs component adds a tab bar above the message list — Chat, Files, Tasks — extensible for Sprint 11 applets.

We also added profile avatars. LEO keeps the gradient avatar but now pulses during streaming. Users get a deterministic color based on a hash of their name — so "Kenneth" is always the same shade. Online/offline status dots. These details matter. They make a chat feel alive.

---

### SEGMENT 5: THE VENDOR MARKETPLACE — SPRINT 11 (3 minutes)

Sprint 11 is where Angel OS starts to become what it was always meant to be: a place where people make things and sell them fairly.

Products got five new fields: `vendor` links to a tenant, `productionType` distinguishes ready-made from print-on-demand from custom orders from digital goods, `cadFile` holds manufacturing files, `configuratorOptions` is a JSON blob for customization, and `isLimitedEdition` with an optional `availableUntil` date.

The Product Configurator is a React component that reads `configuratorOptions` and renders the right inputs — text fields for custom engravings, color swatches, size selectors, finish options. Live preview updates as you configure. There's a "Preview with LEO" button that sends your configuration to the chat for AI feedback, and "Add to Cart" captures the full customization data.

For the vendor side: a new Producer role and a dashboard at `/dashboard/producer`. Incoming orders, production queue, fulfillment status, products, earnings. The `onboard_vendor` LEO tool creates a complete vendor setup through conversation — tenant, space, channels, user account with producer role. Say "I want to sell on Angel OS" and LEO walks you through it.

The order shipping endpoint — `POST /api/orders/ship` — handles the state transition from `in_production` to `shipped`, sets tracking numbers and URLs, timestamps the shipment. Clean REST, proper validation.

Reviews pull from Google Places (with rate limiting and TTL cache) or are created natively on Angel OS. The aggregation component shows average rating, star distribution, individual review cards. LEO can fetch reviews and draft responses — because responding to a 2-star review at 11pm shouldn't require full brain power.

And one more: ministry tenant type. `isTaxExempt` checkbox, `taxExemptId` field. Because churches and nonprofits are first-class citizens in this economy, not edge cases.

---

### SEGMENT 6: THE CONSTITUTIONAL THREAD (1 minute)

Every feature I just described runs through the constitution.

Image uploads? LEO sees them but can't store, share, or analyze faces without consent. That's Article III — human confirmation before irreversible actions.

Vendor onboarding? The 60/20/15/5 split is wired into the tenant creation, not offered as an option. That's Article V — Ultimate Fair isn't a setting, it's architecture.

Reviews? LEO drafts responses but never posts them automatically. The human reviews the review response. That's the whole point.

Channel visibility levels — private, tenant, network — mean your conversations stay scoped until you explicitly choose to share wider. That's Article I — sovereignty and transparency.

This isn't governance theater. It's in the code.

---

### CLOSING (30 seconds)

Sprint 10 gave LEO eyes and gave the chat system depth — channels, images, admin presence. Sprint 11 turned the platform into a marketplace where vendors can onboard through conversation, customize products, and fulfill orders through a constitutional supply chain.

Twenty-nine LEO tools. Ten utility engines. Over a thousand tests. And we're just getting to the part where people actually start using it.

Next up: integration bridges. WhatsApp, voice, email. Meeting people where they already are.

Everyone gets an Angel. That's the deal.

---

### SHOW NOTES

**Sprint 10 highlights:**
- LEO role mapping fix (5-minute bug, huge UX impact)
- Image attachments + LEO vision (Anthropic multi-part content)
- PayloadAdminLEO (floating chat in admin panel)
- Channel switching in SidebarChat + FloatingBubble
- ChannelTabs (Chat / Files / Tasks)
- Profile avatars with streaming pulse + status dots
- Multi-tenant local dev (TENANT_DOMAINS, hosts file routing)

**Sprint 11 highlights:**
- Products: vendor, productionType, cadFile, configuratorOptions, isLimitedEdition
- Product Configurator (text, swatches, size, preview, cart)
- Producer role + `/dashboard/producer`
- LEO tools: onboard_vendor, suggest_products, generate_cad_instructions
- Reviews collection + Google Places import + aggregation display
- LEO tools: fetch_reviews, draft_review_response
- `POST /api/orders/ship` endpoint
- Ministry tenant type (isTaxExempt, taxExemptId)
- Clearwater Cruisin' seed tenant

**Stats:**
- LEO tools: 24 → 29
- New files: ~14 across both sprints
- Sprints 1-11 complete
- Version: v0.11.0-dev

**Links:**
- Live: [angels-os.vercel.app](https://angels-os.vercel.app)
- Repo: [github.com/The-Angel-OS/angels-os](https://github.com/The-Angel-OS/angels-os)
