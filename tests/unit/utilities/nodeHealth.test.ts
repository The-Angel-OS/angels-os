import { describe, it, expect } from 'vitest'
import { summarizeNode, formatNodeHealth, type NodeHealthReport } from '@/utilities/nodeHealth'
import type { RegisteredNode } from '@/utilities/nodeBus'

function nodeFixture(over: Partial<RegisteredNode> = {}): RegisteredNode {
  return {
    id: 'MERLIN-01',
    lastSeen: new Date().toISOString(),
    channel: 'node-merlin-01',
    platform: 'win32',
    version: '2.0.0',
    uptimeSec: 3600,
    capabilities: ['file-share', 'compute'],
    compute: { available: true, models: ['nemotron-3-super:cloud', 'qwen2.5-coder:7b'] },
    stats: { cpu_pct: 12, mem_used_pct: 44, cpu_cores: 16 },
    witnesses: [
      { id: 'sys', type: 'system_health', label: 'System Health', status: 'active' },
      { id: 'cam:door', type: 'camera', label: 'Door Cam', status: 'error' },
    ],
    tunnelUrl: 'https://merlin.example.com',
    ...over,
  } as RegisteredNode
}

describe('summarizeNode', () => {
  it('extracts vitals defensively from the catalog shape', () => {
    const s = summarizeNode(nodeFixture())
    expect(s.id).toBe('MERLIN-01')
    expect(s.online).toBe(true)
    expect(s.cpuPct).toBe(12)
    expect(s.memUsedPct).toBe(44)
    expect(s.cores).toBe(16)
    expect(s.ollamaAvailable).toBe(true)
    expect(s.models).toHaveLength(2)
    expect(s.witnesses).toHaveLength(2)
    expect(s.ageMins).toBeLessThan(2)
  })

  it('marks a stale node offline', () => {
    const old = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    expect(summarizeNode(nodeFixture({ lastSeen: old })).online).toBe(false)
  })

  it('never throws on a garbage / partial node record', () => {
    const s = summarizeNode({ id: 'x' } as RegisteredNode)
    expect(s.id).toBe('x')
    expect(s.online).toBe(false)
    expect(s.cpuPct).toBeUndefined()
    expect(s.witnesses).toBeUndefined()
  })
})

describe('formatNodeHealth', () => {
  it('says all-nominal when every node is online', () => {
    const report: NodeHealthReport = {
      endeavor: 'clearwater-cruisin',
      found: true,
      nodeCount: 1,
      onlineCount: 1,
      nodes: [summarizeNode(nodeFixture())],
    }
    const md = formatNodeHealth(report)
    expect(md).toContain('All 1 node(s) nominal')
    expect(md).toContain('MERLIN-01')
    expect(md).toContain('Ollama up')
    expect(md).toContain('Door Cam(error)') // surfaces a degraded eye
  })

  it('flags partial availability', () => {
    const report: NodeHealthReport = {
      endeavor: 'e', found: true, nodeCount: 2, onlineCount: 1,
      nodes: [summarizeNode(nodeFixture()), summarizeNode(nodeFixture({ id: 'M2', lastSeen: new Date(Date.now() - 9e5).toISOString() }))],
    }
    expect(formatNodeHealth(report)).toContain('1/2 node(s) online')
  })

  it('guides the operator when no nodes are locked on', () => {
    const report: NodeHealthReport = { endeavor: 'lonely', found: false, nodeCount: 0, onlineCount: 0, nodes: [] }
    expect(formatNodeHealth(report)).toContain('No Merlin nodes are locked onto **lonely**')
  })
})
