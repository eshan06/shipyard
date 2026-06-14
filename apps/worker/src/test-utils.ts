/**
 * Shared test helpers: a hand-written in-memory Prisma double and a recording
 * {@link EventPublisher}, so worker logic can be exercised against the real
 * {@link MockOrchestrator} with no database, redis, or Docker.
 *
 * The fake Prisma only implements the handful of model methods the workers
 * actually call (see the README of methods in the worker sources) and is cast
 * `as unknown as PrismaClient` at the boundary. It is intentionally small and
 * explicit rather than a general-purpose ORM emulation.
 *
 * @module
 */

import { pino, type Logger } from "pino";

import type {
  EventPublisher,
  LogEventInput,
  PreviewStatusEventInput,
} from "./events.js";
import type { PrismaClient } from "@shipyard/db";

/** A row in the fake store: any object with a string `id`. */
export type Row = Record<string, unknown> & { id: string };

/** Seed data for {@link createFakePrisma}. */
export interface FakeData {
  deployments?: Row[];
  previews?: Row[];
  projects?: Row[];
  builds?: Row[];
  services?: Row[];
  logChunks?: Row[];
  users?: Row[];
  pullRequests?: Row[];
  seedTemplates?: Row[];
  notifications?: Row[];
  costRecords?: Row[];
  teams?: Row[];
  memberships?: Row[];
}

/** The fake Prisma + direct access to its backing tables for assertions. */
export interface FakePrisma {
  /** The client to inject (typed as a real {@link PrismaClient}). */
  client: PrismaClient;
  /** The backing tables, for direct read/assert in tests. */
  tables: Required<FakeData>;
}

/** A silent logger for tests (no transport, level fatal). */
export function testLogger(): Logger {
  return pino({ level: "silent" });
}

/** A recording {@link EventPublisher} that captures every emitted event. */
export interface RecordingEvents extends EventPublisher {
  /** Every {@link LogEventInput} passed to `log`, in order. */
  logs: LogEventInput[];
  /** Every {@link PreviewStatusEventInput} passed to `previewStatus`. */
  statuses: PreviewStatusEventInput[];
}

/** Build a {@link RecordingEvents} double. */
export function recordingEvents(): RecordingEvents {
  const logs: LogEventInput[] = [];
  const statuses: PreviewStatusEventInput[] = [];
  let seq = 0;
  return {
    logs,
    statuses,
    async log(event: LogEventInput): Promise<number> {
      logs.push(event);
      return seq++;
    },
    async previewStatus(event: PreviewStatusEventInput): Promise<void> {
      statuses.push(event);
    },
  };
}

/**
 * Shallow-clone a row so stored rows are not aliased by callers, while
 * preserving non-JSON values (notably `Date`) that a `JSON` round-trip drops.
 */
function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => clone(v)) as unknown as T;
  if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
  if (value && typeof value === "object") {
    return { ...(value as Record<string, unknown>) } as T;
  }
  return value;
}

/**
 * Construct a minimal in-memory Prisma double covering the model methods the
 * deploy/destroy/cleanup/cost workers use.
 *
 * @param data - Optional seed rows for each table.
 * @returns A {@link FakePrisma}.
 */
