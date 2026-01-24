import React from 'react';
import Link from 'next/link';
import { Story } from '@/types';
import { Clock } from 'lucide-react';

export const StoryCard: React.FC<{ story: Story }> = ({ story }) => {
  return (
    <Link href={`/stories/${story.id}`} className="block group h-full touch-spring">
      <article className="liquid-glass rounded-[2rem] p-8 h-full flex flex-col justify-between relative overflow-hidden hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500">
        
        {/* Dynamic Highlight Gradient (Glare) */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/40 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none transform -translate-x-full group-hover:translate-x-full ease-in-out"></div>

        <div className="relative z-10">
            {/* Author Eyebrow */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-sans font-bold text-emerald-800/70 uppercase tracking-widest">
                        {story.author.name}
                    </span>
                    <div className="w-1 h-1 rounded-full bg-emerald-800/20"></div>
                    <span className="text-[10px] text-ink-400 font-medium">
                        {new Date(story.createdAt).toLocaleDateString()}
                    </span>
                </div>
            </div>
            
            <h3 className="font-serif text-2xl font-bold text-ink-800 mb-4 leading-[1.2] group-hover:text-emerald-900 transition-colors">
                {story.title}
            </h3>
            
            <p className="font-serif text-ink-500 text-base leading-relaxed line-clamp-3 mb-8">
                {story.content}
            </p>
        </div>

        {/* Footer Meta */}
        <div className="relative z-10 flex items-center justify-between pt-4 border-t border-white/50">
            <div className="flex items-center gap-1.5 text-xs font-sans font-medium text-ink-400">
                <Clock size={12} />
                {story.estimatedReadTimeMinutes} min
            </div>
            
            {/* Jewel Reactions */}
            <div className="flex gap-1.5">
                {story.reactionCounts.LOVE > 0 && (
                    <div className="flex items-center gap-1 h-6 px-2 rounded-full bg-care/5 text-care text-[10px] font-bold border border-care/10">
                        <span aria-hidden>❤️</span> {story.reactionCounts.LOVE}
                    </div>
                )}
                {story.reactionCounts.SORROW > 0 && (
                    <div className="flex items-center gap-1 h-6 px-2 rounded-full bg-sorrow/5 text-sorrow text-[10px] font-bold border border-sorrow/10">
                        <span aria-hidden>😢</span> {story.reactionCounts.SORROW}
                    </div>
                )}
                {story.reactionCounts.ANGRY > 0 && (
                    <div className="flex items-center gap-1 h-6 px-2 rounded-full bg-angry/5 text-angry text-[10px] font-bold border border-angry/10">
                        <span aria-hidden>😡</span> {story.reactionCounts.ANGRY}
                    </div>
                )}
            </div>
        </div>
      </article>
    </Link>
  );
};
