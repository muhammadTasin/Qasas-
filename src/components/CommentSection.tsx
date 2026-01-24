import { addCommentAction, deleteCommentAction } from "@/lib/actions";
import type { Comment, User } from "@prisma/client";

export default function CommentSection({
  storyId,
  comments,
  currentUserId,
}: {
  storyId: string;
  comments: (Comment & { user: User })[];
  currentUserId?: string | null;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h3 className="text-xl">Comments</h3>
        <span className="text-sm text-muted">{comments.length} total</span>
      </div>

      {currentUserId ? (
        <form action={addCommentAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="storyId" value={storyId} />
          <textarea
            name="body"
            required
            rows={4}
            className="glass rounded-2xl px-4 py-3 text-sm outline-none"
            placeholder="Add a thoughtful response..."
          />
          <button
            type="submit"
            className="w-fit rounded-full bg-[#2d6a6f] px-4 py-2 text-sm text-white"
          >
            Post comment
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted">Sign in to comment.</p>
      )}

      <div className="mt-6 space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="glass rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {comment.user.name || comment.user.email}
                </p>
                <p className="text-xs text-muted">
                  {comment.createdAt.toLocaleString()}
                </p>
              </div>
              {currentUserId === comment.userId ? (
                <form action={deleteCommentAction}>
                  <input type="hidden" name="commentId" value={comment.id} />
                  <button
                    type="submit"
                    className="text-xs text-[#bd6a4c]"
                  >
                    Delete
                  </button>
                </form>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed">{comment.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