export function createFakePrisma(data: FakeData = {}): FakePrisma {
  const tables: Required<FakeData> = {
    deployments: data.deployments ?? [],
    previews: data.previews ?? [],
    projects: data.projects ?? [],
    builds: data.builds ?? [],
    services: data.services ?? [],
    logChunks: data.logChunks ?? [],
    users: data.users ?? [],
    pullRequests: data.pullRequests ?? [],
    seedTemplates: data.seedTemplates ?? [],
    notifications: data.notifications ?? [],
    costRecords: data.costRecords ?? [],
    teams: data.teams ?? [],
    memberships: data.memberships ?? [],
  };

  /** Resolve a `where` clause to a single row (supports `{ id }` lookups). */
  const findById = (rows: Row[], where: { id?: string }): Row | undefined =>
    where.id != null ? rows.find((r) => r.id === where.id) : undefined;

  const applySelect = (row: Row | undefined, args: { select?: Record<string, unknown> }): unknown => {
    if (!row) return null;
    if (!args.select) return clone(row);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(args.select)) {
      out[key] = clone(row[key]);
    }
    return out;
  };

  const client = {
    deployment: {
      findUnique: async (args: { where: { id: string }; select?: Record<string, unknown> }) =>
        applySelect(findById(tables.deployments, args.where), args),
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = findById(tables.deployments, args.where);
        if (row) Object.assign(row, args.data);
        return clone(row);
      },
    },
    preview: {
      findUnique: async (args: { where: { id: string }; select?: Record<string, unknown> }) =>
        applySelect(findById(tables.previews, args.where), args),
      findMany: async (_args?: unknown) => tables.previews.map(clone),
      update: async (args: { where: { id: string }; data: Record<string, unknown>; select?: Record<string, unknown> }) => {
        const row = findById(tables.previews, args.where);
        if (row) Object.assign(row, args.data);
        return applySelect(row, args ?? {});
      },
    },
    project: {
      findUnique: async (args: { where: { id: string }; select?: Record<string, unknown> }) =>
        applySelect(findById(tables.projects, args.where), args),
    },
    build: {
      upsert: async (args: {
        where: { deploymentId: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const existing = tables.builds.find((b) => b.deploymentId === args.where.deploymentId);
        if (existing) {
          Object.assign(existing, args.update);
          return clone(existing);
        }
        const row: Row = { id: `build-${tables.builds.length + 1}`, ...args.create };
        tables.builds.push(row);
        return clone(row);
      },
      update: async (args: { where: { deploymentId: string }; data: Record<string, unknown> }) => {
        const row = tables.builds.find((b) => b.deploymentId === args.where.deploymentId);
        if (row) Object.assign(row, args.data);
        return clone(row);
      },
      updateMany: async (args: { where: { deploymentId: string }; data: Record<string, unknown> }) => {
        let count = 0;
        for (const b of tables.builds) {
          if (b.deploymentId === args.where.deploymentId) {
            Object.assign(b, args.data);
            count++;
          }
        }
        return { count };
      },
    },
    service: {
      upsert: async (args: {
        where: { previewId_name: { previewId: string; name: string } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const { previewId, name } = args.where.previewId_name;
        const existing = tables.services.find(
          (s) => s.previewId === previewId && s.name === name,
        );
        if (existing) {
          Object.assign(existing, args.update);
          return clone(existing);
        }
        const row: Row = { id: `svc-${tables.services.length + 1}`, ...args.create };
        tables.services.push(row);
        return clone(row);
      },
      updateMany: async (args: { where: { previewId: string }; data: Record<string, unknown> }) => {
        let count = 0;
        for (const s of tables.services) {
          if (s.previewId === args.where.previewId) {
            Object.assign(s, args.data);
            count++;
          }
        }
        return { count };
      },
      count: async (args: { where: { previewId: string; status?: string } }) =>
        tables.services.filter(
          (s) =>
            s.previewId === args.where.previewId &&
            (args.where.status === undefined || s.status === args.where.status),
        ).length,
    },
    logChunk: {
      findFirst: async (args: {
        where: { deploymentId: string };
        orderBy?: { seq: "asc" | "desc" };
        select?: Record<string, unknown>;
      }) => {
        const rows = tables.logChunks.filter((l) => l.deploymentId === args.where.deploymentId);
        rows.sort((a, b) => (b.seq as number) - (a.seq as number));
        return applySelect(rows[0], args ?? {});
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const row: Row = { id: `log-${tables.logChunks.length + 1}`, ...args.data };
        tables.logChunks.push(row);
        return clone(row);
      },
    },
    user: {
      findFirst: async (args: { where: { githubLogin?: string }; select?: Record<string, unknown> }) => {
        const row = tables.users.find((u) => u.githubLogin === args.where.githubLogin);
        return applySelect(row, args ?? {});
      },
    },
    seedTemplate: {
      findFirst: async (args: { where: { projectId: string; isDefault?: boolean }; select?: Record<string, unknown> }) => {
        const row = tables.seedTemplates.find(
          (t) =>
            t.projectId === args.where.projectId &&
            (args.where.isDefault === undefined || t.isDefault === args.where.isDefault),
        );
        return applySelect(row, args ?? {});
      },
    },
    notification: {
      create: async (args: { data: Record<string, unknown> }) => {
        const row: Row = { id: `notif-${tables.notifications.length + 1}`, ...args.data, createdAt: new Date() };
        tables.notifications.push(row);
        return clone(row);
      },
      createMany: async (args: { data: Record<string, unknown>[] }) => {
        for (const d of args.data) {
          tables.notifications.push({ id: `notif-${tables.notifications.length + 1}`, ...d, createdAt: new Date() });
        }
        return { count: args.data.length };
      },
      findFirst: async (_args?: unknown) => null,
    },
    costRecord: {
      findFirst: async (args: {
        where: { previewId: string };
        orderBy?: unknown;
        select?: Record<string, unknown>;
      }) => {
        const rows = tables.costRecords.filter((c) => c.previewId === args.where.previewId);
        rows.sort((a, b) => (b.periodEnd as Date).getTime() - (a.periodEnd as Date).getTime());
        return applySelect(rows[0], args ?? {});
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const row: Row = { id: `cost-${tables.costRecords.length + 1}`, ...args.data };
        tables.costRecords.push(row);
        return clone(row);
      },
      aggregate: async (_args?: unknown) => ({ _sum: { estimatedUsd: null } }),
    },
    team: {
      findMany: async (_args?: unknown) => tables.teams.map(clone),
    },
    membership: {
      findMany: async (args: { where: { teamId: string; role?: string }; select?: Record<string, unknown> }) =>
        tables.memberships
          .filter(
            (m) =>
              m.teamId === args.where.teamId &&
              (args.where.role === undefined || m.role === args.where.role),
          )
          .map((m) => ({ userId: m.userId })),
    },
  };

  return { client: client as unknown as PrismaClient, tables };
}
