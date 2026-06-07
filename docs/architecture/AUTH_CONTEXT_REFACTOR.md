# Auth & Tenant Context Refactor — Oqtane-aligned (DNN as fallback)

**Status:** Plan / Phase 0 foundation drafted (`src/utilities/portalContext.ts`).
**Author:** 2026-06-07. **Trigger:** the `clearwater-cruisin.spacesangels.com/dashboard/account/integrations` "runaround" + two cross-tenant findings — all traceable to fragmented, per-page identity resolution.

> Target architecture is **Oqtane** (Shawn Walker's successor to DNN — where the
> ecosystem is heading). **DNN** (`PortalSettings`/`HostSettings`) is the fallback
> reference where Oqtane's mapping is ambiguous.

---

## 1. Why

Every dashboard surface resolves "who is this + which tenant + what may they do"
on its own, with subtly different rules. Concrete failures this already caused:

- **Runaround:** the integrations page server-authed + gated on `super_admin`
  only; the layout treats auth as *optional* and defines admin as
  `checkRole(ADMIN_ROLES)`. A global `admin` got bounced where the layout
  rendered → redirect loop.
- **Cross-tenant read** (fixed): `ai-bus-poll` derived tenant from a caller's
  `spaceId` with no entitlement check.
- **Cross-subdomain secret exposure** (fixed): integrations page gated on "is
  non-customer somewhere," not "entitled to *this* tenant."
- **Divergent definitions:** `bridge/page.tsx` defines
  `isBusinessOwner = roles.includes('producer')`; the layout defines it as
  `isAdmin || roles.some(r => r !== 'customer')`. Two answers to one question.
- **Unguarded data:** business-ops pages (`products`, `orders`, …) do **no**
  server auth — they `find(... overrideAccess: true, where: tenantFilter)` and
  rely solely on client-side nav visibility. Directly visiting
  `/dashboard/orders` on a tenant subdomain renders that tenant's orders.

There are **48 `page.tsx` + 13 `actions.ts`** under `(dashboard)` — the cost of
the divergence scales with every new surface.

---

## 2. Current-state audit — how each surface authenticates

| Pattern | Where | How it resolves identity | Failure mode |
|---|---|---|---|
| **A. Layout (optional)** | `dashboard/layout.tsx` | `payload.auth` (optional, no redirect) + `resolveTenantFromHeaders` + `checkRole(ADMIN_ROLES)`; `isBusinessOwner = isAdmin \|\| non-customer`. Feeds `DashboardProvider`. | Sets the "right" definitions but pages don't reuse them. |
| **B. Admin page** | `admin/team`, `admin/crew`, `admin/network`, `account/integrations` | `payload.auth` → `redirect(/login)` → `checkRole(ADMIN_ROLES)` → sometimes a membership query. | Each re-implements the gate; drift (super_admin vs ADMIN_ROLES) → runaround. |
| **C. Business-ops page** | `products`, `orders`, `pages`, `posts`, `events`, `media`, `appointments`, `availability`, `holon`, `projects`, … | `resolveTenantFromHeaders().tenantFilter` + `find(overrideAccess:true)`. **No server auth.** | Renders for anyone who reaches the route; tenant-scoped but not identity-gated. |
| **D. Bespoke role** | `bridge/page.tsx` | `payload.auth` + `checkRole(ADMIN_ROLES)` + `roles.includes('producer')`. | Its own "owner" definition diverges from the layout's. |
| **E. Server action** | all 13 `actions.ts` | Each calls `payload.auth` + `checkRole` (+ membership) independently. | N copies of the gate; no shared capability model. |

Shared utilities exist but are composed ad hoc: `payload.auth`,
`resolveTenantFromHeaders`, `checkRole`/`ADMIN_ROLES`, `managerTenantIds`,
`getUserTenantMembership`, `fetchDefaultSpaceId`, `buildTenantFilter`. There is
**no single object** that says "for THIS request: the site, the user, what they
can do."

---

## 3. Target model — Oqtane primitives (DNN fallback)

