/**
 * Ambient module declarations for dependencies that do not ship their own
 * TypeScript types.
 *
 * `eslint-config-prettier` (v9) is published as plain CommonJS with no bundled
 * declarations and no `@types/eslint-config-prettier` package. Its default
 * export is an ESLint flat-config-compatible object (a set of rule overrides),
 * which we consume as a {@link import('eslint').Linter.Config}. Declaring it
 * here keeps the package buildable under `strict` / `noImplicitAny` without
 * resorting to an `any` cast at the import site.
 */
declare module 'eslint-config-prettier' {
  import type { Linter } from 'eslint';

  /** The flat-config rule-disabling preset exported by eslint-config-prettier. */
  const config: Linter.Config;
  export default config;
}
