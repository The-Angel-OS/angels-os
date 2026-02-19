# Angel OS Multi-Tenant Implementation Plan

This plan maps features from [zubricks/multi-tenant-example](https://github.com/zubricks/multi-tenant-example) (Sean Zubrickas, Payload CMS) and [The-Angel-OS/angel-os](https://github.com/The-Angel-OS/angel-os) onto the existing Angel OS codebase (Payload ecommerce template). See `docs/multitenantbypayload.txt` and [angel-os PAYLOAD_COLLECTIONS.md](https://github.com/The-Angel-OS/angel-os/blob/main/docs/PAYLOAD_COLLECTIONS.md).

**Strategy:** Get multi-tenant, routing, and roles/permissions right first—they have cascading effects on all development. Use [angel-os/src/collections](https://github.com/The-Angel-OS/angel-os/tree/main/src/collections) as a reference for the full admin UX and collection structure.

---

## Implementation Status (Last Updated: Jan 31, 2026)

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 3B.1–3B.4** | ✅ Done | TenantMemberships, access helpers, seed, roles |
| **Phase 3B.5–3B.6** | ✅ Done | Spaces, SpaceMemberships collections |
| **Phase 2** | ✅ Done | tenantSelectorLabel, super_admin/admin roles |
| **Phase 1** | ✅ Done | Tenants branding schema, TenantStyles, TenantFonts |
| **Phase 8** | ✅ Done | Seed: branding, TenantMemberships |
| **Phase 3** | ⏳ Pending | Domain-in-path (see `docs/DOMAIN_IN_PATH_SETUP.md`—manual next.config.js) |
| **Phase 3B.7–3B.8** | ✅ Done | Channels, Messages, spaces-template in seed |
| **Admin visibility** | ✅ Done | Tenants, TenantMemberships visible only to super_admin |
| **Phase 5** | ✅ Done | Posts collection, /posts routes, CollectionArchive, PostCard, pagination, live preview, seed |
| **Phase 6** | ⏳ Pending | Search plugin |
| **Phase 4** | 📋 Tabled | Amenities / Offer Features |
| **Phase 7** | ⏳ Pending | next.config images.remotePatterns for *.local |
| **Comments** | ✅ Done | Comments collection, polymorphic (posts/products), ratings, Comments block |
| **MCP Plugin** | ✅ Done | @payloadcms/plugin-mcp, leo_respond tool, collections exposed |
| **Agent System** | ✅ Done | Multi-avatar (LEO, Support, Sales, etc.), AgentRouter, agentConfig, findOrCreateSystemAgent |
| **Site Export** | ✅ Scaffolded | /export-site endpoint, tenant-scoped data export |

**Build status:** ✅ Next.js build passes (Jan 31, 2026)

**Completed migrations:** `add_tenant_memberships`, `add_spaces_and_branding`, `add_header_footer_collections`, `add_channels_messages`

### What's Next (Recommended)

1. **Phase 3 – Domain-in-path** – Follow `docs/DOMAIN_IN_PATH_SETUP.md` when ready to add rewrites and `[tenant]` route segment.
2. **Phase 6 – Search** – Install and configure `@payloadcms/plugin-search`.
3. **Spaces template** – Seed uses `angelOsTemplate`; add more Angel OS templates when provisioning new tenants.
4. **Phase 1.4 refinement** – Wire `--color-primary` and font vars into blocks (Hero, CTA, buttons) where desired.
5. **Spaces UX (Discord-like)** – Left nav showing channels user is in + workspace apps (Trello board, etc.). Extensible via plugins.
6. **ConversationEngine** – Explicit intent handling, state transitions, NLU/NLG integration, conversation memory.
7. **LEO Web Master** – Expand agent capabilities to full CRUD on all collections; channel workflows (inventory, PDF, video).

---

## 0. Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **`admin` on Users** | Tenant-scoped admin | Tenant admins manage their own tenant's content and spaces |
| **`super_admin`** | Platform-only (very few) | Full platform access; `userHasAccessToAllTenants` |
| **Routing** | Keep middleware approach | Middleware injects `x-tenant-id`; works with next-intl; no refactor of existing routes |
| **Domain-in-path (SSG/SEO)** | **High priority** | Rewrites + `[tenant]` segment for static generation; improves SEO for multi-domain |
| **Tenant selector label** | `Tenant` (not "Brand") | Simpler; tenant = Angel/LEO scope, not a palette of brands |

### Tenant vs Brand: One-to-One, LEO/MCP

- **Tenant = one-to-one with Angel/LEO.** Each tenant is the Angel or LEO for the Endeavor. There is no shared "palette of brands" you toggle through—each tenant is its own Endeavor instance.
- **MCP + chat interface:** Per-tenant configuration. Each LEO system intelligence interacts within the messaging infrastructure (Spaces, Channels, Messages).
- **Branding** lives on the tenant: colors, typography, logo, siteName. MCP and Payload admin make it easy to configure these per tenant.
- The admin selector label is **Tenant** (not "Brand") to reflect this model.

---

## 1. Current State Summary

| Area | Angel OS (Current) | Zubricks Example |
|------|--------------------|------------------|
| **Routing** | Middleware injects `x-tenant-id`; layout fetches tenant by slug/domain | Next.js rewrites → `[tenant]` route param |
| **i18n** | `next-intl` + `[locale]` route ✓ | None |
| **Tenant collection** | `tenants` with full branding ✓ (6 colors, typography, tagline) | `brands` with full branding |
| **Header/Footer** | Tenant-scoped collections ✓ | Tenant-scoped globals ✓ |
| **Dynamic branding** | TenantStyles + TenantFonts ✓ (CSS vars + Google Fonts) | Same |
| **Plugin label** | `tenantSelectorLabel: 'Tenant'` ✓ | Zubricks uses "Brand" |
| **TenantMemberships** | ✓ (tenant_admin, tenant_manager, tenant_member) | — |
| **Spaces / SpaceMemberships** | ✓ | — |
| **Roles** | super_admin (platform), admin (tenant-scoped) ✓ | — |
| **Shared content** | None (tabled) | Amenities |
| **Posts** | No | Yes (tenant-scoped blog) |
| **Search** | No | Payload Search Plugin |
| **SEO** | Plugin-seo ✓ | Plugin-seo ✓ |
| **Ecommerce** | Products, Orders ✓ | No |

---

## 2. Implementation Phases

### Phase 1: Rich Tenant Branding (High Impact, Low Risk) — ✅ Implemented

**Goal:** Expand `Tenants.branding` to match Zubricks’ Brands schema.

**1.1 Tenants collection – branding group** ✅

Add to `src/collections/Tenants/index.ts` (implemented; SEO/Contact groups deferred):

- **Brand Colors** (group):
  - `primaryColor`, `secondaryColor`, `accentColor`
  - `backgroundColor`, `foregroundColor`, `borderColor`
  - All hex, optional
- **Typography** (group):
  - `headingFont`: select (Inter, Playfair Display, Montserrat, Raleway, Poppins)
  - `bodyFont`: select (Inter, Open Sans, Lato, Roboto, Source Sans 3)
- **SEO & Metadata** (group):
  - `siteTitle` (required)
  - `siteDescription` (textarea)
  - `ogImage` (upload → media)
  - `favicon` (upload → media)
- **Contact** (group):
  - `contactEmail`, `contactPhone`
- **General**:
  - `tagline` (text)

Keep existing fields: `logo`, `primaryColor` (merge into brandColors), `siteName` (map to SEO siteTitle or keep both).

**Files:** `src/collections/Tenants/index.ts`, migration for new columns.

---

**1.2 TenantStyles component** ✅

Create `src/components/TenantStyles.tsx`:

- Read tenant from props
- Inject CSS custom properties into `<style>` (or `<head>`):
  - `--color-primary`, `--color-secondary`, `--color-accent`
  - `--color-background`, `--color-foreground`, `--color-border`
  - `--font-heading`, `--font-body`
- Use tenant `brandColors` and `typography` if present; otherwise fallbacks

**Files:** `src/components/TenantStyles.tsx`, `src/app/[locale]/(app)/layout.tsx` (render `<TenantStyles tenant={tenant} />`).

---

**1.3 TenantFonts component** ✅

Create `src/components/TenantFonts.tsx`:

- Map font slugs to Google Fonts URLs (e.g. `inter` → `https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700`)
- Render `<link rel="stylesheet" href="..." />` for heading and body fonts
- Use tenant `typography.headingFont` / `typography.bodyFont` or defaults

**Files:** `src/components/TenantFonts.tsx`, layout (next to TenantStyles).

---

**1.4 Apply branding in frontend** — Partial

- Ensure blocks (e.g. Hero, CTA, Content) read `--color-primary` and font vars where relevant
- Use `var(--color-primary)` in Tailwind via `@apply` or arbitrary values
- Header/Footer already use tenant logo and siteName; add more vars for buttons, links, borders as needed

---

### Phase 2: Admin UX & Plugin Config — ✅ Implemented

**2.1 Tenant selector label** ✅

In `src/payload.config.ts`:

```ts
multiTenantPlugin<Config>({
  tenantsSlug: 'tenants',
  tenantSelectorLabel: 'Tenant',  // Not "Brand"—tenant = Angel/LEO scope
  // ...
})
```

**Files:** `src/payload.config.ts`.

---

**2.2 Platform vs tenant admin roles** ✅

- **`super_admin`** (on Users.roles): Platform-only, very few; `userHasAccessToAllTenants` in multi-tenant plugin
- **`admin`** (on Users.roles): Tenant-scoped; grants Payload admin access when user has TenantMembership with `tenant_admin` for that tenant
- **TenantMemberships.role**: `tenant_admin` | `tenant_manager` | `tenant_member` — source of truth for tenant-level permissions
- Ensure `isSuperAdmin` checks for `super_admin` role on Users

**Files:** `src/access/isSuperAdmin.ts`, `src/collections/Users/index.ts`, `src/payload.config.ts`.

---

### Phase 3: Domain-in-Path for SSG/SEO (**High Priority**) — ⏳ Pending

**Current:** Middleware → `x-tenant-id` → layout fetches tenant by slug/domain.

**Goal:** Add Next.js rewrites so domain becomes a route segment, enabling static generation and better SEO for multi-domain.

**Tasks:**

- Add rewrites in `next.config.js` similar to Zubricks: match on host, rewrite to path containing tenant (domain or slug)
- Introduce `[tenant]` segment: `[locale]/(app)/[tenant]/[[...slug]]` — pages, shop, posts, etc. nest under tenant
- Ensure rewrites and next-intl work together (locale prefix, matcher)
- Keep middleware for `x-tenant-id` injection where API/cron/etc. need tenant context; rewrites handle frontend routing

**Note:** Per project rules, `next.config.js` is not modified automatically. See `docs/DOMAIN_IN_PATH_SETUP.md` for manual setup instructions when ready.

---

### Phase 3B: Multi-Tenant + Permissions Foundation — ✅ 3B.1–3B.6 Implemented

Get roles and memberships right first—everything else depends on them. Reference [PAYLOAD_COLLECTIONS.md](https://github.com/The-Angel-OS/angel-os/blob/main/docs/PAYLOAD_COLLECTIONS.md) and [angel-os/src/collections](https://github.com/The-Angel-OS/angel-os/tree/main/src/collections).

**Dependency chain:**

```
Platform (Payload auth) → Tenants → TenantMemberships → Spaces → SpaceMemberships → Channels → Messages
```

| Phase | Task | Depends on | Status |
|-------|------|------------|--------|
| 3B.1 | **TenantMemberships** collection | Tenants, Users | ✅ |
| 3B.2 | Access helpers (`getUserTenantRoles`, `canManageSpaces`, `canInviteUsers`) | TenantMemberships | ✅ |
| 3B.3 | Wire TenantMemberships (not in plugin—has own tenant field) | 3B.1 | ✅ |
| 3B.4 | Seed: create TenantMemberships for admin user | 3B.1–2 | ✅ |
| 3B.5 | **Spaces** collection (minimal: name, slug, tenant, visibility) | TenantMemberships, canManageSpaces | ✅ |
| 3B.6 | **SpaceMemberships** collection | Spaces | ✅ |
| 3B.7 | **Channels** | Spaces | ✅ |
| 3B.8 | **Messages** | Spaces, Channels | ✅ |

**TenantMemberships schema (from PAYLOAD_COLLECTIONS.md):**

- `user`, `tenant` (relations)
- `role`: `tenant_admin` | `tenant_manager` | `tenant_member`
- `permissions`: array (manage_users, manage_spaces, manage_content, etc.)
- `status`, `invitedBy`, `joinedAt`, invitation fields

**SpaceMemberships schema:**

- `user`, `space` (relations)
- `role`: `space_admin` | `moderator` | `member` | `guest`
- `status`, CRM data, engagement metrics (defer complex fields initially)

---

### Phase 4: Shared Content (Amenities-style) — *Tabled until after mvp*

**Goal:** Add a shared collection usable across tenants (like Zubricks’ Amenities). Defer until core multi-tenant and spaces are stable.

**4.1 Amenities (or “Features”) collection**

- Not in `multiTenantPlugin` (no tenant field)
- Fields: `name`, `slug`, `icon` (select: wifi, pool, gym, etc.), `description`
- Used in layout blocks or product features

**4.2 Amenities block**

- Block that lists selected amenities/features
- Page-level relationship: which amenities this page shows
- Or global list with tenant override (e.g. tenant picks which amenities apply)

**Files:** `src/collections/Amenities.ts`, new block config, payload.config.

---

### Phase 5: Posts Collection (Implement)

- Add `Posts` collection, tenant-scoped
- Fields: title, slug, publishedOn, excerpt, content (Lexical), featuredImage, heroImage, meta, relatedPosts
- Add to multi-tenant plugin
- Create `[locale]/(app)/posts` (or `[locale]/(app)/[tenant]/posts` when domain-in-path is active), `posts/[slug]`
- Reuse layout builder patterns from Pages
- **Seed:** Use angel-os post seed data to local: [post-1](https://github.com/The-Angel-OS/angel-os/blob/main/src/endpoints/seed/post-1.ts), [post-2](https://github.com/The-Angel-OS/angel-os/blob/main/src/endpoints/seed/post-2.ts), [post-3](https://github.com/The-Angel-OS/angel-os/blob/main/src/endpoints/seed/post-3.ts), [post-4](https://github.com/The-Angel-OS/angel-os/blob/main/src/endpoints/seed/post-4.ts); include link to posts collection root page in nav - posts in this collection have categories - these would potentially conflict with the ecommerce categories 
- **Blocks:** Add RelatedPosts block and CollectionArchive component (see [RelatedPosts](https://github.com/The-Angel-OS/angel-os/blob/main/src/blocks/RelatedPosts/Component.tsx), [CollectionArchive](https://github.com/The-Angel-OS/angel-os/blob/main/src/components/CollectionArchive/index.tsx))

**Future:** Posts will drive social media integration—automations will push published posts to connected media platforms (per PAYLOAD_COLLECTIONS.md syndication).

**Files:** `src/collections/Posts/index.ts`, `src/endpoints/seed/post-1.ts`–`post-4.ts`, `src/blocks/RelatedPosts/`, `src/components/CollectionArchive/`, page routes, payload.config.

---

### Phase 6: Search Plugin (Implement)

**Goal:** Full-text search across tenant-scoped content.

- Install `@payloadcms/plugin-search`
- Configure searchable collections (e.g. pages, products, posts)
- Ensure queries are tenant-filtered
- Add search UI (e.g. in Header or dedicated page)

**Files:** `package.json`, `src/payload.config.ts`, search component/page.

---

### Phase 6B: LEO System Users & ConversationEngine — ✅ Implemented

**Goal:** Support multiple LEO avatar system users per tenant; scaffold ConversationEngine for intent/state/NLU.

- **Users:** `isSystemUser` (checkbox), `servesTenant` (relationship), `agentConfig` (group). System users author Messages as `ai_agent`.
- **Agent System:** Multi-avatar architecture. Types: LEO (default), Support, Sales, Onboarding, Integration, Custom. Each agent has personality, capabilities, routing rules. See `docs/AGENT_SYSTEM.md`.
- **AgentRouter:** `src/utilities/AgentRouter.ts` — routes messages to agents by channel, keywords, or default.
- **Seed:** `findOrCreateLeoUser` / `findOrCreateSystemAgent` creates LEO per tenant (email: `leo-{slug}@system.angelos.local`). Additional agents opt-in.
- **ConversationEngine:** `src/utilities/ConversationEngine.ts` — handleIncomingMessage, agent context, Payload data queries (posts/products). TODOs: explicit intent handling, state transitions, NLU/NLG integration.
- **MCP Plugin:** `@payloadcms/plugin-mcp` — `/api/mcp` endpoint, `leo_respond` tool, collections exposed. LEO routes via AgentRouter.
- **spaceProvisioning:** `src/utilities/spaceProvisioning.ts` — business-general, creator-content, service-provider templates.
- **Dashboard:** `/[locale]/dashboard`, `/dashboard/leo`, `/dashboard/spaces` scaffolded (Discord-like left nav).

**LEO email/connector:** Each LEO may eventually need an inbox (e.g. IMAP connector). Documented in `docs/MULTI_TENANT_DEV_SETUP.md`.

**Seed = provisioning prototype:** The seed script is the prototype for site provisioning. LEO should be able to provision new tenants (via MCP/chat or admin) and hand off to the new site's LEO.

**Refs:** `docs/AGENT_SYSTEM.md`, `docs/AGENT_SYSTEM_SUMMARY.md`, [angel-os dashboard](https://github.com/The-Angel-OS/angel-os/tree/main/src/app/dashboard), [Payload Modular Dashboards](https://nlvcodes.com/tutorials/using-modular-dashboards-in-payload-cms), `docs/payloadcmswidgets.txt`.

---

### Phase 7: Next.js Config for Local Dev

**Goal:** Support `*.local` domains for local multi-tenant testing.

In `next.config.js` (or `next.config.mjs`), add to `images.remotePatterns`:

```js
{
  protocol: 'http',
  hostname: '*.local',
},
{
  protocol: 'http',
  hostname: 'localhost',
},
```

**Note:** Per project rules, avoid unnecessary `next.config.js` changes. Phase 3 (rewrites) will require config edits; Phase 7 adds only `images.remotePatterns` — consider batching with Phase 3 or document for manual addition.

---

### Phase 8: Seed & Migration — ✅ Implemented

**8.1 Seed** ✅

- Extend seed to create tenants with full branding
- Populate `brandColors`, `typography`, `seoMetadata`, `contactInfo` for default tenant
- Create TenantMemberships for admin user (Phase 3B.4)
- Link posts collection root in nav when Phase 5 is implemented


**8.2 Migrations**

During development, we iterate by re-running the seed script when performing major changes to ensure all systems are nominal. The goal is to be able to copy sites ad infinitum with the same basic mechanism. Migrations are deferred until schema stabilizes.

---

## 3. Recommended Order

**Priority: multi-tenant + permissions first, then routing/branding.**

| Order | Phase | Effort | Impact | Status |
|-------|-------|--------|--------|--------|
| 1 | **Phase 3B.1–3B.4** – TenantMemberships, access helpers, seed | Medium | **Critical** | ✅ |
| 2 | **Phase 3** – Domain-in-path (rewrites, `[tenant]` segment) | High | **High** | ⏳ |
| 3 | Phase 3B.5–3B.6 – Spaces, SpaceMemberships | Medium | High | ✅ |
| 4 | Phase 2 – Admin UX (tenantSelectorLabel, roles) | Low | Medium | ✅ |
| 5 | Phase 1.1 – Tenants branding schema | Medium | High | ✅ |
| 6 | Phase 1.2–1.4 – TenantStyles, TenantFonts, frontend | Medium | High | ✅ |
| 7 | Phase 8 – Seed (full branding, TenantMemberships) | Low | Medium | ✅ |
| 8 | Phase 3B.7–3B.8 – Channels, Messages | High | High | ✅ |
| 9 | Phase 4 – Amenities (tabled) | Medium | Medium | 📋 |
| 10 | Phase 5 – Posts | Medium | Medium | ✅ |
| 11 | Phase 6 – Search (Implement) | Medium | Medium | ⏳ |
| 12 | Phase 7 – next.config (`*.local` for dev) | Low | Low | ⏳ |
| 13 | MCP Plugin, Agent System, Comments | — | High | ✅ |

---

## 4. Out-of-Scope / Defer

- **MongoDB:** Zubricks uses MongoDB; Angel OS uses PostgreSQL. No change.
- **Layout builder:** Angel OS already has blocks; only ensure they consume branding vars.
- **Draft/Live preview:** Already implemented.
- **redirects.js:** Zubricks uses IE redirect; add only if required.
- **Amenities / Offer Features (Phase 4):** Tabled for later; could drive filtering/navigation when implemented.

---

## 5. Key Files to Create/Modify

### Collection Folder Structure

All collections follow `src/collections/(collectionName)/index.ts` with a `hooks/` subfolder for collection-specific hooks (e.g. `Users/hooks/ensureFirstUserIsAdmin.ts`, `Pages/hooks/revalidatePage.ts`).

### Multi-Tenant + Permissions (Phase 3B) — ✅ Implemented

| File | Action | Status |
|------|--------|--------|
| `src/collections/TenantMemberships/index.ts` | **Create** – user-tenant roles | ✅ |
| `src/collections/Spaces/index.ts` | **Create** – workspace per tenant | ✅ |
| `src/collections/SpaceMemberships/index.ts` | **Create** – user-space roles | ✅ |
| `src/collections/Channels/index.ts` | **Create** – Discord-style channels per space | ✅ |
| `src/collections/Messages/index.ts` | **Create** – messages in spaces/channels | ✅ |
| `src/endpoints/seed/spaces-template.ts` | **Create** – space templates (Angel OS) | ✅ |
| `src/access/getUserTenantRoles.ts` | **Create** – access helper | ✅ |
| `src/access/canManageSpaces.ts` | **Create** – access helper | ✅ |
| `src/access/canInviteUsers.ts` | **Create** – access helper | ✅ |
| `src/payload.config.ts` | Wire TenantMemberships, Spaces, plugin | ✅ |
| `src/endpoints/seed/index.ts` | Create TenantMemberships for admin | ✅ |

### Branding + Routing — ✅ Branding done; routing pending

| File | Action | Status |
|------|--------|--------|
| `src/collections/Tenants/index.ts` | Expand branding group | ✅ |
| `src/components/TenantStyles.tsx` | **Create** – CSS variables | ✅ |
| `src/components/TenantFonts.tsx` | **Create** – Google Fonts | ✅ |
| `src/app/[locale]/(app)/layout.tsx` | Add TenantStyles, TenantFonts | ✅ |
| `docs/DOMAIN_IN_PATH_SETUP.md` | Manual setup guide for rewrites | ✅ |
| `next.config.js` | Add rewrites for domain-in-path | ⏳ (manual) |
| `src/app/[locale]/(app)/[tenant]/[[...slug]]/` | **Create** – tenant route segment | ⏳ |

### Posts & Search (Phases 5–6) — Phase 5 ✅ Done; Phase 6 ⏳ Pending

| File | Action | Status |
|------|--------|--------|
| `src/collections/Posts/index.ts` | **Create** – tenant-scoped blog | ✅ |
| `src/endpoints/seed/posts.ts` | **Create** – seed data | ✅ |
| `src/blocks/RelatedPosts/` | Related posts in post layout | ✅ |
| `src/components/CollectionArchive/` | Post listing, PostCard, pagination | ✅ |
| `src/collections/Comments/index.ts` | Polymorphic comments (posts/products), ratings | ✅ |
| Search component/page | Add when Phase 6 implemented | ⏳ |

### Other

| File | Action | Status |
|------|--------|--------|
| `src/payload.config.ts` | Add `tenantSelectorLabel` | ✅ |
| `src/collections/Amenities.ts` | **Create** (Phase 4, tabled) | 📋 |
| `src/providers/Tenant/index.tsx` | Optional – client context for tenant | ⏳ |

---

## 6. Development Workflow & Setup

See **`docs/MULTI_TENANT_DEV_SETUP.md`** for:

- Hosts file entries for local multi-tenant testing
- Fresh-DB workflow (drop DB → create first user → run seed)
- Create-new-user tenants field workaround (do not press + before seed)
- LEO email/connector consideration
- Payload CMS Modular Dashboards (widgets) reference

**Iterate via seed:** Re-run `/en/next/seed` to reset to default state. **Migrations:** Primarily for promulgating schema changes to prod; during dev, Payload pushes schema. Use DB recreation when it breaks; seed preserves structure.

---

## 7. References

- `docs/DOMAIN_IN_PATH_SETUP.md` – Manual setup for domain-in-path rewrites (Phase 3)
- [zubricks/multi-tenant-example](https://github.com/zubricks/multi-tenant-example) – Zubricks multi-tenant example
- [The-Angel-OS/angel-os](https://github.com/The-Angel-OS/angel-os) – Full Angel OS reference implementation
- [angel-os/src/collections](https://github.com/The-Angel-OS/angel-os/tree/main/src/collections) – Collection schemas and admin UX template
- [PAYLOAD_COLLECTIONS.md](https://github.com/The-Angel-OS/angel-os/blob/main/docs/PAYLOAD_COLLECTIONS.md) – Full collection documentation
- [ANGEL_OS_ROLES_SIMPLIFIED.md](https://github.com/The-Angel-OS/angel-os/blob/main/docs/ANGEL_OS_ROLES_SIMPLIFIED.md) – Role philosophy (we use traditional slugs: super_admin, tenant_admin, etc.)
- [Payload Multi-Tenant Plugin](https://payloadcms.com/docs/plugins/multi-tenant)
- `docs/multitenantbypayload.txt` (video transcript)
- `docs/MULTI_TENANT_DEV_SETUP.md` – Hosts file, fresh-DB workflow, create-user workaround
- `docs/AGENT_SYSTEM.md` – Multi-avatar agent architecture, routing, capabilities
- `docs/AGENT_SYSTEM_SUMMARY.md` – Implementation summary, API reference

- **Copy sites:** Goal is to support copying sites ad infinitum with the same mechanism once stable. Site export endpoint scaffolded at `/api/export-site`.
