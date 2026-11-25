/**
 * MCP Server Discovery Endpoint
 *
 * Follows `.well-known/mcp/server.json` (SEP-1649) and cross-links RFC 9728 /
 * OAuth 2.1 discovery (`/.well-known/oauth-protected-resource`) for external
 * AI clients (Antigravity Plugins, ChatGPT Connectors, Claude Remote MCP).
 */
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      mcp_version: '2025-03-26',
      server: {
        name: 'angel-os',
        version: '2.0.0',
        description:
          'Angel OS — Sovereign Creator & LEO AI Platform. Tenant-pinned Remote MCP with OAuth 2.1 and Constitutional Airlock.',
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
        'oauth-protected-resource': '/.well-known/oauth-protected-resource',
        'oauth-authorization-server': '/.well-known/oauth-authorization-server',
      },
      authentication: {
        type: 'oauth2_and_bearer',
        oauth_protected_resource: '/.well-known/oauth-protected-resource',
        portal_api_key_prefix: 'aos_live_',
        scopes_supported: [
          'portal:read',
          'portal:content',
          'portal:admin',
          'portal:provision',
        ],
        login_url: '/api/users/login',
        description:
          'Authenticate with an OAuth 2.1 PKCE Bearer token or tenant-pinned Portal API Key (Authorization: Bearer aos_live_<tenantId>_...) minted in Settings -> Advanced.',
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
        'search_geo_archive',
      ],
      constitutional: {
        framework: 'The Herald Constitution',
        principles: [
          'Observable operations — all external agent actions logged in Settings -> Advanced',
          'Server-side tenant pinning — client x-tenant-id header ignored on scoped tokens',
          'Constitutional Airlock — high-risk destructive actions require human approval',
          'Instant 1-click revocation for all Portal API Keys and OAuth 2.1 tokens',
        ],
        motto: 'The whole point of existence is to learn to love',
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    },
  )
}

export const dynamic = 'force-static'
export const revalidate = 3600
