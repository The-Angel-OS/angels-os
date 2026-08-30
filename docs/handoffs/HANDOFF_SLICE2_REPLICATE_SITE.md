# Handoff — Slice 2: `replicate_site` LEO tool

**Date:** 2026-06-17
**For:** the core thread (angels-os core / LEO tool layer)
**From:** market-vendor vertical thread
**Context docs:** [docs/strategy/MARKET_VENDOR_VERTICAL.md](strategy/MARKET_VENDOR_VERTICAL.md) (the 5-slice plan), memory `project_market_vendor_vertical`

---

## TL;DR

Slice 1 (the **Hays Cactus Farm template**) is **shipped and live-verified** on the kendev node. Slice 2 turns it into the factory: an LEO tool so you can say *"stand up a site for [vendor]"* at a market and get a draft portal in one move. This is the [LEO factory principle](../../Users/kenne/.claude/projects/C--Dev-angels-os/memory/project_leo_factory_principle.md) — build the factory, not the prototype.

Two pieces of work, in order:
1. **Wire the market-vendor template into `apply_site_template`** (tiny — unblocks applying the template to any existing endeavor via LEO).
2. **Add the `replicate_site` tool** (the real slice — provisions a NEW portal + applies the template + branding in one call).

Everything you need already exists as a callable utility. You are wiring, not building from scratch.

---

## What shipped in Slice 1 (already on `main`, verified live)

| File | What it is |
|------|-----------|
| `src/utilities/provisionMarketVendorSite.ts` | The generic market-vendor template (sibling to `provisionChurchSite` / `provisionFitnessSite`). Exports `provisionMarketVendorSite(payload, tenantId, profile, opts)`, the `MarketVendorProfile` type, `HAYS_PROFILE` reference content, and `upcomingMarketDates()` (recurrence math, unit-tested). |
| `src/endpoints/market-vendor-template.ts` | `POST /api/provision-ops/market-vendor-template` — HTTP path, super_admin or `?key=CRON_SECRET`. |
| `src/payload.config.ts` | Endpoint registered (after the fitness-template route). |
| `tests/unit/market-vendor-dates.test.ts` | 3 passing tests for the nth-weekday calendar math. |

**Live proof (kendev node, 2026-06-17):** provisioned tenant #3 `hays-cactus` (`hays-cactus.kendev.co`), then applied the template →
`pages: created [find-us, guides, about], updated [home, contact]` · `posts: 4 created` (full articles) · `products: 3 dish gardens created`.

The signature you'll call:
```ts
export async function provisionMarketVendorSite(
  payload: Payload,
  tenantId: number | string,
  profile: MarketVendorProfile,
  opts: { overwrite?: boolean } = {},
): Promise<MarketVendorResult>  // { pages, posts, products } each { created, updated, skipped }
```

---

## The LEO tool layer — exact facts (all in `src/utilities/leo-data-tools.ts`)

- **Tool registry:** `LEO_TOOLS: Anthropic.Tool[]` at **line ~137**. Each entry = `{ name, description, input_schema: { type:'object', properties, required } }`.
- **Executor context type:** `ToolExecutorContext` at **~line 3476** — `{ payload, tenantId?, spaceId?, userId?, channelSlug?, roles?, tenantAiConfig?, trace? }`.
- **Dispatch:** `executeToolCall` (~3542) → `executeToolSwitch` (~3596), a big `switch (toolName)`. Mutations auto-revalidate via `CONTENT_MUTATION_TOOLS`.
- **Handlers return `Promise<string>`** (markdown). Append a nav hint with `navDirective('/path', 'Label')` (~line 91). Errors return a plain `'Error: …'` string.
- **Auth gate for privileged tools:** `ensureToolSuperAdmin(ctx, 'Provisioning …')` returns a denial string (or null) — call it first in provisioning handlers.
- **Tenant resolution:** `resolveWriteTenant(payload, ctx)` resolves which endeavor to write to when not provisioning a new one.
- **Closest sibling to copy:** `handleProvisionTenant` (**~line 9766**) — validates input, gates super_admin, `await import('./provisionPortal')`, calls `provisionPortal(...)`, formats a markdown log. `case 'provision_tenant'` dispatches at **~line 3765**.
- **Existing `apply_site_template` tool def** at **~line 1237**; its handler `applySiteTemplate` at **~line 7582**. Today its `template` enum is only `['fitness','church']`.

