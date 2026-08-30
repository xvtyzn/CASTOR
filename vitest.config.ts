import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * Tests always resolve workspace packages to SOURCE, never to dist.
 *
 * Without these aliases the package `exports` maps point at ./dist, so a stale build from an
 * earlier `tsc -b` silently shadows the code under test — you fix a rule, the test keeps
 * failing, and nothing tells you why.
 */
const alias = {
  '@castor-bio/core': r('./packages/core/src/index.ts'),
  '@castor-bio/catalog': r('./packages/catalog/src/index.ts'),
  '@castor-bio/react': r('./packages/react/src/index.ts'),
  '@castor-bio/mui': r('./packages/mui/src/index.ts'),
}

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'core',
          environment: 'node',
          include: ['packages/{core,catalog,io}/**/*.test.ts', 'apps/playground/src/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'react',
          environment: 'jsdom',
          setupFiles: ['./packages/react/vitest.setup.ts'],
          include: ['packages/react/**/*.test.tsx'],
        },
      },
    ],
  },
})
