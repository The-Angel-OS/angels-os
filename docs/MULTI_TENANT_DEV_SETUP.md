# Multi-Tenant Development Setup

Local setup for testing multi-tenancy, fresh-DB workflow, and Payload admin.

---

## 1. Hosts File for Local Multi-Tenant Testing

To test multiple tenants by hostname, add entries to your hosts file.

**Windows:** `C:\Windows\System32\drivers\etc\hosts` (run editor as Administrator)  
**macOS/Linux:** `/etc/hosts`

Entries for angels-os (add if not present):

```
127.0.0.1   angelos.local
127.0.0.1   default.local
```

- `localhost` → default tenant (slug `default`)
- `angelos.local` → add a tenant with `domain: angelos.local` for hostname-based routing
- `default.local` → optional alias for default

Ensure middleware resolves tenant from hostname (see `src/middleware.ts` and `fetchTenantByDomain`).

---

## 2. Fresh Database Workflow

### Steps

1. **Drop & recreate DB** (pgAdmin4 or psql)
   - Drop the database
   - Create a new empty database
   - Point `DATABASE_URI` in `.env.local` at it

2. **Start app** – `pnpm dev`
   - Payload pushes the schema
   - No users exist → Payload shows first-user registration

3. **Create first user (Payload admin)**
   - Go to `/admin`
   - Create your user (e.g. `kenneth.courtney@gmail.com`, password `angelos`)
   - **Important:** Do **not** click the **+** button on the Tenants field. No tenants exist yet; clicking + can break the form and require a refresh.
   - Submit. The user will have no tenants initially.

4. **Run seed** – Visit `/en/next/seed` (or `/next/seed` depending on locale)
   - Creates default tenant, LEO, admin/customer users, spaces, products, etc.
   - Seed uses `findOrCreate` – your manually created user is kept; seed creates admin/customer/LEO as additional users.
   - **To make your user the seed admin:** Either (a) use the same email as `INITIAL_USER_EMAILS.admin` in `seed-helpers.ts`, or (b) delete the seed admin and assign your user to the default tenant + TenantMembership in the admin.

5. **Assign your user to tenant** (if needed)
   - Users → edit your user
   - Add the default tenant to the Tenants array (tenant should exist after seed)
   - Optionally add a TenantMembership for tenant_admin role

**Alternative – use your email as seed admin:** Set `INITIAL_USER_EMAILS.admin` in `src/endpoints/seed/seed-helpers.ts` to your email (e.g. `kenneth.courtney@gmail.com`). Then when you create that user manually and run seed, `findOrCreateUser` will find it and use it (no duplicate). Seed will add TenantMembership for tenant_admin automatically.

---

## 3. Create New User – Tenants Field Behavior

The Users collection has a **Tenants** array field (from the multi-tenant plugin). When creating/editing a user:

- **Before seed:** No tenants in the system. Do **not** click + on Tenants. Leave it empty. Submitting works.
- **After seed:** Tenants exist. You can safely add tenants via +.
- **If you clicked + before tenants existed:** The relationship selector may fail. Refresh the page and create the user again without touching Tenants.

**Frontend create-account** (`/create-account`): Only sends email/password. No tenants field. Works regardless of tenant state.

---

## 4. Live Preview (Pages, Products, Posts)

**PREVIEW_SECRET** must be set in `.env` / `.env.local` for live preview to work. Use a random string (e.g. `openssl rand -hex 32`). If unset, preview may show "forbidden" or blank.

- Root `admin.livePreview` includes `pages`, `products`, `posts` with breakpoints
- Preview route: `/[locale]/next/preview` validates secret, enables draft mode, redirects to path
- Ensure `PREVIEW_SECRET` is set before testing live preview in the admin

---

## 5. MCP Plugin & LEO Integration

Payload MCP plugin is enabled. The MCP endpoint is at **`/api/mcp`** (POST).

### Setup