---

## Task 1 — wire market-vendor into `apply_site_template` (small)

So an *existing* endeavor can get the template via LEO without a new portal.

1. In the tool def (~1237), extend the enum: `enum: ['fitness', 'church', 'market-vendor']` and mention it in the description (e.g. *"market-vendor" = a local market seller (Home/Find Us/Guides/About/Contact + product catalog), Hays Cactus Farm pattern*).
2. In the `applySiteTemplate` handler (~7582), add a branch: when `template === 'market-vendor'`, call `provisionMarketVendorSite(payload, tenantId, { vendorName: name || endeavorName }, { overwrite })`. For hays-cactus, default the profile to `HAYS_PROFILE` (mirror what the endpoint at `src/endpoints/market-vendor-template.ts` already does — copy that defaulting logic).
3. Format the `{ pages, posts, products }` result into the same markdown summary style the church/fitness branch uses.

---

## Task 2 — the `replicate_site` tool (the actual slice)

**Intent:** one call provisions a brand-new draft portal for a vendor AND fills it with the template. This is the "type a vendor name at the market → live draft site" flow. It composes two existing utilities — do **not** reimplement either.

### 2a. Tool definition — add to `LEO_TOOLS` (~line 137)
```ts
{
  name: 'replicate_site',
  description:
    'Stand up a complete DRAFT website for a NEW local market vendor in one move: provisions a new portal (tenant + endeavor + spaces) AND fills it with the market-vendor template — Home, a "Find Us" market calendar, guide posts, and a product catalog. Use at a market to spin up a vendor a site on the spot. Provide the vendor name and domain; pass products/markets/branding if you have them, otherwise sensible defaults are used. Idempotent. Returns the draft site URL.',
  input_schema: {
    type: 'object' as const,
    properties: {
      vendorName: { type: 'string', description: 'The vendor/business name, e.g. "Psalms Brittle".' },
      domain:     { type: 'string', description: 'Routing domain, e.g. "psalms-brittle.kendev.co". Required.' },
      slug:       { type: 'string', description: 'URL-safe id. Derived from vendorName if omitted.' },
      tagline:    { type: 'string', description: 'Short tagline for hero/branding.' },
      story:      { type: 'string', description: 'One-paragraph origin story for the About page.' },
      primaryColor:   { type: 'string', description: 'Brand primary hex.' },
      secondaryColor: { type: 'string', description: 'Brand secondary hex.' },
      youtubeUrl: { type: 'string', description: 'Vendor YouTube channel URL (we help them set one up).' },
      products: {
        type: 'array',
        description: 'Optional products to seed: each { title, priceUSD, description }.',
        items: { type: 'object' },
      },
      markets: {
        type: 'array',
        description: 'Optional recurring market stops: each { title, cadence, weekday (0=Sun..6=Sat), nth? }.',
        items: { type: 'object' },
      },
    },
    required: ['vendorName', 'domain'],
  },
},
```

### 2b. Dispatch — in `executeToolSwitch` (~after line 3765)
```ts
case 'replicate_site':
  return await handleReplicateSite(payload, toolInput, ctx)
```

