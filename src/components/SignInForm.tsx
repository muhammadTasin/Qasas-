"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setLoading(true);
    setError(null);

    const response = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    setLoading(false);

    if (response?.error) {
      setError("Invalid credentials.");
      return;
    }

    window.location.href = "/";
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <input
        required
        name="email"
        type="email"
        placeholder="Email"
        className="glass rounded-2xl px-4 py-3 text-sm outline-none"
      />
      <input
        required
        name="password"
        type="password"
        placeholder="Password"
        className="glass rounded-2xl px-4 py-3 text-sm outline-none"
      />
      {error ? <p className="text-sm text-[#bd6a4c]">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-[#2d6a6f] px-4 py-3 text-sm text-white"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
