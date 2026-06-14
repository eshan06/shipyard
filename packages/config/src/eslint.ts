import eslintJs from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
// eslint-plugin-import does not ship its own flat-config types; the runtime
// export is a CommonJS object that is interop-imported here as the default.
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import type { Linter } from 'eslint';

/**
 * A single flat-config block, as consumed by ESLint v9.
 *
 * We intentionally type this as `Linter.Config` (the public flat-config shape)
 * rather than reaching into plugin-specific config types, so the array can be
 * spread directly into a downstream `eslint.config.mjs` without friction.
 */
export type FlatConfig = Linter.Config;

/** File globs that every variant lints. */
const TS_GLOBS = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'] as const;

/** Build artifacts and vendored output that should never be linted. */
const DEFAULT_IGNORES = [
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/out/**',
  '**/coverage/**',
  '**/node_modules/**',
  '**/*.tsbuildinfo',
  // Prisma's generated client is machine-authored and not worth linting.
  '**/generated/**',
] as const;

/**
 * Options accepted by {@link createBaseConfig} and its variants.
 */
export interface ConfigOptions {
  /**
   * Additional ignore globs merged with the built-in {@link DEFAULT_IGNORES}.
   * Use this for app-specific generated folders (e.g. `.turbo`, `storybook-static`).
   */
  readonly ignores?: readonly string[];
  /**
   * When `true` (the default) the returned array ends with
   * `eslint-config-prettier`, disabling stylistic rules that would conflict
   * with Prettier. Set to `false` only if you run ESLint without Prettier.
   */
  readonly prettier?: boolean;
}

/**
 * Rules shared by every Shipyard package, regardless of runtime target.
 *
 * The set is deliberately opinionated but small:
 *  - `no-unused-vars` is delegated to the typescript-eslint variant, configured
 *    to allow intentionally-unused names prefixed with `_` and to flag unused
 *    caught errors (`caughtErrors: 'all'`).
 *  - `import/order` enforces a stable, grouped, alphabetised import ordering so
 *    diffs stay clean and merge conflicts in import blocks are minimised.
 *  - A handful of correctness rules (`no-console` as a warning, `eqeqeq`,
 *    `no-implicit-coercion`) catch common foot-guns without being noisy.
 */
const SHARED_RULES: Linter.RulesRecord = {
  // Defer to the type-aware rule; the core rule double-reports.
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      args: 'after-used',
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrors: 'all',
      caughtErrorsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    },
  ],
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
  ],
  '@typescript-eslint/no-import-type-side-effects': 'error',
  'import/order': [
    'error',
    {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true },
      pathGroups: [{ pattern: '@shipyard/**', group: 'internal', position: 'before' }],
      pathGroupsExcludedImportTypes: ['type'],
    },
  ],
  'import/no-duplicates': 'error',
  'import/first': 'error',
  'import/newline-after-import': 'error',
  'no-console': 'warn',
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-implicit-coercion': 'error',
  'no-var': 'error',
  'prefer-const': ['error', { destructuring: 'all' }],
  'object-shorthand': ['error', 'always'],
};

/**
 * Resolve the merged ignore list for a config invocation.
 *
 * @internal
 */
function resolveIgnores(extra?: readonly string[]): string[] {
  return [...DEFAULT_IGNORES, ...(extra ?? [])];
}

/**
 * The shared `import` plugin flat-config block, including the resolver settings
 * required for TypeScript path/extension resolution.
 *
 * @internal
 */
function importPluginConfig(): FlatConfig {
  return {
    name: 'shipyard/import',
    files: [...TS_GLOBS],
    plugins: {
      // The plugin's runtime shape is broader than the flat-config plugin type;
      // this cast is the documented interop for eslint-plugin-import under v9.
      import: importPlugin as unknown as NonNullable<FlatConfig['plugins']>[string],
    },
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true },
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'] },
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'],
      },
    },
  };
}

/**
 * Create the base flat-config array shared by every Shipyard package.
 *
 * The returned array is ordered so that later blocks override earlier ones:
 * recommended JS rules → recommended typed-aware TS rules → import plugin →
 * Shipyard house rules → (optionally) Prettier compatibility shim.
 *
 * @param options - {@link ConfigOptions} to tune ignores and Prettier behaviour.
 * @returns A flat-config array ready to spread into `eslint.config.mjs`.
 *
 * @example
 * ```js
 * import { createBaseConfig } from '@shipyard/config/eslint';
 * export default createBaseConfig();
 * ```
 */
export function createBaseConfig(options: ConfigOptions = {}): FlatConfig[] {
  const { prettier = true, ignores } = options;

  const config: FlatConfig[] = [
    { name: 'shipyard/ignores', ignores: resolveIgnores(ignores) },
    eslintJs.configs.recommended as FlatConfig,
    ...(tseslint.configs.recommended as FlatConfig[]),
    importPluginConfig(),
    {
      name: 'shipyard/base',
      files: [...TS_GLOBS],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      rules: SHARED_RULES,
    },
  ];

  if (prettier) {
    config.push({ name: 'shipyard/prettier', ...(prettierConfig as FlatConfig) });
  }

  return config;
}

/**
 * Node-flavoured variant of the base config.
 *
 * Adds Node global definitions and relaxes `no-console` (servers and CLIs log to
 * stdout/stderr by design). Use this for `apps/api`, `apps/worker`, and any
 * `packages/*` that runs under Node.
 *
 * @param options - {@link ConfigOptions} forwarded to {@link createBaseConfig}.
 * @returns A flat-config array for Node targets.
 */
export function createNodeConfig(options: ConfigOptions = {}): FlatConfig[] {
  return [
    ...createBaseConfig(options),
    {
      name: 'shipyard/node',
      files: [...TS_GLOBS, '**/*.js', '**/*.mjs', '**/*.cjs'],
      languageOptions: {
        globals: { ...globals.node },
      },
      rules: {
        'no-console': 'off',
      },
    },
  ];
}

/**
 * React/Next.js-flavoured variant of the base config.
 *
 * Adds browser globals and configures JSX-aware parsing. React-plugin rule sets
 * are intentionally left to the consuming app (Next.js ships its own plugin
 * wiring); this variant only provides the language environment so the base
 * rules apply correctly to `.tsx` files.
 *
 * @param options - {@link ConfigOptions} forwarded to {@link createBaseConfig}.
 * @returns A flat-config array for React/Next.js targets.
 */
export function createReactConfig(options: ConfigOptions = {}): FlatConfig[] {
  return [
    ...createBaseConfig(options),
    {
      name: 'shipyard/react',
      files: ['**/*.tsx', '**/*.jsx'],
      languageOptions: {
        globals: { ...globals.browser, ...globals.serviceworker },
        parserOptions: {
          ecmaFeatures: { jsx: true },
        },
      },
      settings: {
        react: { version: 'detect' },
      },
    },
  ];
}

/**
 * Default export: the base config factory.
 *
 * Exporting the factory (rather than a pre-built array) lets each consumer pass
 * package-specific ignores while still getting a sensible zero-config default
 * via `createBaseConfig()`.
 */
export default createBaseConfig;
