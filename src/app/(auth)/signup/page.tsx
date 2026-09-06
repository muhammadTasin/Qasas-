import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import GoogleSignIn from "@/components/GoogleSignIn";
import { signupAction } from "@/lib/auth-actions";
import { googleEnabled } from "@/lib/auth";
export default function SignupPage() {
  return <AuthShell title="Join Qasas" description={googleEnabled ? "Create your account with Google or email" : "Create your account"}>
    {googleEnabled && <><GoogleSignIn /><p className="text-center text-xs text-ink-400 my-6">or use email</p></>}
    <form action={signupAction} className="flex flex-col gap-4">
      <input name="name" aria-label="Name (optional)" autoComplete="name" placeholder="Name (optional)" className="auth-input" />
      <input name="email" aria-label="Email" type="email" required autoComplete="email" placeholder="Email" className="auth-input" />
      <input name="password" aria-label="Password" type="password" required minLength={6} autoComplete="new-password" placeholder="Password" className="auth-input" />
      <button className="auth-submit">Create account</button>
    </form>
    <p className="text-sm text-ink-500 mt-6 text-center">Already a member? <Link href="/signin" className="text-emerald-800 hover:underline">Sign in.</Link></p>
  </AuthShell>;
}
