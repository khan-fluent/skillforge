import { encrypt, decrypt } from "../services/crypto.js";

const VALID_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("encrypt + decrypt roundtrip", () => {
  it("decrypts back to original plaintext", () => {
    const plaintext = "super-secret-api-token-12345";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("handles empty string", () => {
    const encrypted = encrypt("");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe("");
  });

  it("handles unicode characters", () => {
    const plaintext = "token-with-emoji-\u{1F680}-and-accent-\u00E9";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });
});

describe("random IV produces different ciphertexts", () => {
  it("same plaintext encrypts to different values each time", () => {
    const plaintext = "identical-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);

    // Both should still decrypt correctly
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });
});

describe("tampered ciphertext throws on decrypt", () => {
  it("throws when ciphertext bytes are modified", () => {
    const encrypted = encrypt("do-not-tamper");
    const buf = Buffer.from(encrypted, "base64");
    // Flip a byte in the ciphertext portion (after IV + tag = 28 bytes)
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws when auth tag is modified", () => {
    const encrypted = encrypt("auth-tag-test");
    const buf = Buffer.from(encrypted, "base64");
    // Flip a byte in the auth tag (bytes 12-27)
    buf[12] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(() => decrypt(tampered)).toThrow();
  });
});

describe("invalid ENCRYPTION_KEY", () => {
  let originalKey;

  beforeEach(() => {
    originalKey = process.env.ENCRYPTION_KEY;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it("throws when key is too short", () => {
    process.env.ENCRYPTION_KEY = "abcd1234";
    expect(() => encrypt("test")).toThrow(/ENCRYPTION_KEY/);
  });

  it("throws when key is missing", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("test")).toThrow(/ENCRYPTION_KEY/);
  });

  it("throws when key is empty string", () => {
    process.env.ENCRYPTION_KEY = "";
    expect(() => encrypt("test")).toThrow(/ENCRYPTION_KEY/);
  });
});
