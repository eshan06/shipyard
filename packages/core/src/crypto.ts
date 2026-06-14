/**
 * Authenticated symmetric encryption helpers for secrets at rest.
 *
 * Shipyard stores environment variables / secrets encrypted in the database
 * (`EnvVar.valueEncrypted`). This module implements AES-256-GCM encryption with
 * a single, versioned payload format so the scheme can evolve later without
 * breaking stored ciphertext.
 *
 * ## Payload format (`v1`)
 *
 * ```
 * v1:<iv>:<tag>:<ciphertext>
 * ```
 *
 * - `v1` — literal scheme version, enabling forward migration.
 * - `<iv>` — base64 of the 12-byte random GCM nonce.
 * - `<tag>` — base64 of the 16-byte GCM authentication tag.
 * - `<ciphertext>` — base64 of the encrypted bytes.
 *
 * GCM provides authenticated encryption: tampering with any part of the payload
 * causes {@link decryptSecret} to throw, and the tag comparison is performed in
 * constant time by the underlying OpenSSL implementation.
 *
 * @module
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/** AES-256-GCM requires a 32-byte (256-bit) key. */
const KEY_BYTES = 32;
/** Recommended GCM nonce length is 96 bits (12 bytes). */
const IV_BYTES = 12;
/** GCM authentication tag length in bytes (128 bits). */
const TAG_BYTES = 16;
/** Current payload scheme version prefix. */
const SCHEME_VERSION = "v1";
/** Node cipher algorithm identifier. */
const ALGORITHM = "aes-256-gcm";

/**
 * Decode and validate a base64-encoded 32-byte encryption key.
 *
 * @param keyB64 - Base64 string encoding exactly 32 bytes.
 * @returns The decoded key as a {@link Buffer}.
 * @throws Error if the value is empty or does not decode to 32 bytes.
 */
function decodeKey(keyB64: string): Buffer {
  if (!keyB64) {
    throw new Error("Encryption key is empty");
  }
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `Encryption key must be ${KEY_BYTES} bytes (got ${key.length}). ` +
        "Provide a base64-encoded 32-byte key (e.g. `openssl rand -base64 32`).",
    );
  }
  return key;
}

/**
 * Generate a fresh, cryptographically random AES-256 key.
 *
 * Intended for provisioning / key-rotation tooling. The returned value is the
 * base64 form expected by {@link loadEncryptionKey} and {@link encryptSecret}.
 *
 * @returns A base64-encoded 32-byte key.
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}

/**
 * Read and validate the secrets encryption key from a process environment map.
 *
 * Looks up `SECRETS_ENCRYPTION_KEY`, which must be a base64-encoded 32-byte key
 * (see `.env.example`). Throws a clear, actionable error if the variable is
 * missing or malformed — failing fast at startup is preferable to discovering a
 * bad key when a secret is first decrypted.
 *
 * @param env - Environment map to read from. Defaults to `process.env`.
 * @returns The base64 key string (already validated to decode to 32 bytes).
 * @throws Error if `SECRETS_ENCRYPTION_KEY` is unset, empty, or not 32 bytes.
 */
export function loadEncryptionKey(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const raw = env.SECRETS_ENCRYPTION_KEY;
  if (raw === undefined || raw.length === 0) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY is not set. Provide a base64-encoded 32-byte " +
        "key (e.g. `openssl rand -base64 32`).",
    );
  }
  // Validate length now so callers fail fast; throws with a clear message.
  decodeKey(raw);
  return raw;
}

/**
 * Encrypt a UTF-8 plaintext secret using AES-256-GCM.
 *
 * A fresh random 96-bit IV is generated per call, so encrypting the same
 * plaintext twice yields different payloads (semantic security).
 *
 * @param plaintext - The secret value to encrypt.
 * @param keyB64 - Base64-encoded 32-byte key (see {@link loadEncryptionKey}).
 * @returns A versioned, colon-delimited payload: `v1:<iv>:<tag>:<ciphertext>`
 *   with each component base64-encoded.
 * @throws Error if the key is invalid.
 */
export function encryptSecret(plaintext: string, keyB64: string): string {
  const key = decodeKey(keyB64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    SCHEME_VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a payload produced by {@link encryptSecret}.
 *
 * Verifies the GCM authentication tag: any tampering with the IV, tag, or
 * ciphertext — or use of the wrong key — causes this function to throw rather
 * than return corrupted data. The tag check is constant-time (handled by GCM).
 *
 * @param payload - A `v1:<iv>:<tag>:<ciphertext>` payload string.
 * @param keyB64 - Base64-encoded 32-byte key used to encrypt the payload.
 * @returns The original UTF-8 plaintext.
 * @throws Error if the payload is malformed, the version is unsupported, the
 *   key is invalid, or authentication fails (tamper / wrong key).
 */
export function decryptSecret(payload: string, keyB64: string): string {
  const key = decodeKey(keyB64);

  const parts = payload.split(":");
  if (parts.length !== 4) {
    throw new Error(
      "Malformed secret payload: expected 'version:iv:tag:ciphertext'.",
    );
  }
  const [version, ivB64, tagB64, dataB64] = parts as [
    string,
    string,
    string,
    string,
  ];

  if (version !== SCHEME_VERSION) {
    throw new Error(`Unsupported secret payload version: '${version}'.`);
  }

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  if (iv.length !== IV_BYTES) {
    throw new Error(
      `Malformed secret payload: IV must be ${IV_BYTES} bytes (got ${iv.length}).`,
    );
  }
  if (tag.length !== TAG_BYTES) {
    throw new Error(
      `Malformed secret payload: tag must be ${TAG_BYTES} bytes (got ${tag.length}).`,
    );
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  // `final()` throws "Unsupported state or unable to authenticate data" when
  // the tag does not match (tampered payload or wrong key).
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString("utf8");
}
