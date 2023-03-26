import path from 'node:path'
import { defineConfig } from 'vitest/config'

const alias = (p: string) => path.resolve(__dirname, p)

export default defineConfig({
  test: {
    coverage: {
      provider: 'c8', // or 'c8',
      reporter: ['text', 'json-summary', 'json', 'html'],
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/test/**',
      '**/docs/**',
      'vitest/utils.ts',
    ],
    include: [
      './vitest/**/*.test.ts',
    ],
    singleThread: true,
    hookTimeout: 61000,
    testTimeout: 190000,
  },
  resolve: {
    alias: {
      'supertokens-node': alias('./src/'),
      'overrideableBuilder': alias('./src/overrideableBuilder/'),
    },
  },
})