import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lightweight unit tests for the client singleton wiring.
 *
 * These tests do **not** require a real Postgres database or a generated
 * Prisma client: the generated client module is mocked so we can assert the
 * singleton/global-caching behaviour of `src/index.ts` in isolation.
 */

/** A minimal fake of the generated `PrismaClient` constructor. */
const constructed: Array<{ log?: unknown }> = [];

class FakePrismaClient {
  public readonly options: { log?: unknown };
  constructor(options: { log?: unknown } = {}) {
    this.options = options;
    constructed.push(options);
  }
}

// Mock the generated client BEFORE importing the module under test. The path
// must match the import specifier used in `src/index.ts`.
vi.mock("../generated/client/index.js", () => ({
  PrismaClient: FakePrismaClient,
}));

describe("@shipyard/db client singleton", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    constructed.length = 0;
    vi.resetModules();
    // Provide a DATABASE_URL so nothing complains about missing config.
    process.env.DATABASE_URL =
      "postgresql://shipyard:shipyard@localhost:5432/shipyard?schema=public";
    // Clear any cached global instance between tests.
    delete (globalThis as Record<string, unknown>).__shipyardPrisma__;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    delete (globalThis as Record<string, unknown>).__shipyardPrisma__;
  });

  it("constructs a Prisma client and exports it as `prisma`", async () => {
    const mod = await import("./index.js");
    expect(mod.prisma).toBeInstanceOf(FakePrismaClient);
    expect(constructed).toHaveLength(1);
  });

  it("exposes the same instance as the default export", async () => {
    const mod = await import("./index.js");
    expect(mod.default).toBe(mod.prisma);
  });

  it("caches the instance on globalThis in non-production", async () => {
    process.env.NODE_ENV = "development";
    const mod = await import("./index.js");
    expect((globalThis as Record<string, unknown>).__shipyardPrisma__).toBe(
      mod.prisma,
    );
  });

  it("does NOT cache on globalThis in production", async () => {
    process.env.NODE_ENV = "production";
    await import("./index.js");
    expect(
      (globalThis as Record<string, unknown>).__shipyardPrisma__,
    ).toBeUndefined();
  });

  it("reuses a pre-existing global instance instead of constructing a new one", async () => {
    process.env.NODE_ENV = "development";
    const existing = new FakePrismaClient({ log: ["warn"] });
    constructed.length = 0; // reset count after the manual construction
    (globalThis as Record<string, unknown>).__shipyardPrisma__ = existing;

    const mod = await import("./index.js");
    expect(mod.prisma).toBe(existing);
    // No new client should have been constructed.
    expect(constructed).toHaveLength(0);
  });

  it("honours PRISMA_LOG to configure log levels", async () => {
    process.env.PRISMA_LOG = "query, error";
    await import("./index.js");
    expect(constructed).toHaveLength(1);
    expect(constructed[0]?.log).toEqual(["query", "error"]);
  });

  it("defaults to a quiet log set in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.PRISMA_LOG;
    await import("./index.js");
    expect(constructed[0]?.log).toEqual(["warn", "error"]);
  });
});
