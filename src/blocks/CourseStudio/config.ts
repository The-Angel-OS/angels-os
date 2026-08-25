import type { Block } from 'payload'

export const CourseStudioBlock: Block = {
  slug: 'courseStudio',
  interfaceName: 'CourseStudioBlock',
  labels: { singular: 'Course studio', plural: 'Course studios' },
  fields: [
    {
      name: 'work',
      type: 'text',
      required: true,
      admin: { description: 'Course slug to author. Only the owning endeavor’s managers can save.' },
    },
  ],
}