| Oqtane | DNN (fallback) | Role | Angel OS equivalent |
|---|---|---|---|
| **Alias** (URL → Tenant/Site) | Portal Alias | Resolve the site from the request | `resolveTenantFromHeaders()` (x-tenant-id → domain) |
| **Site** | `PortalSettings` | The resolved tenant + its settings/branding | `Tenant` (+ branding, default space) |
| **Host / HostSettings** | `HostSettings` | Platform-global config + super-admin | platform (`super_admin`) + env/node settings |
| **SiteState** (scoped DI: Alias + Site + User) | `PortalSettings` on `HttpContext` | **One resolved context per request**, injected everywhere | **`resolvePortalContext()`** (React.cache) ← the core of this refactor |
| **PageState** (current page + user + permissions) | `TabInfo` + `TabPermission` | Per-route auth state | per-request `entitlements` for the active portal |
| **IUserService / Identity principal** | `UserInfo` | Authentication + roles | `payload.auth().user` + `user.roles` |
| **PermissionService / `[Authorize(Roles=…)]` / page & module permissions** | `PortalSecurity`, `ModulePermissionController` | **Declarative** authorization, checked centrally | **`requirePortalAccess(ctx, capability)`** + a capability map |
| **Host role vs Site roles** (Administrators, Registered Users) | super-user vs portal roles | Two-tier authority | `super_admin/admin/archangel` (Host) vs `tenant_admin/tenant_manager/member` (Site) |

Key Oqtane lessons we adopt:
1. **Resolve once.** Alias→Site→User is established per request in `SiteState`,
   not re-derived per page/module.
2. **Authorize declaratively.** Components don't hand-roll role checks; they
   declare a required permission and the framework enforces it.
3. **Host vs Site separation.** A super-admin (Host) is distinct from a site
   admin; both are first-class, neither is ad-hoc.

---

## 4. Proposed architecture

