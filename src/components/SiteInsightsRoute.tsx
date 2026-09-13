"use client";
import { useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import SiteInsightsPanel, { type SiteInsightsData } from "./SiteInsightsPanel";
const subscribe = () => () => {};
export default function SiteInsightsRoute({ data }: { data: SiteInsightsData }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const router = useRouter();
  const close = useCallback(() => router.push("/"), [router]);
  return mounted ? <SiteInsightsPanel data={data} onClose={close} /> : <p className="text-center text-ink-500">Loading Insights...</p>;
}
