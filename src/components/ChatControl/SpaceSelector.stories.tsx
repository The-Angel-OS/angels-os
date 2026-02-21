import type { Meta, StoryObj } from '@storybook/react'
import { SpaceSelector } from './SpaceSelector'
import type { ChatSpace } from './types'

const sampleSpaces: ChatSpace[] = [
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
    name: 'Private Projects',
    slug: 'private-projects',
    description: 'Confidential project channels',
    visibility: 'private',
    isSystem: false,
  },
  {
    id: 'space-4',
    name: 'AI Bus',
    slug: 'ai-bus',
    description: 'System space for Guardian Angel communication',
    isSystem: true,
  },
]

const meta: Meta<typeof SpaceSelector> = {
  title: 'ChatControl/SpaceSelector',
  component: SpaceSelector,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 280, padding: 16, background: 'var(--background, #fff)' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    onSelect: { action: 'space-selected' },
  },
}

export default meta
type Story = StoryObj<typeof SpaceSelector>

/** Default state with multiple spaces */
export const Default: Story = {
  args: {
    spaces: sampleSpaces,
    activeSpaceId: 'space-1',
  },
}

/** Loading skeleton shown while spaces are being fetched */
export const Loading: Story = {
  args: {
    spaces: [],
    activeSpaceId: '',
    isLoading: true,
  },
}

/** Compact mode for collapsed sidebar — icon + chevron only */
export const Compact: Story = {
  args: {
    spaces: sampleSpaces,
    activeSpaceId: 'space-2',
    compact: true,
  },
}

/** When the user has no spaces available */
export const NoSpaces: Story = {
  args: {
    spaces: [],
    activeSpaceId: '',
  },
}

/** Single space — renders as static label, no dropdown */
export const SingleSpace: Story = {
  args: {
    spaces: [sampleSpaces[0]],
    activeSpaceId: 'space-1',
  },
}
