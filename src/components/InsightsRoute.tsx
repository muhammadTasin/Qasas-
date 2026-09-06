"use client";
import { useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import InsightsPanel, { type Insights } from "./InsightsPanel";
const subscribe = () => () => {};
export default function InsightsRoute({ data, storyId }: { data: Insights; storyId: string }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const router = useRouter();
  const close = useCallback(() => router.push(`/stories/${storyId}`), [router, storyId]);
  return mounted ? <InsightsPanel data={data} onClose={close} /> : <p className="text-center text-ink-500">Loading Insights...</p>;
}
