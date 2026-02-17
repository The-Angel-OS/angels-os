/**
 * MCP Server Discovery Endpoint
 *
 * Follows the emerging `.well-known/mcp/server.json` standard (SEP-1649)
 * for MCP server metadata discovery. Any MCP-aware client (Claude Code,
 * VS Code, future OpenClaw MCP support) can auto-discover Angel OS.
 */
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    mcp_version: '2025-03-26',
    server: {
      name: 'angel-os',
      version: '1.0.0',
      description: 'Angel OS — Sovereign AI Platform. Everyone Gets An Angel.',
    },
    capabilities: {
      tools: true,
      resources: true,
      prompts: false,
    },
    endpoints: {
      mcp: '/api/mcp',
      chat: '/api/leo',
      stream: '/api/leo/stream',
      health: '/api/leo',
      'ai-bus-poll': '/api/ai-bus/poll',
    },
    authentication: {
      type: 'bearer',
      login_url: '/api/users/login',
    },
  })
}
