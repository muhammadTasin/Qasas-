import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import SignInForm from "@/components/SignInForm";
import GoogleSignIn from "@/components/GoogleSignIn";
import { googleEnabled } from "@/lib/auth";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <AuthShell title="Welcome Back" description={googleEnabled ? "Sign in with Google or your email to continue" : "Sign in to continue"}>
    {params.error && <p role="alert" className="text-sm text-rose-600 mb-6">Could not sign in with Google. Please try again or sign in with your email and password.</p>}
    {googleEnabled && <><GoogleSignIn /><p className="text-center text-xs text-ink-400 my-6">or use email</p></>}
    <SignInForm />
    <p className="text-sm text-ink-500 mt-6 text-center">No account yet? <Link href="/signup" className="text-emerald-800 hover:underline">Create one.</Link></p>
  </AuthShell>;
}
