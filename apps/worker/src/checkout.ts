/**
 * Repository checkout for real (docker-driver) preview builds.
 *
 * A deploy job carries a `commitSha` but no source: something must fetch the PR
 * code before the deploy engine can build an image from it. This module does a
 * shallow `git` checkout of the exact commit into an isolated scratch directory
 * and resolves the build-context root against it — with a path-traversal guard
 * so a malicious `rootDirectory` cannot point the build context outside the
 * checkout (e.g. at the worker's own filesystem/secrets).
 *
 * Private repositories are cloned with a GitHub App installation token when one
 * is available (see {@link GitHubApp}); otherwise an anonymous HTTPS clone is
 * attempted (public repos).
 *
 * @module
 */

import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

import type { GitHubApp } from "./github.js";
import type { Logger } from "pino";

/** A completed checkout: the checkout root and the resolved build-context dir. */
export interface Checkout {
  /** Absolute path of the checkout root (repository top level). */
  root: string;
  /** Absolute path of the build context (`root` + the project's rootDirectory). */
  contextDir: string;
  /** Remove the checkout directory. Always call in a finally. */
  cleanup: () => Promise<void>;
}

/** Inputs describing what to check out. */
export interface CheckoutRequest {
  /** `owner/repo`. */
  repoFullName: string;
  /** Exact commit to check out. */
  commitSha: string;
  /** Project-relative build-context directory (e.g. `.` or `apps/web`). */
  rootDirectory: string;
  /** GitHub App installation id, when the repo is private + app-installed. */
  installationId?: string | null;
  /** Base scratch directory; defaults to the OS temp dir. */
  workspaceDir?: string;
}

/**
 * Shallow-checkout `commitSha` of `repoFullName` and resolve its build context.
 *
 * @throws Error if git is unavailable, the clone/fetch fails, or the resolved
 *   context escapes the checkout root.
 */
export async function checkoutRepo(
  req: CheckoutRequest,
  app: GitHubApp | null,
  logger: Logger,
): Promise<Checkout> {
  const base = req.workspaceDir ?? join(tmpdir(), "shipyard-checkouts");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "co-"));
  const cleanup = async () => {
    await rm(root, { recursive: true, force: true }).catch(() => undefined);
  };

  try {
    const cloneUrl =
      app && req.installationId
        ? await app.cloneUrl(req.repoFullName, req.installationId)
        : `https://github.com/${req.repoFullName}.git`;

    // Fetch only the target commit (GitHub permits fetching a reachable SHA).
    await git(["init", "--quiet"], root, logger);
    await git(["remote", "add", "origin", cloneUrl], root, logger, { secret: cloneUrl });
    await git(["fetch", "--depth", "1", "--quiet", "origin", req.commitSha], root, logger, {
      secret: cloneUrl,
    });
    await git(["checkout", "--quiet", "FETCH_HEAD"], root, logger);

    const contextDir = resolveContext(root, req.rootDirectory);
    // Confirm the build context actually exists in the checkout.
    const st = await stat(contextDir).catch(() => null);
    if (!st?.isDirectory()) {
      throw new Error(
        `Build context "${req.rootDirectory}" does not exist in ${req.repoFullName}@${req.commitSha.slice(0, 12)}`,
      );
    }
    return { root, contextDir, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/**
 * Resolve `rootDirectory` under `root`, rejecting any value that escapes the
 * checkout (absolute paths, `..` traversal, symlink-style prefixes).
 */
export function resolveContext(root: string, rootDirectory: string): string {
  const rel = (rootDirectory ?? ".").trim() || ".";
  const resolved = resolve(root, rel);
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    throw new Error(`rootDirectory "${rootDirectory}" escapes the checkout root`);
  }
  return resolved;
}

/** Run a git subcommand in `cwd`, redacting any secret substring from logs. */
function git(
  args: string[],
  cwd: string,
  logger: Logger,
  opts: { secret?: string } = {},
): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", args, { cwd, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) =>
      reject(new Error(`git ${args[0]} failed to spawn (is git installed?): ${err.message}`)),
    );
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      const redacted = opts.secret ? stderr.split(opts.secret).join("***") : stderr;
      const safeArgs = opts.secret
        ? args.map((a) => a.split(opts.secret!).join("***"))
        : args;
      logger.warn({ args: safeArgs, code }, "git command failed");
      reject(new Error(`git ${safeArgs.join(" ")} exited ${code}: ${redacted.trim().slice(0, 500)}`));
    });
  });
}
