import { describe, expect, it } from "vitest";

import {
  MAX_SLUG_LENGTH,
  SLUG_SUFFIX_LENGTH,
  isValidSlug,
  prefixedId,
  slugSuffix,
  slugify,
  slugifyBranch,
} from "./ids.js";

describe("ids", () => {
  describe("prefixedId", () => {
    it("uses the known prefix mapping", () => {
      expect(prefixedId("token")).toMatch(/^tok_[A-Za-z0-9_-]{21}$/);
      expect(prefixedId("preview")).toMatch(/^prev_/);
    });

    it("passes through unknown prefixes verbatim", () => {
      expect(prefixedId("custom", 10)).toMatch(/^custom_[A-Za-z0-9_-]{10}$/);
    });

    it("produces unique ids", () => {
      const ids = new Set(Array.from({ length: 1000 }, () => prefixedId("token")));
      expect(ids.size).toBe(1000);
    });
  });

  describe("slugSuffix", () => {
    it("is the configured length and DNS-safe", () => {
      const s = slugSuffix();
      expect(s).toHaveLength(SLUG_SUFFIX_LENGTH);
      expect(s).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe("slugify", () => {
    it("lowercases and replaces unsupported chars with hyphens", () => {
      expect(slugify("Feature/Add Login!")).toBe("feature-add-login");
    });

    it("collapses separator runs and trims hyphens", () => {
      expect(slugify("  --Hello___World--  ")).toBe("hello-world");
    });

    it("strips diacritics", () => {
      expect(slugify("Café Déjà")).toBe("cafe-deja");
    });

    it("truncates to maxLength without trailing hyphen", () => {
      const out = slugify("a".repeat(100), 10);
      expect(out).toBe("a".repeat(10));
      // A boundary that would leave a trailing hyphen gets trimmed.
      expect(slugify("aaaa bbbb cccc", 5)).toBe("aaaa");
    });

    it("returns empty for unsupported-only input", () => {
      expect(slugify("###")).toBe("");
    });
  });

  describe("slugifyBranch", () => {
    it("derives a dns-safe slug with a collision suffix", () => {
      const slug = slugifyBranch("feature/Add Login!");
      expect(slug).toMatch(/^feature-add-login-[a-z0-9]{6}$/);
      expect(isValidSlug(slug)).toBe(true);
    });

    it("stays within MAX_SLUG_LENGTH for very long branches", () => {
      const slug = slugifyBranch("feat/" + "x".repeat(200));
      expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
      expect(isValidSlug(slug)).toBe(true);
    });

    it("falls back to suffix-only for unsupported branch names", () => {
      const slug = slugifyBranch("###");
      expect(slug).toMatch(/^[a-z0-9]{6}$/);
      expect(isValidSlug(slug)).toBe(true);
    });

    it("produces unique slugs for the same branch", () => {
      const a = slugifyBranch("main");
      const b = slugifyBranch("main");
      expect(a).not.toBe(b);
    });
  });

  describe("isValidSlug", () => {
    it("accepts valid DNS labels", () => {
      expect(isValidSlug("abc")).toBe(true);
      expect(isValidSlug("a-b-c")).toBe(true);
      expect(isValidSlug("a1")).toBe(true);
    });

    it("rejects invalid slugs", () => {
      expect(isValidSlug("")).toBe(false);
      expect(isValidSlug("-abc")).toBe(false);
      expect(isValidSlug("abc-")).toBe(false);
      expect(isValidSlug("ABC")).toBe(false);
      expect(isValidSlug("a".repeat(64))).toBe(false);
    });
  });
});
