// Root ESLint v9 flat config for the Shipyard monorepo.
//
// Each app/package may add its own `eslint.config.mjs` for framework-specific
// rules (e.g. Next.js in apps/web). This root config provides the shared base
// that applies across the workspace when ESLint is run from the repo root.
import { createBaseConfig } from '@shipyard/config/eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...createBaseConfig({
    ignores: ['**/.turbo/**', '**/storybook-static/**', '**/.next/**'],
  }),
];
