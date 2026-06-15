// ESLint v9 flat config for apps/web (Next.js dashboard).
//
// Extends the shared Shipyard base and layers on React Hooks correctness rules.
// `react-hooks/exhaustive-deps` is a warning (advisory; a few effects opt out
// with an inline disable), while `rules-of-hooks` stays an error since a
// violation is always a real bug.
import { createBaseConfig } from '@shipyard/config/eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...createBaseConfig({ ignores: ['**/.next/**'] }),
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
