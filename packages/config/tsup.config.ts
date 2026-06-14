import { defineConfig } from 'tsup';

/**
 * Build configuration for `@shipyard/config`.
 *
 * The package ships three runtime entry points (re-exported via the package
 * `exports` map):
 *  - `index`    — aggregate export of the eslint + prettier presets
 *  - `eslint`   — flat-config preset factory + named variants
 *  - `prettier` — shared Prettier options object
 *
 * The tsconfig JSON presets are NOT built; they are shipped verbatim from the
 * `tsconfig/` directory and exposed directly through the `./tsconfig/*` export.
 */
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    eslint: 'src/eslint.ts',
    prettier: 'src/prettier.ts',
  },
  format: ['esm'],
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
});
