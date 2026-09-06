"use client";
import { useCallback, useRef, useState } from "react";
import { BarChart2 } from "lucide-react";
import InsightsPanel, { type Insights } from "./InsightsPanel";

export default function InsightsLauncher({ storyId }: { storyId: string }) {
  const button = useRef<HTMLButtonElement>(null);
  const [data, setData] = useState<Insights>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const close = useCallback(() => setData(undefined), []);
  async function open() {
    if (pending) return;
    setPending(true); setError(false);
    try {
      const response = await fetch(`/api/stories/${storyId}/insights`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch { setError(true); }
    finally { setPending(false); }
  }
  return <div>
    <button ref={button} type="button" onClick={open} disabled={pending} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase tracking-wide hover:bg-emerald-200 transition-colors shadow-sm">
      <BarChart2 size={14} />{pending ? "Loading..." : "Insights"}
    </button>
    {error && <p role="alert" className="text-xs text-rose-600">Insights unavailable. Try again.</p>}
    {data && <InsightsPanel data={data} onClose={close} returnFocusRef={button} />}
  </div>;
}
