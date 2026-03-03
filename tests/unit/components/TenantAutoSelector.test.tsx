/**
 * TenantAutoSelector — Unit Tests
 *
 * Tests the subdomain-slug extraction logic and the cookie auto-set
 * behaviour via stubbed window.location, fetch, document.cookie,
 * sessionStorage, and window.location.reload.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'

import { TenantAutoSelector } from '@/components/TenantAutoSelector'

// ── helpers ──────────────────────────────────────────────────────────────────

function setHostname(hostname: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, hostname, reload: vi.fn() },
    writable: true,
    configurable: true,
  })
}

function mockFetch(tenantId: string | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ docs: tenantId ? [{ id: tenantId }] : [] }),
    }),
  )
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

// ── setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  sessionStorage.clear()
  // Clear cookie
  document.cookie = 'payload-tenant=; max-age=-1; path=/'
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── subdomain detection ───────────────────────────────────────────────────────

describe('TenantAutoSelector — subdomain detection', () => {
  it('does NOT call fetch on main domain (spacesangels.com)', async () => {
    setHostname('spacesangels.com')
    vi.stubGlobal('fetch', vi.fn())
    await act(async () => { render(React.createElement(TenantAutoSelector)) })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does NOT call fetch on www.spacesangels.com', async () => {
    setHostname('www.spacesangels.com')
    vi.stubGlobal('fetch', vi.fn())
    await act(async () => { render(React.createElement(TenantAutoSelector)) })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does NOT call fetch on kendev.co', async () => {
    setHostname('kendev.co')
    vi.stubGlobal('fetch', vi.fn())
    await act(async () => { render(React.createElement(TenantAutoSelector)) })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does NOT call fetch on localhost', async () => {
    setHostname('localhost')
    vi.stubGlobal('fetch', vi.fn())
    await act(async () => { render(React.createElement(TenantAutoSelector)) })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('calls fetch on cactus-farm.kendev.co (subdomain)', async () => {
    setHostname('cactus-farm.kendev.co')
    mockFetch('10')
    await act(async () => { render(React.createElement(TenantAutoSelector)) })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('cactus-farm'),
    )
  })

  it('calls fetch on cactus-farm.localhost', async () => {
    setHostname('cactus-farm.localhost')
    mockFetch('10')
    await act(async () => { render(React.createElement(TenantAutoSelector)) })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('cactus-farm'),
    )
  })

  it('calls fetch on custom-shop.spacesangels.com (subdomain)', async () => {
    setHostname('custom-shop.spacesangels.com')
    mockFetch('5')
    await act(async () => { render(React.createElement(TenantAutoSelector)) })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('custom-shop'),
    )
  })
})

// ── cookie auto-set ───────────────────────────────────────────────────────────

describe('TenantAutoSelector — cookie auto-set', () => {
  it('sets payload-tenant cookie when missing and tenant found', async () => {
    setHostname('my-shop.kendev.co')
    mockFetch('42')
    await act(async () => { render(React.createElement(TenantAutoSelector)) })
    expect(getCookie('payload-tenant')).toBe('42')
  })

  it('reloads page after setting cookie', async () => {
    setHostname('my-shop.kendev.co')
    mockFetch('42')
    await act(async () => { render(React.createElement(TenantAutoSelector)) })
    expect(window.location.reload).toHaveBeenCalledTimes(1)
  })

  it('does NOT reload when cookie already matches tenant id', async () => {
    setHostname('my-shop.kendev.co')
    mockFetch('42')
    document.cookie = 'payload-tenant=42; path=/'
    await act(async () => { render(React.createElement(TenantAutoSelector)) })
    expect(window.location.reload).not.toHaveBeenCalled()
  })

  it('does NOT set cookie when tenant is not found in API', async () => {
    setHostname('unknown.kendev.co')
    mockFetch(null) // empty docs
    await act(async () => { render(React.createElement(TenantAutoSelector)) })
    expect(getCookie('payload-tenant')).toBeNull()
    expect(window.location.reload).not.toHaveBeenCalled()
  })

  it('does NOT reload when fetch returns non-ok', async () => {
    setHostname('my-shop.kendev.co')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }),
    )
    await act(async () => { render(React.createElement(TenantAutoSelector)) })
    expect(window.location.reload).not.toHaveBeenCalled()
  })

  it('does NOT crash when fetch throws', async () => {
    setHostname('my-shop.kendev.co')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    await act(async () => { render(React.createElement(TenantAutoSelector)) })
    expect(window.location.reload).not.toHaveBeenCalled()
  })
})

// ── sessionStorage loop prevention ────────────────────────────────────────────

describe('TenantAutoSelector — reload loop prevention', () => {
  it('does NOT call fetch when sessionStorage flag is set for slug', async () => {
    setHostname('my-shop.kendev.co')
    sessionStorage.setItem('tenant_auto_set_my-shop', '1')
    vi.stubGlobal('fetch', vi.fn())
    await act(async () => { render(React.createElement(TenantAutoSelector)) })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sets sessionStorage flag after setting cookie (before reload)', async () => {
    setHostname('my-shop.kendev.co')
    mockFetch('42')
    await act(async () => { render(React.createElement(TenantAutoSelector)) })
    expect(sessionStorage.getItem('tenant_auto_set_my-shop')).toBe('1')
  })

  it('sets sessionStorage flag even when cookie already matches', async () => {
    setHostname('my-shop.kendev.co')
    mockFetch('42')
    document.cookie = 'payload-tenant=42; path=/'
    await act(async () => { render(React.createElement(TenantAutoSelector)) })
    expect(sessionStorage.getItem('tenant_auto_set_my-shop')).toBe('1')
  })
})

// ── render ────────────────────────────────────────────────────────────────────

describe('TenantAutoSelector — render', () => {
  it('renders nothing (returns null)', async () => {
    setHostname('localhost')
    vi.stubGlobal('fetch', vi.fn())
    const { container } = await act(async () =>
      render(React.createElement(TenantAutoSelector)),
    )
    expect(container.firstChild).toBeNull()
  })
})
