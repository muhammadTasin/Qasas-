import { getSession } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import SiteInsightsRoute from "@/components/SiteInsightsRoute";
import { getSiteInsights } from "@/lib/site-insights";

export const dynamic = "force-dynamic";

export default async function SiteInsightsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/signin");
  if (!session.user.isSiteAdmin) notFound();
  const insights = await getSiteInsights().catch(() => null);
  return insights ? <SiteInsightsRoute data={insights} /> : <p className="max-w-4xl mx-auto p-8 text-ink-500">Insights are temporarily unavailable. Please try again later.</p>;
}
