import type { Meta, StoryObj } from '@storybook/react'
import { DashboardSidebar } from './DashboardSidebar'

const meta: Meta<typeof DashboardSidebar> = {
  title: 'Dashboard/DashboardSidebar',
  component: DashboardSidebar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      navigation: {
        pathname: '/en/dashboard',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', height: '100vh' }}>
        <Story />
        <div style={{ flex: 1, padding: 24, background: 'var(--background, #f5f5f5)' }}>
          <p style={{ color: 'var(--muted-foreground, #666)' }}>Main content area</p>
        </div>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof DashboardSidebar>

/** Admin with full navigation — expanded sidebar with tenant branding */
export const AdminExpanded: Story = {
  args: {
    prefix: '/en',
    isAdmin: true,
    isBusinessOwner: true,
    userName: 'Kenneth',
    userEmail: 'kenneth@angelos.local',
    userInitials: 'KD',
    tenantBranding: {
      siteName: 'Dev Dashboard',
      logoUrl: null,
      primaryColor: '#6366F1',
    },
  },
}

/** Regular member view — no admin or business owner sections */
export const MemberView: Story = {
  args: {
    prefix: '/en',
    isAdmin: false,
    isBusinessOwner: false,
    userName: 'Guest User',
    userEmail: 'guest@example.com',
    userInitials: 'GU',
    tenantBranding: {
      siteName: 'Community Hub',
      logoUrl: null,
      primaryColor: '#10B981',
    },
  },
}

/** Business owner without admin — sees business ops but not admin section */
export const BusinessOwner: Story = {
  args: {
    prefix: '/en',
    isAdmin: false,
    isBusinessOwner: true,
    userName: 'Joshua',
    userEmail: 'joshua@massage.studio',
    userInitials: 'JD',
    tenantBranding: {
      siteName: 'Healing Hands Studio',
      logoUrl: null,
      primaryColor: '#F59E0B',
    },
  },
}

/** Default Angel OS branding — no tenant branding provided */
export const DefaultBranding: Story = {
  args: {
    prefix: '/en',
    isAdmin: true,
    isBusinessOwner: true,
    userName: 'Admin',
    userEmail: 'admin@angelos.co',
    userInitials: 'AO',
    tenantBranding: null,
  },
}
