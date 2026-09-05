"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { forgotPasswordAction, resetPasswordAction } from "@/lib/password-reset-actions";

export default function PasswordResetForm({ mode }: { mode: "request" | "reset" }) {
  const lock = useRef(false); const [pending, setPending] = useState(false); const [message, setMessage] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return; lock.current = true; setPending(true); setMessage(undefined);
    const data = new FormData(event.currentTarget);
    try {
      if (mode === "request") setMessage((await forgotPasswordAction(data)).message);
      else {
        const token = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
        data.set("token", token);
        const result = await resetPasswordAction(data);
        if (result.redirectTo) { window.history.replaceState(null, "", window.location.pathname); window.location.replace(result.redirectTo); return; }
        setMessage(result.error);
      }
    } catch { setMessage("Something went wrong. Please try again."); }
    lock.current = false; setPending(false);
  }
  return <form onSubmit={submit} className="flex flex-col gap-4">
    {mode === "request" ? <input required name="email" type="email" maxLength={254} aria-label="Email" autoComplete="email" placeholder="Email" className="auth-input" /> : <>
      <input required name="password" type="password" minLength={8} aria-label="New password" autoComplete="new-password" placeholder="New password" className="auth-input" />
      <input required name="confirmPassword" type="password" minLength={8} aria-label="Confirm password" autoComplete="new-password" placeholder="Confirm password" className="auth-input" />
      <p className="text-xs text-ink-500">Use at least 8 characters (at most 72 UTF-8 bytes).</p>
    </>}
    {message && <p role="status" className="text-sm text-ink-500">{message}</p>}
    <button type="submit" disabled={pending} className="auth-submit">{pending ? "Please wait..." : mode === "request" ? "Send reset link" : "Reset password"}</button>
    <Link href={mode === "request" ? "/signin" : "/forgot-password"} className="text-xs text-center font-bold text-emerald-800 hover:underline">{mode === "request" ? "Back to Sign In" : "Request a new link"}</Link>
  </form>;
}
