import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Account, Profile, Session, User } from "next-auth";
import type { CredentialsConfig } from "next-auth/providers/credentials";

const url = process.env.TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname) || new URL(url).pathname !== "/qasas_test") throw new Error("Dedicated localhost qasas_test database required.");
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
process.env.GOOGLE_CLIENT_ID = "local-google-test-client";
process.env.GOOGLE_CLIENT_SECRET = "local-google-test-secret";
const { prisma } = await import("../src/lib/prisma");
const { resolveGoogleUser } = await import("../src/lib/google-auth");
const { authOptions } = await import("../src/lib/auth");
const { editStory, moveStoryToTrash, restoreStory } = await import("../src/lib/story-mutations");
const emails: string[] = [];
const password = "original-fixture-password";

function email() {
  const value = `google-auth-${randomUUID()}@example.invalid`;
  emails.push(value);
  return value;
}
async function createUser(passwordHash: string | null = null) {
  return prisma.user.create({ data: { email: email(), name: "Original author", passwordHash } });
}
function googleCallback(address: string, subject = randomUUID(), overrides: Record<string, unknown> = {}) {
  const user: User = { id: subject, email: address, name: "Google name" };
  const account: Account = { provider: "google", type: "oauth", providerAccountId: subject };
  const profile: Profile & { email_verified?: unknown } = { sub: subject, email: address, name: "Google name", email_verified: true, ...overrides };
  return { user, account, profile };
}
after(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  await prisma.story.deleteMany({ where: { authorId: { in: users.map(user => user.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  await prisma.$disconnect();
});

test("verified same-email Google sign-in preserves the original User, password and every story relationship", async () => {
  assert.ok(authOptions.providers.some(provider => provider.id === "google"));
  const owner = await createUser(await bcrypt.hash(password, 12));
  const story = await prisma.story.create({ data: {
    authorId: owner.id, title: "Existing story", content: "Original content with existing relationships.", totalReadSeconds: 19,
    comments: { create: { userId: owner.id, body: "Existing comment" } },
    reactions: { create: { userId: owner.id, type: "LOVE" } },
    views: { create: { visitorId: randomUUID(), totalReadSeconds: 19 } },
  }, include: { comments: true, reactions: true, views: true } });
  const trash = await prisma.story.create({ data: { authorId: owner.id, title: "Existing trash", content: "Retain this story too.", deletedAt: new Date() } });
  const input = googleCallback(owner.email);
  assert.equal(await authOptions.callbacks!.signIn!(input), true);
  assert.deepEqual(input.user, { id: owner.id, email: owner.email, name: owner.name });
  assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: owner.id } }), owner);
  assert.equal(await prisma.user.count({ where: { email: owner.email } }), 1);
  assert.equal((await prisma.account.findUniqueOrThrow({ where: { provider_providerAccountId: { provider: "google", providerAccountId: input.account.providerAccountId } } })).userId, owner.id);
  assert.deepEqual(await prisma.story.findUniqueOrThrow({ where: { id: story.id }, include: { comments: true, reactions: true, views: true } }), story);
  assert.deepEqual(await prisma.story.findUniqueOrThrow({ where: { id: trash.id } }), trash);

  const token = await authOptions.callbacks!.jwt!({ token: {}, ...input, trigger: "signIn" });
  assert.equal(token.sub, owner.id);
  const session = await authOptions.callbacks!.session!({ session: { user: { id: "", email: owner.email }, expires: new Date(Date.now() + 60000).toISOString() }, token, user: { ...input.user, emailVerified: null }, newSession: undefined, trigger: "update" }) as Session;
  assert.equal(session.user.id, owner.id);
  await editStory(session.user.id, story.id, { title: "Still my story", content: story.content });
  await moveStoryToTrash(session.user.id, story.id);
  await restoreStory(session.user.id, story.id);
  await restoreStory(session.user.id, trash.id);
  assert.equal((await prisma.story.findUniqueOrThrow({ where: { id: story.id } })).authorId, owner.id);

  const credentials = authOptions.providers.find(provider => provider.id === "credentials") as CredentialsConfig;
  const loggedIn = await credentials.options!.authorize!({ email: owner.email, password }, { body: {}, query: {}, headers: {}, method: "POST" });
  assert.equal(loggedIn?.id, owner.id);
});

