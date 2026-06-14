# @shipyard/config

Shared developer-tooling presets for the Shipyard monorepo: TypeScript configs,
an ESLint v9 flat-config preset, and a Prettier config.

## tsconfig presets

Extend a preset from any package's `tsconfig.json`:

```jsonc
{
  // Node service / library
  "extends": "@shipyard/config/tsconfig/node",
}
```

| Preset                            | Use for                          |
| --------------------------------- | -------------------------------- |
| `@shipyard/config/tsconfig/base`  | Generic library code             |
| `@shipyard/config/tsconfig/node`  | `apps/api`, `apps/worker`, libs  |
| `@shipyard/config/tsconfig/nextjs`| `apps/web` (Next.js dashboard)   |

## ESLint

`eslint.config.mjs`:

```js
import { createNodeConfig } from '@shipyard/config/eslint';
export default createNodeConfig();
```

Factories:

- `createBaseConfig(options?)` — shared base (JS + typed TS + import order + Prettier shim).
- `createNodeConfig(options?)` — base + Node globals, `no-console` off.
- `createReactConfig(options?)` — base + browser globals + JSX parsing.

`options`: `{ ignores?: string[]; prettier?: boolean }`.

## Prettier

`.prettierrc.mjs`:

```js
export { default } from '@shipyard/config/prettier';
```

House style: `printWidth: 100`, single quotes, semicolons, trailing commas `all`.