### 4.1 `resolvePortalContext()` — our `SiteState` (Phase 0, drafted)
`src/utilities/portalContext.ts`, wrapped in `React.cache()` so the **layout and
the page in one request share a single resolution** (identity can't diverge):

```ts
PortalContext = {
  host:   { isFederationNode },                         // HostSettings
  portal: { tenant, tenantId, tenantFilter },           // Site / PortalSettings
  user:   User | null,                                  // Identity principal
  entitlements: {                                       // PageState/PermissionService
    isAuthenticated, isPlatformAdmin, isBusinessOwner,
    memberTenantIds, managedTenantIds, isMemberOfPortal,
    can: { manageConnectors, manageSpaces, adminPortal },
  },
}
```
Entitlement math is a **pure** `computePortalEntitlements()` (unit-testable; no
payload/headers). This is the single definition of "admin" and "owner" — killing
the bridge-vs-layout divergence.

### 4.2 `requirePortalAccess(ctx, capability?)` — our `[Authorize]`
Locale-aware, redirects consistently:
```ts
const ctx = await resolvePortalContext()
await requirePortalAccess(ctx, 'manageConnectors')
```
- no `user` → `/login`; lacks capability → `/dashboard`.
- Public pages call `resolvePortalContext()` without `requirePortalAccess`.

### 4.3 Capabilities (= Oqtane permissions)
Start with `manageConnectors`, `manageSpaces`, `adminPortal`; grow the `can` map
as surfaces migrate. Each capability is computed once from Host/Site role +
current-portal entitlement — never re-derived in a page.

---

## 5. Migration phases

- **Phase 0 — Foundation (DRAFTED).** `portalContext.ts` (`resolvePortalContext`,
  `requirePortalAccess`, `computePortalEntitlements`) + unit tests for the pure
  entitlement math. *Dead code until Phase 1 wires it.*
- **Phase 1 — Proof (NEXT).** Migrate `dashboard/layout.tsx` (consume the context
  for its auth/role block — so layout + page share one resolution) and
  `account/integrations/page.tsx` (replace its inline guard with
  `requirePortalAccess(ctx, 'manageConnectors')`). This fixes the runaround at
  the root and validates the shape on the surface that exposed it.
- **Phase 2 — Pattern sweep.** Migrate by pattern, not file-by-file randomly:
  (a) admin pages (B) → `requirePortalAccess(ctx, 'adminPortal')`;
  (b) business-ops pages (C) → add the missing identity gate
  (`requirePortalAccess(ctx)` + capability) — closes the unguarded-data exposure;
  (c) `bridge` (D) → delete the bespoke `producer` check, use the shared owner
  definition.
- **Phase 3 — Server actions.** Replace the per-action `payload.auth + checkRole`
  with `resolvePortalContext()` + capability assertions.
- **Phase 4 — Lock it in.** Remove direct `payload.auth` / `checkRole` /
  `resolveTenantFromHeaders` calls from pages/actions; add an ESLint
  `no-restricted-imports` rule so new dashboard pages must go through
  `portalContext` (prevents regression — the whole point).

Each phase: build-gate + the existing access tests (`tenantAccessControl`,
`crossTenantIsolation`) must stay green; migrate in small, reviewable commits.

---

## 6. Open decisions

- **Naming.** Foundation currently uses DNN's "portal" (`PortalContext`).
  Oqtane's term is **Site**; our domain term is **Tenant/Endeavor/Enterprise**.
  Recommendation: keep the file/Type as `PortalContext`/`resolvePortalContext`
  for now (DNN is the more familiar mental model to most), but document the
  Oqtane mapping (this table) so the concepts are unambiguous. Rename to
  `SiteContext` later if we standardize on Oqtane vocabulary — cheap, mechanical.
- **`isFederationNode` signal.** Phase 0 infers it from env; replace with a real
  HostSettings record when the Host/Site split is formalized (ties into the
  Enterprise=Diocese federation model).
- **Member-on-private-space edge.** Entitlement uses `user.tenants` (plugin
  array) ∪ `managedTenantIds` (memberships). If a legit member exists only via a
  space-membership not reflected in either, add a space-membership fallback in
  `computePortalEntitlements` inputs (one query, only on the non-admin path).

---

## 6b. Interim point-fixes shipped (pending the full refactor)

These are the same fragmentation bug surfacing one endpoint at a time; each was
fixed by routing tenant resolution through the shared
`resolveTenantFromHeaders` chain (slug → domain → DEFAULT_TENANT_SLUG), which is
what the PortalContext will centralize:

- **`dashboard/endeavor/actions.ts`** (2026-06-07) — hand-rolled
  `x-tenant-id || 'default'` failed on the federation apex →
  "Unable to load Endeavor data". Now uses `resolveTenantFromHeaders`.
- **admin `contacts` / `comments` / `invitations` + `setup` actions & page**
  (2026-06-07) — all hand-rolled `x-tenant-id || 'default'` and failed on the
  federation apex ("Tenant not found" on the Contacts importer, blocking the bulk
  invite flow). All now use `resolveTenantFromHeaders`. (5 surfaces in one pass —
  the tenant-resolution slice of this refactor, applied early to unblock invites.)
- **`endpoints/space-create.ts`** (2026-06-07) — derived a slug from the
  hostname (`federation.kendev.co` → `federation`, no tenant) then fell back to
  `user.tenants[0]`, which is empty for a super_admin → "Could not resolve
  tenant" (and was **not logged**). Now resolves via `fetchTenantBySlug` →
  `fetchTenantByDomain` → user membership, and `logError`s the unresolved case.

**Known symptom, not yet fixed:** Google OAuth occasionally lands on the Payload
admin on the first attempt and works on retry — a cookie-propagation race in
`/api/auth/complete` (it has a "cookie may not have been received" branch). The
PortalContext/session-hardening work should make post-login destination
deterministic; tracked here so it isn't lost.

## 7. What this closes

- The runaround (one auth source, one admin definition).
- Cross-tenant / cross-subdomain exposure (capability gates the *resolved* portal).
- Business-ops unguarded pages (Phase 2b adds the gate).
- Per-surface drift (Phase 4 lint rule).
- The reuse findings from code review (`resolveTenantFromSpace`, duplicated
  membership/role logic) are subsumed by the single context.
