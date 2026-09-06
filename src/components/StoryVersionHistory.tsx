"use client";

import { useEffect, useId, useState } from "react";
import { useSession } from "next-auth/react";
import { History, RotateCcw } from "lucide-react";
import { restoreStoryVersionAction } from "@/lib/actions";
import MutationForm from "./MutationForm";

type Version = { version: number; title: string; createdAt: string; restoredFromVersion: number | null };
type HistoryPage = { currentVersion: number; versions: Version[]; nextBefore: number | null };
type Props = { storyId: string; authorId: string; currentVersion: number };
const dateLabel = (date: string) => new Date(date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function StoryVersionHistory(props: Props) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (status !== "authenticated" || session?.user?.id !== props.authorId) return null;
  return <div className="mb-6">
    <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}
      className="ml-auto flex items-center gap-2 rounded-full border border-emerald-900/10 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 touch-spring">
      <History size={16} aria-hidden="true" />Version History
    </button>
    {open && <section id={panelId} aria-label="Version History" className="mt-4 liquid-glass-heavy rounded-[2rem] p-5 sm:p-8">
      <HistoryContent key={`${props.storyId}:${props.currentVersion}`} {...props} />
    </section>}
  </div>;
}

function HistoryContent({ storyId, currentVersion }: Props) {
  const [history, setHistory] = useState<HistoryPage | null>(null);
  const [before, setBefore] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/stories/${storyId}/versions${before ? `?before=${before}` : ""}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("History is unavailable. Check that this story is active and belongs to you.");
        return response.json() as Promise<HistoryPage>;
      })
      .then(page => {
        if (controller.signal.aborted) return;
        setHistory(previous => ({ ...page, versions: before && previous ? [...previous.versions, ...page.versions] : page.versions }));
        setLoading(false);
      })
      .catch(error => { if (!controller.signal.aborted) { setError(error.message); setLoading(false); } });
    return () => controller.abort();
  }, [storyId, before, attempt]);
  return <>
    <h2 className="font-serif text-2xl text-ink-900">Version History</h2>
    <p className="mt-2 mb-5 text-sm text-ink-500">Saved versions of your story. Restoring publishes a new version and keeps all later history.</p>
    {history && history.currentVersion !== currentVersion && <p role="alert" className="mb-4 text-sm text-rose-600">This story changed in another tab. Copy your unsaved text, then reload the editor.</p>}
    <ol className="space-y-3">
      {history?.versions.map(version => <li key={version.version} className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-900/10 pb-3">
        <div className="min-w-0">
          <p className="font-medium text-sm text-ink-800">Version {version.version}{version.version === history.currentVersion ? " · Current published" : ""}</p>
          <time dateTime={version.createdAt} className="text-xs text-ink-500">{dateLabel(version.createdAt)}</time>
          {version.restoredFromVersion !== null && <p className="text-xs text-emerald-800">Restored from version {version.restoredFromVersion}</p>}
        </div>
        <button type="button" aria-label={`View version ${version.version}`} aria-pressed={selected === version.version}
          onClick={() => setSelected(version.version)} className="rounded-full border border-emerald-900/10 px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-50">View</button>
      </li>)}
    </ol>
    {loading && <p role="status" className="mt-4 text-sm text-ink-500">Loading history…</p>}
    {error && <div className="mt-4"><p role="alert" className="text-sm text-rose-600">{error}</p>
      <button type="button" className="mt-2 text-sm text-emerald-800 underline" onClick={() => { setError(undefined); setLoading(true); setAttempt(attempt + 1); }}>Try again</button></div>}
    {history?.nextBefore && !loading && !error && <button type="button" className="mt-4 text-sm text-emerald-800 underline" onClick={() => { setLoading(true); setBefore(history.nextBefore); }}>Load older versions</button>}
    {history?.versions.length === 0 && !loading && !error && <p className="mt-4 text-sm text-ink-500">No saved versions yet. Your current text will be preserved when you next edit this story.</p>}
    {selected !== null && <VersionPreview key={selected} storyId={storyId} version={selected} currentVersion={currentVersion}
      canRestore={history?.currentVersion === currentVersion} />}
  </>;
}

function VersionPreview({ storyId, version, currentVersion, canRestore }: { storyId: string; version: number; currentVersion: number; canRestore: boolean }) {
  const [snapshot, setSnapshot] = useState<(Version & { content: string }) | null>(null);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/stories/${storyId}/versions/${version}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Could not load this version. It may no longer be available to you.");
        return response.json() as Promise<Version & { content: string }>;
      })
      .then(value => { if (!controller.signal.aborted) setSnapshot(value); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [storyId, version, attempt]);
  return <div className="mt-6 border-t border-emerald-900/10 pt-6" aria-label={`Version ${version} preview`}>
    {error ? <><p role="alert" className="text-sm text-rose-600">{error}</p><button type="button" className="mt-2 text-sm text-emerald-800 underline"
      onClick={() => { setError(undefined); setAttempt(attempt + 1); }}>Try again</button></> : !snapshot ? <p role="status">Loading version…</p> : <>
      <p className="text-xs uppercase tracking-widest text-emerald-800 mb-3">Version {snapshot.version} preview</p>
      <h3 className="font-serif text-2xl text-ink-900 break-words">{snapshot.title}</h3>
      <div className="my-5 max-h-96 overflow-y-auto whitespace-pre-wrap break-words font-serif text-ink-800 leading-relaxed">{snapshot.content}</div>
      {version < currentVersion && canRestore && <MutationForm action={restoreStoryVersionAction} label="Restore this version" pendingLabel="Restoring…"
        buttonIcon={<RotateCcw size={16} aria-hidden="true" />} buttonClassName="flex items-center justify-center gap-2 rounded-full bg-emerald-800 text-white px-5 py-3 text-sm font-medium hover:bg-emerald-900"
        buttonWrapperClassName="mt-3">
        <input type="hidden" name="storyId" value={storyId} />
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="expectedVersion" value={currentVersion} />
        <p className="text-sm text-ink-500">This becomes the published story. Unsaved edits in the editor are not included.</p>
      </MutationForm>}
    </>}
  </div>;
}
