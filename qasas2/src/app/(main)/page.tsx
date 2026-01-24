'use client';

import React, { useEffect, useState } from 'react';
import { Story } from '@/types';
import { getStories } from '@/app/actions';
import { StoryCard } from '@/components/StoryCard';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Feather } from 'lucide-react';

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    getStories().then(data => {
      setStories(data as any);
      setLoading(false);
    });
  }, []);

  return (
    <div className="max-w-5xl mx-auto pt-6 pb-20 px-4 sm:px-6">
      
      {/* Hero Section */}
      <section className="mb-24 relative mt-8 sm:mt-16 text-center">
        <div className="relative z-10 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full liquid-glass text-emerald-800 mb-8 shadow-lg ring-1 ring-white/60">
                <Feather size={24} strokeWidth={1.5} />
            </div>
            
            <h1 className="font-serif text-5xl sm:text-7xl font-bold text-ink-900 mb-6 leading-tight tracking-tight">
              Qasas.
            </h1>
            
            <p className="font-serif text-xl sm:text-2xl text-ink-500 mb-10 leading-relaxed italic">
              "যেখানে শব্দরা কথা কয়, আর নিস্তব্ধতা পায় ভাষা"
            </p>
            
            {!isAuthenticated && (
                <Link href="/signin" className="inline-flex items-center px-8 py-3 bg-emerald-800 text-white rounded-full font-sans font-medium shadow-lg shadow-emerald-900/20 touch-spring hover:bg-emerald-900">
                    Join the Circle
                </Link>
            )}
        </div>
      </section>

      {/* Feed */}
      <section id="feed" className="space-y-12">
        <div className="flex items-center gap-4">
            <h2 className="font-sans text-xs font-bold uppercase tracking-widest text-emerald-800/60">Recent Stories</h2>
            <div className="h-px bg-emerald-900/10 flex-1"></div>
        </div>

        {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[1, 2].map(i => (
                    <div key={i} className="h-80 rounded-[2rem] bg-white/40 animate-pulse border border-white/50"></div>
                ))}
             </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {stories.map((story, i) => (
                    <div key={story.id} className="animate-in fade-in slide-in-from-bottom-8" style={{ animationDelay: `${i * 100}ms` }}>
                        <StoryCard story={story} />
                    </div>
                ))}
            </div>
        )}
        
        {!loading && stories.length === 0 && (
            <div className="liquid-glass rounded-[2rem] p-16 text-center text-ink-400 font-serif italic border-dashed border-2 border-emerald-900/5">
                <p>No stories yet. Be the first to break the silence.</p>
            </div>
        )}
      </section>
    </div>
  );
}