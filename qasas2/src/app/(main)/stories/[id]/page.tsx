'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Story, Comment, ReactionType, StoryView, AnalyticsStats } from '@/types';
import { getStory, addCommentAction, toggleReactionAction, recordViewAction, getStoryAnalyticsAction, deleteStoryAction } from '@/app/actions';
import { useAuth } from '@/contexts/AuthContext';
import { ReadTracker } from '@/components/ReadTracker';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { ArrowLeft, Send, Clock, Eye, BarChart2 } from 'lucide-react';

export default function StoryDetail() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  
  const [data, setData] = useState<{ story: Story; comments: Comment[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  
  // Analytics State
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<StoryView[]>([]);
  const [analyticsStats, setAnalyticsStats] = useState<AnalyticsStats | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    const res = await getStory(id);
    if (res) setData(res as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    if (id) {
        recordViewAction(id);
    }
  }, [id, user?.id]);

  useEffect(() => {
    if (id) {
        const savedDraft = localStorage.getItem(`mosk_comment_draft_${id}`);
        if (savedDraft) setCommentText(savedDraft);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
        localStorage.setItem(`mosk_comment_draft_${id}`, commentText);
    }
  }, [commentText, id]);

  const handleReaction = async (type: ReactionType) => {
    if (!isAuthenticated) return;
    if (!id || !user) return;

    const oldData = data;
    if (!data) return;

    const isRemoving = data.story.currentUserReaction === type;
    const newReaction = isRemoving ? undefined : type;
    
    const newCounts = { ...data.story.reactionCounts };
    if (data.story.currentUserReaction) {
        newCounts[data.story.currentUserReaction]--;
    }
    if (!isRemoving) {
        newCounts[type]++;
    }

    setData({
        ...data,
        story: {
            ...data.story,
            currentUserReaction: newReaction,
            reactionCounts: newCounts
        }
    });

    try {
        await toggleReactionAction(id, type);
        fetchData();
    } catch (e) {
        setData(oldData);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!commentText.trim() || !user || !id) return;
      
      setSubmittingComment(true);
      try {
          await addCommentAction(id, commentText);
          setCommentText('');
          localStorage.removeItem(`mosk_comment_draft_${id}`);
          fetchData();
      } finally {
          setSubmittingComment(false);
      }
  };

  const handleShowAnalytics = async () => {
      if (!data || !user) return;
      setShowAnalytics(true);
      setLoadingAnalytics(true);
      try {
          const res = await getStoryAnalyticsAction(data.story.id);
          setAnalyticsData((res as any).views || []);
          setAnalyticsStats((res as any).stats || null);
      } catch (e) {
          alert("Could not load analytics.");
          setShowAnalytics(false);
      } finally {
          setLoadingAnalytics(false);
      }
  };

  const handleDeleteStory = async () => {
      if (!data) return;
      const confirmed = window.confirm("Delete this story? This cannot be undone.");
      if (!confirmed) return;
      try {
          await deleteStoryAction(data.story.id);
          router.push('/');
          router.refresh();
      } catch (e) {
          alert('Could not delete story.');
      }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-emerald-800 font-serif italic animate-pulse">Unfolding story...</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-ink-500 font-sans">Story not found.</div>;

  const { story, comments } = data;
  const isAuthor = user?.id === story.authorId;

  const getReactionConfig = (type: ReactionType) => {
      const active = story.currentUserReaction === type;
      switch(type) {
          case ReactionType.LOVE:
              return {
                  icon: <span aria-hidden>❤️</span>,
                  style: active 
                    ? "bg-care/10 border-care text-care shadow-lg shadow-care/20" 
                    : "bg-white/50 border-white/60 text-ink-400 hover:text-care hover:bg-care/5",
                  label: "Love"
              };
          case ReactionType.ANGRY:
              return {
                  icon: <span aria-hidden>😡</span>,
                  style: active 
                    ? "bg-angry/10 border-angry text-angry shadow-lg shadow-angry/20" 
                    : "bg-white/50 border-white/60 text-ink-400 hover:text-angry hover:bg-angry/5",
                  label: "Angry"
              };
          case ReactionType.SORROW:
              return {
                  icon: <span aria-hidden>😢</span>,
                  style: active 
                    ? "bg-sorrow/10 border-sorrow text-sorrow shadow-lg shadow-sorrow/20" 
                    : "bg-white/50 border-white/60 text-ink-400 hover:text-sorrow hover:bg-sorrow/5",
                  label: "Sorrow"
              };
      }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-4xl mx-auto pt-6 px-4 pb-20">
      <ReadTracker storyId={story.id} />
      
      {/* Analytics Modal */}
      {showAnalytics && (
          <AnalyticsDashboard 
            views={analyticsData} 
            totalReadTime={analyticsStats?.totalReadTime ?? story.totalReadSeconds} 
            stats={analyticsStats}
            onClose={() => setShowAnalytics(false)} 
          />
      )}

      {/* Nav */}
      <div className="mb-8 flex items-center justify-between">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 px-4 py-2 rounded-full liquid-glass text-sm text-ink-500 hover:text-emerald-900 font-medium touch-spring">
            <ArrowLeft size={16} /> 
            Back
        </button>

        {isAuthor && (
            <div className="flex items-center gap-2">
                <button 
                    onClick={handleShowAnalytics}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase tracking-wide hover:bg-emerald-200 transition-colors shadow-sm"
                >
                    <BarChart2 size={14} />
                    Insights
                </button>
                <button
                    onClick={handleDeleteStory}
                    className="inline-flex items-center px-3 py-2 rounded-full border border-rose-200 text-rose-600 text-[10px] font-bold uppercase tracking-wide hover:bg-rose-50 transition-colors"
                >
                    Delete
                </button>
            </div>
        )}
      </div>

      <article className="reading-surface rounded-[2.5rem] p-8 sm:p-16 mb-12 relative overflow-hidden">
        <div className="flex flex-col items-center gap-4 mb-12 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50/50 border border-emerald-100/50 text-[10px] font-sans font-bold uppercase tracking-widest text-emerald-800">
                {story.author.name}
            </div>
            
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-ink-900 leading-[1.1] tracking-tight">
                {story.title}
            </h1>

            <div className="flex items-center gap-4 text-xs font-sans text-ink-400 font-medium">
                <span>{new Date(story.createdAt).toLocaleDateString()}</span>
                <span className="w-1 h-1 rounded-full bg-emerald-200"></span>
                <span className="flex items-center gap-1"><Clock size={12} /> {story.estimatedReadTimeMinutes} min</span>
                <span className="w-1 h-1 rounded-full bg-emerald-200"></span>
                <span className="flex items-center gap-1" title="Aggregate read time by all users">
                    <Eye size={12} /> {(story.totalReadSeconds / 60).toFixed(0)}m total read
                </span>
            </div>
        </div>

        <div className="prose prose-xl prose-p:font-serif prose-headings:font-serif max-w-[65ch] mx-auto text-ink-800 leading-[1.8] whitespace-pre-wrap selection:bg-emerald-100">
            {story.content}
        </div>

        <div className="mt-24 pt-12 border-t border-emerald-900/5 flex flex-col items-center">
            <p className="text-xs font-sans text-ink-400 mb-8 uppercase tracking-widest font-bold opacity-60">Reaction</p>
            
            <div className="flex flex-wrap justify-center gap-4">
                {[ReactionType.LOVE, ReactionType.ANGRY, ReactionType.SORROW].map((type) => {
                    const config = getReactionConfig(type);
                    return (
                        <div key={type} className="flex flex-col items-center gap-2 group">
                             <button 
                                disabled={!isAuthenticated}
                                onClick={() => handleReaction(type)}
                                className={`h-14 px-6 rounded-full flex items-center gap-2 border transition-all duration-300 touch-spring disabled:opacity-50 disabled:cursor-not-allowed ${config.style}`}
                                title={!isAuthenticated ? "Sign in to react" : config.label}
                            >
                                {config.icon}
                                <span className="font-sans font-bold text-sm">{story.reactionCounts[type]}</span>
                            </button>
                        </div>
                    );
                })}
            </div>
            
            {!isAuthenticated && (
                <Link href="/signin" className="mt-6 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors">Sign in to react</Link>
            )}
        </div>
      </article>

      <section className="max-w-[65ch] mx-auto">
        <h3 className="font-serif text-2xl text-emerald-900 mb-8 px-4 flex items-baseline gap-3">
            Reflections <span className="text-sm font-sans font-bold text-emerald-800/30">({comments.length})</span>
        </h3>

        {isAuthenticated ? (
            <div className="liquid-glass rounded-3xl p-6 mb-10">
                <form onSubmit={handleCommentSubmit} className="relative">
                    <textarea 
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Write a reflection..." 
                        className="w-full p-4 rounded-xl bg-white/40 border border-white/60 focus:bg-white focus:border-emerald-500 focus:ring-0 outline-none transition-all resize-none h-32 text-base font-serif text-ink-800 placeholder:text-ink-400"
                    />
                    <div className="flex justify-end items-center mt-4">
                        <button 
                            type="submit" 
                            disabled={submittingComment || !commentText.trim()}
                            className="flex items-center gap-2 px-6 py-2 bg-emerald-800 text-white rounded-full hover:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed touch-spring shadow-lg shadow-emerald-900/10 text-sm font-bold"
                        >
                            <span>Post</span>
                            <Send size={14} />
                        </button>
                    </div>
                </form>
            </div>
        ) : (
            <div className="liquid-glass p-8 rounded-3xl text-center mb-10 border border-dashed border-emerald-900/10">
                <p className="font-serif text-ink-500 mb-3 italic">Join the circle to share your thoughts.</p>
                <Link href="/signin" className="text-sm font-bold text-emerald-700 hover:text-emerald-900 underline decoration-2 underline-offset-4">Sign in</Link>
            </div>
        )}

        <div className="space-y-4">
            {comments.map(comment => (
                <div key={comment.id} className="liquid-glass p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-sans font-bold text-xs text-emerald-900 uppercase tracking-wider">{comment.user.name}</span>
                        <span className="text-[10px] text-ink-400 font-sans">{new Date(comment.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="font-serif text-ink-700 text-base leading-relaxed">{comment.body}</p>
                </div>
            ))}
        </div>
      </section>
    </div>
  );
}
