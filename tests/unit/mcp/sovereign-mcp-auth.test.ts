import crypto from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  AIRLOCK_GATED_TOOLS,
  authenticateSovereignBearer,
  createAirlockApproval,
  createOAuthAuthorizationCode,
  exchangeOAuthCodeForToken,
  getTenantMcpOverview,
  isToolAllowedByScopes,
  mintPortalApiKey,
  parsePortalApiKey,
  resolveAirlockApproval,
  revokePortalApiKey,
  verifyPkceS256,
} from '@/lib/mcp/sovereignAuth'
import { isAllowedRedirectUri } from '@/endpoints/mcp-oauth'

/** Minimal in-memory mock of Payload + SettingService `settings` collection */
function createMockPayload(opts: {
  ownerRoles?: string[]
  membershipRole?: string | null
} = {}) {
  const settingsRows = new Map<string, { id: number; settingValue: string }>()
  let nextId = 1

  const keyFor = (where: any) => {
    const and = where?.and || []
    const get = (field: string) =>
      and.find((c: any) => c[field]?.equals !== undefined)?.[field]?.equals
    return `${get('tenant')}:${get('entityName')}:${get('entityId')}:${get('settingName')}`
  }

  return {
    find: vi.fn(async ({ collection, where }: any) => {
      if (collection === 'settings') {
        const k = keyFor(where)
        const row = settingsRows.get(k)
        return { docs: row ? [{ id: row.id, settingValue: row.settingValue }] : [] }
      }
      if (collection === 'tenant-memberships') {
        if (opts.membershipRole === null) return { docs: [] }
        return {
          docs: [{ id: 10, role: opts.membershipRole || 'tenant_admin', status: 'active' }],
        }
      }
      return { docs: [] }
    }),
    findByID: vi.fn(async ({ collection, id }: any) => {
      if (collection === 'users') {
        return { id, email: 'owner@example.com', roles: opts.ownerRoles || ['user'] }
      }
      return null
    }),
    create: vi.fn(async ({ collection, data }: any) => {
      if (collection === 'settings') {
        const k = `${data.tenant}:${data.entityName}:${data.entityId}:${data.settingName}`
        const id = nextId++
        settingsRows.set(k, { id, settingValue: data.settingValue })
        return { id, ...data }
      }
      return { id: nextId++, ...data }
    }),
    update: vi.fn(async ({ collection, id, data }: any) => {
      if (collection === 'settings') {
        const k = `${data.tenant}:${data.entityName}:${data.entityId}:${data.settingName}`
        settingsRows.set(k, { id, settingValue: data.settingValue })
        return { id, ...data }
      }
      return { id, ...data }
    }),
    delete: vi.fn(async () => ({})),
  } as any
}