test("legacy Google-only users without Account rows link by email without acquiring a password", async () => {
  const owner = await createUser();
  const resolved = await resolveGoogleUser(randomUUID(), owner.email, "Updated Google name");
  assert.equal(resolved.id, owner.id);
  assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: owner.id } }), owner);
});

test("existing Google subject links remain authoritative when the supplied email changes", async () => {
  const owner = await createUser();
  const other = await createUser();
  const subject = randomUUID();
  await prisma.account.create({ data: { userId: owner.id, type: "oauth", provider: "google", providerAccountId: subject } });
  const input = googleCallback(other.email, subject);
  assert.equal(await authOptions.callbacks!.signIn!(input), true);
  assert.equal(input.user.id, owner.id);
  assert.equal(input.user.email, owner.email);
  assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: other.id } }), other);
});

test("first-time Google sign-in creates exactly one user with no credentials password", async () => {
  const address = email();
  const subject = randomUUID();
  const user = await resolveGoogleUser(subject, address, "New Google user");
  assert.equal((await resolveGoogleUser(subject, address)).id, user.id);
  assert.equal(await prisma.user.count({ where: { email: address } }), 1);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash, null);
  const credentials = authOptions.providers.find(provider => provider.id === "credentials") as CredentialsConfig;
  assert.equal(await credentials.options!.authorize!({ email: address, password }, { body: {}, query: {}, headers: {}, method: "POST" }), null);
});

test("concurrent same-subject callbacks create one Account and reuse one User", async () => {
  for (const existing of [false, true]) {
    const address = existing ? (await createUser()).email : email();
    const subject = randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => resolveGoogleUser(subject, address)));
    assert.equal(new Set(results.map(user => user.id)).size, 1);
    assert.equal(await prisma.user.count({ where: { email: address } }), 1);
    assert.equal(await prisma.account.count({ where: { provider: "google", providerAccountId: subject } }), 1);
  }
});

test("concurrent different Google subjects sharing one verified email reuse the same User", async () => {
  const address = email();
  const results = await Promise.all(Array.from({ length: 5 }, () => resolveGoogleUser(randomUUID(), address)));
  assert.equal(new Set(results.map(user => user.id)).size, 1);
  assert.equal(await prisma.user.count({ where: { email: address } }), 1);
  assert.equal(await prisma.account.count({ where: { userId: results[0].id } }), 5);
});

test("conflicting concurrent emails for one Google subject never leave an orphan user or reassign the link", async () => {
  const addresses = [email(), email()];
  const subject = randomUUID();
  const results = await Promise.all(addresses.map(address => resolveGoogleUser(subject, address)));
  assert.equal(results[0].id, results[1].id);
  assert.equal(await prisma.user.count({ where: { email: { in: addresses } } }), 1);
  assert.equal(await prisma.account.count({ where: { provider: "google", providerAccountId: subject } }), 1);
});

test("unverified, malformed and mismatched Google profiles cannot create or link users", async () => {
  const owner = await createUser();
  const address = email();
  for (const candidate of [owner.email, address]) {
    for (const overrides of [{ email_verified: false }, { email_verified: undefined }, { email_verified: "true" }, { email: undefined }, { email: "invalid" }, { sub: "different-subject" }, { sub: undefined }]) {
      assert.equal(await authOptions.callbacks!.signIn!(googleCallback(candidate, randomUUID(), overrides)), false);
    }
  }
  const missing = googleCallback(owner.email);
  assert.equal(await authOptions.callbacks!.signIn!({ ...missing, profile: undefined }), false);
  assert.equal(await prisma.account.count({ where: { userId: owner.id } }), 0);
  assert.equal(await prisma.user.count({ where: { email: address } }), 0);
  assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: owner.id } }), owner);
});
