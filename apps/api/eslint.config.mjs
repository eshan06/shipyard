// ESLint flat config for @shipyard/api (Node service).
import { createNodeConfig } from "@shipyard/config/eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [...createNodeConfig({ ignores: ["**/.turbo/**"] })];
