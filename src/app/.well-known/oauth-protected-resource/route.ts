/**
 * RFC 9728 — OAuth 2.0 Protected Resource Metadata
 *
 * Served at `/.well-known/oauth-protected-resource` so external AI assistants
 * (Antigravity Plugins, ChatGPT Connectors, Claude Remote MCP) auto-discover
 * Angel OS's OAuth 2.1 authorization server and tenant-pinned MCP scopes.
 */
import { NextResponse, type NextRequest } from 'next/server'

function getOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'spacesangels.com'
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function GET(req: NextRequest) {
  const origin = getOrigin(req)
  return NextResponse.json(
    {
      resource: `${origin}/api/mcp`,
      authorization_servers: [origin],
      scopes_supported: [
        'portal:read',
        'portal:content',
        'portal:admin',
        'portal:provision',
      ],
      bearer_methods_supported: ['header'],
      resource_name: 'Angel OS Sovereign LEO MCP Server',
      resource_documentation: `${origin}/.well-known/mcp/server.json`,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    },
  )
}
