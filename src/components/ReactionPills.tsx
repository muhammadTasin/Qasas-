import { reactToStoryAction } from "@/lib/actions";
import type { ReactionType } from "@prisma/client";

const reactions: ReactionType[] = ["LOVE", "SORROW", "ANGRY"];

const labels: Record<ReactionType, string> = {
  LOVE: "Love",
  SORROW: "Sorrow",
  ANGRY: "Angry",
};

export default function ReactionPills({
  storyId,
  counts,
  selected,
  disabled,
}: {
  storyId: string;
  counts: Record<ReactionType, number>;
  selected?: ReactionType | null;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {reactions.map((reaction) => (
        <form action={reactToStoryAction} key={reaction}>
          <input type="hidden" name="storyId" value={storyId} />
          <input type="hidden" name="type" value={reaction} />
          <button
            type="submit"
            disabled={disabled}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              selected === reaction
                ? "border-[#bd6a4c] bg-[#bd6a4c]/20"
                : "border-black/10 bg-white/60 hover:border-black/20"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            {labels[reaction]} · {counts[reaction] || 0}
          </button>
        </form>
      ))}
    </div>
  );
}
