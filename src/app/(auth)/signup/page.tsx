import Link from "next/link";
import { signupAction } from "@/lib/auth-actions";

export default function SignUpPage() {
  return (
    <div className="glass rounded-[32px] px-8 py-10">
      <h1 className="text-3xl">Create your account</h1>
      <p className="mt-3 text-sm text-muted">
        Join Qasas to write stories and track how they are received.
      </p>
      <form action={signupAction} className="mt-6 flex flex-col gap-4">
        <input
          name="name"
          placeholder="Name (optional)"
          className="glass rounded-2xl px-4 py-3 text-sm outline-none"
        />
        <input
          required
          type="email"
          name="email"
          placeholder="Email"
          className="glass rounded-2xl px-4 py-3 text-sm outline-none"
        />
        <input
          required
          type="password"
          name="password"
          placeholder="Password"
          className="glass rounded-2xl px-4 py-3 text-sm outline-none"
        />
        <button
          type="submit"
          className="rounded-full bg-[#2d6a6f] px-4 py-3 text-sm text-white"
        >
          Create account
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/signin" className="text-[#bd6a4c]">
          Sign in.
        </Link>
      </p>
    </div>
  );
}
