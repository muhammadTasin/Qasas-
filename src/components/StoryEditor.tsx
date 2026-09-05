import Link from "next/link";
import { ChevronLeft, Save } from "lucide-react";
import MutationForm from "./MutationForm";

export default function StoryEditor({ action, label, pendingLabel, publish = false, story }: {
  action: (data: FormData) => Promise<{ error?: string; redirectTo?: string }>;
  label: string; pendingLabel: string; publish?: boolean;
  story?: { id: string; title: string; content: string };
}) {
  return <div className="max-w-4xl mx-auto pt-6 px-4 pb-20">
    <div className="mb-6 flex items-center justify-between">
      <Link href={story ? `/stories/${story.id}` : "/"} aria-label="Back" className="text-ink-400 hover:text-ink-800 transition-colors"><ChevronLeft size={24} /></Link>
      <span className="text-xs font-sans font-bold text-emerald-800/60 uppercase tracking-widest">{publish ? "Drafting" : "Edit story"}</span>
      <div className="w-6" />
    </div>
    <MutationForm action={action} label={label} pendingLabel={pendingLabel} publish={publish}
      className="liquid-glass-heavy rounded-[2.5rem] p-8 sm:p-16 min-h-[75vh] relative flex flex-col"
      buttonWrapperClassName="flex justify-end pt-8 border-t border-emerald-900/5 mt-8 items-center gap-4" buttonIcon={<Save size={16} />}
      buttonClassName="flex items-center gap-2 bg-emerald-800 text-white px-8 py-3 rounded-full font-sans text-sm font-bold hover:bg-emerald-900 disabled:opacity-50 touch-spring shadow-lg shadow-emerald-900/20">
      {story && <input type="hidden" name="storyId" value={story.id} />}
      <div className="space-y-8 flex-1">
        <input aria-label="Story title" name="title" required minLength={3} maxLength={160} defaultValue={story?.title}
          className="w-full text-4xl sm:text-5xl font-serif font-bold text-ink-900 placeholder:text-emerald-900/20 bg-transparent border-none outline-none ring-0 p-0 tracking-tight" placeholder="Title your thoughts..." />
        <textarea aria-label="Story content" name="content" required minLength={20} defaultValue={story?.content}
          className="w-full h-full min-h-[50vh] text-lg leading-[1.8] font-serif text-ink-800 placeholder:text-emerald-900/20 bg-transparent border-none outline-none ring-0 p-0 resize-none" placeholder="Start writing..." />
      </div>
    </MutationForm>
  </div>;
}
