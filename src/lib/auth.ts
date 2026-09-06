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

const googleProfileSchema = z.object({
  email_verified: z.literal(true),
  email: z.string().email(),
  sub: z.string().min(1),
  name: z.string().nullable().optional(),
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
      const parsed = googleProfileSchema.safeParse(profile);
      if (!parsed.success || parsed.data.sub !== account.providerAccountId) return false;
      const google = parsed.data;
      const local = await resolveGoogleUser(google.sub, google.email, google.name);
      user.id = local.id; user.name = local.name; user.email = local.email;
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
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
