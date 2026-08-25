import type { Block } from 'payload'

export const WorkQuizBlock: Block = {
  slug: 'workQuiz',
  interfaceName: 'WorkQuizBlock',
  labels: { singular: 'Quiz', plural: 'Quizzes' },
  fields: [
    {
      name: 'work',
      type: 'text',
      required: true,
      admin: { description: 'Work slug, e.g. "wdeg". Same slug as /learn/<work>.' },
    },
    {
      name: 'chapter',
      type: 'text',
      admin: {
        description:
          'Chapter slug. Leave blank to show every quiz in the work. The quiz itself is authored in the chapter as a ```quiz code block.',
      },
    },
  ],
}
