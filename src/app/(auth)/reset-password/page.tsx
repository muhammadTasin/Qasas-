import type { Metadata } from "next";
import AuthShell from "@/components/AuthShell";
import PasswordResetForm from "@/components/PasswordResetForm";
export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };
export default function ResetPasswordPage() {
  return <AuthShell title="Reset password" description="Choose a new password for your Qasas account."><PasswordResetForm mode="reset" /></AuthShell>;
}
