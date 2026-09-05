"use client";
import { useState, useRef, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function SignInForm() {
  const [error, setError] = useState<string>(); const [loading, setLoading] = useState(false); const lock = useRef(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return; lock.current = true;
    const data = new FormData(event.currentTarget); setLoading(true); setError(undefined);
    try {
      const result = await signIn("credentials", { email: data.get("email"), password: data.get("password"), redirect: false });
      if (!result || result.error) setError("Invalid credentials.");
      else { window.location.href = "/"; return; }
    } catch { setError("Sign-in is temporarily unavailable. Please try again."); }
    lock.current = false; setLoading(false);
  }
  return <form onSubmit={onSubmit} className="flex flex-col gap-4">
    <input required name="email" type="email" autoComplete="email" aria-label="Email" placeholder="Email" className="auth-input" />
    <input required name="password" type="password" autoComplete="current-password" aria-label="Password" placeholder="Password" className="auth-input" />
    <Link href="/forgot-password" className="text-xs font-bold text-emerald-800 text-right hover:underline">Forgot password?</Link>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    <button type="submit" disabled={loading} className="auth-submit">{loading ? "Signing in..." : "Sign in"}</button>
  </form>;
}
