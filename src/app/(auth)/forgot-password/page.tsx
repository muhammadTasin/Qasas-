import AuthShell from "@/components/AuthShell";
import PasswordResetForm from "@/components/PasswordResetForm";
export default function ForgotPasswordPage() {
  return <AuthShell title="Forgot password?" description="Enter your account email to request a secure reset link."><PasswordResetForm mode="request" /></AuthShell>;
}
