import type { Meta, StoryObj } from '@storybook/react'
import { ChannelSettingsPanel } from './ChannelSettingsPanel'
import type { ChatChannel } from './types'

const generalChannel: ChatChannel = {
  id: 'ch-1',
  name: 'general',
  slug: 'general',
  description: 'Main discussion channel for the community',
  type: 'general',
  spaceId: 'space-1',
  isDefault: true,
}

const supportChannel: ChatChannel = {
  id: 'ch-2',
  name: 'support',
  slug: 'support',
  description: 'Customer support conversations',
  type: 'support',
  spaceId: 'space-1',
  isDefault: false,
}

const meta: Meta<typeof ChannelSettingsPanel> = {
  title: 'ChatControl/ChannelSettingsPanel',
  component: ChannelSettingsPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    onClose: { action: 'close' },
    onSaved: { action: 'saved' },
  },
}

export default meta
type Story = StoryObj<typeof ChannelSettingsPanel>

/** Panel open with a general (default) channel */
export const Open: Story = {
  args: {
    channel: generalChannel,
    isOpen: true,
  },
}

/** Panel closed — renders nothing */
export const Closed: Story = {
  args: {
    channel: generalChannel,
    isOpen: false,
  },
}

/** Default channel indicator shown */
export const DefaultChannel: Story = {
  args: {
    channel: generalChannel,
    isOpen: true,
  },
}

/** Support channel — different type selected */
export const SupportChannel: Story = {
  args: {
    channel: supportChannel,
    isOpen: true,
  },
}
