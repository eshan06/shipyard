import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for `@shipyard/config`.
 *
 * Tests exercise the ESLint flat-config factory and the Prettier preset as
 * plain data structures (no real linting run), so a Node environment with the
 * default settings is sufficient.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
