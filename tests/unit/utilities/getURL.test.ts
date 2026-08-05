/**
 * getURL — Unit Tests
 *
 * getServerSideURL, getTenantURL, buildTenantAwareURL, getTenantAwareURLFromHeaders
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  getServerSideURL,
  getTenantURL,
  getTenantAwareURLFromHeaders,
} from '@/utilities/getURL'

const ENV_KEYS = [
  'NEXT_PUBLIC_SERVER_URL',
  'PAYLOAD_PUBLIC_SERVER_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
  'SERVER_URL',
]

describe('getServerSideURL', () => {
  beforeEach(() => {
    ENV_KEYS.forEach(k => delete process.env[k])
  })

  afterEach(() => {
    ENV_KEYS.forEach(k => delete process.env[k])
  })

  it('returns NEXT_PUBLIC_SERVER_URL when set', () => {
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://myapp.com'
    expect(getServerSideURL()).toBe('https://myapp.com')
  })

  it('returns PAYLOAD_PUBLIC_SERVER_URL when NEXT_PUBLIC_SERVER_URL absent', () => {
    process.env.PAYLOAD_PUBLIC_SERVER_URL = 'https://payload.myapp.com'
    expect(getServerSideURL()).toBe('https://payload.myapp.com')
  })

  it('returns https://VERCEL_PROJECT_PRODUCTION_URL when Vercel production set', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'myapp.vercel.app'
    expect(getServerSideURL()).toBe('https://myapp.vercel.app')
  })

  it('returns https://VERCEL_URL for preview deployments', () => {
    process.env.VERCEL_URL = 'myapp-abc123.vercel.app'
    expect(getServerSideURL()).toBe('https://myapp-abc123.vercel.app')
  })

  it('falls back to SERVER_URL when the build-time NEXT_PUBLIC_ var was never baked in', () => {
    process.env.SERVER_URL = 'https://www.spacesangels.com'
    expect(getServerSideURL()).toBe('https://www.spacesangels.com')
  })

  it('NEXT_PUBLIC_SERVER_URL takes priority over SERVER_URL', () => {
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://baked.example'
    process.env.SERVER_URL = 'https://runtime.example'
    expect(getServerSideURL()).toBe('https://baked.example')
  })

  it('falls back to http://localhost:3000 when no env vars set', () => {
    expect(getServerSideURL()).toBe('http://localhost:3000')
  })

  it('NEXT_PUBLIC_SERVER_URL takes priority over VERCEL_URL', () => {
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://custom.com'
    process.env.VERCEL_URL = 'myapp.vercel.app'
    expect(getServerSideURL()).toBe('https://custom.com')
  })
})

describe('getTenantURL', () => {
  it('returns http:// URL in non-production env', () => {
    const url = getTenantURL('tenant.example.com')
    expect(url).toMatch(/^http:\/\//)
    expect(url).toContain('tenant.example.com')
  })

  it('appends path with leading slash', () => {
    const url = getTenantURL('tenant.example.com', '/dashboard')
    expect(url).toContain('/dashboard')
  })

  it('adds leading slash to path when missing', () => {
    const url = getTenantURL('tenant.example.com', 'dashboard')
    expect(url).toContain('/dashboard')
  })

  it('returns base URL without path when path is empty', () => {
    const url = getTenantURL('tenant.example.com', '')
    expect(url.endsWith('tenant.example.com')).toBe(true)
    // No trailing slash or path segment
    expect(url.replace(/^https?:\/\//, '').includes('/')).toBe(false)
  })
})

describe('getTenantAwareURLFromHeaders', () => {
  it('returns a non-empty string', () => {
    // In jsdom (canUseDOM=true), returns window.location.origin
    const url = getTenantAwareURLFromHeaders()
    expect(typeof url).toBe('string')
    expect(url.length).toBeGreaterThan(0)
  })

  it('returns a URL string when called with a request', () => {
    const req = new Request('https://example.com/')
    const url = getTenantAwareURLFromHeaders(req)
    expect(typeof url).toBe('string')
  })
})