1. **Create MCP API key** – In Payload admin, go to **Payload MCP API Keys** and create a key.
2. **Enable collections** – Configure which collections the key can access (find, create, update, delete).
3. **Enable `leo_respond`** – For the custom LEO tool, enable the `leo_respond` checkbox on the API key.

### LEO tool (`leo_respond`)

- **Parameters:** `message` (required), `conversationId` (optional)
- **Behavior:** Sends the message to the ConversationEngine (LEO) and returns LEO’s response.
- **Agent Routing:** Uses `AgentRouter` to select the right agent. Defaults to LEO if no specific match.
- **ConversationEngine:** Uses Payload when available (posts/products queries). Respects agent capabilities and personality.

### Connecting MCP clients

Use the API key as a Bearer token when calling the MCP endpoint. See [Payload MCP plugin](https://github.com/payloadcms/payload/tree/main/packages/plugin-mcp) for client integration.

---

## 6. Agent System (LEO & Multi-Avatar)

System agents are "avatar" users with `isSystemUser: true`. Each tenant can have multiple agents with distinct personalities and capabilities.

### Agent Types

- **LEO** (default) – General assistant, handles posts/products/spaces
- **Support** – Customer support, issue resolution
- **Sales** – Product recommendations, checkout assistance
- **Onboarding** – New user guidance
- **Integration** – Foreign system connectors (Stripe, Shopify, etc.)
- **Custom** – Admin-defined

### Configuration

Each agent has `agentConfig` with:
- **agentType** – Determines default behavior
- **displayName** – Name shown in chat
- **personality** – System prompt / guidelines
- **capabilities** – What actions the agent can perform
- **routingRules** – When this agent handles messages (channel, keywords, default)
- **handoffTo** – Escalation target

### Routing

The `AgentRouter` determines which agent handles a message:
1. **Channel-based** – Message in #support → Support Agent
2. **Keyword-based** – Message contains "buy" → Sales Agent
3. **Default** – No match → LEO

### Seeding

Initially, each tenant gets **LEO** only. Additional agents can be added via:
- Seed script (`findOrCreateSystemAgent`)
- Admin UI (Users collection, check `isSystemUser`)

See **[AGENT_SYSTEM.md](./AGENT_SYSTEM.md)** for full architecture and API reference.

---

## 7. Payload CMS Modular Dashboards (Widgets)

Payload 3.69+ supports modular dashboards with draggable, resizable widgets.

- **Docs:** [Using Modular Dashboards in Payload CMS](https://nlvcodes.com/tutorials/using-modular-dashboards-in-payload-cms)
- **Reference:** `docs/payloadcmswidgets.txt`
- **Config:** Add `admin.dashboard.components` or `admin.components` for custom widgets; use `getPayload` and the Local API to fetch data.
- **Preferences:** Widget layout is stored per user in `payload-preferences`.

Use Payload’s built-in widgets or Angel OS’s dashboard patterns as needed.

---

## 8. Angel OS Context

Angel OS is an inversion of Daniel Suarez’s *Daemon* OS – decentralized, human-centered infrastructure. The control panel can use Payload widgets or the Angel OS dashboard from the reference repo.

---

## 9. Seed as Site Provisioning Prototype

The seed script is the **prototype for the site provisioning system**:

- **Tenants control panel:** In angel-os, the admin has an "Add New Tenant" flow. This must be callable via **MCP/chat** when a user interacts with any LEO.
- **LEO provisioning:** LEO should be able to provision a new site (create tenant, LEO, spaces, etc.) and **hand off to the new site's LEO**.
- **LEO in Messages:** LEO exists in the Messages collection for all intents and purposes – authoring as `ai_agent`, referenced by `author` (User with `isSystemUser`).

---

## Quick Reference

| Step          | Action                                            |
|---------------|---------------------------------------------------|
| Reset         | Drop DB, create new, update `DATABASE_URI`        |
| First user    | Create via Payload admin; **do not** press + on Tenants |
| Seed          | Visit `/en/next/seed` after first user exists     |
| Multi-tenant  | Add hosts entries, configure tenant domains       |
