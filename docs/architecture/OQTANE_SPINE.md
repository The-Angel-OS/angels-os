# The Oqtane Spine — Angel OS Internal Architecture Contract

> Built in the lineage of **Shaun Walker's** DotNetNuke and Oqtane. Angel OS adopts
> Oqtane's four cross-cutting spines verbatim in shape — one Permission model, one
> Settings bag, one Service base, one cascading Context — and rejects only its UI
> ceremony (panes/themes/drag-drop), which assumes a server-rendered admin placing
> modules. Angel OS is headless, conversational, and federated: **apps slide around
> in spaces and channels, and a Page is a surface of a Channel** (its message stream).
>
> The rule that killed DNN's first decade and Genesis SIS alike: *five dialects per
> concern.* The fix is one mechanism per concern. This doc is that contract.

## Why shape-fidelity (not just "inspired by")

Mirroring Oqtane's entity shapes is also the **interop protocol**. Because Angel OS
natively speaks Site/Module/Permission/Setting, an Oqtane instance can be *lifted*
into an Angel OS node by structural mapping, not rewrite — and a `.nupkg` published
to the Oqtane Marketplace becomes a near-trivial bridge. So we bias the schema toward
Oqtane fidelity **on purpose**, paying a small ergonomic tax now to make the
Marketplace play a "when," not an "if." (See `OQTANE_INTEROP.md` for the bridge.)

## The four spines

### 1. Context — `SiteState` / `PageState`
Oqtane resolves `SiteState` (Alias→Site, modules) + `PageState` (Page, User, Modules,
Action) **once**, flows them by cascading parameter; no page re-resolves.
- Angel OS: `portalContext.ts` (SiteState, Phase 0 shipped) resolved once per request →
  React context. Add **`ChannelState`** as the channel-substrate analog of PageState.
- Resolve: Alias(domain/header) → Tenant → Enterprise(Diocese) → User → Roles →
  current Space → Channel → AppletInstances. Every surface *reads*; nothing re-resolves.

### 2. Permissions — `IPermissionService` + one `Permission` table
Oqtane shape (verbatim target):
```
Permission { id, siteId, entityName, entityId, permissionName, roleId?, userId?, isAuthorized }
UserSecurity.IsAuthorized(user, permissionName, permissions)
```
- Angel OS: a `permissions` collection of that shape + ONE resolver
  `can(user, permissionName, entityName, entityId)`.
- The hard part Oqtane doesn't have — **composition**. Angel OS folds:
  `platformRole ∪ Enterprise/Diocese trust ∪ tenantMembership.permissions[] ∪ spaceMembership.role ∪ appletInstance permission`.
  Resolve the full grant set into SiteState once; `can()` is then in-memory.
- PermissionNames: `View`, `Edit`, `Manage` + applet-defined (Oqtane convention).
- Retires: scattered `checkRole` / `ADMIN_ROLES` / per-page membership checks.

### 3. Settings — `ISettingService` + one `Setting` table
Oqtane shape (verbatim target):
```
Setting { id, entityName, entityId, settingName, settingValue, isPrivate }
```
A generic bag attachable to ANY entity (Host/Tenant/Site/Page/Module/User → here:
Tenant/Space/Channel/Applet/User/Page).
- Angel OS: a `settings` collection of that shape. Move bespoke config
  (`branding`, `aiConfig`, `enabledApplets`, `channel.data/widgets`) into it.
- **This ends the schema-drift outages** (the Tenants-branding-field rule + the
  presence/locked_documents column drift): config becomes a row, not an `ALTER`.
  Keep relational columns ONLY for what you query/filter on.

### 4. Service / Repository — `ServiceBase` over the repository
Oqtane: `IModule` def → `IService` → `Controller` → `IRepository` over `DBContextBase`;
everything through `ServiceBase`.
- Angel OS: domain services — `SpaceService`, `ChannelService`, `BookingService`,
  `OnboardingService`, `PermissionService`, `SettingService` — over a `ServiceBase`
  enforcing tenant scoping + `overrideAccess` discipline + uniform errors. **Payload is
  the repository.** One entry point per domain; the scattered `ensureX`/`verifyX`
  helpers (already drifting toward this) collapse into it.

## Module / PageModule → Applet / AppletInstance
- Oqtane: `Module`(definition) + `PageModule`(placement: page, pane, container, perms).
- Angel OS: **`Applet`** (registry: id, render, settings schema, permissions) +
  **`AppletInstance`** (placement: spaceId, channelId, settings, permissions).
  "Apps slide around channels." `space.enabledApplets` is the seed of this.

## The inversion — Page = surface of a Channel
Oqtane: Page is primary; modules are cargo placed on it.
Angel OS: the **Channel is the substrate** (messages + data/widgets). Page, Applet,
Comments, LEO-DM are all **Surfaces** = `{ space, channel, applet, settings, permissions }`.
We already do this literally (`page:<path>` channels on the AI Bus). Build the Surface
abstraction LAST — after the four spines make the pattern obvious, not speculative.

## Federation — the layer Oqtane lacks
Enterprise(Diocese) → Tenant → Space → Channel, with a mesh *between* nodes. Oqtane's
single "marketplace" becomes the federated discovery mesh. Do NOT copy Oqtane's
Tenant(DB)/Site split — Angel OS's layering already supersedes it.

## Sequencing (contract-first)
1. ✅ **`Setting` table + `SettingService`** — SHIPPED (2026-06-09). `collections/Settings`
   + `services/SettingService`. 8 tests. Stops the schema-drift bleeding.
2. ✅ **`Permission` table + `can()` resolver** — SHIPPED (2026-06-09).
   `collections/Permissions` + `services/PermissionService` (pure `isAuthorized`, 11
   tests; Diocese rung = marked seam in `resolveGrantContext`). NON-BREAKING: zero rows
   reproduces membership-derived behavior. NEXT consumer-migration: replace scattered
   `checkRole`/membership checks with `can()` page-by-page (unblocks AUTH_CONTEXT_REFACTOR.md).
3. **`ServiceBase` + domain services** — fold the `ensureX`/`verifyX` helpers in.
4. **Applet/AppletInstance**, then the **Surface** abstraction.

INTERLEAVE: **Dreams** (Leo cognitive arch — see proactive-agent roadmap memory) is the
first real consumer of the Setting bag and a good next slice after spine 2.

Spines 1–2 are the published contract; their shapes are Oqtane-verbatim — build on them.
