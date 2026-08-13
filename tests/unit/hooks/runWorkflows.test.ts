/**
 * runWorkflows Hook — Unit Tests
 *
 * Tests the afterChange hook that runs channel workflows when a message
 * with attachments is created.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the workflow runner and message content extractor
vi.mock('@/utilities/workflowRunner', () => ({
  runWorkflowsForMessage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/utilities/messageContent', () => ({
  extractTextFromContent: vi.fn((content: unknown) => String(content ?? '')),
}))

import { runWorkflows } from '@/collections/Messages/hooks/runWorkflows'
import { runWorkflowsForMessage } from '@/utilities/workflowRunner'

// ── Helper ────────────────────────────────────────────────────────────────────

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    tenant: 5,
    space: 10,
    channel: 'general',
    content: 'Hello world',
    messageType: 'chat',
    attachments: [] as any[],
    ...overrides,
  }
}

function makeArgs({
  doc = makeDoc(),
  operation = 'create' as 'create' | 'update',
} = {}) {
  return {
    doc,
    operation,
    req: { payload: { find: vi.fn(), create: vi.fn() } } as any,
    collection: null as any,
    context: {} as any,
    previousDoc: {} as any,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runWorkflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── operation guard ───────────────────────────────────────────────────────

  it('returns doc unchanged on update and skips runWorkflowsForMessage', async () => {
    const doc = makeDoc({ attachments: [{ media: 99 }] })
    const args = makeArgs({ doc, operation: 'update' })
    const result = await runWorkflows(args as any)
    expect(result).toEqual(doc)
    expect(runWorkflowsForMessage).not.toHaveBeenCalled()
  })

  // ── attachment guard ──────────────────────────────────────────────────────

  it('returns doc unchanged when attachments is empty', async () => {
    const doc = makeDoc({ attachments: [] })
    const args = makeArgs({ doc })
    const result = await runWorkflows(args as any)
    expect(result).toEqual(doc)
    expect(runWorkflowsForMessage).not.toHaveBeenCalled()
  })

  it('returns doc unchanged when attachments is undefined', async () => {
    const doc = makeDoc({ attachments: undefined })
    const args = makeArgs({ doc })
    const result = await runWorkflows(args as any)
    expect(result).toEqual(doc)
    expect(runWorkflowsForMessage).not.toHaveBeenCalled()
  })

  // ── happy path ────────────────────────────────────────────────────────────

  it('calls runWorkflowsForMessage with correct args on create with attachments', async () => {
    const doc = makeDoc({ attachments: [{ media: 42 }, { media: 43 }] })
    const args = makeArgs({ doc })
    const result = await runWorkflows(args as any)
    expect(result).toEqual(doc)
    expect(runWorkflowsForMessage).toHaveBeenCalledOnce()
    expect(runWorkflowsForMessage).toHaveBeenCalledWith(
      args.req.payload,
      expect.objectContaining({
        id: 1,
        attachments: [{ media: 42 }, { media: 43 }],
        channel: 'general',
        space: 10,
        messageType: 'chat',
      }),
      5, // tenantId — passed through raw; the runner normalizes it
      { req: args.req }, // so a nested product-draft write joins the transaction
    )
  })

  it('passes extracted text from UMS content to runWorkflowsForMessage', async () => {
    const doc = makeDoc({
      content: { type: 'doc', content: [{ type: 'text', text: 'UMS message' }] },
      attachments: [{ media: 99 }],
    })
    const args = makeArgs({ doc })
    await runWorkflows(args as any)
    expect(runWorkflowsForMessage).toHaveBeenCalledWith(
      args.req.payload,
      expect.objectContaining({
        // extractTextFromContent is mocked to return String(content)
        content: expect.any(String),
      }),
      5,
      { req: args.req },
    )
  })

  // ── error handling ────────────────────────────────────────────────────────

  it('does not throw when runWorkflowsForMessage rejects', async () => {
    ;(runWorkflowsForMessage as any).mockRejectedValueOnce(new Error('Workflow engine failed'))
    const doc = makeDoc({ attachments: [{ media: 99 }] })
    const args = makeArgs({ doc })
    // The hook catches errors silently and still returns doc
    await expect(runWorkflows(args as any)).resolves.toEqual(doc)
  })
})
