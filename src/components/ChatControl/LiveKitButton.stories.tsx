import type { Meta, StoryObj } from '@storybook/react'
import { LiveKitButton } from './LiveKitButton'

const meta: Meta<typeof LiveKitButton> = {
  title: 'ChatControl/LiveKitButton',
  component: LiveKitButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof LiveKitButton>

/**
 * Idle state — headphones icon with "Voice" label.
 * Clicking would normally fetch a LiveKit token from the API.
 */
export const Idle: Story = {
  args: {
    spaceId: 'space-1',
    channelSlug: 'general',
  },
}

/**
 * Different channel context — same idle appearance but
 * scoped to a different space/channel combination.
 */
export const DifferentChannel: Story = {
  args: {
    spaceId: 'space-2',
    channelSlug: 'standup',
  },
}
