"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
export default function GoogleSignIn() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return <>
    <button type="button" className="auth-submit" disabled={pending} onClick={async () => {
      setPending(true); setError(false);
      try { await signIn("google", { callbackUrl: "/" }); }
      catch { setError(true); setPending(false); }
    }}>{pending ? "Redirecting..." : "Continue with Google"}</button>
    {error && <p role="alert" className="text-sm text-rose-600 mt-3">Could not start Google sign-in. Please try again.</p>}
  </>;
}
