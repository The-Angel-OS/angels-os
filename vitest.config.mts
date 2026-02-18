import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.test.tsx',
      'tests/int/**/*.int.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'src/utilities/**',
        'src/components/ChatControl/**',
        'src/components/Header/**',
        'src/endpoints/**',
      ],
      exclude: ['**/*.d.ts', '**/types.ts', '**/payload-types.ts'],
    },
    // Timeout for integration tests that boot Payload
    testTimeout: 30_000,
  },
})
