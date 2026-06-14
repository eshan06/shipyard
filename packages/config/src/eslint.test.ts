import { describe, expect, it } from 'vitest';

import {
  createBaseConfig,
  createNodeConfig,
  createReactConfig,
  type FlatConfig,
} from './eslint.js';
import prettierConfig from './prettier.js';

/**
 * Find the first config block whose `name` matches.
 * Flat configs are plain objects, so this is the cleanest way to assert on a
 * specific block without relying on positional indices.
 */
function block(config: FlatConfig[], name: string): FlatConfig {
  const found = config.find((c) => c.name === name);
  if (!found) {
    throw new Error(`expected a config block named "${name}"`);
  }
  return found;
}

describe('createBaseConfig', () => {
  it('returns a non-empty flat-config array', () => {
    const config = createBaseConfig();
    expect(Array.isArray(config)).toBe(true);
    expect(config.length).toBeGreaterThan(0);
  });

  it('places an ignores block first with the default build outputs', () => {
    const config = createBaseConfig();
    const ignores = config[0];
    expect(ignores?.name).toBe('shipyard/ignores');
    expect(ignores?.ignores).toContain('**/dist/**');
    expect(ignores?.ignores).toContain('**/node_modules/**');
    expect(ignores?.ignores).toContain('**/generated/**');
  });

  it('merges caller-supplied ignores with the defaults', () => {
    const config = createBaseConfig({ ignores: ['**/.turbo/**'] });
    const ignores = block(config, 'shipyard/ignores');
    expect(ignores.ignores).toContain('**/.turbo/**');
    // Defaults are preserved alongside the extras.
    expect(ignores.ignores).toContain('**/dist/**');
  });

  it('configures type-aware no-unused-vars to ignore underscore + caught errors', () => {
    const base = block(createBaseConfig(), 'shipyard/base');
    const rule = base.rules?.['@typescript-eslint/no-unused-vars'];
    expect(Array.isArray(rule)).toBe(true);
    const [severity, opts] = rule as [string, Record<string, unknown>];
    expect(severity).toBe('error');
    expect(opts.argsIgnorePattern).toBe('^_');
    expect(opts.caughtErrors).toBe('all');
    expect(opts.caughtErrorsIgnorePattern).toBe('^_');
    // The core rule must be disabled so it does not double-report.
    expect(base.rules?.['no-unused-vars']).toBe('off');
  });

  it('enforces grouped, alphabetised import ordering', () => {
    const base = block(createBaseConfig(), 'shipyard/base');
    const rule = base.rules?.['import/order'];
    expect(Array.isArray(rule)).toBe(true);
    const [severity, opts] = rule as [string, Record<string, unknown>];
    expect(severity).toBe('error');
    expect(opts['newlines-between']).toBe('always');
    expect(opts.alphabetize).toMatchObject({ order: 'asc', caseInsensitive: true });
  });

  it('appends the prettier compatibility block by default', () => {
    const config = createBaseConfig();
    expect(config.at(-1)?.name).toBe('shipyard/prettier');
  });

  it('omits the prettier block when prettier is disabled', () => {
    const config = createBaseConfig({ prettier: false });
    expect(config.some((c) => c.name === 'shipyard/prettier')).toBe(false);
  });

  it('registers the import plugin with a typescript resolver', () => {
    const importBlock = block(createBaseConfig(), 'shipyard/import');
    expect(importBlock.plugins).toHaveProperty('import');
    const resolver = (importBlock.settings?.['import/resolver'] ?? {}) as Record<string, unknown>;
    expect(resolver).toHaveProperty('typescript');
  });
});

describe('createNodeConfig', () => {
  it('extends the base config and adds a node block', () => {
    const config = createNodeConfig();
    const node = block(config, 'shipyard/node');
    expect(node.languageOptions?.globals).toHaveProperty('process');
    // Servers/CLIs are allowed to log.
    expect(node.rules?.['no-console']).toBe('off');
  });

  it('still includes the base rules block', () => {
    expect(() => block(createNodeConfig(), 'shipyard/base')).not.toThrow();
  });
});

describe('createReactConfig', () => {
  it('extends the base config and adds a react block with browser globals', () => {
    const config = createReactConfig();
    const react = block(config, 'shipyard/react');
    expect(react.languageOptions?.globals).toHaveProperty('window');
    expect(react.languageOptions?.globals).toHaveProperty('document');
    const parserOptions = react.languageOptions?.parserOptions as
      | { ecmaFeatures?: { jsx?: boolean } }
      | undefined;
    expect(parserOptions?.ecmaFeatures?.jsx).toBe(true);
  });

  it('targets only jsx/tsx files', () => {
    const react = block(createReactConfig(), 'shipyard/react');
    expect(react.files).toEqual(['**/*.tsx', '**/*.jsx']);
  });
});

describe('prettierConfig', () => {
  it('matches the house style contract', () => {
    expect(prettierConfig).toMatchObject({
      printWidth: 100,
      singleQuote: true,
      semi: true,
      trailingComma: 'all',
    });
  });
});
