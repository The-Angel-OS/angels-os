import { Banner } from '@payloadcms/ui'
import React from 'react'

import { SeedButton } from './SeedButton'
import './index.scss'

const baseClass = 'before-dashboard'

/**
 * BeforeDashboard — Angel OS admin welcome widget.
 *
 * Shows quick action cards, collection links, and getting-started steps.
 * Registered via admin.components.beforeDashboard in payload.config.ts.
 */
export const BeforeDashboard: React.FC = () => {
  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Angel OS Command Center</h4>
      </Banner>

      <p style={{ marginBottom: '16px', fontSize: '14px', color: '#888' }}>
        Constitutional AI platform where everyone gets an Angel. Manage tenants, content,
        commerce, spaces, and federation from here.
      </p>

      {/* Quick action cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <QuickCard href="/dashboard" title="Dashboard" desc="LEO, spaces, CIC, bridge" />
        <QuickCard href="/admin/collections/pages" title="Pages" desc="Create landing pages" />
        <QuickCard href="/admin/collections/posts" title="Posts" desc="Publish blog posts" />
        <QuickCard href="/admin/collections/products" title="Products" desc="Product catalog" />
        <QuickCard href="/admin/collections/tenants" title="Tenants" desc="Multi-tenant management" />
        <QuickCard href="/" title="View Site" desc="Visit the frontend" />
      </div>

      {/* Collection quick links */}
      <h5 style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: '12px' }}>
        Collection Quick Links
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
