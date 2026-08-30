import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Develop against source, not dist, so a stale build can never shadow what you are editing.
    alias: {
      // The CSS alias must come first: Vite matches these in order, and the bare package
      // specifier would otherwise swallow the stylesheet subpath.
      '@castor-bio/react/styles.css': r('../../packages/react/src/styles/castor.css'),
      '@castor-bio/react': r('../../packages/react/src/index.ts'),
      '@castor-bio/core': r('../../packages/core/src/index.ts'),
      '@castor-bio/catalog': r('../../packages/catalog/src/index.ts'),
      '@castor-bio/mui': r('../../packages/mui/src/index.ts'),
    },
  },
  server: { port: 5178 },
})