describe('Sprint E (Worf) — Sovereign Remote MCP Auth, OAuth 2.1 PKCE & Airlock', () => {
  it('parses valid aos_live_<tenantId>_<hex> keys and rejects malformed strings', () => {
    const valid = `aos_live_45_${'a'.repeat(48)}`
    expect(parsePortalApiKey(valid)).toEqual({ tenantId: 45, raw: valid })
    expect(parsePortalApiKey('aos_live_0_' + 'a'.repeat(48))).toBeNull()
    expect(parsePortalApiKey('sk_live_123')).toBeNull()
    expect(parsePortalApiKey('')).toBeNull()
  })

  it('verifies PKCE S256 challenges correctly', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')

    expect(verifyPkceS256(verifier, challenge)).toBe(true)
    expect(verifyPkceS256('wrong-verifier', challenge)).toBe(false)
  })

  it('enforces least-privilege scopes on MCP tools', () => {
    expect(isToolAllowedByScopes('query_posts', ['portal:read'])).toBe(true)
    expect(isToolAllowedByScopes('leo_respond', ['portal:read'])).toBe(true)
    expect(isToolAllowedByScopes('create_post', ['portal:read'])).toBe(false)
    expect(isToolAllowedByScopes('create_post', ['portal:content'])).toBe(true)
    expect(isToolAllowedByScopes('provision_tenant', ['portal:content'])).toBe(false)
    expect(isToolAllowedByScopes('provision_tenant', ['portal:provision'])).toBe(true)
    expect(isToolAllowedByScopes('delete_space', ['portal:admin'])).toBe(true)
    expect(AIRLOCK_GATED_TOOLS.has('disconnect_square')).toBe(true)
    expect(AIRLOCK_GATED_TOOLS.has('delete_portal')).toBe(true)
  })

  it('mints, authenticates (tenant-pinned), checks standing, and revokes portal API keys', async () => {
    const payload = createMockPayload({ membershipRole: 'tenant_admin' })
    const minted = await mintPortalApiKey(payload, {
      tenantId: 45,
      ownerUserId: 7,
      name: 'Antigravity Plugin',
      scopes: ['portal:read', 'portal:content'],
    })

    expect(minted.plaintext.startsWith('aos_live_45_')).toBe(true)
    expect(minted.key.active).toBe(true)

    const authed = await authenticateSovereignBearer(payload, `Bearer ${minted.plaintext}`)
    expect(authed && authed.ok).toBe(true)
    if (authed && authed.ok) {
      expect(authed.ctx.tenantId).toBe(45)
      expect(authed.ctx.scopes).toEqual(['portal:read', 'portal:content'])
    }

    // Revoke key -> subsequent auth must fail
    const revoked = await revokePortalApiKey(payload, 45, minted.key.id)
    expect(revoked.revoked).toBe(true)

    const afterRevoke = await authenticateSovereignBearer(payload, `Bearer ${minted.plaintext}`)
    expect(afterRevoke && !afterRevoke.ok).toBe(true)
  })

  it('rejects valid key if owner loses active tenant_admin/tenant_manager standing', async () => {
    const payload = createMockPayload({ ownerRoles: ['user'], membershipRole: null })
    const minted = await mintPortalApiKey(payload, {
      tenantId: 12,
      ownerUserId: 9,
      name: 'Demoted User Key',
      scopes: ['portal:read'],
    })

    const res = await authenticateSovereignBearer(payload, `Bearer ${minted.plaintext}`)
    expect(res && !res.ok).toBe(true)
    if (res && !res.ok) {
      expect(res.error).toMatch(/standing/i)
    }
  })

  it('completes OAuth 2.1 PKCE code exchange once and rejects replay or bad verifier', async () => {
    const payload = createMockPayload({ membershipRole: 'tenant_admin' })
    const verifier = 'my-secret-pkce-verifier-string-1234567890'
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')

    const { code } = await createOAuthAuthorizationCode(payload, {
      tenantId: 45,
      ownerUserId: 7,
      clientId: 'chatgpt-connector',
      redirectUri: 'https://chat.openai.com/aip/oauth/callback',
      codeChallenge: challenge,
      scopes: ['portal:read', 'portal:provision'],
    })

    // Wrong verifier rejected
    const bad = await exchangeOAuthCodeForToken(payload, {
      code,
      codeVerifier: 'wrong-verifier',
      clientId: 'chatgpt-connector',
      redirectUri: 'https://chat.openai.com/aip/oauth/callback',
    })
    expect(bad.ok).toBe(false)

    // Correct verifier succeeds
    const good = await exchangeOAuthCodeForToken(payload, {
      code,
      codeVerifier: verifier,
      clientId: 'chatgpt-connector',
      redirectUri: 'https://chat.openai.com/aip/oauth/callback',
    })
    expect(good.ok).toBe(true)
    if (good.ok) {
      expect(good.accessToken.startsWith('aos_live_45_')).toBe(true)
      expect(good.scope).toBe('portal:read portal:provision')
    }

    // Replay rejected (single-use)
    const replay = await exchangeOAuthCodeForToken(payload, {
      code,
      codeVerifier: verifier,
      clientId: 'chatgpt-connector',
      redirectUri: 'https://chat.openai.com/aip/oauth/callback',
    })
    expect(replay.ok).toBe(false)
  })

  it('pauses high-risk tools in Constitutional Airlock and resolves human approval', async () => {
    const payload = createMockPayload({ membershipRole: 'tenant_admin' })
    const { approval, approvalUrl } = await createAirlockApproval(payload, {
      tenantId: 45,
      toolName: 'disconnect_square',
      args: { confirm: true },
      keyId: 'key_1',
      keyName: 'Claude Remote',
      portalDomain: 'mlb.spacesangels.com',
    })

    expect(approval.status).toBe('pending')
    expect(approvalUrl).toBe(
      `https://mlb.spacesangels.com/dashboard/admin/settings?tab=advanced&airlock=${approval.id}`,
    )

    const resolved = await resolveAirlockApproval(payload, {
      tenantId: 45,
      approvalId: approval.id,
      decision: 'approved',
      resolvedByUserId: 7,
    })
    expect(resolved?.status).toBe('approved')

    const overview = await getTenantMcpOverview(payload, 45)
    expect(overview.airlock[0]?.status).toBe('approved')
    expect(overview.activity.length).toBeGreaterThanOrEqual(2)
  })

  it('validates OAuth redirect URIs (HTTPS or localhost only)', () => {
    expect(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(true)
    expect(isAllowedRedirectUri('http://localhost:8787/callback')).toBe(true)
    expect(isAllowedRedirectUri('http://127.0.0.1:3000/cb')).toBe(true)
    expect(isAllowedRedirectUri('http://evil.example.com/cb')).toBe(false)
    expect(isAllowedRedirectUri('javascript:alert(1)')).toBe(false)
  })
})
