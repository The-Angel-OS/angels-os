# Domain-in-Path Setup (Phase 3)

To enable domain-based routing with `[tenant]` in the path (for SSG/SEO), add rewrites to `next.config.js` and restructure routes.

**Note:** Per project rules, `next.config.js` is not modified automatically. Implement manually when ready.

## Route restructuring required

Current: `[locale]/(app)/page.tsx`, `[locale]/(app)/[slug]/`, `[locale]/(app)/shop/`, etc.

Target: `[locale]/(app)/[tenant]/page.tsx`, `[locale]/(app)/[tenant]/[slug]/`, `[locale]/(app)/[tenant]/shop/`, etc.

All app routes must move under `[tenant]` so the tenant segment comes from the path (via rewrite).

## Rewrites (next.config.js)

Add inside `nextConfig`:

```js
async rewrites() {
  return {
    beforeFiles: [
      {
        source: '/:path((?!admin|api|_next/static|_next/image|favicon.ico).*)*',
        destination: '/:path*',
        has: [{ type: 'host', value: '(?.*)' }],
      },
    ],
  }
},
```

Reference: [zubricks/multi-tenant-example](https://github.com/zubricks/multi-tenant-example) next.config.js

## Images for local dev

Add to `images.remotePatterns`:

```js
{ protocol: 'http', hostname: '*.local' },
{ protocol: 'http', hostname: 'localhost' },
```
