import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
const { compare, hash } = bcrypt;
const url = process.env.TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname) || new URL(url).pathname !== "/qasas_test") throw new Error("Dedicated localhost qasas_test database required.");
process.env.DATABASE_URL = url; process.env.DIRECT_URL = url;
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.NEXTAUTH_SECRET = randomBytes(32).toString("hex");
const { prisma } = await import("../src/lib/prisma");
const { requestPasswordReset, resetPassword, tokenDigest } = await import("../src/lib/password-reset");
const { resolveGoogleUser } = await import("../src/lib/google-auth");
const users: string[] = [];
async function user() {
  const value = await prisma.user.create({ data: { email: `reset-${randomUUID()}@example.invalid`, passwordHash: await hash("original-fixture-password", 12) } });
  users.push(value.id); return value;
}
let resetUser: Awaited<ReturnType<typeof user>>;
before(async () => { resetUser = await user(); });
after(async () => { await prisma.user.deleteMany({ where: { id: { in: users } } }); await prisma.$disconnect(); });
const tokenFrom = (url: string) => new URLSearchParams(new URL(url).hash.slice(1)).get("token")!;

test("reset delivery uses random hashed expiring secrets and no HTTP URL token", async () => {
  let sent = "";
  await requestPasswordReset(resetUser.email, randomUUID(), async mail => { assert.equal(mail.to, resetUser.email); sent = mail.resetUrl; });
  const token = tokenFrom(sent); const row = await prisma.passwordResetToken.findUniqueOrThrow({ where: { userId: resetUser.id } });
  assert.match(token, /^[a-f0-9]{64}$/); assert.equal(row.tokenHash, tokenDigest(token)); assert.notEqual(row.tokenHash, token);
  assert.ok(row.expiresAt.getTime() > Date.now()); assert.ok(row.expiresAt.getTime() < Date.now() + 31 * 60 * 1000);
  assert.equal(new URL(sent).search, "");
  // Only one concurrent consumer succeeds and the old login becomes invalid.
  const results = await Promise.all([resetPassword(token, "new-fixture-password"), resetPassword(token, "new-fixture-password")]);
  assert.equal(results.filter(Boolean).length, 1);
  const updated = await prisma.user.findUniqueOrThrow({ where: { id: resetUser.id } });
  assert.ok(await compare("new-fixture-password", updated.passwordHash!));
  assert.equal(await compare("original-fixture-password", updated.passwordHash!), false);
  assert.equal(updated.sessionVersion, 1);
  assert.equal(await prisma.passwordResetToken.count({ where: { userId: resetUser.id } }), 0);
  assert.equal(await resetPassword(token, "another-fixture-password"), false);
});
test("unknown addresses, expired tokens and delivery failure never change accounts", async () => {
  let sends = 0;
  await requestPasswordReset(`missing-${randomUUID()}@example.invalid`, randomUUID(), async () => { sends++; });
  assert.equal(sends, 0);
  const value = await user(); const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({ data: { userId: value.id, tokenHash: tokenDigest(token), expiresAt: new Date(Date.now() - 1000) } });
  assert.equal(await resetPassword(token, "new-fixture-password"), false);
  await assert.rejects(requestPasswordReset(value.email, randomUUID(), async () => { throw new Error("synthetic delivery failure"); }));
  assert.equal(await prisma.passwordResetToken.count({ where: { userId: value.id } }), 0);
  assert.ok(await compare("original-fixture-password", (await prisma.user.findUniqueOrThrow({ where: { id: value.id } })).passwordHash!));
});
test("concurrent repeated reset requests send one email", async () => {
  const value = await user(); let sends = 0; const network = randomUUID();
  await Promise.all(Array.from({ length: 5 }, () => requestPasswordReset(value.email, network, async () => { sends++; })));
  assert.equal(sends, 1);
});
test("Google retains existing Account ownership and never silently links a credentials account", async () => {
  const subject = randomUUID(); const credentials = await user();
  assert.equal(await resolveGoogleUser(subject, credentials.email), null);
  const google = await resolveGoogleUser(subject, `google-${randomUUID()}@example.invalid`, "Google fixture");
  assert.ok(google); users.push(google.id);
  await prisma.user.update({ where: { id: google.id }, data: { passwordHash: null } }); // Legacy Google-only account.
  const again = await resolveGoogleUser(subject, credentials.email, "Different name");
  assert.equal(again?.id, google.id);
  assert.equal(await prisma.account.count({ where: { provider: "google", providerAccountId: subject } }), 1);
});
