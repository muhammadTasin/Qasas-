"use client";
import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, Monitor, Users, Activity } from 'lucide-react';
import type { getSiteInsights } from '@/lib/site-insights';
export type SiteInsightsData = Awaited<ReturnType<typeof getSiteInsights>>;
export default function SiteInsightsPanel({ data, onClose, returnFocusRef }: { data: SiteInsightsData; onClose: () => void; returnFocusRef?: RefObject<HTMLButtonElement | null> }) {
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
    { kind: "New" as const, title: "New in the last 24h", count: data.newDevices },
    { kind: "Returning" as const, title: "Returning in the last 24h", count: data.returningDevices },
  ];
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="site-insights-title" ref={panel} tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto liquid-glass-heavy rounded-[2.5rem] shadow-2xl border border-white/60 animate-in fade-in zoom-in-95 duration-300 no-scrollbar">

        {/* Header */}
        <div className="sticky top-0 z-20 liquid-glass border-b border-emerald-900/5 px-5 sm:px-8 py-6 flex justify-between items-center gap-3">
            <div>
                <h2 id="site-insights-title" className="font-serif text-2xl font-bold text-emerald-900">Site Insights</h2>
                <p className="text-xs font-sans text-emerald-800/60 font-bold uppercase tracking-widest">Private Analytics · Last {data.windowHours}h</p>
            </div>
            <button aria-label="Close Insights" onClick={onClose} className="w-8 h-8 shrink-0 rounded-full bg-emerald-100/50 text-emerald-900 hover:bg-emerald-200/50 flex items-center justify-center transition-colors">
                ✕
            </button>
        </div>

        <div className="p-5 sm:p-8 space-y-8">

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/40 rounded-2xl p-4 border border-white/60 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-800/60 mb-1">
                  <Users size={14} aria-hidden /><span className="text-[10px] font-bold uppercase tracking-wider">Unique devices</span>
                </div>
                <div className="text-3xl font-serif font-bold text-ink-900">{data.uniqueDevicesCount}</div>
                <div className="mt-2 text-xs text-ink-500 space-y-1">
                  <div>New: {data.newDevices}</div><div>Returning: {data.returningDevices}</div>
                </div>
              </div>
              <div className="bg-white/40 rounded-2xl p-4 border border-white/60 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-800/60 mb-1">
                  <Activity size={14} aria-hidden /><span className="text-[10px] font-bold uppercase tracking-wider">Total visits</span>
                </div>
                <div className="text-3xl font-serif font-bold text-ink-900">{data.totalVisits}</div>
                <div className="mt-2 text-xs text-ink-500 space-y-1">
                  <div>Across {data.uniqueDevicesCount} devices</div>
                </div>
              </div>
            </div>

            <section aria-labelledby="site-insights-devices">
              <h3 id="site-insights-devices" className="text-sm font-bold text-ink-500 uppercase tracking-widest mb-3">Devices</h3>
              <dl className="grid grid-cols-2 gap-3">
                {Object.entries(data.devices).map(([category, count]) => <div key={category} className="flex items-center justify-between gap-2 rounded-xl bg-white/30 border border-white/40 px-3 py-2 text-sm text-ink-900">
                  <dt>{category}</dt><dd className="font-bold">{count}</dd>
                </div>)}
              </dl>
              <p className="text-xs text-ink-500 mt-3">Each unique device counts once, using its latest observed profile.</p>
            </section>

            {sections.map(section => {
              const views = data.visitors.filter(view => view.visitKind === section.kind);
              return <section key={section.kind} aria-label={section.title} className="space-y-3">
                <h3 className="text-sm font-bold text-ink-500 uppercase tracking-widest">{section.title} — {section.count}</h3>
                {views.length === 0 && <p className="text-sm text-ink-400 italic">No {section.title.toLowerCase()} yet.</p>}
                {views.map(view => <article key={view.visitorLabel} className="rounded-2xl bg-white/30 border border-white/40 p-4 space-y-2 min-w-0">
                  {view.displayName && <h4 className="font-serif font-bold text-ink-900 break-words">{view.displayName}</h4>}
                  <p className="font-serif font-bold text-ink-900 text-sm break-all">{view.visitorLabel}</p>
                  <p className="text-xs text-ink-500 break-words">Device: {view.deviceModel}</p>
                  <p className="text-xs text-ink-500 flex flex-wrap items-center gap-1">
                    {view.deviceCategory === "Android" || view.deviceCategory === "iPhone" ? <Smartphone size={12} aria-hidden /> : <Monitor size={12} aria-hidden />}
                    {[view.deviceCategory, view.os || "OS unavailable", view.browser || "Browser unavailable"].join(" · ")}
                  </p>
                  <p className="text-xs text-ink-500">Visits in window: {view.visitsInWindow}</p>
                  <p className="text-xs text-ink-500 break-words">Approximate location: {view.approximateLocation}</p>
                  <p className="text-xs text-ink-400">Last seen: <time dateTime={view.lastSeenAt}>{new Date(view.lastSeenAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></p>
                </article>)}
                {section.count > views.length && <p className="text-xs text-ink-500">Showing the {views.length} most recent of {section.count} devices. Totals include everyone.</p>}
              </section>;
            })}

            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-[11px] text-blue-800/80 leading-relaxed space-y-2">
              <p>Location is approximate and based on network information. VPNs, carriers and ISP routing may affect accuracy. GPS is never requested.</p>
              <p>Visible only to the site owner. Device details are browser-reported, not independently verified. Each device reflects its latest observed state over the last {data.windowHours} hours.</p>
            </div>

        </div>
      </div>
    </div>, document.body
  );
};
