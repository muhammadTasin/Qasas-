import { test } from "node:test";
import assert from "node:assert/strict";
import { resetBaseUrl, tokenDigest, resetPasswordSchema, resetTokenSchema } from "../src/lib/password-reset";
test("reset links require an explicit trusted origin", () => {
  const previous = process.env.NEXTAUTH_URL;
  try {
    delete process.env.NEXTAUTH_URL; assert.throws(resetBaseUrl);
    process.env.NEXTAUTH_URL = "http://example.invalid"; assert.throws(resetBaseUrl);
    process.env.NEXTAUTH_URL = "https://user:secret@example.invalid"; assert.throws(resetBaseUrl);
    process.env.NEXTAUTH_URL = "https://qasas.example.invalid/path"; assert.equal(resetBaseUrl(), "https://qasas.example.invalid");
    process.env.NEXTAUTH_URL = "http://localhost:3000"; assert.equal(resetBaseUrl(), "http://localhost:3000");
  } finally { if (previous) process.env.NEXTAUTH_URL = previous; else delete process.env.NEXTAUTH_URL; }
});
test("reset secrets are hashed and passwords respect bcrypt's byte limit", () => {
  const token = "a".repeat(64);
  assert.ok(resetTokenSchema.safeParse(token).success);
  assert.equal(tokenDigest(token).length, 64);
  assert.notEqual(tokenDigest(token), token);
  assert.equal(resetTokenSchema.safeParse("../token").success, false);
  assert.equal(resetPasswordSchema.safeParse("short").success, false);
  assert.equal(resetPasswordSchema.safeParse("a".repeat(72)).success, true);
  assert.equal(resetPasswordSchema.safeParse("a".repeat(73)).success, false);
  assert.equal(resetPasswordSchema.safeParse("🙂".repeat(19)).success, false);
});
