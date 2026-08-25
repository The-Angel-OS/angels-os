import type { Block } from 'payload'

export const CoursePlayerBlock: Block = {
  slug: 'coursePlayer',
  interfaceName: 'CoursePlayerBlock',
  labels: { singular: 'Course player', plural: 'Course players' },
  fields: [
    {
      name: 'work',
      type: 'text',
      required: true,
      admin: {
        description:
          'Course slug — a Work of type "course". To sell it, put this block on a page the membership gating already covers.',
      },
    },
  ],
}
