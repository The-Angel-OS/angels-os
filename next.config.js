import { withPayload } from '@payloadcms/next/withPayload'
import createNextIntlPlugin from 'next-intl/plugin'

import redirects from './redirects.js'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 caps request bodies passing through middleware at 10MB by default —
  // which silently TRUNCATED >10MB media uploads to /api/media ("Request body
  // exceeded 10MB" → "Upload timeout") while smaller files worked, so video
  // uploads looked randomly broken. Self-host has no platform body wall (that
  // was Vercel's 4.5MB), so allow real video sizes; R2 presigned direct upload
  // remains the path for anything truly large.
  middlewareClientMaxBodySize: '150mb',
  images: {
    remotePatterns: [
      // ── Production: all *.spacesangels.com subdomains ──────────────────────
      { protocol: 'https', hostname: '**.spacesangels.com' },
      // ── kendev.co: development + federation partner domains ────────────────
      { protocol: 'https', hostname: '**.kendev.co' },
      { protocol: 'https', hostname: 'kendev.co' },
      // ── Vercel preview deployments ─────────────────────────────────────────
      { protocol: 'https', hostname: '**.vercel.app' },
      // ── Local dev: *.angelos.local subdomains + plain localhost ────────────
      { protocol: 'http', hostname: '**.angelos.local' },
      { protocol: 'http', hostname: 'localhost' },
      // ── Vercel Blob Storage (legacy — media migrated to R2) ────────────────
      { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' },
      // ── Cloudflare R2 (current media store — pub-*.r2.dev + custom domains) ─
      { protocol: 'https', hostname: '**.r2.dev' },
    ],
    // Add quality 90 to allowed qualities (Next.js 16 requirement)
    // Default is [75], but our Image component uses quality={90}
    // See: src/components/Media/Image/index.tsx line 76
    qualities: [75, 90],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    dangerouslyAllowSVG: true,
    // Next.js 16 blocks private IPs (localhost) in production image optimization.
    // On Vercel: images come from Blob Storage (public URL) — optimization works fine.
    // Locally via `pnpm start`: images come from localhost — must skip optimization.
    unoptimized: !process.env.VERCEL,
  },
  reactStrictMode: true,
  redirects,
  // Include docs/vision/** in serverless function bundles so
  // SoulViewer's fs.readFileSync calls work at runtime on Vercel.
  // Keyed '**' (all routes): these keys are matched as globs, so a literal
  // app-router key like '/[locale]/(app)/learn/[soul]' never matches its own
  // route ([..] is a char class, (..) an extglob). docs/vision is ~300KB —
  // shipping it everywhere is cheaper than a fragile per-route key.
  outputFileTracingIncludes: {
    '**': ['./docs/vision/**/*'],
  },
  // The /api/docs endpoint (src/endpoints/docs.ts) readdir's `docs/` from the
  // payload config graph, so nft globs the whole checkout into EVERY getPayload
  // route — that's what blew the 250MB Vercel function cap (427MB). The docs
  // endpoint only serves .md/.txt, so strip media from docs plus the dirs
  // nothing reads at runtime. The includes above are applied after excludes.
  outputFileTracingExcludes: {
    '*': [
      './docs/**/*.{pptx,png,jpg,jpeg,gif,webp,svg,mp4,mov,pdf,zip}',
      './docs/marketing/**',
      './docs/images/**',
      './tests/**',
      './scripts/**',
      './playwright-report/**',
      './test-results/**',
      './*.tsbuildinfo',
      './nul',
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

export default withNextIntl(withPayload(nextConfig))
