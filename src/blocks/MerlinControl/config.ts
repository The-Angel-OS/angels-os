import type { Block } from 'payload'

export const MerlinControl: Block = {
  slug: 'merlinControl',
  interfaceName: 'MerlinControlBlock',
  labels: { singular: 'Merlin Control', plural: 'Merlin Controls' },
  fields: [
    {
      name: 'endeavor',
      type: 'text',
      admin: {
        description:
          'OPTIONAL override. Leave blank to use THIS page’s own endeavor (a Merlin can only ever belong to its own endeavor). Set a slug only to surface a different endeavor’s Merlin nodes (from node-ops/register).',
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
