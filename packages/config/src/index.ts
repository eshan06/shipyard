/**
 * `@shipyard/config` — shared dev-tooling presets for the Shipyard monorepo.
 *
 * This is the aggregate entry point. Most consumers should import the specific
 * sub-path instead, which keeps tree-shaking and intent crisp:
 *
 *  - ESLint flat config:  `@shipyard/config/eslint`
 *  - Prettier config:     `@shipyard/config/prettier`
 *  - tsconfig presets:    `@shipyard/config/tsconfig/{base,node,nextjs}`
 *
 * @packageDocumentation
 */

export {
  createBaseConfig,
  createNodeConfig,
  createReactConfig,
  type ConfigOptions,
  type FlatConfig,
} from './eslint.js';

export { default as prettierConfig } from './prettier.js';
