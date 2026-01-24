'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createStoryAction } from '@/app/actions';
import { Save, ChevronLeft } from 'lucide-react';

export default function WriteStory() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load draft on mount
  useEffect(() => {
    try {
        const savedDraft = localStorage.getItem('mosk_story_draft');
        if (savedDraft) {
            const { title: t, content: c } = JSON.parse(savedDraft);
            if (t) setTitle(t);
            if (c) setContent(c);
        }
    } catch (e) {
        console.error('Error loading draft', e);
    }
  }, []);

  // Save draft on change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
        if (title || content) {
            localStorage.setItem('mosk_story_draft', JSON.stringify({ title, content }));
        }
    }, 500); // Debounce save
    return () => clearTimeout(timeoutId);
  }, [title, content]);

  const handleSubmit = async () => {
      if (!title || !content || !user) return;
      setSubmitting(true);
      try {
          const story = await createStoryAction(title, content);
          // Clear draft on success
          localStorage.removeItem('mosk_story_draft');
          router.push(`/stories/${story.id}`);
      } catch (error) {
          alert('Failed to publish story');
      } finally {
          setSubmitting(false);
      }
  };

  return (
    <div className="max-w-4xl mx-auto pt-6 px-4 pb-20">
        <div className="mb-6 flex items-center justify-between">
            <button onClick={() => router.back()} className="text-ink-400 hover:text-ink-800 transition-colors">
                <ChevronLeft size={24} />
            </button>
            <span className="text-xs font-sans font-bold text-emerald-800/60 uppercase tracking-widest">Drafting</span>
            <div className="w-6"></div> {/* Spacer for balance */}
        </div>

        {/* Editor Liquid Panel */}
        <div className="liquid-glass-heavy rounded-[2.5rem] p-8 sm:p-16 min-h-[75vh] relative flex flex-col">
            
            <div className="space-y-8 flex-1">
                <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-4xl sm:text-5xl font-serif font-bold text-ink-900 placeholder:text-emerald-900/20 bg-transparent border-none outline-none ring-0 p-0 tracking-tight"
                    placeholder="Title your thoughts..."
                    autoFocus
                />
                
                <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-full min-h-[50vh] text-lg leading-[1.8] font-serif text-ink-800 placeholder:text-emerald-900/20 bg-transparent border-none outline-none ring-0 p-0 resize-none"
                    placeholder="Start writing..."
                />
            </div>

            <div className="flex justify-end pt-8 border-t border-emerald-900/5 mt-8 items-center gap-4">
                 <span className="text-[10px] text-ink-400 font-sans uppercase tracking-widest opacity-60">
                    Auto-saving...
                 </span>
                 <button 
                    onClick={handleSubmit} 
                    disabled={submitting || !title || !content}
                    className="flex items-center gap-2 bg-emerald-800 text-white px-8 py-3 rounded-full font-sans text-sm font-bold hover:bg-emerald-900 disabled:opacity-50 touch-spring shadow-lg shadow-emerald-900/20"
                >
                    <Save size={16} />
                    {submitting ? 'Publishing...' : 'Publish Story'}
                </button>
            </div>
            
        </div>
    </div>
  );
}