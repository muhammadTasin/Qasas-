import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";

// Reuse original Google Account links. Never attach a different provider merely
// because an email matches a credentials account.
export async function resolveGoogleUser(subject: string, email: string, name?: string | null) {
  const linked = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: subject } },
    select: { user: { select: { id: true, email: true, name: true } } },
  });
  if (linked) return linked.user;
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return null;
  const passwordHash = await hash(randomBytes(32).toString("hex"), 12);
  try {
    return await prisma.user.create({ data: { email, name, passwordHash,
      accounts: { create: { provider: "google", providerAccountId: subject, type: "oauth" } },
    }, select: { id: true, email: true, name: true } });
  } catch {
    const raced = await prisma.account.findUnique({ where: { provider_providerAccountId: { provider: "google", providerAccountId: subject } }, select: { user: { select: { id: true, email: true, name: true } } } });
    return raced?.user || null;
  }
}
