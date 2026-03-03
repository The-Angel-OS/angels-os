import { describe, it, expect, vi, beforeEach } from 'vitest'
import { spaceMembersRemoveHandler } from '@/endpoints/space-members'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(
  body: Record<string, unknown> | null,
  user: Record<string, unknown> | null = { id: 10 },
  payloadOverrides: Record<string, unknown> = {},
) {
  const nativeReq = new Request('http://localhost/api/spaces/members/remove', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT VALID JSON{{{',
  })

  const payload = {
    find: vi.fn().mockResolvedValue({ docs: [{ role: 'space_admin' }] }),
    findByID: vi.fn().mockResolvedValue({ id: 99, role: 'member', user: { id: 77 } }),
    count: vi.fn().mockResolvedValue({ totalDocs: 2 }),
    update: vi.fn().mockResolvedValue({}),
    ...payloadOverrides,
  }

  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('spaceMembersRemoveHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no user is authenticated', async () => {
    const req = makeReq({ membershipId: 99, spaceId: 1 }, null)
    const res = await spaceMembersRemoveHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq(null)
    const res = await spaceMembersRemoveHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when membershipId is missing', async () => {
    const req = makeReq({ spaceId: 1 })
    const res = await spaceMembersRemoveHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/membershipId and spaceId are required/i)
  })

  it('returns 400 when spaceId is missing', async () => {
    const req = makeReq({ membershipId: 99 })
    const res = await spaceMembersRemoveHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/membershipId and spaceId are required/i)
  })

  it('returns 403 when requester is not admin or moderator', async () => {
    const req = makeReq(
      { membershipId: 99, spaceId: 1 },
      { id: 10 },
      { find: vi.fn().mockResolvedValue({ docs: [] }) },
    )
    const res = await spaceMembersRemoveHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/only admins and moderators can remove members/i)
  })

  it('returns 400 when trying to remove yourself', async () => {
    // Target membership user.id matches req.user.id (both 10)
    const req = makeReq(
      { membershipId: 99, spaceId: 1 },
      { id: 10 },
      {
        find: vi.fn().mockResolvedValue({ docs: [{ role: 'space_admin' }] }),
        findByID: vi.fn().mockResolvedValue({ id: 99, role: 'member', user: { id: 10 } }),
      },
    )
    const res = await spaceMembersRemoveHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/cannot remove yourself/i)
  })

  it('returns 403 when moderator tries to remove a space_admin', async () => {
    const req = makeReq(
      { membershipId: 99, spaceId: 1 },
      { id: 10 },
      {
        find: vi.fn().mockResolvedValue({ docs: [{ role: 'moderator' }] }),
        findByID: vi.fn().mockResolvedValue({ id: 99, role: 'space_admin', user: { id: 77 } }),
      },
    )
    const res = await spaceMembersRemoveHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/moderators cannot remove admins/i)
  })

  it('returns 400 when trying to remove the last admin', async () => {
    const req = makeReq(
      { membershipId: 99, spaceId: 1 },
      { id: 10 },
      {
        find: vi.fn().mockResolvedValue({ docs: [{ role: 'space_admin' }] }),
        findByID: vi.fn().mockResolvedValue({ id: 99, role: 'space_admin', user: { id: 77 } }),
        count: vi.fn().mockResolvedValue({ totalDocs: 1 }),
      },
    )
    const res = await spaceMembersRemoveHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/cannot remove the last admin/i)
  })

  it('returns 200 on success with correct body', async () => {
    const req = makeReq({ membershipId: 99, spaceId: 1 })
    const res = await spaceMembersRemoveHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.message).toBe('Member removed.')
  })

  it('calls payload.update with status left', async () => {
    const updateMock = vi.fn().mockResolvedValue({})
    const req = makeReq(
      { membershipId: 99, spaceId: 1 },
      { id: 10 },
      { update: updateMock },
    )
    await spaceMembersRemoveHandler(req)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'space-memberships',
        id: 99,
        data: { status: 'left' },
      }),
    )
  })

  it('moderator can remove a regular member', async () => {
    const updateMock = vi.fn().mockResolvedValue({})
    const req = makeReq(
      { membershipId: 99, spaceId: 1 },
      { id: 10 },
      {
        find: vi.fn().mockResolvedValue({ docs: [{ role: 'moderator' }] }),
        findByID: vi.fn().mockResolvedValue({ id: 99, role: 'member', user: { id: 77 } }),
        count: vi.fn().mockResolvedValue({ totalDocs: 2 }),
        update: updateMock,
      },
    )
    const res = await spaceMembersRemoveHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(updateMock).toHaveBeenCalled()
  })
})
