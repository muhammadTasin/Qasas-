import { reactToStoryAction } from "@/lib/actions";
import type { ReactionType } from "@prisma/client";

const reactions: ReactionType[] = ["LOVE", "ANGRY", "SORROW"];

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
    <div className="flex flex-wrap justify-center gap-4">
      {reactions.map((reaction) => (
        <form action={reactToStoryAction} key={reaction}>
          <input type="hidden" name="storyId" value={storyId} />
          <input type="hidden" name="type" value={reaction} />
          <button
            type="submit"
            disabled={disabled}
            aria-label={`${labels[reaction]} · ${counts[reaction]}`}
            title={disabled ? "Sign in to react" : labels[reaction]}
            className={`h-14 px-6 rounded-full flex items-center gap-2 border transition-all duration-300 touch-spring disabled:opacity-50 disabled:cursor-not-allowed ${
              selected === reaction ? ({ LOVE: "bg-care/10 border-care text-care shadow-lg shadow-care/20", ANGRY: "bg-angry/10 border-angry text-angry shadow-lg shadow-angry/20", SORROW: "bg-sorrow/10 border-sorrow text-sorrow shadow-lg shadow-sorrow/20" }[reaction])
              : ({ LOVE: "bg-white/50 border-white/60 text-ink-400 hover:text-care hover:bg-care/5", ANGRY: "bg-white/50 border-white/60 text-ink-400 hover:text-angry hover:bg-angry/5", SORROW: "bg-white/50 border-white/60 text-ink-400 hover:text-sorrow hover:bg-sorrow/5" }[reaction])
            }`}
          >
            <span aria-hidden>{({ LOVE: "❤️", ANGRY: "😡", SORROW: "😢" })[reaction]}</span> <span className="font-sans font-bold text-sm">{counts[reaction]}</span>
          </button>
        </form>
      ))}
    </div>
  );
}
