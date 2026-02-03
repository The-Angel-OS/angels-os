import type { Block } from 'payload'

export const Comments: Block = {
  slug: 'comments',
  interfaceName: 'CommentsBlock',
  labels: {
    singular: 'Comments',
    plural: 'Comments',
  },
  fields: [
    {
      name: 'blockName',
      type: 'text',
      admin: {
        description: 'Optional label for this block in the editor',
      },
    },
    {
      name: 'heading',
      type: 'text',
      defaultValue: 'Comments',
      admin: {
        description: 'Heading displayed above the comments section',
      },
    },
  ],
}
