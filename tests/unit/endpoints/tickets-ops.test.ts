import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockResolveTenant = vi.fn()
const mockCanManagePortal = vi.fn()

vi.mock('@/utilities/resolveTenantFromHeaders', () => ({
  resolveTenantFromHeaders: () => mockResolveTenant(),
}))

vi.mock('@/utilities/canManagePortal', () => ({
  canManagePortal: (...args: unknown[]) => mockCanManagePortal(...args),
}))

import {
  formatIncidentId,
  parseIncidentSearch,
  sanitizeTicketForRequester,
} from '@/utilities/ticketHelpers'
import {
  ticketSubmitHandler,
  ticketMineHandler,
  ticketUpdateHandler,
} from '@/endpoints/tickets-ops'

describe('ServiceNow-lite Support Ticketing helpers & endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveTenant.mockResolvedValue({ tenantId: 1 })
    mockCanManagePortal.mockResolvedValue(false)
  })

  it('formats and parses INC-0000XX incident numbers', () => {
    expect(formatIncidentId(14)).toBe('INC-000014')
    expect(formatIncidentId('7')).toBe('INC-000007')
    expect(parseIncidentSearch('INC-000014')).toBe('14')
    expect(parseIncidentSearch('#14')).toBe('14')
    expect(parseIncidentSearch('dns error')).toBeNull()
  })

  it('strips internalNotes in sanitizeTicketForRequester', () => {
    const view = sanitizeTicketForRequester({
      id: 42,
      type: 'support',
      subject: 'Custom domain SSL pending',
      description: 'CNAME added 10 minutes ago.',
      status: 'reviewing',
      priority: 'high',
      resolution: 'Cloudflare edge certificate active now.',
      internalNotes: 'SECRET STAFF NOTE: restarted CF worker',
      createdAt: '2026-11-23T12:00:00.000Z',
    })
    expect(view.incidentNumber).toBe('INC-000042')
    expect(view.resolution).toBe('Cloudflare edge certificate active now.')
    expect('internalNotes' in view).toBe(false)
    expect(JSON.stringify(view)).not.toContain('SECRET STAFF NOTE')
  })

  it('rejects unauthenticated submit and mine requests with 401', async () => {
    const req = { user: null, payload: {} } as never
    const subRes = await ticketSubmitHandler(req)
    expect(subRes.status).toBe(401)
    const mineRes = await ticketMineHandler(req)
    expect(mineRes.status).toBe(401)
  })

  it('locks non-staff submit to status=submitted and priority=normal, and returns INC number', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 19 })
    const req = {
      user: { id: 99, roles: ['customer'] },
      payload: { create: createMock, logger: { error: vi.fn() } },
      json: async () => ({
        type: 'support',
        subject: 'Cannot connect domain',
        description: 'Need help pointing CNAME',
        priority: 'urgent', // attempt by non-staff should be ignored
      }),
    } as never

    const res = await ticketSubmitHandler(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ ok: true, reference: 19, incidentNumber: 'INC-000019' })
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tickets',
        data: expect.objectContaining({
          status: 'submitted',
          priority: 'normal',
          requester: 99,
          tenant: 1,
        }),
      }),
    )
  })

  it('GET /mine omits internalNotes from response payload', async () => {
    const req = {
      user: { id: 99 },
      payload: {
        find: vi.fn().mockResolvedValue({
          totalDocs: 1,
          docs: [
            {
              id: 19,
              type: 'support',
              subject: 'Help with Square',
              description: 'OAuth link expired',
              status: 'resolved',
              priority: 'normal',
              resolution: 'Reconnected Square sandbox.',
              internalNotes: 'CONFIDENTIAL: token rotated manually',
              createdAt: '2026-11-23T12:00:00.000Z',
            },
          ],
        }),
      },
    } as never

    const res = await ticketMineHandler(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.tickets[0].incidentNumber).toBe('INC-000019')
    expect(json.tickets[0].resolution).toBe('Reconnected Square sandbox.')
    expect(json.tickets[0].internalNotes).toBeUndefined()
  })

  it('POST /update rejects non-managers with 403 and updates for portal managers', async () => {
    const findByIDMock = vi.fn().mockResolvedValue({ id: 19, tenant: 1 })
    const updateMock = vi.fn().mockResolvedValue({
      id: 19,
      status: 'resolved',
      priority: 'high',
      assignee: 5,
      resolution: 'Fixed DNS.',
      internalNotes: 'Checked dig',
      updatedAt: '2026-11-23T12:05:00.000Z',
    })

    const forbiddenReq = {
      user: { id: 99, roles: ['customer'] },
      payload: { findByID: findByIDMock, update: updateMock, logger: { error: vi.fn() } },
      json: async () => ({ ticketId: 19, status: 'resolved' }),
    } as never
    const forbiddenRes = await ticketUpdateHandler(forbiddenReq)
    expect(forbiddenRes.status).toBe(403)
    expect(updateMock).not.toHaveBeenCalled()

    mockCanManagePortal.mockResolvedValueOnce(true)
    const staffReq = {
      user: { id: 5, roles: ['customer'] },
      payload: { findByID: findByIDMock, update: updateMock, logger: { error: vi.fn() } },
      json: async () => ({
        ticketId: 19,
        status: 'resolved',
        priority: 'high',
        assignee: 5,
        resolution: 'Fixed DNS.',
        internalNotes: 'Checked dig',
      }),
    } as never
    const staffRes = await ticketUpdateHandler(staffReq)
    expect(staffRes.status).toBe(200)
    const json = await staffRes.json()
    expect(json.ok).toBe(true)
    expect(json.ticket.incidentNumber).toBe('INC-000019')
    expect(json.ticket.status).toBe('resolved')
  })
})
