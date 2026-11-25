/**
 * RFC 8414 / OAuth 2.1 Authorization Server Metadata
 *
 * Served at `/.well-known/oauth-authorization-server` for MCP clients performing
 * PKCE S256 OAuth 2.1 discovery against Angel OS portals.
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
      issuer: origin,
      authorization_endpoint: `${origin}/api/mcp-oauth/authorize`,
      token_endpoint: `${origin}/api/mcp-oauth/token`,
      revocation_endpoint: `${origin}/api/mcp-oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: [
        'portal:read',
        'portal:content',
        'portal:admin',
        'portal:provision',
      ],
      service_documentation: `${origin}/.well-known/mcp/server.json`,
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
