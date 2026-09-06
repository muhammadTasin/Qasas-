import { addCommentAction, deleteCommentAction } from "@/lib/actions";
import { Send } from "lucide-react";
import Link from "next/link";
import type { Comment } from "@prisma/client";

export default function CommentSection({ storyId, comments, currentUserId }: {
  storyId: string;
  comments: (Pick<Comment, "id" | "body" | "userId" | "createdAt"> & { user: { name: string | null } })[];
  currentUserId?: string | null;
}) {
  return <section className="max-w-[65ch] mx-auto">
    <h3 className="font-serif text-2xl text-emerald-900 mb-8 px-4 flex items-baseline gap-3">Reflections <span className="text-sm font-sans font-bold text-emerald-800/30">({comments.length})</span></h3>
    {currentUserId ? <div className="liquid-glass rounded-3xl p-6 mb-10">
      <form action={addCommentAction} className="relative">
        <input type="hidden" name="storyId" value={storyId} />
        <textarea name="body" required maxLength={1000} aria-label="Reflection" placeholder="Write a reflection..." className="w-full p-4 rounded-xl bg-white/40 border border-white/60 focus:bg-white focus:border-emerald-500 focus:ring-0 outline-none transition-all resize-none h-32 text-base font-serif text-ink-800 placeholder:text-ink-400" />
        <div className="flex justify-end items-center mt-4"><button type="submit" className="flex items-center gap-2 px-6 py-2 bg-emerald-800 text-white rounded-full hover:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed touch-spring shadow-lg shadow-emerald-900/10 text-sm font-bold">Post<Send size={14} /></button></div>
      </form>
    </div> : <div className="liquid-glass p-8 rounded-3xl text-center mb-10 border border-dashed border-emerald-900/10">
      <p className="font-serif text-ink-500 mb-3 italic">Join the circle to share your thoughts.</p><Link href="/signin" className="text-sm font-bold text-emerald-700 hover:text-emerald-900 underline decoration-2 underline-offset-4">Sign in</Link>
    </div>}
    <div className="space-y-4">
      {comments.map(comment => <div key={comment.id} className="liquid-glass p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex items-center justify-between mb-2">
          <span className="font-sans font-bold text-xs text-emerald-900 uppercase tracking-wider">{comment.user.name || "Anonymous"}</span>
          <span className="text-[10px] text-ink-400 font-sans">{comment.createdAt.toLocaleDateString()}</span>
        </div>
        <p className="font-serif text-ink-700 text-base leading-relaxed">{comment.body}</p>
        {currentUserId === comment.userId && <form action={deleteCommentAction} className="mt-2 text-right"><input type="hidden" name="commentId" value={comment.id} /><button className="text-xs text-rose-600">Delete</button></form>}
      </div>)}
    </div>
  </section>;
}
