"use server";
import { after } from "next/server";
import { headers } from "next/headers";
import { requestPasswordReset, resetPassword, resetEmailSchema, RESET_RESPONSE } from "./password-reset";

export async function forgotPasswordAction(formData: FormData) {
  const email = resetEmailSchema.safeParse(formData.get("email"));
  if (email.success) {
    const requestHeaders = await headers();
    const network = (requestHeaders.get("x-real-ip") || requestHeaders.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0,128);
    after(async () => {
      try { await requestPasswordReset(email.data, network); }
      catch { console.error("Password reset request could not be delivered. Check server email configuration and availability."); }
    });
  }
  return { message: RESET_RESPONSE };
}

export async function resetPasswordAction(formData: FormData) {
  const token = formData.get("token"); const password = formData.get("password");
  if (typeof token !== "string" || typeof password !== "string" || password !== formData.get("confirmPassword")) return { error: "Check that your passwords match." };
  try {
    if (await resetPassword(token, password)) return { redirectTo: "/signin?reset=success" };
  } catch { /* Do not return database/provider details. */ }
  return { error: "This link is invalid or expired, or the password does not meet the requirements. Request a new link and try again." };
}
