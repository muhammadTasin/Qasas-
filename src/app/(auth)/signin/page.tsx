import Link from "next/link";
import SignInForm from "@/components/SignInForm";

export default function SignInPage() {
  return (
    <div className="glass rounded-[32px] px-8 py-10">
      <h1 className="text-3xl">Welcome back</h1>
      <p className="mt-3 text-sm text-muted">
        Sign in to write, react, and keep track of your story insights.
      </p>
      <SignInForm />
      <p className="mt-6 text-sm text-muted">
        No account yet?{" "}
        <Link href="/signup" className="text-[#bd6a4c]">
          Create one.
        </Link>
      </p>
    </div>
  );
}
