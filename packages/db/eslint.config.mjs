// ESLint v9 flat config for @shipyard/db.
//
// This is a Node-targeted package (Prisma client + seed script), so we use the
// shared Node preset which enables Node globals and relaxes `no-console`
// (the seed logs progress to stdout by design). Prisma's machine-generated
// client under `generated/` is ignored by the shared base config.
import { createNodeConfig } from '@shipyard/config/eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [...createNodeConfig()];
