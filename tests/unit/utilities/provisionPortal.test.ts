/**
 * Unit tests for provisionPortal() — the canonical "stand up a whole portal
 * enterprise" path shared by the Provision Portal endpoint and LEO's
 * provision_tenant tool.
 *
 * The canonical helpers are mocked; we assert provisionPortal orchestrates them
 * correctly: tenant + alias domains + nav + pages + endeavor + ALL baseline
 * spaces + admin link, idempotently.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const findOrCreateTenant = vi.fn()
const findOrCreateTenantMembership = vi.fn()
const createDefaultTenantPages = vi.fn()
const createDefaultTenantNavigation = vi.fn()
const ensureTenantDefaults = vi.fn()
const ensureTenantSpaces = vi.fn()

vi.mock('@/endpoints/seed/seed-helpers', () => ({
  findOrCreateTenant: (...a: unknown[]) => findOrCreateTenant(...a),
  findOrCreateTenantMembership: (...a: unknown[]) => findOrCreateTenantMembership(...a),
}))
vi.mock('@/utilities/createDefaultTenantPages', () => ({
  createDefaultTenantPages: (...a: unknown[]) => createDefaultTenantPages(...a),
}))
vi.mock('@/utilities/createDefaultTenantNavigation', () => ({
  createDefaultTenantNavigation: (...a: unknown[]) => createDefaultTenantNavigation(...a),
}))
vi.mock('@/utilities/lexicalHelpers', () => ({
  createLexicalContent: () => ({ root: {} }),
  createHeadingNode: (t: string) => ({ heading: t }),
  createParagraphNode: (t: string) => ({ paragraph: t }),
}))
vi.mock('@/utilities/ensureTenantDefaults', () => ({
  ensureTenantDefaults: (...a: unknown[]) => ensureTenantDefaults(...a),
}))
vi.mock('@/utilities/ensureTenantSpaces', () => ({
  ensureTenantSpaces: (...a: unknown[]) => ensureTenantSpaces(...a),
}))

import { provisionPortal } from '@/utilities/provisionPortal'

function makePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    // endeavors lookup → none existing by default; pages lookup → a home page
    find: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'endeavors') return { docs: [] }
      if (collection === 'pages') return { docs: [{ id: 5 }] }
      return { docs: [] }
    }),
    findByID: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'tenants') return { domains: [] }
      if (collection === 'users') return { tenants: [] }
      return {}
    }),
    create: vi.fn(async ({ collection }: { collection: string }) => ({
      id: collection === 'endeavors' ? 99 : 1,
    })),
    update: vi.fn(async () => ({})),
    ...overrides,
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  findOrCreateTenant.mockResolvedValue({ id: 7, slug: 'kendev', name: 'KenDev' })
  findOrCreateTenantMembership.mockResolvedValue(undefined)
  createDefaultTenantPages.mockResolvedValue(undefined)
  createDefaultTenantNavigation.mockResolvedValue(undefined)
  ensureTenantDefaults.mockResolvedValue({ aiBusSpaceId: 10, mainSpaceId: 11, dmSpaceId: 12, errors: [] })
  ensureTenantSpaces.mockResolvedValue({ createdSpace: true, spaceId: 20, addedChannels: [] })
})

describe('provisionPortal', () => {
  it('throws when domain is missing', async () => {
    await expect(provisionPortal(makePayload(), { name: 'KenDev', domain: '' })).rejects.toThrow(/domain/)
  })

  it('creates tenant + endeavor + all baseline spaces and returns a log', async () => {
    const payload = makePayload()
    const result = await provisionPortal(
      payload,
      { name: 'KenDev', domain: 'kendev.co', endeavorType: 'service-provider' },
      { actingUserId: 3 },
    )

    expect(result.ok).toBe(true)
    expect(result.tenant).toEqual({ id: 7, slug: 'kendev', domain: 'kendev.co' })
    expect(result.url).toBe('https://kendev.co')

    // tenant via canonical helper
    expect(findOrCreateTenant).toHaveBeenCalledWith(
      payload,
      undefined,
      expect.objectContaining({ name: 'KenDev', slug: 'kendev', domain: 'kendev.co', type: 'tenant' }),
    )
    // nav + pages
    expect(createDefaultTenantNavigation).toHaveBeenCalledWith(payload, 7)
    expect(createDefaultTenantPages).toHaveBeenCalled()
    // endeavor created (none existed)
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'endeavors' }),
    )
    // baseline spaces
    expect(ensureTenantDefaults).toHaveBeenCalledWith(payload, 7)
    expect(ensureTenantSpaces).toHaveBeenCalledWith(
      payload,
      7,
      expect.objectContaining({ endeavorType: 'service-provider', spaceName: 'Community' }),
    )
    // admin link
    expect(findOrCreateTenantMembership).toHaveBeenCalledWith(
      payload,
      undefined,
      expect.objectContaining({ userId: 3, tenantId: 7, role: 'tenant_admin' }),
    )
    expect(result.log.join('\n')).toContain('linked admin → tenant')
  })

  it('derives a dot-free slug from the name when slug omitted', async () => {
    await provisionPortal(makePayload(), { name: 'Ken Dev AI', domain: 'kendev.co' })
    expect(findOrCreateTenant).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      expect.objectContaining({ slug: 'ken-dev-ai' }),
    )
  })

  it('merges alias domains into tenant.domains[] (skipping the primary)', async () => {
    const payload = makePayload()
    await provisionPortal(payload, {
      name: 'KenDev',
      domain: 'kendev.co',
      domainAliases: ['www.kendev.co', 'KENDEV.CO'],
    })
    const aliasUpdate = payload.update.mock.calls.find(
      (c: any[]) => c[0].collection === 'tenants' && c[0].data?.domains,
    )
    expect(aliasUpdate).toBeTruthy()
    expect(aliasUpdate[0].data.domains).toEqual([{ domain: 'www.kendev.co' }])
  })

  it('does not recreate an endeavor that already exists (idempotent)', async () => {
    const payload = makePayload({
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'endeavors') return { docs: [{ id: 42 }] }
        if (collection === 'pages') return { docs: [{ id: 5 }] }
        return { docs: [] }
      }),
    })
    const result = await provisionPortal(payload, { name: 'KenDev', domain: 'kendev.co' })
    const endeavorCreate = payload.create.mock.calls.find((c: any[]) => c[0].collection === 'endeavors')
    expect(endeavorCreate).toBeFalsy()
    expect(result.log.join('\n')).toContain('endeavor #42 (existing)')
  })

  it('skips the admin link when no acting user is supplied (LEO with no userId)', async () => {
    const result = await provisionPortal(makePayload(), { name: 'KenDev', domain: 'kendev.co' })
    expect(findOrCreateTenantMembership).not.toHaveBeenCalled()
    expect(result.log.join('\n')).toContain('admin link skipped (no acting user)')
  })

  it('does not abort when a space step fails — logs and continues', async () => {
    ensureTenantDefaults.mockRejectedValueOnce(new Error('pool exhausted'))
    const result = await provisionPortal(makePayload(), { name: 'KenDev', domain: 'kendev.co' })
    expect(result.ok).toBe(true)
    expect(result.log.join('\n')).toContain('ensureTenantDefaults skipped: pool exhausted')
    // later steps still ran
    expect(ensureTenantSpaces).toHaveBeenCalled()
  })
})
