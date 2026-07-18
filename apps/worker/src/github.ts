/**
 * GitHub App integration for the worker.
 *
 * When a GitHub App is configured (`GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY`),
 * this module mints short-lived **installation access tokens** and uses them to
 * (a) clone private repositories for a preview build and (b) report preview
 * status back onto the pull request as a commit status. All of it is optional
 * and env-gated: with no app configured the helpers report "unconfigured" and
 * the deploy path falls back to anonymous (public-repo) clones with no PR
 * status posting.
 *
 * Implemented with `jose` (RS256 app JWT) + global `fetch` — no `octokit`
 * dependency — to keep the worker's footprint small.
 *
 * @module
 */

import { importPKCS8, SignJWT } from "jose";

import type { WorkerConfig } from "./config.js";
import type { Logger } from "pino";

/** GitHub REST API base. */
const GITHUB_API = "https://api.github.com";

/** A minted installation token with its expiry. */
interface InstallationToken {
  token: string;
  expiresAt: number; // epoch ms
}

/**
 * Thin GitHub App client. Construct once per worker; it caches installation
 * tokens until shortly before they expire.
 */
export class GitHubApp {
  private readonly appId: string;
  private readonly privateKeyPem: string;
  private readonly logger: Logger;
  private readonly tokenCache = new Map<string, InstallationToken>();

  private constructor(appId: string, privateKeyPem: string, logger: Logger) {
    this.appId = appId;
    this.privateKeyPem = privateKeyPem;
    this.logger = logger;
  }

  /**
   * Build a {@link GitHubApp} from config, or `null` when the app is not
   * configured (so callers can cleanly fall back to the anonymous path).
   */
  static fromConfig(config: WorkerConfig, logger: Logger): GitHubApp | null {
    if (!config.GITHUB_APP_ID || !config.GITHUB_APP_PRIVATE_KEY) return null;
    // Env files often store the PEM with escaped newlines; normalize them.
    const pem = config.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n");
    return new GitHubApp(config.GITHUB_APP_ID, pem, logger);
  }

  /** Sign a short-lived app JWT (RS256) used to mint installation tokens. */
  private async appJwt(): Promise<string> {
    const key = await importPKCS8(this.privateKeyPem, "RS256");
    // `iat` back-dated 60s to tolerate clock skew; GitHub caps `exp` at 10 min.
    const now = Math.floor(Date.now() / 1000) - 60;
    return new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(this.appId)
      .setIssuedAt(now)
      .setExpirationTime(now + 9 * 60)
      .sign(key);
  }

  /**
   * Get a (cached) installation access token for `installationId`. Tokens are
   * reused until 60s before expiry.
   */
  async installationToken(installationId: string): Promise<string> {
    const cached = this.tokenCache.get(installationId);
    if (cached && cached.expiresAt - Date.now() > 60_000) return cached.token;

    const jwt = await this.appJwt();
    const res = await fetch(
      `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "shipyard-worker",
        },
      },
    );
    if (!res.ok) {
      throw new Error(
        `GitHub App: failed to mint installation token (${res.status} ${res.statusText})`,
      );
    }
    const body = (await res.json()) as { token: string; expires_at: string };
    const token: InstallationToken = {
      token: body.token,
      expiresAt: new Date(body.expires_at).getTime(),
    };
    this.tokenCache.set(installationId, token);
    return token.token;
  }

  /**
   * Authenticated HTTPS clone URL for `repoFullName` using an installation
   * token, e.g. `https://x-access-token:<token>@github.com/acme/app.git`.
   */
  async cloneUrl(repoFullName: string, installationId: string): Promise<string> {
    const token = await this.installationToken(installationId);
    return `https://x-access-token:${token}@github.com/${repoFullName}.git`;
  }

  /**
   * Post a commit status onto the PR head SHA (best-effort; failures are logged
   * and swallowed so status reporting never fails a deploy).
   */
  async postCommitStatus(args: {
    repoFullName: string;
    installationId: string;
    sha: string;
    state: "pending" | "success" | "failure" | "error";
    targetUrl?: string;
    description?: string;
  }): Promise<void> {
    try {
      const token = await this.installationToken(args.installationId);
      const res = await fetch(
        `${GITHUB_API}/repos/${args.repoFullName}/statuses/${args.sha}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "shipyard-worker",
          },
          body: JSON.stringify({
            state: args.state,
            context: "shipyard/preview",
            ...(args.targetUrl ? { target_url: args.targetUrl } : {}),
            ...(args.description ? { description: args.description.slice(0, 140) } : {}),
          }),
        },
      );
      if (!res.ok) {
        this.logger.warn(
          { status: res.status, repo: args.repoFullName },
          "GitHub App: commit status post failed",
        );
      }
    } catch (err) {
      this.logger.warn({ err, repo: args.repoFullName }, "GitHub App: commit status error");
    }
  }
}
