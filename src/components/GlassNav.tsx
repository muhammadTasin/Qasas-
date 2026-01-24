import Link from "next/link";
import type { Session } from "next-auth";
import SignOutButton from "@/components/SignOutButton";

export default function GlassNav({ session }: { session: Session | null }) {
  return (
    <header className="sticky top-4 z-30 mx-auto w-full max-w-6xl px-4">
      <div className="glass flex items-center justify-between rounded-full px-5 py-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="rounded-full bg-[#2d6a6f]/10 px-3 py-1 text-xs uppercase tracking-[0.2em]">
            Qasas
          </span>
          <span className="text-sm text-muted">Stories that breathe</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/about" className="hover:text-[#bd6a4c]">
            About
          </Link>
          {session?.user ? (
            <>
              <Link href="/write" className="hover:text-[#bd6a4c]">
                Write
              </Link>
              <Link href="/me" className="hover:text-[#bd6a4c]">
                My stories
              </Link>
              <SignOutButton />
            </>
          ) : (
            <Link href="/signin" className="hover:text-[#bd6a4c]">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
