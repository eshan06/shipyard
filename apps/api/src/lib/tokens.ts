/**
 * API token generation and hashing.
 *
 * Personal-access / CI tokens are shown to the user exactly once at creation;
 * only their SHA-256 hash and a short display prefix are persisted (`ApiToken`).
 * Auth then hashes the presented bearer token and looks up the stored hash, so a
 * database leak never exposes a usable credential.
 *
 * @module
 */

import { createHash, randomBytes } from "node:crypto";

/** Human/greppable prefix on every raw token. */
const TOKEN_PREFIX = "shipyard_";
/** Number of random bytes in the token body (base64url ≈ 43 chars). */
const TOKEN_BYTES = 32;
/** Length of the stored display prefix (`shipyard_` + a few body chars). */
const DISPLAY_PREFIX_LENGTH = 12;

/**
 * A freshly minted API token: the raw secret (returned to the client once), its
 * stored SHA-256 hash, and a short display prefix for the UI.
 */
export interface GeneratedToken {
  /** The full secret token — return to the caller once, never persist. */
  raw: string;
  /** SHA-256 hex digest of {@link GeneratedToken.raw} — persist this. */
  hashed: string;
  /** First {@link DISPLAY_PREFIX_LENGTH} chars of `raw`, safe to show in the UI. */
  prefix: string;
}

/**
 * Hash a raw token into the hex digest stored in the database.
 *
 * @param raw - The raw token string presented by a client.
 * @returns Lowercase SHA-256 hex digest.
 */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/**
 * Generate a new API token.
 *
 * @returns A {@link GeneratedToken} with the raw value, its hash, and prefix.
 */
export function generateApiToken(): GeneratedToken {
  const body = randomBytes(TOKEN_BYTES).toString("base64url");
  const raw = `${TOKEN_PREFIX}${body}`;
  return {
    raw,
    hashed: hashToken(raw),
    prefix: raw.slice(0, DISPLAY_PREFIX_LENGTH),
  };
}
