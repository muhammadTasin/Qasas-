import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const userSelect = { id: true, email: true, name: true } as const;

// Only call after the Google callback verifies the email and provider subject.
// An existing provider link is authoritative, even if Google's email changes.
export async function resolveGoogleUser(subject: string, email: string, name?: string | null) {
  const where = { provider_providerAccountId: { provider: "google", providerAccountId: subject } };
  for (let attempt = 0; ; attempt++) {
    const linked = await prisma.account.findUnique({
      where,
      select: { user: { select: userSelect } },
    });
    if (linked) return linked.user;

    try {
      // This nested write is atomic. Matching emails connect to the original
      // User without changing its ID, password, profile or story relationships.
      const account = await prisma.account.create({
        data: {
          provider: "google",
          providerAccountId: subject,
          type: "oauth",
          user: { connectOrCreate: { where: { email }, create: { email, name } } },
        },
        select: { user: { select: userSelect } },
      });
      return account.user;
    } catch (error) {
      // Concurrent callbacks can race on either the email or provider key.
      // Retry against the winning row; failed nested writes leave no orphan User.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || attempt >= 2) throw error;
    }
  }
}
