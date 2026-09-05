import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import SignInForm from "@/components/SignInForm";
import GoogleSignIn from "@/components/GoogleSignIn";
import { googleEnabled } from "@/lib/auth";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ reset?: string; error?: string }> }) {
  const params = await searchParams;
  return <AuthShell title="Welcome Back" description={googleEnabled ? "Sign in with Google or your email to continue" : "Sign in to continue"}>
    {params.reset === "success" && <p role="status" className="text-sm text-emerald-800 mb-6">Your password has been reset. Sign in with your new password.</p>}
    {params.error && <p role="alert" className="text-sm text-rose-600 mb-6">Could not sign in with Google. Use your existing sign-in method or reset your password.</p>}
    {googleEnabled && <><GoogleSignIn /><p className="text-center text-xs text-ink-400 my-6">or use email</p></>}
    <SignInForm />
    <p className="text-sm text-ink-500 mt-6 text-center">No account yet? <Link href="/signup" className="text-emerald-800 hover:underline">Create one.</Link></p>
  </AuthShell>;
}
