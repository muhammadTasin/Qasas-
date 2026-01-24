import type { StoryView } from "@prisma/client";
import { formatReadTime } from "@/lib/format";

export default function InsightsTable({
  views,
}: {
  views: StoryView[];
}) {
  return (
    <div className="glass mt-6 overflow-hidden rounded-3xl">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/60 text-xs uppercase tracking-widest text-muted">
          <tr>
            <th className="px-4 py-3">Viewer</th>
            <th className="px-4 py-3">Device</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">Read time</th>
            <th className="px-4 py-3">First seen</th>
            <th className="px-4 py-3">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {views.map((view) => (
            <tr key={view.id} className="border-t border-white/40">
              <td className="px-4 py-3 text-xs text-muted">
                {view.visitorId ? view.visitorId.slice(0, 8) : "Anon"}
              </td>
              <td className="px-4 py-3">
                <div>{view.deviceType || "unknown"}</div>
                <div className="text-xs text-muted">
                  {view.os || ""} {view.browser || ""}
                </div>
              </td>
              <td className="px-4 py-3">
                {[view.city, view.region, view.country].filter(Boolean).join(", ") ||
                  "Unknown"}
              </td>
              <td className="px-4 py-3">{formatReadTime(view.totalReadSeconds)}</td>
              <td className="px-4 py-3 text-xs text-muted">
                {view.firstSeenAt.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-xs text-muted">
                {view.lastSeenAt.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
