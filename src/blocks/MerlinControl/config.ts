import type { Block } from 'payload'

export const MerlinControl: Block = {
  slug: 'merlinControl',
  interfaceName: 'MerlinControlBlock',
  labels: { singular: 'Merlin Control', plural: 'Merlin Controls' },
  fields: [
    {
      name: 'endeavor',
      type: 'text',
      required: true,
      admin: {
        description:
          'Endeavor slug whose Merlin nodes this control lists (from node-ops/register).',
      },
    },
    {
      name: 'showNav',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          'Show the node selector rail. Turn off to pin the control to the first/only node.',
      },
    },
    {
      name: 'heading',
      type: 'text',
      admin: { description: 'Optional heading above the control.' },
    },
  ],
}