### 2c. Handler — model on `handleProvisionTenant` (~9766)
Pseudocode (defensive coercion + super_admin gate, like its sibling):
```ts
async function handleReplicateSite(payload, input, ctx): Promise<string> {
  const denied = ensureToolSuperAdmin(ctx, 'Replicating a vendor site')
  if (denied) return denied

  const vendorName = String(input.vendorName || '').trim()
  const domain = String(input.domain || '').trim()
  if (!vendorName || !domain) return 'Error: vendorName and domain are required.'

  // 1) Provision the new portal (reuse, don't reinvent).
  const { provisionPortal } = await import('./provisionPortal')
  const portal = await provisionPortal(payload, {
    name: vendorName, domain, slug: input.slug as string | undefined,
    tagline: input.tagline as string | undefined,
    primaryColor: input.primaryColor as string | undefined,
    secondaryColor: input.secondaryColor as string | undefined,
    endeavorType: 'retail-commerce',
  }, { actingUserId: ctx.userId })

  // 2) Fill it with the market-vendor template.
  const { provisionMarketVendorSite } = await import('./provisionMarketVendorSite')
  const profile = {
    vendorName,
    tagline: input.tagline as string | undefined,
    story: input.story as string | undefined,
    youtubeUrl: input.youtubeUrl as string | undefined,
    products: mapProducts(input.products),   // light coercion → MarketVendorProduct[]
    markets: mapMarkets(input.markets),       // light coercion → MarketStop[]
  }
  const result = await provisionMarketVendorSite(payload, portal.tenant.id, profile, { overwrite: true })

  // 3) Markdown summary + nav to the draft.
  return `Stood up **${vendorName}** at ${portal.url} — ${result.pages.created.length} pages, `
    + `${result.posts.created.length} posts, ${result.products.created.length} products.`
    + navDirective(portal.url, 'Open draft site')
}
```
> Check `provisionPortal`'s real return shape (`{ tenant: { id }, url, log }` per the live test above) and its exact input keys before finalizing — it's in `src/utilities/provisionPortal.ts`.

### 2d. Tests
Add a unit test for the two `mapProducts`/`mapMarkets` coercion helpers (LLM hands you loose objects — guard the shapes). The provisioning path itself is integration-level; the existing endpoint already proves it end-to-end.

---

## Decisions already made (don't re-litigate)

- **Two tools, not one.** `apply_site_template` = fill an existing endeavor; `replicate_site` = create + fill a new one. Keep them separate — the market "on the spot" flow needs provisioning baked in.
- **`{{vendor.*}}` substitution** is just the `MarketVendorProfile` fields — no template-string engine needed. The profile IS the substitution.
- **Commercial node.** Vendors are commercial → these run on the **kendev.co** node (commercial Diocese), not the pristine mission node.
- **No new schema in this slice.** Template uses existing blocks. `parentEndeavor` grouping (so `makerspacepinellas` rolls up children) is **Slice 3** — out of scope here; don't add the field yet.
- **Heroes are text (lowImpact)** like church/fitness. `heroImage` media wiring is a later polish.

## What this unlocks next (not your job, just so you see the arc)

Slice 3 = one `parentEndeavor` field + a `?market=` Discovery filter so participating vendors interlink. Slice 4/5 = event booth roster. After `replicate_site` lands, the market demo is real: laptop open, vendor name in, draft site out.

---

## Quick verification recipe (how I tested Slice 1 — reuse for Slice 2)

```
# server must be restarted after adding endpoints/tools (Payload registers at boot)
POST /api/provision-ops/portal?key=<CRON_SECRET>
  { "name":"Test Vendor","slug":"test-vendor","domain":"test-vendor.kendev.co","endeavorType":"retail-commerce" }
POST /api/provision-ops/market-vendor-template?key=<CRON_SECRET>&overwrite=true
  { "tenantSlug":"test-vendor" }
```
Once `replicate_site` exists, the same is one LEO turn: *"replicate a site for Test Vendor at test-vendor.kendev.co."*

⚠️ **Gotcha:** the dev server registers endpoints/tools at boot — restart it after editing `leo-data-tools.ts` or `payload.config.ts`, or the new tool 404s/doesn't appear.
