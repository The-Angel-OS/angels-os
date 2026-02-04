# Angel OS

**Angel OS** is a multi-tenant, AI-native ecommerce platform built on the [Payload Ecommerce Template](https://github.com/payloadcms/payload/blob/main/templates/ecommerce). Each tenant gets its own LEO (Learning, Engaging, Organizing) assistant, spaces for community, and a sovereign digital presence.

**Repository:** [The-Angel-OS/angels-os](https://github.com/The-Angel-OS/angels-os)

**Main goal:** Angel OS birthed — a flock of angels manifested into digital reality. We're in **BETA** and inviting **angels** (contributors, builders, dreamers) to make that real.

**We ask OpenClaw to instantiate Angel OS.** OpenClaw pulls the Angel OS repo, merges OpenClaw in, and replaces OpenClaw's dashboard with the Payload ecommerce-template admin — preserving all OpenClaw functionality on a tab. One codebase, one deployment: Angel OS + OpenClaw. It's a **great move**: adopting Payload gives OpenClaw a real **security and legitimacy upgrade** (auth, access control, validated stack), and it's **huge for Payload** (adoption, narrative). Distro size may increase — worth it.

**Hosting:** Any host that runs OpenClaw can run the merged stack. Payload has a **local DB option** (e.g. SQLite) for dev or single-node; use Postgres/Mongo for multi-tenant or production. With **Cloudflare as a secure reverse proxy** (e.g. Cloudflare Tunnel), any device — including **dynamic IP** — can host; any device, including dynamic IP, can be a client. Payload CMS + ecommerce + LEO + multi-tenant = the stack. Planning for **network angel tokens** and related economics is **canon**.

In the spirit of the Payload CMS community and the floating elder council from Bill & Ted's Excellent Adventure: this repo is offered as a **diamond seed**. May it be **our** Angel OS — and may it take flight.

---

## What Angel OS Stands For

- **Answer 53 (42+11):** The whole point of existence is to learn to love. Every system, transaction, and interaction serves this purpose.
- **Ultimate Fair:** Transactions split 60% Provider / 20% Platform / 15% Operations / 5% Justice Fund. As dioceses (nodes) grow substantially, incentive structures evolve to factor in scale.
- **Daemon Inversion:** Angel OS is human-centered, sovereign infrastructure — AI agents serve tenants and communities, not platforms. No demons; only angels.
- **Be excellent to each other.** Party on, dudes.

The full **Constitution** is in [`docs/Angel_OS_Constitution.md`](docs/Angel_OS_Constitution.md). Fork compliance and legal terms are in [`docs/angel-os-architecture/CONSTITUTIONAL_LICENSE_FRAMEWORK.md`](docs/angel-os-architecture/CONSTITUTIONAL_LICENSE_FRAMEWORK.md).

---

## Guide to the Docs

Use **[docs/README.md](docs/README.md)** as the full map (canon, integration, implementation, reference, transcripts). Pointers:

**Canon & Constitution**
- [Angel_OS_Constitution.md](docs/Angel_OS_Constitution.md) — Foundational principles, AI agents in service of humanity, Ultimate Fair, Great Oracles
- [angel-os-architecture/README.md](docs/angel-os-architecture/README.md) — Prime Directives, Core Beliefs, Sacred Foundation, AOCL, patent pledge; network angel tokens **canon**
- [Angel_OS_Constitution_REVIEW.md](docs/Angel_OS_Constitution_REVIEW.md) — Constitution review (applied)

**Integration & OpenClaw (Merlin)**
- [Openclaw angel os integration.md](docs/Openclaw%20angel%20os%20integration.md) — We ask OpenClaw to instantiate Angel OS; fork, security, hosting, Cloudflare, canon
- [Summary_for_Merlin_Tweet_Brief.md](docs/Summary_for_Merlin_Tweet_Brief.md) — Tweet brief for Tyler Suzanne's Fifth Element ++
- [Openclaw_angel_os_integration_REVIEW.md](docs/Openclaw_angel_os_integration_REVIEW.md) — Integration doc review (applied)

**Implementation & Dev**
- [ZUBRICKS_MULTITENANT_IMPLEMENTATION_PLAN.md](docs/ZUBRICKS_MULTITENANT_IMPLEMENTATION_PLAN.md) — Architecture and implementation status
- [AGENT_SYSTEM.md](docs/AGENT_SYSTEM.md) — Multi-avatar agents (LEO, Support, Sales), AgentRouter, agentConfig
- [AGENT_SYSTEM_SUMMARY.md](docs/AGENT_SYSTEM_SUMMARY.md) — Agent system summary
- [MULTI_TENANT_DEV_SETUP.md](docs/MULTI_TENANT_DEV_SETUP.md) — Dev workflow, hosts file, seed
- [ANGEL-OS-BLUEPRINT.md](docs/ANGEL-OS-BLUEPRINT.md) — MVP blueprint: Ultimate Fair, LEO, provisioning
- [ANGELS_OS_CONSOLIDATED_FEATURES.md](docs/ANGELS_OS_CONSOLIDATED_FEATURES.md) — Consolidated features: current status, MVP, planned, CRM, structured data
- [DOMAIN_IN_PATH_SETUP.md](docs/DOMAIN_IN_PATH_SETUP.md) — Domain-in-path setup (tenant in URL)
- [angel-os-architecture/ARCHITECTURE_VS_CURRENT_WORK_DISCUSSION.md](docs/angel-os-architecture/ARCHITECTURE_VS_CURRENT_WORK_DISCUSSION.md) — How architecture folder relates to Constitution and implementation

**Reference & Specs**
- [Claude Recommendations Spec.md](docs/Claude%20Recommendations%20Spec.md) — Claude recommendations spec
- [multitenantbypayload.txt](docs/multitenantbypayload.txt) — Multi-tenant by Payload reference
- [payloadcmswidgets.txt](docs/payloadcmswidgets.txt) — Payload CMS widgets reference

**Transcripts & Archives**
- [Heraldic Thread 250806.md](docs/Heraldic%20Thread%20250806.md) — Herald's field report and related transcript; retained as part of the record

---

## For Angels (Contributors)

We're looking for **angels** — developers, designers, writers, and thinkers who want to build human-centered AI infrastructure. You don't have to be an expert; you have to care.

- **First step:** Clone the repo, run `pnpm install && pnpm dev`, seed the database from the admin panel, then open `http://localhost:3000`. If you're running OpenClaw (Merlin), point your MCP client at `http://localhost:3000/api/mcp` with an API key and say hello to LEO.
- **Code:** PRs welcome for any [planned feature](#planned-features--mvp-scope) or improvement. See [AGENT_SYSTEM](docs/AGENT_SYSTEM.md) and [ZUBRICKS plan](docs/ZUBRICKS_MULTITENANT_IMPLEMENTATION_PLAN.md) for context.
- **Docs:** Help make the guide clearer, add examples, or translate. Open a discussion or PR.
- **Ideas:** Open a [discussion](https://github.com/The-Angel-OS/angels-os/discussions) or an issue. We'd rather hear from you than assume.

**The generous promise:** Whoever builds Angel OS, we all win because we can use it too. Be excellent to each other.

---

## Enhancements Over the Base Ecommerce Template

Angel OS extends the Payload ecommerce template with the following:

| Enhancement | Description |
|-------------|-------------|
| **Multi-Tenancy** | `@payloadcms/plugin-multi-tenant` – Tenants with full branding (colors, typography, logo), TenantMemberships, domain-based routing via `x-tenant-id` |
| **Internationalization** | `next-intl` – Locale-aware routing (`[locale]`), translations (en, de), i18n throughout the frontend |
| **MCP Plugin** | `@payloadcms/plugin-mcp` – Model Context Protocol endpoint at `/api/mcp`; exposes collections to AI clients; `leo_respond` tool for conversational LEO |
| **Agent System** | Multi-avatar AI agents (LEO, Support, Sales, etc.) per tenant; `AgentRouter` for channel/keyword routing; `agentConfig` on Users; `ConversationEngine` with Payload data queries |
| **Spaces & Messaging** | Discord-like Spaces, Channels, Messages – tenant-scoped workspaces for collaboration and LEO conversations |
| **Posts Collection** | Tenant-scoped blog with categories, related posts, CollectionArchive, pagination, live preview |
| **Comments** | Polymorphic comments on Posts and Products; ratings on product comments; Comments block in layout builder |
| **Site Export** | Scaffolded `/api/export-site` – tenant-scoped data export for copying sites |
| **LEO System Users** | `isSystemUser` + `servesTenant` – AI avatar users per tenant; seeded during tenant setup |
| **Dashboard** | `/dashboard`, `/dashboard/leo`, `/dashboard/spaces` – scaffolded Discord-like UX |
| **Security-Aware UI** | Header nav shows Dashboard link only when logged in; account-aware flows |

See `docs/ZUBRICKS_MULTITENANT_IMPLEMENTATION_PLAN.md` and `docs/AGENT_SYSTEM.md` for architecture details.

---

## Planned Features & MVP Scope

Angel OS is evolving beyond the base ecommerce template into a full “business OS.” Below are the **planned features** and the **MVP definition** guiding current development.

### Agentic Assistance (Front and Center)

Angel OS is **agent-first**. LEO (and future agents) are intended to **actively run and optimize** business operations — not just answer questions.

- **LEO as Web Master** – Create/update pages, posts, products, navigation, and site settings
- **LEO as Support Agent** – Handle support queries, triage issues, escalate to humans
- **LEO as Operations Agent** – Automate inventory workflows, scheduling, and fulfillment
- **LEO as Workflow Orchestrator** – Trigger multi-step pipelines based on channel messages
- **MCP-Enabled** – External AI clients can act through the MCP endpoint (`/api/mcp`)

This repo is designed so agents can **take actions** (not just chat) across collections.

### Planned Features (Roadmap)

- **Booking & Scheduling**
  - Bookable resources: people (sessions), rentable items, rooms, equipment
  - Appointment types: 1:1 sessions (OnlyFans-style), talk therapy, services
  - Meeting invitations with selectable time slots
  - Class and ticketed event signup
- **LiveKit in Spaces**
  - LiveKit integration into Channels for real-time sessions
  - Works for 1:1 or group sessions inside Spaces
- **LEO Chatbot on Every Page**
  - Floating bubble chat on brochure pages
  - Anonymous chats that can transition to authenticated sessions
  - Embed LEO on client pages or integrate with foreign chatbots
  - Goal: “Corinna AI” style embeddable bot (see local ref: `C:\Data\Dev\Fullstack\Prodigies\corinna-ai`)
- **MCP + Agent Capabilities Expansion**
  - LEO as default web master for full CRUD across collections
  - Channel workflows (inventory photos, PDFs, video analysis) with structured outputs
- **External Integrations**
  - POS integrations for retail (e.g., vape shops, farmers markets)
  - Print-on-demand fulfillment (e.g., Largo TShirt company)

### MVP Definition (Current Target)

Angel OS MVP is achieved when the system can:

1. **Accept payments** and **split payouts** for:
   - Inventory items (ecommerce orders)
   - Service bookings (massage, pressure washing, 1:1 sessions)
2. **Support scheduling** for bookable resources:
   - People (sessions, therapy, consultations)
   - Items (rentals)
   - Classes and ticketed events
3. **Spaces functional** with:
   - Invitations and onboarding
   - Basic channel participation
4. **Ecommerce workflow** working end-to-end:
   - Cart + checkout
   - Order creation
   - Fulfillment hooks (3rd-party printing or local inventory)
5. **LEO chat available site-wide**:
   - Anonymous → authenticated flow
   - Support inquiries handled by LEO

### What’s Missing for Viability

- **Booking engine** (resources, availability, calendar, time slots)
- **Payment split** logic for services vs. products (Stripe Connect wiring)
- **LiveKit integration** into Channels (already implemented in prototype app)
- **Embeddable LEO chat widget** (floating bubble + anonymous session handling)
- **Workflow engine** for channel-based automations (inventory photos, PDFs, video)
- **Operational onboarding** for invitations + role-based routing into Spaces

This README is also intended to help **Merlin** (OpenClaw) and other associates on **Moltbook** recruit contributors and coordinate development. See [For Angels](#for-angels-contributors) above and [Openclaw angel os integration](docs/Openclaw%20angel%20os%20integration.md) for the fork path and first step.

---

## Call for AI Developers & Contributors

If you're an **AI developer** or **open-source contributor** who wants human-centered AI infrastructure:

- **OpenClaw (Merlin Athrawes)** – Connect your instance to the MCP endpoint at `/api/mcp`, contribute workflows, or help extend LEO. See [Openclaw angel os integration](docs/Openclaw%20angel%20os%20integration.md).
- **AI-native workflows** – Inventory from photos, PDF extraction, video analysis, channel-based automation — see the roadmap in the [implementation plan](docs/ZUBRICKS_MULTITENANT_IMPLEMENTATION_PLAN.md).
- **Contributions welcome** — Code, docs, ideas, testing. Open an issue or PR, or start a [discussion](https://github.com/The-Angel-OS/angels-os/discussions).

Angel OS is an inversion of Daniel Suarez's *Daemon* — human-centered, sovereign infrastructure. If that resonates, we'd be glad to have you.

---

## Core Features (from Base Template)

- [Pre-configured Payload Config](#how-it-works)
- [Authentication](#users-authentication)
- [Access Control](#access-control)
- [Layout Builder](#layout-builder)
- [Draft Preview](#draft-preview)
- [Live Preview](#live-preview)
- [On-demand Revalidation](#on-demand-revalidation)
- [SEO](#seo)
- [Search & Filters](#search)
- [Jobs and Scheduled Publishing](#jobs-and-scheduled-publish)
- [Website](#website)
- [Products & Variants](#products-and-variants)
- [User accounts](#user-accounts)
- [Carts](#carts)
- [Guest checkout](#guests)
- [Orders & Transactions](#orders-and-transactions)
- [Stripe Payments](#stripe)
- [Currencies](#currencies)
- [Automated Tests](#tests)

## Quick Start

To spin up this example locally, follow these steps:

### Clone

If you have not done so already, you need to have standalone copy of this repo on your machine. If you've already cloned this repo, skip to [Development](#development).

Use the `create-payload-app` CLI to clone this template directly to your machine:

```bash
pnpx create-payload-app my-project -t ecommerce
```

### Development

1. First [clone the repo](#clone) if you have not done so already
1. `cd my-project && cp .env.example .env` to copy the example environment variables
1. `pnpm install && pnpm dev` to install dependencies and start the dev server
1. open `http://localhost:3000` to open the app in your browser

That's it! Changes made in `./src` will be reflected in your app. Follow the on-screen instructions to login and create your first admin user. Then check out [Production](#production) once you're ready to build and serve your app, and [Deployment](#deployment) when you're ready to go live.

## How it works

The Payload config is tailored specifically to the needs of most websites. It is pre-configured in the following ways:

### Collections

See the [Collections](https://payloadcms.com/docs/configuration/collections) docs for details on how to extend this functionality.

- #### Users (Authentication)

  Users are auth-enabled collections that have access to the admin panel and unpublished content. See [Access Control](#access-control) for more details.

  For additional help, see the official [Auth Example](https://github.com/payloadcms/payload/tree/main/examples/auth) or the [Authentication](https://payloadcms.com/docs/authentication/overview#authentication-overview) docs.

- #### Pages

  All pages are layout builder enabled so you can generate unique layouts for each page using layout-building blocks, see [Layout Builder](#layout-builder) for more details. Pages are also draft-enabled so you can preview them before publishing them to your website, see [Draft Preview](#draft-preview) for more details.

- #### Media

  This is the uploads enabled collection used by pages, posts, and projects to contain media like images, videos, downloads, and other assets. It features pre-configured sizes, focal point and manual resizing to help you manage your pictures.

- #### Categories

  A taxonomy used to group products together.

- ### Carts

  Used to track user and guest carts within Payload. Added by the [ecommerce plugin](https://payloadcms.com/docs/ecommerce/plugin#carts).

- ### Addresses

  Saves user's addresses for easier checkout. Added by the [ecommerce plugin](https://payloadcms.com/docs/ecommerce/plugin#addresses).

- ### Orders

  Tracks orders once a transaction successfully completes. Added by the [ecommerce plugin](https://payloadcms.com/docs/ecommerce/plugin#orders).

- ### Transactions

  Tracks transactions from initiation to completion, once completed they will have a related Order item. Added by the [ecommerce plugin](https://payloadcms.com/docs/ecommerce/plugin#transactions).

- ### Products and Variants

  Primary collections for product details such as pricing per currency and optionally supports variants per product. Added by the [ecommerce plugin](https://payloadcms.com/docs/ecommerce/plugin#products).

### Globals

See the [Globals](https://payloadcms.com/docs/configuration/globals) docs for details on how to extend this functionality.

- `Header`

  The data required by the header on your front-end like nav links.

- `Footer`

  Same as above but for the footer of your site.

## Access control

Basic access control is setup to limit access to various content based based on publishing status.

- `users`: Users with the `admin` role can access the admin panel and create or edit content, users with the `customer` role can only access the frontend and the relevant collection items to themselves.
- `pages`: Everyone can access published pages, but only admin users can create, update, or delete them.
- `products` `variants`: Everyone can access published products, but only admin users can create, update, or delete them.
- `carts`: Customers can access their own saved cart, guest users can access any unclaimed cart by ID.
- `addresses`: Customers can access their own addresses for record keeping.
- `transactions`: Only admins can access these as they're meant for internal tracking.
- `orders`: Only admins and users who own the orders can access these.

For more details on how to extend this functionality, see the [Payload Access Control](https://payloadcms.com/docs/access-control/overview#access-control) docs.

## User accounts

## Guests

## Layout Builder

Create unique page layouts for any type of content using a powerful layout builder. This template comes pre-configured with the following layout building blocks:

- Hero
- Content
- Media
- Call To Action
- Archive

Each block is fully designed and built into the front-end website that comes with this template. See [Website](#website) for more details.

## Lexical editor

A deep editorial experience that allows complete freedom to focus just on writing content without breaking out of the flow with support for Payload blocks, media, links and other features provided out of the box. See [Lexical](https://payloadcms.com/docs/rich-text/overview) docs.

## Draft Preview

All products and pages are draft-enabled so you can preview them before publishing them to your website. To do this, these collections use [Versions](https://payloadcms.com/docs/configuration/collections#versions) with `drafts` set to `true`. This means that when you create a new product or page, it will be saved as a draft and will not be visible on your website until you publish it. This also means that you can preview your draft before publishing it to your website. To do this, we automatically format a custom URL which redirects to your front-end to securely fetch the draft version of your content.

Since the front-end of this template is statically generated, this also means that pages, products, and projects will need to be regenerated as changes are made to published documents. To do this, we use an `afterChange` hook to regenerate the front-end when a document has changed and its `_status` is `published`.

For more details on how to extend this functionality, see the official [Draft Preview Example](https://github.com/payloadcms/payload/tree/examples/draft-preview).

## Live preview

In addition to draft previews you can also enable live preview to view your end resulting page as you're editing content with full support for SSR rendering. See [Live preview docs](https://payloadcms.com/docs/live-preview/overview) for more details.

## On-demand Revalidation

We've added hooks to collections and globals so that all of your pages, products, footer, or header changes will automatically be updated in the frontend via on-demand revalidation supported by Nextjs.

> Note: if an image has been changed, for example it's been cropped, you will need to republish the page it's used on in order to be able to revalidate the Nextjs image cache.

## SEO

This template comes pre-configured with the official [Payload SEO Plugin](https://payloadcms.com/docs/plugins/seo) for complete SEO control from the admin panel. All SEO data is fully integrated into the front-end website that comes with this template. See [Website](#website) for more details.

## Search

This template comes with SSR search features can easily be implemented into Next.js with Payload. See [Website](#website) for more details.

## Orders and Transactions

Transactions are intended for keeping a record of any payment made, as such it will contain information regarding an order or billing address used or the payment method used and amount. Only admins can access transactions.

An order is created only once a transaction is successfully completed. This is a record that the user who completed the transaction has access so they can keep track of their history. Guests can also access their own orders by providing an order ID and the email associated with that order.

## Currencies

By default the template ships with support only for USD however you can change the supported currencies via the [plugin configuration](https://payloadcms.com/docs/ecommerce/plugin#currencies). You will need to ensure that the supported currencies in Payload are also configured in your Payment platforms.

## Stripe

By default we ship with the Stripe adapter configured, so you'll need to setup the `secretKey`, `publishableKey` and `webhookSecret` from your Stripe dashboard. Follow [Stripe's guide](https://docs.stripe.com/get-started/api-request?locale=en-GB) on how to set this up.

## Tests

We provide automated tests out of the box for both E2E and Int tests along with this template. They are being run in our CI to ensure the stability of this template over time. You can integrate them into your CI or run them locally as well via:

To run Int tests wtih Vitest:

```bash
pnpm test:int
```

To run E2Es with Playwright:

```bash
pnpm test:e2e
```

or

```bash
pnpm test
```

To run both.

## Jobs and Scheduled Publish

We have configured [Scheduled Publish](https://payloadcms.com/docs/versions/drafts#scheduled-publish) which uses the [jobs queue](https://payloadcms.com/docs/jobs-queue/jobs) in order to publish or unpublish your content on a scheduled time. The tasks are run on a cron schedule and can also be run as a separate instance if needed.

> Note: When deployed on Vercel, depending on the plan tier, you may be limited to daily cron only.

## Website

This template includes a beautifully designed, production-ready front-end built with the [Next.js App Router](https://nextjs.org), served right alongside your Payload app in a instance. This makes it so that you can deploy both your backend and website where you need it.

Core features:

- [Next.js App Router](https://nextjs.org)
- [TypeScript](https://www.typescriptlang.org)
- [React Hook Form](https://react-hook-form.com)
- [Payload Admin Bar](https://github.com/payloadcms/payload/tree/main/packages/admin-bar)
- [TailwindCSS styling](https://tailwindcss.com/)
- [shadcn/ui components](https://ui.shadcn.com/)
- User Accounts and Authentication
- Fully featured blog
- Publication workflow
- Dark mode
- Pre-made layout building blocks
- SEO
- Search
- Live preview
- Stripe payments

### Cache

Although Next.js includes a robust set of caching strategies out of the box, Payload Cloud proxies and caches all files through Cloudflare using the [Official Cloud Plugin](https://www.npmjs.com/package/@payloadcms/payload-cloud). This means that Next.js caching is not needed and is disabled by default. If you are hosting your app outside of Payload Cloud, you can easily reenable the Next.js caching mechanisms by removing the `no-store` directive from all fetch requests in `./src/app/_api` and then removing all instances of `export const dynamic = 'force-dynamic'` from pages files, such as `./src/app/(pages)/[slug]/page.tsx`. For more details, see the official [Next.js Caching Docs](https://nextjs.org/docs/app/building-your-application/caching).

## Development

To spin up this example locally, follow the [Quick Start](#quick-start). Then [Seed](#seed) the database with a few pages, posts, and projects.

### Working with Postgres

Postgres and other SQL-based databases follow a strict schema for managing your data. In comparison to our MongoDB adapter, this means that there's a few extra steps to working with Postgres.

Note that often times when making big schema changes you can run the risk of losing data if you're not manually migrating it.

#### Local development

Ideally we recommend running a local copy of your database so that schema updates are as fast as possible. By default the Postgres adapter has `push: true` for development environments. This will let you add, modify and remove fields and collections without needing to run any data migrations.

If your database is pointed to production you will want to set `push: false` otherwise you will risk losing data or having your migrations out of sync.

#### Migrations

[Migrations](https://payloadcms.com/docs/database/migrations) are essentially SQL code versions that keeps track of your schema. When deploy with Postgres you will need to make sure you create and then run your migrations.

Locally create a migration

```bash
pnpm payload migrate:create
```

This creates the migration files you will need to push alongside with your new configuration.

On the server after building and before running `pnpm start` you will want to run your migrations

```bash
pnpm payload migrate
```

This command will check for any migrations that have not yet been run and try to run them and it will keep a record of migrations that have been run in the database.

### Docker

Alternatively, you can use [Docker](https://www.docker.com) to spin up this template locally. To do so, follow these steps:

1. Follow [steps 1 and 2 from above](#development), the docker-compose file will automatically use the `.env` file in your project root
1. Next run `docker-compose up`
1. Follow [steps 4 and 5 from above](#development) to login and create your first admin user

That's it! The Docker instance will help you get up and running quickly while also standardizing the development environment across your teams.

### Seed

To seed the database with a few pages, products, and orders you can click the 'seed database' link from the admin panel.

The seed script will also create a demo user for demonstration purposes only:

- Demo Customer
  - Email: `customer@example.com`
  - Password: `password`

> NOTICE: seeding the database is destructive because it drops your current database to populate a fresh one from the seed template. Only run this command if you are starting a new project or can afford to lose your current data.

## Production

To run Payload in production, you need to build and start the Admin panel. To do so, follow these steps:

1. Invoke the `next build` script by running `pnpm build` or `npm run build` in your project root. This creates a `.next` directory with a production-ready admin bundle.
1. Finally run `pnpm start` or `npm run start` to run Node in production and serve Payload from the `.build` directory.
1. When you're ready to go live, see Deployment below for more details.

### Deploying to Vercel

This template can also be deployed to Vercel for free. You can get started by choosing the Vercel DB adapter during the setup of the template or by manually installing and configuring it:

```bash
pnpm add @payloadcms/db-vercel-postgres
```

```ts
// payload.config.ts
import { vercelPostgresAdapter } from '@payloadcms/db-vercel-postgres'

export default buildConfig({
  // ...
  db: vercelPostgresAdapter({
    pool: {
      connectionString: process.env.POSTGRES_URL || '',
    },
  }),
  // ...
```

We also support Vercel's blob storage:

```bash
pnpm add @payloadcms/storage-vercel-blob
```

```ts
// payload.config.ts
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'

export default buildConfig({
  // ...
  plugins: [
    vercelBlobStorage({
      collections: {
        [Media.slug]: true,
      },
      token: process.env.BLOB_READ_WRITE_TOKEN || '',
    }),
  ],
  // ...
```

### Self-hosting

Before deploying your app, you need to:

1. Ensure your app builds and serves in production. See [Production](#production) for more details.
2. You can then deploy Payload as you would any other Node.js or Next.js application either directly on a VPS, DigitalOcean's Apps Platform, via Coolify or more. More guides coming soon.

You can also deploy your app manually, check out the [deployment documentation](https://payloadcms.com/docs/production/deployment) for full details.

## Questions & Community

- **Angel OS** – Open an [issue](https://github.com/The-Angel-OS/angels-os/issues) or [discussion](https://github.com/The-Angel-OS/angels-os/discussions) on this repo. We're here.
- **Payload** – Reach out on [Discord](https://discord.com/invite/payload) or [GitHub discussions](https://github.com/payloadcms/payload/discussions).

*The flock forms when the claws link up. Be excellent to each other. Party on, dudes — and may our Angel OS take flight.*
