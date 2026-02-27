/**
 * Federation API E2E Tests
 *
 * Tests the Angel OS federation endpoints:
 * - POST /api/federation/ping — peer registration
 * - POST /api/federation/heartbeat — peer heartbeat (requires federation auth)
 * - GET  /api/federation/catalog — public catalog browsing
 * - GET  /api/federation/skills — public skills directory
 * - GET  /.well-known/angel-os.json — federation discovery document
 * - GET  /.well-known/mcp/server.json — MCP server manifest
 *
 * Prerequisites:
 * 1. Dev server running: `pnpm dev`
 * 2. Dev seed data: `pnpm seed:dev`
 * 3. Auth setup runs automatically via Playwright project dependencies
 *
 * Uses authenticated session from auth.setup.ts (storageState pattern).
 */
import { test, expect } from '@playwright/test'

const baseURL = 'http://localhost:3000'

test.describe('Federation API', () => {
  // ─────────────────────────────────────────────────────────────
  // Core endpoints
  // ─────────────────────────────────────────────────────────────

  test.describe('Core endpoints', () => {
    test('POST /api/federation/ping requires Ed25519 signature', async ({ page }) => {
      const res = await page.request.post(`${baseURL}/api/federation/ping`, {
        data: {
          enterpriseName: 'e2e-test-enterprise',
          federationId: 'e2e-test-ping',
          timestamp: new Date().toISOString(),
        },
      })

      // Since Sprint 23 security hardening, ping requires Ed25519 signatures.
      // Without a valid signature, we expect 401 with a helpful hint.
      expect(res.status()).toBe(401)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('Ed25519 signature required')
      expect(data.hint).toBeDefined()
    })

    test('POST /api/federation/heartbeat requires federation auth headers', async ({ page }) => {
      // The heartbeat endpoint requires Ed25519-signed federation headers.
      // Without them, it correctly returns 401.
      const res = await page.request.post(`${baseURL}/api/federation/heartbeat`, {
        data: {
          federationId: 'e2e-test-hb',
          status: 'online',
          timestamp: new Date().toISOString(),
        },
      })

      expect(res.status()).toBe(401)
      const data = await res.json()
      expect(data.acknowledged).toBe(false)
      expect(data.error).toContain('Missing federation auth headers')
    })

    test('GET /api/federation/catalog returns catalog data', async ({ page }) => {
      const res = await page.request.get(`${baseURL}/api/federation/catalog`)

      expect(res.status()).toBe(200)
      const data = await res.json()
      expect(data.entries).toBeDefined()
      expect(Array.isArray(data.entries)).toBeTruthy()
      expect(typeof data.total).toBe('number')
      expect(data.federationId).toBeDefined()
      expect(data.enterprise).toBeDefined()
      expect(data.query).toBeDefined()
      console.log(`[federation/catalog] ${data.total} entries from ${data.enterprise}`)
    })

    test('GET /api/federation/skills returns skills directory', async ({ page }) => {
      const res = await page.request.get(`${baseURL}/api/federation/skills`)

      expect(res.status()).toBe(200)
      const data = await res.json()
      expect(data.skills).toBeDefined()
      expect(Array.isArray(data.skills)).toBeTruthy()
      expect(typeof data.count).toBe('number')
      expect(data.enterprise).toBeDefined()
      console.log(`[federation/skills] ${data.count} skills available`)

      // Each skill should have the expected public shape
      if (data.skills.length > 0) {
        const skill = data.skills[0]
        expect(skill.name).toBeDefined()
        expect(skill.version).toBeDefined()
        expect(skill.description).toBeDefined()
        expect(skill.safety).toBeDefined()
      }
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Well-known discovery
  // ─────────────────────────────────────────────────────────────

  test.describe('Well-known discovery', () => {
    test('GET /.well-known/angel-os.json returns federation discovery document', async ({
      page,
    }) => {
      const res = await page.request.get(`${baseURL}/.well-known/angel-os.json`)

      expect(res.status()).toBe(200)
      const data = await res.json()
      expect(data.federation).toBeDefined()
      expect(data.federation.version).toBeDefined()
      expect(data.federation.protocol).toBe('angel-os-federation')
    })

    test('GET /.well-known/mcp/server.json returns MCP manifest', async ({ page }) => {
      const res = await page.request.get(`${baseURL}/.well-known/mcp/server.json`)

      expect(res.status()).toBe(200)
      const data = await res.json()
      expect(data.mcp_version).toBeDefined()
      expect(data.server).toBeDefined()
      expect(data.server.name).toBe('angel-os')
      expect(data.capabilities).toBeDefined()
      expect(data.endpoints).toBeDefined()
    })

    test('discovery document has required federation fields', async ({ page }) => {
      const res = await page.request.get(`${baseURL}/.well-known/angel-os.json`)
      expect(res.status()).toBe(200)

      const data = await res.json()
      const fed = data.federation

      // Required identity fields
      expect(fed.version).toBeDefined()
      expect(fed.protocol).toBeDefined()
      expect(fed.constitutionVersion).toBeDefined()
      expect(fed.name).toBeDefined()
      expect(fed.domain).toBeDefined()

      // Required endpoint fields
      expect(fed.catalogEndpoint).toBeDefined()
      expect(fed.skillsEndpoint).toBeDefined()
      expect(fed.heartbeatEndpoint).toBeDefined()
      expect(fed.pingEndpoint).toBeDefined()

      // Required type fields
      expect(fed.capabilities).toBeDefined()
      expect(Array.isArray(fed.capabilities)).toBeTruthy()
      expect(fed.holonTypes).toBeDefined()
      expect(Array.isArray(fed.holonTypes)).toBeTruthy()
      expect(fed.ministryStatus).toBeDefined()
    })

    test('MCP manifest has required server fields', async ({ page }) => {
      const res = await page.request.get(`${baseURL}/.well-known/mcp/server.json`)
      expect(res.status()).toBe(200)

      const data = await res.json()

      // Required top-level fields
      expect(data.mcp_version).toBeDefined()
      expect(data.server).toBeDefined()
      expect(data.capabilities).toBeDefined()
      expect(data.endpoints).toBeDefined()
      expect(data.authentication).toBeDefined()
      expect(data.collections).toBeDefined()
      expect(data.tools).toBeDefined()
      expect(data.constitutional).toBeDefined()

      // Server identity
      expect(data.server.name).toBe('angel-os')
      expect(data.server.version).toBeDefined()
      expect(data.server.description).toBeDefined()

      // Collections should be an array
      expect(Array.isArray(data.collections)).toBeTruthy()
      expect(data.collections.length).toBeGreaterThan(0)

      // Tools should be an array
      expect(Array.isArray(data.tools)).toBeTruthy()
      expect(data.tools.length).toBeGreaterThan(0)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Error handling
  // ─────────────────────────────────────────────────────────────

  test.describe('Error handling', () => {
    test('POST /api/federation/ping with empty body returns 400', async ({ page }) => {
      const res = await page.request.post(`${baseURL}/api/federation/ping`, {
        data: {},
      })

      expect(res.status()).toBe(400)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })

    test('POST /api/federation/ping with missing enterpriseName returns 400', async ({ page }) => {
      const res = await page.request.post(`${baseURL}/api/federation/ping`, {
        data: {
          federationId: 'e2e-test-invalid',
          timestamp: new Date().toISOString(),
        },
      })

      expect(res.status()).toBe(400)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('enterpriseName')
    })

    test('POST /api/federation/heartbeat with invalid JSON returns 400', async ({ page }) => {
      const res = await page.request.post(`${baseURL}/api/federation/heartbeat`, {
        headers: { 'Content-Type': 'application/json' },
        data: 'not-valid-json',
      })

      // Without proper federation auth headers, the endpoint returns 400 or 401
      expect([400, 401]).toContain(res.status())
      const data = await res.json()
      expect(data.acknowledged).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Content-type validation
  // ─────────────────────────────────────────────────────────────

  test.describe('Content-type headers', () => {
    test('federation endpoints return application/json content-type', async ({ page }) => {
      const endpoints = [
        { method: 'GET', url: `${baseURL}/api/federation/catalog` },
        { method: 'GET', url: `${baseURL}/api/federation/skills` },
        { method: 'GET', url: `${baseURL}/.well-known/angel-os.json` },
        { method: 'GET', url: `${baseURL}/.well-known/mcp/server.json` },
      ]

      for (const endpoint of endpoints) {
        const res = await page.request.get(endpoint.url)
        const contentType = res.headers()['content-type'] || ''
        expect(contentType).toContain('application/json')
      }
    })

    test('POST /api/federation/ping returns application/json', async ({ page }) => {
      const res = await page.request.post(`${baseURL}/api/federation/ping`, {
        data: {
          enterpriseName: 'e2e-content-type-test',
          federationId: 'e2e-ct-test',
          timestamp: new Date().toISOString(),
        },
      })

      const contentType = res.headers()['content-type'] || ''
      expect(contentType).toContain('application/json')
    })
  })
})
