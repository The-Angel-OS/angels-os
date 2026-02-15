# Angel OS — UI Refinement & Image Fix Session

**Date**: February 15, 2026
**Context**: Seed completes successfully, Vercel deploys READY, but frontend has display issues.

---

## Priority 1: Fix Images Not Displaying on Frontend

### Symptoms
- Images load in `/admin` (Payload CMS dashboard) but show as broken on `/posts`, home page hero, etc.
- Post cards show alt text "Straight metallic shapes with a blue gradient" instead of images
- Console: `image:1 Failed to load resource: the server responded with a status of 400 ()`
- Console: `/undefined/api/users/me` (404) — `NEXT_PUBLIC_SERVER_URL` is undefined client-side

### Root Causes

**1. Tenant resolution fails on `angels-os.vercel.app`**
- Default tenant domain is `localhost` (seeded at `src/endpoints/seed/index.ts` line ~159)
- `fetchTenantByDomain('angels-os.vercel.app')` returns `null`
- This cascades: Header returns no nav items, Footer returns nothing, tenant-scoped queries fail

**2. `NEXT_PUBLIC_SERVER_URL` may be missing/empty in Vercel env vars**
- Console shows `/undefined/api/users/me` — meaning the client bundle has `undefined` for this var
- `NEXT_PUBLIC_*` vars are embedded at build time; if not set in Vercel, the client gets nothing
- Check Vercel Dashboard → angels-os → Settings → Environment Variables

**3. Image URL construction breaks with undefined server URL**
- `src/components/Media/Image/index.tsx` line 54: `src = url?.startsWith('http') ? url : \`${process.env.NEXT_PUBLIC_SERVER_URL}${url}\``
- When `NEXT_PUBLIC_SERVER_URL` is undefined, non-blob URLs become `undefined/media/image.jpg`

### Files to Fix

#### `src/utilities/fetchTenantByDomain.ts`
Add fallback to the "default" tenant when no domain match found:
```typescript
export async function fetchTenantByDomain(host: string): Promise<Tenant | null> {
  const domain = host?.split(':')[0]?.toLowerCase() || 'localhost'
  const payload = await getPayload({ config: configPromise })

  const tenants = await payload.find({
    collection: 'tenants',
    where: { domain: { equals: domain } },
    limit: 1, depth: 1,
  })
  if (tenants.docs?.[0]) return tenants.docs[0]

  // Fallback: return "default" tenant so site always works
  const defaults = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: 'default' } },
    limit: 1, depth: 1,
  })
  return defaults.docs?.[0] ?? null
}
```

#### `src/components/Media/Image/index.tsx` (line 54)
Harden URL construction:
```typescript
if (url?.startsWith('http')) {
  src = url
} else if (url) {
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
  src = serverUrl ? `${serverUrl}${url}` : url
}
```

#### Vercel Environment Variable
Set `NEXT_PUBLIC_SERVER_URL=https://angels-os.vercel.app` in Vercel project settings (Settings → Environment Variables → Production). Then redeploy.

---

## Priority 2: Fix Navigation Links Not Showing

### Symptom
No navigation links visible at top of page when signed in. Only the logo and cart icon appear.

### Root Cause
`src/components/Header/index.tsx` requires a `tenantId` to fetch header nav items. When tenant is `null` (domain resolution fails), `header` is `null`, so `navItems` is empty.

### Fix
Once Priority 1's `fetchTenantByDomain` fallback is in place, this resolves automatically. The default tenant HAS nav items seeded: Home, Shop, Posts, Account (see `src/endpoints/seed/index.ts` lines 567-572).

### Enhancement
Add Login/Logout to header. Currently shows Dashboard link when authenticated but no auth controls:

In `src/components/Header/index.client.tsx`, add to the right side:
```tsx
{user ? (
  <>
    <span className="text-sm text-muted-foreground hidden md:inline">{user.email}</span>
    <Link href="/logout" className="text-sm hover:text-foreground transition">Logout</Link>
  </>
) : (
  <Link href="/login" className="text-sm hover:text-foreground transition">Login</Link>
)}
```

---

## Priority 3: Add Chat Interface Icon on Brochure Site

### Current State
`FloatingBubble` (`src/components/ChatControl/FloatingBubble.tsx`) only renders when `status === 'loggedIn'` — correct to prevent 403 polling errors.

### Enhancement
Show a teaser chat icon for unauthenticated users linking to login:
```tsx
export function FloatingBubble() {
  const { status } = useAuth()
  if (status === 'loggedIn') {
    return <ChatControl mode="minimalist" spaceId="1" channelSlug="general" position="bottom-right" />
  }
  // Teaser for unauthenticated users
  return (
    <Link href="/login" className="fixed bottom-6 right-6 bg-primary text-primary-foreground rounded-full p-3 shadow-lg hover:scale-110 transition-transform z-50" title="Chat with LEO">
      <MessageCircle className="w-6 h-6" />
    </Link>
  )
}
```

---

## Priority 4: UI Color Palette Refinement

