/**
 * ESLint configuration for @shipyard/core.
 *
 * Kept intentionally minimal and self-contained so the package lints in
 * isolation. The repo-wide shared preset (packages/config) can replace this
 * once it is published; until then this provides type-aware-free, fast linting.
 */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
  ignorePatterns: ["dist", "node_modules", "coverage", "*.config.ts", ".eslintrc.cjs"],
};
