# Membership Gating — page access + nav + meeting/classroom (design)

> Created 2026-06-21. Gate pages (and their nav entry) to "members in good standing," and
> gate meeting/virtual-classroom surfaces (therapists, classes) to members. Reuse the
> membership system + PermissionService + LiveKit gate we already have — don't build a
> parallel gate.

## How others do it (research)
- **Memberstack** — gate pages / folders / page elements; pick *who* can access and *where
  to send them if they can't* (redirect to join/upgrade, NOT a 404). This redirect-on-deny
  UX is the universal pattern.
- **HubSpot CMS** — "access groups" tied to CRM contacts; choose which groups can view content.
- **Wix** — distinguishes *members* vs *paying subscribers* per dynamic page.
- **Outseta** — all-in-one auth+billing+gating; status-driven.
- **Circle** — the virtual-classroom model: members join discussions, **live streams, courses,
  and events** in one gated community (this is our "meeting/classroom page" target).

Common shape = **(1) a per-page access level + (2) a "member in good standing" predicate +
(3) redirect-to-join on deny + (4) nav hides what you can't enter.**

## What we already have (substrate — most of it)
- **Memberships** collection with `status`: active | trialing | past_due | canceled | incomplete,
  kept authoritative by the **Stripe webhook** (`stripe-webhooks.ts` upsert).
- **PermissionService** (`can()`, `resolveGrantContext`, `buildSpaceVisibilityFilter`) +
  **Permissions** collection (additive per-user/role grants) — a page gate can plug in.
- **Spaces** `visibility` (public/invite_only/private) + **space-memberships** = the existing
  per-resource gate model to mirror.
- **LiveKit** token endpoint (`livekit-token.ts`) **already checks space-membership** before
  issuing a room token → the meeting gate is half-built.
- **Pages** `showInNav` + nav builder (`pagesNav.ts` / `Header`), `[slug]/page.tsx` render.
- ⚠️ "good standing" is **hardcoded + scattered** today (`['active','trialing','past_due']` in
  Membership block, membership-self, webhook) — past_due currently counts as good standing.

## What's missing
- A **single `isMemberInGoodStanding(user, tenant)` helper** (one definition; make `past_due`
  inclusion configurable). Everything else calls this.
- Pages **access fields**: `access` = `public | authenticated | members | good_standing`
  (+ optional `requiredPlans[]`), and a `navGate` so `showInNav` can require membership too.
- **Enforcement** at: read-access resolver (collection), render gate (`[slug]/page.tsx` →
  redirect to the Join page, not 404), and **nav filter** (`pagesNav` hides gated pages from
  non-members).
- A **Meeting / Classroom block** wrapping `LiveKitRoom`, bound to a space, gated to members —
  reuses the existing LiveKit token gate.

## Recommended design
1. **`isMemberInGoodStanding(payload, userId, tenantId, { allowPastDue })`** — the one predicate.
2. **Pages fields**: `access` (select, default `public`), `requiredPlans` (optional), and let
   `showInNav` respect the gate (gated pages only appear in nav for eligible members).
3. **Enforce in 3 places, all calling the predicate:**
   - read resolver `membershipGatedWithTenantScope` (wraps `adminOrPublishedWithTenantScope`),
   - `[slug]/page.tsx`: if gated + not eligible → **redirect to the tenant's Join/membership
     page** with a `?next=` return (Memberstack pattern), admins always pass,
   - `pagesNav`: filter gated pages for non-eligible users.
4. **Meeting/Classroom**: new gated page block (`meetingRoom`) rendering `LiveKitRoom`, with a
   `space` relationship; page `access: good_standing`. Therapist/classroom = a page + this block.
5. **Later (Phase 3)**: PermissionService per-user overrides (comp a therapist, ban a member)
   via the Permissions collection — `can('View', 'page', id)` with membership → grant mapping.

## Phasing
- **P1** (small, high value): predicate helper + Pages `access` field + render redirect + nav filter.
- **P2**: meeting/classroom gated block over LiveKit (binds page→space; reuses token gate).
- **P3**: plan-specific tiers + PermissionService per-user overrides.

## Sources
- Memberstack Gated Content · HubSpot access groups · Wix members-vs-subscribers · Outseta ·
  Circle (courses/events/livestreams). See conversation 2026-06-21.
