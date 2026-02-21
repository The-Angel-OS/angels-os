import type { Preview } from '@storybook/react'
import '../src/app/[locale]/(app)/globals.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/en/dashboard',
      },
    },
  },
}

export default preview
