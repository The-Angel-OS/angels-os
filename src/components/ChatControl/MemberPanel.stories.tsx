import type { Meta, StoryObj } from '@storybook/react'
import { MemberPanel } from './MemberPanel'

const meta: Meta<typeof MemberPanel> = {
  title: 'ChatControl/MemberPanel',
  component: MemberPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    onClose: { action: 'close' },
  },
}

export default meta
type Story = StoryObj<typeof MemberPanel>

/**
 * Admin view — shows invite button and full member management.
 * Note: In Storybook the API calls won't connect, so the panel shows
 * the loading skeleton followed by the empty state.
 */
export const AdminView: Story = {
  args: {
    spaceId: 1,
    isOpen: true,
    currentUserRole: 'space_admin',
  },
}

/** Regular member view — no invite button */
export const MemberView: Story = {
  args: {
    spaceId: 1,
    isOpen: true,
    currentUserRole: 'member',
  },
}

/** Panel closed — renders nothing */
export const Closed: Story = {
  args: {
    spaceId: 1,
    isOpen: false,
    currentUserRole: 'member',
  },
}

/** Guest role — read-only access */
export const GuestView: Story = {
  args: {
    spaceId: 1,
    isOpen: true,
    currentUserRole: 'guest',
  },
}
