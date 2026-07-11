/**
 * selectToolsForContext — Unit Tests
 *
 * The cloud-provider latency win: instead of shipping all ~159 tool schemas to
 * Gemini every turn (~30k tokens, no caching), send CORE + the tools relevant to
 * THIS message. Verifies CORE always survives, keyword relevance pulls in the
 * right domain tools, the cap holds, and short/empty messages fall back safely.
 */
import { describe, it, expect } from 'vitest'
import { selectToolsForContext } from '@/utilities/leoToolSelection'

type Tool = { name: string; description?: string }

// A stand-in registry: a few CORE tools + domain tools with realistic descriptions.
const TOOLS: Tool[] = [
  // CORE (always kept)
  { name: 'query_products', description: 'List products in the catalog' },
  { name: 'send_message', description: 'Send a message to a channel' },
  { name: 'my_place', description: 'Where am I in the world' },
  { name: 'create_page', description: 'Create a website page' },
  // domain: provisioning
  { name: 'provision_tenant', description: 'Provision a new tenant portal endeavor with a domain' },
  { name: 'clone_portal', description: 'Clone an existing portal to a new one' },
  // domain: federation
  { name: 'browse_federation_peers', description: 'Browse peer nodes across the federation network' },
  { name: 'route_federated_request', description: 'Route a request to a federation peer' },
  // domain: commerce
  { name: 'issue_refund', description: 'Refund a customer order payment' },
  // filler tools with no overlap
  ...Array.from({ length: 60 }, (_, i) => ({ name: `filler_${i}`, description: `unrelated capability number ${i}` })),
]

describe('selectToolsForContext', () => {
  it('returns everything untouched when the registry already fits under the cap', () => {
    const few = TOOLS.slice(0, 5)
    expect(selectToolsForContext(few, 'provision a portal', { cap: 40 })).toEqual(few)
  })

  it('always keeps the CORE tools', () => {
    const out = selectToolsForContext(TOOLS, 'refund an order', { cap: 30 }).map((t) => t.name)
    for (const core of ['query_products', 'send_message', 'my_place', 'create_page']) {
      expect(out).toContain(core)
    }
  })

  it('pulls in the domain tools relevant to the message (provisioning)', () => {
    const out = selectToolsForContext(TOOLS, 'provision a new portal for my bakery', { cap: 30 }).map((t) => t.name)
    expect(out).toContain('provision_tenant')
    expect(out).toContain('clone_portal')
    // Irrelevant federation tools should NOT be pulled in by a provisioning message.
    expect(out).not.toContain('route_federated_request')
  })

  it('pulls federation tools for a federation message, not provisioning', () => {
    const out = selectToolsForContext(TOOLS, 'browse the federation network peers', { cap: 30 }).map((t) => t.name)
    expect(out).toContain('browse_federation_peers')
    expect(out).not.toContain('provision_tenant')
  })

  it('respects the cap', () => {
    const out = selectToolsForContext(TOOLS, 'provision portal federation refund order network', { cap: 12 })
    expect(out.length).toBeLessThanOrEqual(12)
  })

  it('a message with no signal falls back to CORE only', () => {
    const out = selectToolsForContext(TOOLS, 'hi', { cap: 20 }).map((t) => t.name)
    expect(out.sort()).toEqual(['create_page', 'my_place', 'query_products', 'send_message'].sort())
  })
})
