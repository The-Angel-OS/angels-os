import { Banner } from '@payloadcms/ui'
import React from 'react'

import { SeedButton } from './SeedButton'
import './index.scss'

const baseClass = 'before-dashboard'

export const BeforeDashboard: React.FC = () => {
  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Welcome to Angel OS</h4>
      </Banner>

      <p style={{ marginBottom: '16px', fontSize: '14px', color: '#666' }}>
        Constitutional AI platform where everyone gets an Angel. Manage your tenants, products,
        spaces, and LEO AI agents from this admin panel.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <a
          href="/"
          style={{ display: 'block', padding: '12px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', textDecoration: 'none', color: 'inherit' }}
        >
          <strong>View Site</strong>
          <br />
          <span style={{ fontSize: '12px', color: '#888' }}>Visit the public frontend</span>
        </a>
        <a
          href="/en/dashboard"
          style={{ display: 'block', padding: '12px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', textDecoration: 'none', color: 'inherit' }}
        >
          <strong>Dashboard</strong>
          <br />
          <span style={{ fontSize: '12px', color: '#888' }}>Native dashboard with LEO chat</span>
        </a>
        <a
          href="/admin/collections/products"
          style={{ display: 'block', padding: '12px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', textDecoration: 'none', color: 'inherit' }}
        >
          <strong>Products</strong>
          <br />
          <span style={{ fontSize: '12px', color: '#888' }}>Manage your product catalog</span>
        </a>
        <a
          href="/admin/collections/tenants"
          style={{ display: 'block', padding: '12px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', textDecoration: 'none', color: 'inherit' }}
        >
          <strong>Tenants</strong>
          <br />
          <span style={{ fontSize: '12px', color: '#888' }}>Multi-tenant management</span>
        </a>
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
          <a href="/en/dashboard">native dashboard</a>
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
