import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { DashboardHeader } from './DashboardHeader'
import { DashboardProvider } from '@/providers/DashboardContext'
import type { DashboardSpace } from '@/providers/DashboardContext'

const sampleSpaces: DashboardSpace[] = [
  {
    id: 'space-1',
    name: 'Community',
    slug: 'community',
    description: 'Public community space',
    visibility: 'public',
    isSystem: false,
  },
  {
    id: 'space-2',
    name: 'Team',
    slug: 'team',
    description: 'Internal team discussions',
    visibility: 'invite_only',
    isSystem: false,
  },
  {
    id: 'space-3',
    name: 'AI Bus',
    slug: 'ai-bus',
    description: 'Guardian Angel communication bus',
    isSystem: true,
  },
]

/** Wrap story in DashboardProvider with given spaces */
function withDashboard(spaces: DashboardSpace[]) {
  return function Decorator(Story: React.ComponentType) {
    return (
      <DashboardProvider initialSpaces={spaces} defaultSpaceId={spaces[0]?.id}>
        <Story />
      </DashboardProvider>
    )
  }
}

const meta: Meta<typeof DashboardHeader> = {
  title: 'Dashboard/DashboardHeader',
  component: DashboardHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [withDashboard(sampleSpaces)],
}

export default meta
type Story = StoryObj<typeof DashboardHeader>

/** Default header with space selector and user name */
export const Default: Story = {
  args: {
    prefix: '/en',
    userName: 'Kenneth',
  },
}

/** Header when no spaces exist — shows plain "Dashboard" heading */
export const NoSpaces: Story = {
  args: {
    prefix: '/en',
    userName: 'New User',
  },
  decorators: [withDashboard([])],
}

/** Header with a long username */
export const LongUserName: Story = {
  args: {
    prefix: '/en',
    userName: 'Joshua Kenneth Consort of the Fifth Element',
  },
}