### Design Direction
Reference: The second screenshot (localhost:3000/dashboard/chat) shows the target aesthetic:
- Dark sidebar with clean section headers (COLLABORATION, COMMUNICATION, SYSTEM)
- Chat interface with distinct message bubbles
- Channel list with type badges (chat, project, files, notes)
- Professional, polished feel with muted neutral colors

### Target Color Palette
Move from the current bright-on-black to **muted neutral dark**:

| Element | Current | Target |
|---------|---------|--------|
| Background | Pure black/very dark | Deep charcoal `#1a1d23` |
| Cards/Surfaces | Dark | Slightly lighter `#22262e` with subtle borders |
| Primary accent | Bright green | Muted teal/sage `#6b9080` |
| Text primary | White | Off-white `#e8e8e8` |
| Text secondary | Gray | Muted gray `#9ca3af` |
| Interactive hover | Bold color shift | Subtle lightening |
| Danger/Warning | Bright red | Muted coral `#e07a6e` |
| Borders | None or harsh | Subtle `rgba(255,255,255,0.08)` |

### Files to Update
- `src/app/[locale]/(app)/globals.css` — CSS custom properties
- `tailwind.config.mjs` — Tailwind theme colors
- `src/components/Header/index.client.tsx` — Header styling
- `src/components/Footer/index.tsx` — Footer styling
- `src/components/CollectionArchive/PostCard.tsx` — Post card design
- Dashboard components in `src/app/[locale]/(app)/dashboard/`

### Post Cards (`/posts` page)
- Need proper image display with aspect-ratio containers
- Hover effects (subtle scale + shadow)
- Better typography hierarchy (title, date, excerpt)
- Consistent card sizing with grid layout

### Hero Section
- Should display hero image with text overlay
- Gradient overlay for text readability
- CTA buttons with muted accent colors

---

## Priority 5: Console Error Fixes

### `/undefined/api/users/me` (404)
**Cause**: `NEXT_PUBLIC_SERVER_URL` undefined in client bundle
**Fix**: Set env var in Vercel, redeploy

### `postMessage` origin mismatch
**Cause**: `http://localhost:3000` vs `https://angels-os.vercel.app`
**File**: Check `src/components/LivePreviewListener/index.tsx` — may have hardcoded localhost
**Fix**: Ensure it reads server URL from env

### Lazy-loaded images replaced with placeholders
**Cause**: Browser intervention for images that never became visible
**Fix**: Set `priority` prop on above-the-fold images (hero, first row of post cards)

---

## Technical Reference

### Key Files
| File | Purpose |
|------|---------|
| `src/app/[locale]/(app)/layout.tsx` | Root layout — tenant resolution, Header/Footer |
| `src/components/Header/index.tsx` | Server component — fetches header by tenantId |
| `src/components/Header/index.client.tsx` | Client component — renders nav items |
| `src/components/Media/Image/index.tsx` | Image component — URL construction (line 54) |
| `src/utilities/fetchTenantByDomain.ts` | Tenant resolution by domain |
| `src/utilities/getURL.ts` | URL helpers (getServerSideURL, etc.) |
| `src/endpoints/seed/index.ts` | 9-phase seed script |
| `src/fields/simpleSlugField.ts` | Slug field override (unique: false) |
| `src/payload.config.ts` | Payload config with Vercel Blob Storage |
| `next.config.js` | Next.js config with image remotePatterns |
| `scripts/drop-unique-slugs.cjs` | Direct SQL to fix slug uniqueness |
| `src/components/ChatControl/FloatingBubble.tsx` | Floating chat bubble |

### Environment Variables (Vercel)
```
NEXT_PUBLIC_SERVER_URL=https://angels-os.vercel.app   ← MUST BE SET
DATABASE_URI=postgresql://postgres:K3nD3v!host@74.208.87.243:5432/angels
PAYLOAD_SECRET=(existing value)
BLOB_READ_WRITE_TOKEN=(existing value)
```

### Slug Uniqueness Note
Slug indexes are now non-unique (dropped via `scripts/drop-unique-slugs.cjs`). If `payload migrate:fresh` is ever run, indexes get recreated as UNIQUE. Run the script again: `node scripts/drop-unique-slugs.cjs`

### Seed Data Summary
- 4 tenants: Angel OS (default), Angel OS Platform, Serenity Massage & Wellness, Hays Cactus Farm
- Header + Footer nav items for default and use-case tenants
- 15 channels across 2 use-case tenant spaces
- 13 posts, 4 media items, products, categories, orders

### Chrome MCP Testing
Available tabs in Chrome browser (Claude MCP tab group):
- Vercel Deployments dashboard
- Payload Admin at angels-os.vercel.app/admin

After fixes, verify:
1. Navigation links appear in header (Home, Shop, Posts, Account + Dashboard when logged in)
2. Images display on `/posts` page and home page hero
3. Chat bubble appears (teaser for guests, full chat for authenticated)
4. No console errors related to `undefined` URLs
5. Muted color palette applied consistently
