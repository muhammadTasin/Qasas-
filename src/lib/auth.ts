import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { resolveGoogleUser } from "./google-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    ...(googleEnabled ? [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })] : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.passwordHash) return null;

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name || undefined };
      },
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      const google = profile as { email_verified?: boolean; email?: string; sub?: string; name?: string };
      if (google?.email_verified !== true || !google.email || !google.sub || google.sub !== account.providerAccountId) return false;
      const local = await resolveGoogleUser(google.sub, google.email, google.name);
      if (!local) return "/signin?error=OAuthAccountNotLinked";
      user.id = local.id; user.name = local.name; user.email = local.email;
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      if (!token.sub) return token;
      const account = await prisma.user.findUnique({ where: { id: token.sub }, select: { sessionVersion: true } });
      if (!account) return {};
      if (user) token.sessionVersion = account.sessionVersion;
      if ((token.sessionVersion ?? 0) !== account.sessionVersion) return {};
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};
