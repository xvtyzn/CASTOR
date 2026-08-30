import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/compare/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  // React must never be bundled into a component library.
  deps: { neverBundle: ['react', 'react-dom', 'react/jsx-runtime'] },
})
