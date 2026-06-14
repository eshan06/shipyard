import type { Config } from 'prettier';

/**
 * Shared Prettier configuration for the Shipyard monorepo.
 *
 * Consumers re-export this from their own `.prettierrc.mjs` (or `prettier`
 * field) so that formatting stays consistent across every app and package:
 *
 * ```js
 * // .prettierrc.mjs
 * export { default } from '@shipyard/config/prettier';
 * ```
 *
 * House style:
 *  - `printWidth: 100`     — wide enough for typed signatures, narrow enough to diff
 *  - `singleQuote: true`   — single quotes for JS/TS string literals
 *  - `semi: true`          — always terminate statements with semicolons
 *  - `trailingComma: 'all'`— trailing commas everywhere ES5+ allows (cleaner diffs)
 */
const prettierConfig: Config = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  singleQuote: true,
  semi: true,
  trailingComma: 'all',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',
};

export default prettierConfig;
