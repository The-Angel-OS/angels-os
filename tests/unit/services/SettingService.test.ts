/**
 * SettingService — the one way to read/write per-entity settings (Oqtane bag).
 * Verifies upsert semantics, isPrivate read-gating, and typed coercion.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  getSettings,
  getSetting,
  setSetting,
  deleteSetting,
  getBoolSetting,
  getNumberSetting,
  getJsonSetting,
  setJsonSetting,
} from '@/services/SettingService'

interface Row {
  id: number
  entityName: string
  entityId: string
  settingName: string
  settingValue?: string
  isPrivate?: boolean
  tenant?: number | string
}

/** In-memory mock of the `settings` collection honoring the where clauses used. */
function makePayload(seed: Row[] = []) {
  let rows = [...seed]
  let nextId = (seed.reduce((m, r) => Math.max(m, r.id), 0) || 0) + 1
  const match = (r: Row, where: any) => {
    const and = where?.and || []
    return and.every((c: any) => {
      if (c.entityName) return r.entityName === c.entityName.equals
      if (c.entityId) return r.entityId === c.entityId.equals
      if (c.settingName) return r.settingName === c.settingName.equals
      if (c.tenant) return String(r.tenant) === String(c.tenant.equals)
      return true
    })
  }
  return {
    get rows() {
      return rows
    },
    find: vi.fn(async ({ where }: any) => ({ docs: rows.filter((r) => match(r, where)) })),
    create: vi.fn(async ({ data }: any) => {
      const row = { id: nextId++, ...data }
      rows.push(row)
      return row
    }),
    update: vi.fn(async ({ id, data }: any) => {
      rows = rows.map((r) => (r.id === id ? { ...r, ...data } : r))
      return rows.find((r) => r.id === id)
    }),
    delete: vi.fn(async ({ id }: any) => {
      rows = rows.filter((r) => r.id !== id)
      return { id }
    }),
  }
}

const scope = { entityName: 'space', entityId: 42, tenantId: 1 }

describe('SettingService', () => {
  it('creates a setting when none exists, then updates in place (upsert)', async () => {
    const payload = makePayload()
    await setSetting(payload, scope, 'theme', 'dark')
    expect(payload.create).toHaveBeenCalledTimes(1)
    expect(await getSetting(payload, scope, 'theme')).toBe('dark')

    await setSetting(payload, scope, 'theme', 'light')
    expect(payload.create).toHaveBeenCalledTimes(1) // no second create
    expect(payload.update).toHaveBeenCalledTimes(1)
    expect(await getSetting(payload, scope, 'theme')).toBe('light')
    expect(payload.rows.filter((r) => r.settingName === 'theme').length).toBe(1)
  })

  it('returns the default when a setting is absent', async () => {
    const payload = makePayload()
    expect(await getSetting(payload, scope, 'missing', 'fallback')).toBe('fallback')
    expect(await getSetting(payload, scope, 'missing')).toBeUndefined()
  })

  it('requires a tenantId to write', async () => {
    const payload = makePayload()
    await expect(
      setSetting(payload, { entityName: 'space', entityId: 42 }, 'k', 'v'),
    ).rejects.toThrow(/tenantId/)
  })

  it('withholds private settings from getSettings unless includePrivate', async () => {
    const payload = makePayload()
    await setSetting(payload, scope, 'public', 'yes')
    await setSetting(payload, scope, 'secret', 'shh', { isPrivate: true })

    const bag = await getSettings(payload, scope)
    expect(bag).toEqual({ public: 'yes' })

    const full = await getSettings(payload, scope, { includePrivate: true })
    expect(full).toEqual({ public: 'yes', secret: 'shh' })
  })

  it('scopes by tenant — another tenant cannot read these settings', async () => {
    const payload = makePayload()
    await setSetting(payload, scope, 'theme', 'dark')
    const otherTenant = { entityName: 'space', entityId: 42, tenantId: 999 }
    expect(await getSetting(payload, otherTenant, 'theme')).toBeUndefined()
  })

  it('deletes a setting (and is a no-op when absent)', async () => {
    const payload = makePayload()
    await setSetting(payload, scope, 'theme', 'dark')
    await deleteSetting(payload, scope, 'theme')
    expect(await getSetting(payload, scope, 'theme')).toBeUndefined()
    await deleteSetting(payload, scope, 'theme') // no throw
  })

  it('coerces typed values (bool / number / json)', async () => {
    const payload = makePayload()
    await setSetting(payload, scope, 'enabled', 'true')
    await setSetting(payload, scope, 'count', '7')
    await setJsonSetting(payload, scope, 'cfg', { a: 1, b: [2, 3] })

    expect(await getBoolSetting(payload, scope, 'enabled')).toBe(true)
    expect(await getBoolSetting(payload, scope, 'absent', true)).toBe(true)
    expect(await getNumberSetting(payload, scope, 'count')).toBe(7)
    expect(await getNumberSetting(payload, scope, 'absent', 5)).toBe(5)
    expect(await getJsonSetting(payload, scope, 'cfg')).toEqual({ a: 1, b: [2, 3] })
  })

  it('getJsonSetting returns default on malformed JSON', async () => {
    const payload = makePayload()
    await setSetting(payload, scope, 'cfg', '{ not json')
    expect(await getJsonSetting(payload, scope, 'cfg', { fallback: true })).toEqual({ fallback: true })
  })
})
