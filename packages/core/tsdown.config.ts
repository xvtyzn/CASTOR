import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/compare/index.ts', 'src/validate/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  publint: true,
  attw: true,
})
