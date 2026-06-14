import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  generateEncryptionKey,
  loadEncryptionKey,
} from "./crypto.js";

describe("crypto", () => {
  const key = generateEncryptionKey();

  describe("generateEncryptionKey", () => {
    it("produces a base64 string decoding to 32 bytes", () => {
      const decoded = Buffer.from(generateEncryptionKey(), "base64");
      expect(decoded.length).toBe(32);
    });

    it("produces distinct keys", () => {
      expect(generateEncryptionKey()).not.toBe(generateEncryptionKey());
    });
  });

  describe("encrypt/decrypt round-trip", () => {
    it("recovers the original plaintext", () => {
      const plaintext = "super-secret-DATABASE_URL=postgres://u:p@h/db";
      const payload = encryptSecret(plaintext, key);
      expect(decryptSecret(payload, key)).toBe(plaintext);
    });

    it("handles empty strings and unicode", () => {
      for (const plaintext of ["", "héllo 🌍 — secrets", "a".repeat(10_000)]) {
        const payload = encryptSecret(plaintext, key);
        expect(decryptSecret(payload, key)).toBe(plaintext);
      }
    });

    it("emits the versioned 4-part payload format", () => {
      const parts = encryptSecret("x", key).split(":");
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe("v1");
      // iv (12 bytes) and tag (16 bytes) base64.
      expect(Buffer.from(parts[1]!, "base64").length).toBe(12);
      expect(Buffer.from(parts[2]!, "base64").length).toBe(16);
    });

    it("is non-deterministic (random IV per call)", () => {
      const a = encryptSecret("same", key);
      const b = encryptSecret("same", key);
      expect(a).not.toBe(b);
      expect(decryptSecret(a, key)).toBe("same");
      expect(decryptSecret(b, key)).toBe("same");
    });
  });

  describe("tamper detection", () => {
    it("rejects a flipped ciphertext byte", () => {
      const payload = encryptSecret("attack-at-dawn", key);
      const parts = payload.split(":");
      const data = Buffer.from(parts[3]!, "base64");
      data[0] = data[0]! ^ 0xff;
      const tampered = [parts[0], parts[1], parts[2], data.toString("base64")].join(":");
      expect(() => decryptSecret(tampered, key)).toThrow();
    });

    it("rejects a flipped auth tag", () => {
      const payload = encryptSecret("attack-at-dawn", key);
      const parts = payload.split(":");
      const tag = Buffer.from(parts[2]!, "base64");
      tag[0] = tag[0]! ^ 0x01;
      const tampered = [parts[0], parts[1], tag.toString("base64"), parts[3]].join(":");
      expect(() => decryptSecret(tampered, key)).toThrow();
    });

    it("rejects decryption with the wrong key", () => {
      const payload = encryptSecret("attack-at-dawn", key);
      expect(() => decryptSecret(payload, generateEncryptionKey())).toThrow();
    });

    it("rejects malformed payloads and unknown versions", () => {
      expect(() => decryptSecret("not-a-payload", key)).toThrow(/Malformed/);
      const parts = encryptSecret("x", key).split(":");
      const wrongVersion = ["v2", parts[1], parts[2], parts[3]].join(":");
      expect(() => decryptSecret(wrongVersion, key)).toThrow(/version/i);
    });
  });

  describe("loadEncryptionKey", () => {
    it("returns the key when set and valid", () => {
      expect(loadEncryptionKey({ SECRETS_ENCRYPTION_KEY: key } as NodeJS.ProcessEnv)).toBe(key);
    });

    it("throws a clear error when missing", () => {
      expect(() => loadEncryptionKey({} as NodeJS.ProcessEnv)).toThrow(
        /SECRETS_ENCRYPTION_KEY is not set/,
      );
    });

    it("throws when the key is the wrong length", () => {
      const shortKey = Buffer.from("too-short").toString("base64");
      expect(() =>
        loadEncryptionKey({ SECRETS_ENCRYPTION_KEY: shortKey } as NodeJS.ProcessEnv),
      ).toThrow(/32 bytes/);
    });
  });

  describe("encryptSecret key validation", () => {
    it("throws when given a wrong-length key", () => {
      const badKey = Buffer.from("x".repeat(16)).toString("base64");
      expect(() => encryptSecret("x", badKey)).toThrow(/32 bytes/);
    });
  });
});
