import { createHash, createHmac, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma";

export const RESET_RESPONSE = "If an account exists for this email, a reset link has been sent.";
export const resetEmailSchema = z.string().trim().email().max(254);
export const resetPasswordSchema = z.string().min(8).refine(value => Buffer.byteLength(value, "utf8") <= 72);
export const resetTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const tokenDigest = (value: string) => createHash("sha256").update(value).digest("hex");

export function resetBaseUrl() {
  const url = new URL(process.env.NEXTAUTH_URL || "");
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) || url.username || url.password) {
    throw new Error("Invalid reset URL configuration");
  }
  return url.origin;
}

async function takeLimit(subject: string, limit: number, seconds: number) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Missing auth secret");
  const key = createHmac("sha256", secret).update(subject).digest("hex");
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "PasswordResetRateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, NOW() + ${seconds} * INTERVAL '1 second')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "PasswordResetRateLimit"."resetAt" <= NOW() THEN 1 ELSE LEAST("PasswordResetRateLimit"."count" + 1, ${limit + 1}) END,
      "resetAt" = CASE WHEN "PasswordResetRateLimit"."resetAt" <= NOW() THEN NOW() + ${seconds} * INTERVAL '1 second' ELSE "PasswordResetRateLimit"."resetAt" END
    RETURNING "count"`;
  return rows[0].count <= limit;
}

export type ResetMail = { to: string; resetUrl: string };
export async function sendResetEmail({ to, resetUrl }: ResetMail) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_FROM;
  if (!key || !from) throw new Error("Password reset email is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: "Reset your Qasas password",
      text: `A password reset was requested for your Qasas account.\n\n${resetUrl}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, you can ignore this email.`,
    }),
  });
  if (!response.ok) throw new Error("Password reset delivery failed");
}

// The caller runs this after sending the same response for every email address.
// A mail dependency is injectable only in local tests; HTTP clients cannot choose it.
export async function requestPasswordReset(email: string, network: string, deliver: (mail: ResetMail) => Promise<void> = sendResetEmail) {
  const parsed = resetEmailSchema.safeParse(email);
  if (!parsed.success) return;
  const base = resetBaseUrl();
  await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await prisma.passwordResetRateLimit.deleteMany({ where: { resetAt: { lte: new Date() } } });
  const allowed = await Promise.all([takeLimit(`email:${parsed.data.toLowerCase()}`, 1, 60), takeLimit(`network:${network}`, 10, 3600)]);
  if (allowed.some(value => !value)) return;
  // Match the existing case-sensitive credentials/signup identity exactly.
  const user = await prisma.user.findUnique({ where: { email: parsed.data }, select: { id: true, email: true } });
  if (!user) return;
  const token = randomBytes(32).toString("hex");
  const tokenHash = tokenDigest(token);
  await prisma.passwordResetToken.upsert({ where: { userId: user.id },
    create: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    update: { tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000), createdAt: new Date() },
  });
  // Fragments are not sent in HTTP request URLs, server logs or Referer headers.
  const url = new URL("/reset-password", base);
  url.hash = `token=${token}`;
  try { await deliver({ to: user.email, resetUrl: url.toString() }); }
  catch {
    await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
    throw new Error("Password reset delivery failed");
  }
}

export async function resetPassword(token: string, password: string) {
  if (!resetTokenSchema.safeParse(token).success || !resetPasswordSchema.safeParse(password).success) return false;
  const tokenHash = tokenDigest(token);
  // Avoid expensive bcrypt work for random/expired tokens.
  const candidate = await prisma.passwordResetToken.findFirst({ where: { tokenHash, expiresAt: { gt: new Date() } }, select: { userId: true } });
  if (!candidate) return false;
  const passwordHash = await hash(password, 12);
  return prisma.$transaction(async tx => {
    // Atomic consume: concurrent attempts cannot both change the password.
    const consumed = await tx.passwordResetToken.deleteMany({ where: { tokenHash, expiresAt: { gt: new Date() } } });
    if (!consumed.count) return false;
    await tx.user.update({ where: { id: candidate.userId }, data: { passwordHash, sessionVersion: { increment: 1 } } });
    return true;
  });
}
