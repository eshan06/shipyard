/**
 * Identifier and slug generation utilities.
 *
 * Two concerns live here:
 *
 * 1. **Prefixed ids** — short, URL-safe, type-tagged identifiers (e.g.
 *    `tok_V1StGXR8_Z5jdHi6B-myT`) used for opaque external references such as
 *    API tokens. (Primary keys themselves are `cuid()` in Postgres; these are
 *    for human/transport-facing identifiers.)
 * 2. **Slugs** — DNS-safe, lowercase, length-bounded slugs derived from
 *    arbitrary text (most importantly a git branch → preview subdomain), with a
 *    collision-resistant suffix helper.
 *
 * @module
 */

import { customAlphabet, nanoid } from "nanoid";

/**
 * Maximum length of a generated slug, in characters.
 *
 * Chosen to stay well under the 63-character per-label limit for DNS, leaving
 * room for an environment/zone suffix when composing a preview hostname like
 * `<slug>.preview.example.com`.
 */
export const MAX_SLUG_LENGTH = 40;

/**
 * Length (in characters) of the collision-avoidance suffix appended by
 * {@link slugifyBranch} and produced by {@link slugSuffix}.
 */
export const SLUG_SUFFIX_LENGTH = 6;

/**
 * Lowercase alphanumeric alphabet for slug suffixes. Excludes `1/l/0/o`-style
 * ambiguity is not a concern here, but we keep it DNS-safe (no uppercase, no
 * symbols) so suffixed slugs remain valid hostnames.
 */
const SUFFIX_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

const generateSuffix = customAlphabet(SUFFIX_ALPHABET, SLUG_SUFFIX_LENGTH);

/**
 * Known id prefixes, keeping opaque identifiers self-describing and greppable.
 */
export const ID_PREFIX = {
  /** API token id. */
  token: "tok",
  /** Generic preview reference. */
  preview: "prev",
  /** Generic deployment reference. */
  deployment: "dep",
} as const;

/**
 * Union of supported id prefix keys.
 */
export type IdPrefixKey = keyof typeof ID_PREFIX;

/**
 * Generate a prefixed, URL-safe identifier.
 *
 * Uses {@link nanoid} (URL-safe alphabet) for the random portion. The default
 * 21-character body provides ample collision resistance for transport-facing
 * ids.
 *
 * @param prefix - A known {@link IdPrefixKey} or an arbitrary short string.
 * @param size - Length of the random body (default 21).
 * @returns A string of the form `<prefix>_<random>`.
 *
 * @example
 * ```ts
 * prefixedId("token");        // "tok_V1StGXR8_Z5jdHi6B-myT"
 * prefixedId("custom", 10);   // "custom_4f90Jk2bQz"
 * ```
 */
export function prefixedId(prefix: IdPrefixKey | string, size = 21): string {
  const resolved =
    prefix in ID_PREFIX
      ? ID_PREFIX[prefix as IdPrefixKey]
      : prefix;
  return `${resolved}_${nanoid(size)}`;
}

/**
 * Generate a short, lowercase-alphanumeric, DNS-safe collision suffix.
 *
 * @returns A {@link SLUG_SUFFIX_LENGTH}-character random string.
 */
export function slugSuffix(): string {
  return generateSuffix();
}

/**
 * Normalize arbitrary text into a DNS-safe slug fragment.
 *
 * The result is lowercase, contains only `[a-z0-9-]`, collapses runs of
 * separators into a single hyphen, and is trimmed of leading/trailing hyphens.
 * It is truncated to {@link MAX_SLUG_LENGTH} (or `maxLength`) characters.
 *
 * Note: this does not guarantee a non-empty result for input consisting solely
 * of unsupported characters — see {@link slugifyBranch} for the
 * preview-oriented wrapper that guarantees a usable, collision-suffixed slug.
 *
 * @param input - Arbitrary text (e.g. a branch or project name).
 * @param maxLength - Maximum length of the slug (default {@link MAX_SLUG_LENGTH}).
 * @returns A normalized slug fragment (possibly empty).
 */
export function slugify(input: string, maxLength = MAX_SLUG_LENGTH): string {
  return input
    .normalize("NFKD")
    // Drop combining marks left over from NFKD decomposition.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Any run of non-alphanumeric characters becomes a single hyphen.
    .replace(/[^a-z0-9]+/g, "-")
    // Trim leading/trailing hyphens.
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    // Truncation may re-expose a trailing hyphen; trim again.
    .replace(/-+$/g, "");
}

/**
 * Derive a DNS-safe, collision-suffixed preview slug from a git branch name.
 *
 * The slug is used both as the unique `Preview.slug` and as the preview
 * subdomain (`<slug>.preview.<domain>`), so it must be a valid DNS label
 * (lowercase, `[a-z0-9-]`, no leading/trailing hyphen) and short enough to
 * leave room for the domain suffix.
 *
 * Behaviour:
 * - The branch is {@link slugify}'d and truncated so that the base plus a
 *   `-<suffix>` collision tail fits within {@link MAX_SLUG_LENGTH}.
 * - A random {@link slugSuffix} is always appended, guaranteeing uniqueness in
 *   practice without a database round-trip and ensuring a non-empty, valid
 *   result even for branches with no slug-able characters.
 *
 * @param branch - The git branch name (e.g. `feature/Add Login!`).
 * @returns A DNS-safe slug like `feature-add-login-k3f9a2`.
 *
 * @example
 * ```ts
 * slugifyBranch("feature/Add Login!"); // "feature-add-login-<suffix>"
 * slugifyBranch("###");                // "<suffix>"   (base empty → suffix only)
 * ```
 */
export function slugifyBranch(branch: string): string {
  const suffix = slugSuffix();
  // Reserve room for "-<suffix>" within the max length.
  const baseBudget = MAX_SLUG_LENGTH - (suffix.length + 1);
  const base = slugify(branch, Math.max(0, baseBudget));
  return base.length > 0 ? `${base}-${suffix}` : suffix;
}

/**
 * Validate whether a string is a usable DNS label / preview slug.
 *
 * A valid slug is lowercase, 1–63 characters, composed of `[a-z0-9-]`, and does
 * not start or end with a hyphen.
 *
 * @param slug - Candidate slug.
 * @returns `true` if the slug is a valid DNS label.
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug);
}
