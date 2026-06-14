// ESLint flat config for @shipyard/worker (Node service).
import { createNodeConfig } from "@shipyard/config/eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [...createNodeConfig({ ignores: ["**/.turbo/**"] })];
