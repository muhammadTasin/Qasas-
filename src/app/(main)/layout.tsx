import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import GlassNav from "@/components/GlassNav";
import SiteStatsWidget from "@/components/SiteStatsWidget";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <div>
      <GlassNav session={session} />
      <main className="mx-auto w-full max-w-6xl">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-10">
        <SiteStatsWidget />
        <p className="mt-4 text-xs text-muted">
          Qasas keeps visitor metrics privacy-safe and cookie-based.
        </p>
      </footer>
    </div>
  );
}
