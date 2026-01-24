"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded-full border border-black/10 px-4 py-2 text-sm transition hover:border-black/20 hover:bg-white/60"
    >
      Sign out
    </button>
  );
}
