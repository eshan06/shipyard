/**
 * `@shipyard/core` — shared domain library.
 *
 * Re-exports the package's public surface: zod schemas + DTO types, status
 * state machines, AES-256-GCM secret crypto, the typed error hierarchy, the
 * `Result` helpers, id/slug utilities, and cost computation.
 *
 * @packageDocumentation
 */

export * from "./result.js";
export * from "./errors.js";
export * from "./crypto.js";
export * from "./ids.js";
export * from "./cost.js";
export * from "./status.js";
export * from "./jobs.js";
export * from "./schemas/index.js";
