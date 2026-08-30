import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/compare/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  copy: [
    { from: 'src/styles/castor.css', to: 'dist', rename: 'styles.css' },
    { from: 'src/styles/styles.css.d.ts', to: 'dist', rename: 'styles.css.d.mts' },
    { from: 'src/styles/styles.css.d.ts', to: 'dist', rename: 'styles.css.d.cts' },
  ],
  publint: true,
  attw: true,
  // React must never be bundled into a component library.
  deps: { neverBundle: ['react', 'react-dom', 'react/jsx-runtime'] },
})
