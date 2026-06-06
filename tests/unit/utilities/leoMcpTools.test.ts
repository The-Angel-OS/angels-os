/**
 * Unit tests for leoMcpTools — the LEO_TOOLS → MCP custom-tool generator.
 *
 * Verifies the surface stays in lockstep with LEO (one MCP tool per LEO tool),
 * the camelCase keys match the plugin's gate, identity-based filtering matches
 * selectToolsForUser, and the per-call role guard denies admin tools to
 * non-admins.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('stripe', () => ({ default: vi.fn().mockImplementation(() => ({})) }))
vi.mock('@payloadcms/richtext-lexical', () => ({
  consolidateHTMLConverters: vi.fn(),
  convertLexicalToHTML: vi.fn(),
  defaultEditorConfig: { resolvedFeatureMap: new Map() },
  defaultEditorFeatures: [],
  lexicalEditor: vi.fn(() => ({})),
  FixedToolbarFeature: vi.fn(() => ({})),
  HeadingFeature: vi.fn(() => ({})),
  InlineToolbarFeature: vi.fn(() => ({})),
}))

import { z } from 'zod'
import {
  toMcpToolKey,
  jsonSchemaToZodShape,
  buildLeoMcpTools,
  leoMcpToolAccessMap,
} from '@/utilities/leoMcpTools'
import { LEO_TOOLS } from '@/utilities/leo-data-tools'

describe('toMcpToolKey (mirrors plugin toCamelCase)', () => {
  it.each([
    ['provision_tenant', 'provisionTenant'],
    ['leo_respond', 'leoRespond'],
    ['query_application_logs', 'queryApplicationLogs'],
    ['run_subsafe_check', 'runSubsafeCheck'],
    ['query_products', 'queryProducts'],
  ])('%s → %s', (input, expected) => {
    expect(toMcpToolKey(input)).toBe(expected)
  })
})

describe('jsonSchemaToZodShape', () => {
  const shape = jsonSchemaToZodShape({
    properties: {
      name: { type: 'string', description: 'a name' },
      count: { type: 'number' },
      flag: { type: 'boolean' },
      tags: { type: 'array', items: { type: 'string' } },
      mode: { type: 'string', enum: ['a', 'b'] },
      blob: { type: 'object' },
    },
    required: ['name'],
  })

  it('makes a zod field per property', () => {
    expect(Object.keys(shape).sort()).toEqual(['blob', 'count', 'flag', 'mode', 'name', 'tags'])
  })

  it('marks required fields non-optional and others optional', () => {
    // Wrap the shape in an object to test parsing semantics
    const obj = z.object(shape)
    expect(obj.safeParse({ name: 'x' }).success).toBe(true) // optionals omitted ok
    expect(obj.safeParse({}).success).toBe(false) // missing required name
  })

  it('enforces enum values', () => {
    const obj = z.object(shape)
    expect(obj.safeParse({ name: 'x', mode: 'c' }).success).toBe(false)
    expect(obj.safeParse({ name: 'x', mode: 'a' }).success).toBe(true)
  })

  it('returns an empty shape for a schema with no properties', () => {
    expect(jsonSchemaToZodShape({})).toEqual({})
  })
})

describe('buildLeoMcpTools', () => {
  const tools = buildLeoMcpTools()

  it('generates exactly one MCP tool per LEO tool', () => {
    expect(tools.length).toBe(LEO_TOOLS.length)
  })

  it('every generated tool has name, description, parameters object, and handler', () => {
    for (const t of tools) {
      expect(typeof t.name).toBe('string')
      expect(typeof t.description).toBe('string')
      expect(t.description.length).toBeGreaterThan(0)
      expect(typeof t.parameters).toBe('object')
      expect(typeof t.handler).toBe('function')
    }
  })

  it('includes provision_tenant (the new full-provision tool)', () => {
    expect(tools.find((t) => t.name === 'provision_tenant')).toBeTruthy()
  })

  it('denies an admin tool to a non-admin caller (per-call guard)', async () => {
    const tool = tools.find((t) => t.name === 'issue_refund')!
    const req = { headers: { get: () => null }, payload: {}, user: { id: 1, roles: ['member'] } }
    const res = await tool.handler({}, req as never, undefined)
    expect(res.content[0].text).toContain('requires elevated privileges')
  })

  it('allows a read tool for a non-admin caller (dispatches; errors surface as text)', async () => {
    const tool = tools.find((t) => t.name === 'query_products')!
    const throwingPayload = { find: () => { throw new Error('boom') } }
    const req = { headers: { get: () => null }, payload: throwingPayload, user: { id: 1, roles: ['member'] } }
    const res = await tool.handler({ search: 'x' }, req as never, undefined)
    // executeToolCall catches and returns an error string — proves it dispatched past the guard
    expect(res.content[0].text).toContain('Error')
  })
})

describe('leoMcpToolAccessMap', () => {
  it('grants super_admin the full tool set including admin tools', () => {
    const map = leoMcpToolAccessMap(['super_admin'])
    expect(map.provisionTenant).toBe(true)
    expect(map.issueRefund).toBe(true)
    expect(Object.keys(map).length).toBe(LEO_TOOLS.length)
  })

  it('hides admin tools from a non-admin role but keeps read tools', () => {
    const map = leoMcpToolAccessMap(['member'])
    expect(map.provisionTenant).toBeUndefined()
    expect(map.issueRefund).toBeUndefined()
    expect(map.queryProducts).toBe(true)
  })

  it('treats empty/unknown roles as non-privileged (no admin tools leaked)', () => {
    const map = leoMcpToolAccessMap([])
    expect(map.provisionTenant).toBeUndefined()
    expect(map.payloadDelete).toBeUndefined()
    expect(map.queryProducts).toBe(true)
  })
})
