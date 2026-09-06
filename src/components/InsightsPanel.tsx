"use client";
import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, Monitor, Clock, User as UserIcon } from 'lucide-react';
import { formatInsightReadTime } from '@/lib/format';
import type { getStoryInsights } from '@/lib/story-insights';
export type Insights = Awaited<ReturnType<typeof getStoryInsights>>;
export default function InsightsPanel({ data, onClose, returnFocusRef }: { data: Insights; onClose: () => void; returnFocusRef?: RefObject<HTMLButtonElement | null> }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Loading temporarily disables the launcher, so activeElement alone can
    // lose the original focus target before this asynchronously loaded dialog.
    const prior = returnFocusRef?.current || document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const items = panel.current?.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"]');
        const first = items?.[0]; const last = items?.[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); prior?.focus(); };
  }, [onClose, returnFocusRef]);
  const sections = [
    { kind: "Logged in", title: "Logged-in readers", count: data.loggedIn },
    { kind: "Guest", title: "Guest readers", count: data.guests },
    ...(data.legacy ? [{ kind: "Legacy", title: "Earlier readers", count: data.legacy }] : []),
  ];
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="insights-title" ref={panel} tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto liquid-glass-heavy rounded-[2.5rem] shadow-2xl border border-white/60 animate-in fade-in zoom-in-95 duration-300 no-scrollbar">

        {/* Header */}
        <div className="sticky top-0 z-20 liquid-glass border-b border-emerald-900/5 px-5 sm:px-8 py-6 flex justify-between items-center gap-3">
            <div>
                <h2 id="insights-title" className="font-serif text-2xl font-bold text-emerald-900">Story Insights</h2>
                <p className="text-xs font-sans text-emerald-800/60 font-bold uppercase tracking-widest">Private Analytics</p>
            </div>
            <button aria-label="Close Insights" onClick={onClose} className="w-8 h-8 shrink-0 rounded-full bg-emerald-100/50 text-emerald-900 hover:bg-emerald-200/50 flex items-center justify-center transition-colors">
                ✕
            </button>
        </div>

        <div className="p-5 sm:p-8 space-y-8">

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/40 rounded-2xl p-4 border border-white/60 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-800/60 mb-1">
                  <UserIcon size={14} aria-hidden /><span className="text-[10px] font-bold uppercase tracking-wider">Unique viewers</span>
                </div>
                <div className="text-3xl font-serif font-bold text-ink-900">{data.uniqueViewsCount}</div>
                <div className="mt-2 text-xs text-ink-500 space-y-1">
                  <div>Logged in: {data.loggedIn}</div><div>Guests: {data.guests}</div>
                  {data.legacy > 0 && <div>Earlier readers: {data.legacy}</div>}
                </div>
              </div>
              <div className="bg-white/40 rounded-2xl p-4 border border-white/60 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-800/60 mb-1">
                  <Clock size={14} aria-hidden /><span className="text-[10px] font-bold uppercase tracking-wider">Total read time</span>
                </div>
                <div className="text-2xl font-serif font-bold text-ink-900 break-words">{formatInsightReadTime(data.totalReadSeconds)}</div>
                <div className="mt-2 text-xs text-ink-500 space-y-1">
                  <div>Logged in: {formatInsightReadTime(data.loggedInReadSeconds)}</div>
                  <div>Guests: {formatInsightReadTime(data.guestReadSeconds)}</div>
                </div>
              </div>
            </div>

            <section aria-labelledby="insights-devices">
              <h3 id="insights-devices" className="text-sm font-bold text-ink-500 uppercase tracking-widest mb-3">Devices</h3>
              <dl className="grid grid-cols-2 gap-3">
                {Object.entries(data.devices).map(([category, count]) => <div key={category} className="flex items-center justify-between gap-2 rounded-xl bg-white/30 border border-white/40 px-3 py-2 text-sm text-ink-900">
                  <dt>{category}</dt><dd className="font-bold">{count}</dd>
                </div>)}
              </dl>
              <p className="text-xs text-ink-500 mt-3">Each unique reader counts once, using their latest observed device. A signed-in reader is combined across browsers.</p>
            </section>

            {sections.map(section => {
              const views = data.viewers.filter(view => view.visitorKind === section.kind);
              return <section key={section.kind} aria-label={section.title} className="space-y-3">
                <h3 className="text-sm font-bold text-ink-500 uppercase tracking-widest">{section.title} — {section.count}</h3>
                {section.kind === "Legacy" && <p className="text-xs text-ink-500">Older records have no reliable reader identity. New visits are classified as logged in or guest.</p>}
                {views.length === 0 && <p className="text-sm text-ink-400 italic">No {section.title.toLowerCase()} yet.</p>}
                {views.map(view => <article key={view.visitorLabel} className="rounded-2xl bg-white/30 border border-white/40 p-4 space-y-2 min-w-0">
                  {view.displayName && <h4 className="font-serif font-bold text-ink-900 break-words">{view.displayName}</h4>}
                  <p className="font-serif font-bold text-ink-900 text-sm break-all">{view.visitorLabel}</p>
                  <p className="text-xs text-ink-500 break-words">Device: {view.deviceModel}</p>
                  <p className="text-xs text-ink-500 flex flex-wrap items-center gap-1">
                    {view.deviceCategory === "Android" || view.deviceCategory === "iPhone" ? <Smartphone size={12} aria-hidden /> : <Monitor size={12} aria-hidden />}
                    {[view.deviceCategory, view.os || "OS unavailable", view.browser || "Browser unavailable"].join(" · ")}
                  </p>
                  {view.architecture && <p className="text-xs text-ink-500 break-words">Architecture: {view.architecture}</p>}
                  <p className="text-xs text-ink-500">Read time: {formatInsightReadTime(view.totalReadSeconds)}</p>
                  <p className="text-xs text-ink-500 break-words">Approximate location: {view.approximateLocation}</p>
                  <p className="text-xs text-ink-400">Last seen: <time dateTime={view.lastSeenAt}>{new Date(view.lastSeenAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></p>
                </article>)}
                {section.count > views.length && <p className="text-xs text-ink-500">Showing the {views.length} most recent of {section.count} readers. Totals include everyone.</p>}
              </section>;
            })}

            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-[11px] text-blue-800/80 leading-relaxed space-y-2">
              <p>Location is approximate and based on network information. VPNs, carriers and ISP routing may affect accuracy. GPS is never requested.</p>
              <p>Names are visible only to the story owner. Device details are browser-reported, not independently verified. Browser streams reflect their latest guest or signed-in state, including their accumulated reading time.</p>
            </div>

        </div>
      </div>
    </div>, document.body
  );
};
