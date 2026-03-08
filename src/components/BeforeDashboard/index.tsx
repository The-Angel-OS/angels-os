import { Banner } from '@payloadcms/ui'
import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'

import { SeedButton } from './SeedButton'
import './index.scss'

const baseClass = 'before-dashboard'

/**
 * BeforeDashboard — Angel OS admin command center.
 *
 * Async server component: fetches real content stats from Payload Local API.
 * Shows content overview cards, recent edits, quick actions, and collection links.
 * Registered via admin.components.beforeDashboard in payload.config.ts.
 */
export async function BeforeDashboard() {
  // Fetch content stats in parallel — all queries non-fatal
  let stats = { pages: 0, posts: 0, products: 0, media: 0, users: 0, tenants: 0, spaces: 0, draftPages: 0, draftPosts: 0 }
  let recentEdits: Array<{ collection: string; title: string; id: string | number; updatedAt: string; status?: string }> = []

  try {
    const payload = await getPayload({ config })

    const [pages, posts, products, media, users, tenants, spaces, draftPages, draftPosts, recentPages, recentPosts, recentProducts] = await Promise.all([
      payload.count({ collection: 'pages', overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'posts', overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'products', overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'media', overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'users', where: { isSystemUser: { not_equals: true } }, overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'tenants', overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'spaces', overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'pages', where: { _status: { equals: 'draft' } }, overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'posts', where: { _status: { equals: 'draft' } }, overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      // Recent edits — 3 from each content collection
      payload.find({ collection: 'pages', sort: '-updatedAt', limit: 3, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
      payload.find({ collection: 'posts', sort: '-updatedAt', limit: 3, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
      payload.find({ collection: 'products', sort: '-updatedAt', limit: 3, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    ])

    stats = {
      pages: pages.totalDocs,
      posts: posts.totalDocs,
      products: products.totalDocs,
      media: media.totalDocs,
      users: users.totalDocs,
      tenants: tenants.totalDocs,
      spaces: spaces.totalDocs,
      draftPages: draftPages.totalDocs,
      draftPosts: draftPosts.totalDocs,
    }

    // Combine and sort recent edits by updatedAt
    const combined = [
      ...recentPages.docs.map((d: any) => ({
        collection: 'pages' as const,
        title: d.title || d.slug || 'Untitled Page',
        id: d.id,
        updatedAt: d.updatedAt || d.createdAt || '',
        status: d._status,
      })),
      ...recentPosts.docs.map((d: any) => ({
        collection: 'posts' as const,
        title: d.title || 'Untitled Post',
        id: d.id,
        updatedAt: d.updatedAt || d.createdAt || '',
        status: d._status,
      })),
      ...recentProducts.docs.map((d: any) => ({
        collection: 'products' as const,
        title: d.title || d.name || 'Untitled Product',
        id: d.id,
        updatedAt: d.updatedAt || d.createdAt || '',
        status: d._status,
      })),
    ]
    recentEdits = combined
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
  } catch {
    // DB not ready — show defaults
  }

  const totalDrafts = stats.draftPages + stats.draftPosts

  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Angel OS Command Center</h4>
      </Banner>

      <p style={{ marginBottom: '16px', fontSize: '14px', color: '#888' }}>
        Constitutional AI platform where everyone gets an Angel. Manage tenants, content,
        commerce, spaces, and federation from here.
      </p>

      {/* Content Overview Stats */}
      <h5 style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#f5a623', marginBottom: '12px' }}>
        Content Overview
      </h5>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        <StatCard label="Pages" value={stats.pages} href="/admin/collections/pages" color="#99ccff" />
        <StatCard label="Posts" value={stats.posts} href="/admin/collections/posts" color="#99ccff" />
        <StatCard label="Products" value={stats.products} href="/admin/collections/products" color="#cc99cc" />
        <StatCard label="Media" value={stats.media} href="/admin/collections/media" color="#f5a623" />
        <StatCard label="Users" value={stats.users} href="/admin/collections/users" color="#4caf50" />
        <StatCard label="Tenants" value={stats.tenants} href="/admin/collections/tenants" color="#cc99cc" />
        <StatCard label="Spaces" value={stats.spaces} href="/admin/collections/spaces" color="#99ccff" />
        {totalDrafts > 0 && (
          <StatCard label="Drafts" value={totalDrafts} href="/admin/collections/pages" color="#ff9800" />
        )}
      </div>

      {/* Recent Edits Table */}
      {recentEdits.length > 0 && (
        <>
          <h5 style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#f5a623', marginBottom: '12px' }}>
            Recent Edits
          </h5>
          <div style={{ marginBottom: '20px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>Title</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>Collection</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {recentEdits.map((edit) => (
                  <tr key={`${edit.collection}-${edit.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <a
                        href={`/admin/collections/${edit.collection}/${edit.id}`}
                        style={{ color: '#99ccff', textDecoration: 'none' }}
                      >
                        {edit.title}
                      </a>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        background: edit.collection === 'pages' ? 'rgba(153,204,255,0.1)' : edit.collection === 'posts' ? 'rgba(76,175,80,0.1)' : 'rgba(204,153,204,0.1)',
                        color: edit.collection === 'pages' ? '#99ccff' : edit.collection === 'posts' ? '#4caf50' : '#cc99cc',
                      }}>
                        {edit.collection}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {edit.status && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          color: edit.status === 'published' ? '#4caf50' : '#ff9800',
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: edit.status === 'published' ? '#4caf50' : '#ff9800',
                          }} />
                          {edit.status}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888', fontSize: '12px' }}>
                      {formatRelativeTime(edit.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Quick action cards */}
      <h5 style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#f5a623', marginBottom: '12px' }}>
        Quick Actions
      </h5>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <QuickCard href="/dashboard" title="Dashboard" desc="LEO, spaces, CIC, bridge" />
        <QuickCard href="/admin/collections/pages/create" title="New Page" desc="Create a landing page" />
        <QuickCard href="/admin/collections/posts/create" title="New Post" desc="Write a blog post" />
        <QuickCard href="/admin/collections/products/create" title="New Product" desc="Add to catalog" />
        <QuickCard href="/admin/collections/tenants" title="Tenants" desc="Multi-tenant management" />
        <QuickCard href="/" title="View Site" desc="Visit the frontend" />
      </div>

      {/* Collection quick links */}
      <h5 style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: '12px' }}>
        All Collections
      </h5>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '20px' }}>
        {[
          { label: 'Media', href: '/admin/collections/media' },
          { label: 'Categories', href: '/admin/collections/categories' },
          { label: 'Comments', href: '/admin/collections/comments' },
          { label: 'Events', href: '/admin/collections/events' },
          { label: 'Bookings', href: '/admin/collections/bookings' },
          { label: 'Spaces', href: '/admin/collections/spaces' },
          { label: 'Users', href: '/admin/collections/users' },
          { label: 'Crew', href: '/admin/collections/crew-assignments' },
          { label: 'Endeavors', href: '/admin/collections/endeavors' },
          { label: 'Header', href: '/admin/collections/header' },
          { label: 'Footer', href: '/admin/collections/footer' },
          { label: 'Site Settings', href: '/admin/collections/site-settings' },
          { label: 'Connectors', href: '/admin/collections/connectors' },
          { label: 'Workflows', href: '/admin/collections/workflows' },
          { label: 'Contacts', href: '/admin/collections/contacts' },
        ].map((item) => (
          <a
            key={item.label}
            href={item.href}
            style={{
              display: 'block',
              padding: '8px 12px',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              textDecoration: 'none',
              color: 'inherit',
              fontSize: '13px',
              transition: 'background 150ms',
            }}
          >
            {item.label}
          </a>
        ))}
      </div>

      <ul className={`${baseClass}__instructions`}>
        <li>
          <SeedButton />
          {' with products, pages, and tenant data to get started, then '}
          <a href="/">visit your site</a>
          {' to see the results.'}
        </li>
        <li>
          {'Use the '}
          <a href="/dashboard">native dashboard</a>
          {' for LEO AI chat, spaces, events, and order management.'}
        </li>
        <li>
          {'Configure tenant branding, Stripe Connect, and AI settings in '}
          <a href="/admin/collections/tenants">Tenants</a>
          {'.'}
        </li>
      </ul>
    </div>
  )
}

/** Stat card — shows a count with LCARS-style accent */
function StatCard({ label, value, href, color }: { label: string; value: number; href: string; color: string }) {
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        padding: '12px 8px',
        border: `1px solid ${color}22`,
        borderRadius: '8px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 200ms, background 200ms',
        background: `${color}08`,
      }}
    >
      <span style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color }}>{value}</span>
      <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888' }}>{label}</span>
    </a>
  )
}

/** Quick action card */
function QuickCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '14px 16px',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 200ms, background 200ms',
      }}
    >
      <strong style={{ fontSize: '14px' }}>{title}</strong>
      <span style={{ fontSize: '12px', color: '#888' }}>{desc}</span>
    </a>
  )
}

/** Format a date string as relative time (e.g., "2h ago", "3d ago") */
function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const now = Date.now()
    const then = new Date(dateStr).getTime()
    const diffMs = now - then
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 30) return `${diffDays}d ago`
    return new Date(dateStr).toLocaleDateString()
  } catch {
    return ''
  }
}
