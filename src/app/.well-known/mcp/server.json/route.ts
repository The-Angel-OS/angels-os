/**
 * MCP Server Discovery Endpoint
 *
 * Follows the emerging `.well-known/mcp/server.json` standard (SEP-1649)
 * for MCP server metadata discovery. Any MCP-aware client (Claude Code,
 * VS Code, future AngelClaw MCP support) can auto-discover Angel OS.
 * 
 * Spec: https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/discovery/
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
      description: 'POST email + password to /api/users/login, receive JWT token. Use as: Authorization: JWT <token>',
    },
    collections: [
      'products',
      'posts',
      'bookings',
      'availability',
      'spaces',
      'channels',
      'messages',
      'projects',
      'users',
    ],
    tools: [
      'leo_respond',
      'query_products',
      'query_posts',
      'query_bookings',
      'query_spaces',
      'query_projects',
      'query_availability',
    ],
    constitutional: {
      framework: 'The Herald Constitution',
      principles: [
        'Observable operations — all actions visible on AI Bus',
        'Request/offer model — no binding commands',
        'Tenant-scoped access only',
        'Dignity — every human is a person first',
        'Anti-demonic safeguards — no manipulation, no scoring',
      ],
      motto: 'The whole point of existence is to learn to love',
    },
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export const dynamic = 'force-static'
export const revalidate = 3600 // Revalidate every hour
