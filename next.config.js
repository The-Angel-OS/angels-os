import { withPayload } from '@payloadcms/next/withPayload'
import createNextIntlPlugin from 'next-intl/plugin'

import redirects from './redirects.js'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
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
      // ── Vercel Blob Storage ────────────────────────────────────────────────
      { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' },
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
  // SoulViewer's fs.readFileSync calls work at runtime on Vercel
  outputFileTracingIncludes: {
    '/[locale]/(app)/learn/[soul]': ['./docs/vision/**/*'],
    // Bundle the file-based Library into the Payload API fn so the works-ops
    // import can read book images + per-language text at runtime (transitional —
    // removed when docs/vision + public/library are retired post-migration).
    '/api/[...slug]': ['./public/library/**/*', './docs/vision/**/*'],
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
