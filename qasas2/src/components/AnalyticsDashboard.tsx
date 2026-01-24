import React from 'react';
import { StoryView, AnalyticsStats } from '@/types';
import { Smartphone, Monitor, Globe, Clock, User as UserIcon } from 'lucide-react';

interface AnalyticsDashboardProps {
  views: StoryView[];
  totalReadTime: number;
  stats?: AnalyticsStats | null;
  onClose: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ views, totalReadTime, stats, onClose }) => {
  const uniqueViews = views.length;
  const totalViews = stats?.totalViews ?? uniqueViews;
  const uniqueLoggedIn = stats?.uniqueLoggedIn ?? 0;
  const uniqueGuests = stats?.uniqueGuests ?? Math.max(uniqueViews - uniqueLoggedIn, 0);
  const totalReadTimeLoggedIn = stats?.totalReadTimeLoggedIn ?? 0;
  const totalReadTimeGuests = stats?.totalReadTimeGuests ?? Math.max(totalReadTime - totalReadTimeLoggedIn, 0);
  // const averageReadTime = uniqueViews > 0 ? (totalReadTime / uniqueViews / 60).toFixed(1) : '0';

  // Group by Device
  const deviceStats = views.reduce((acc, view) => {
      acc[view.deviceType] = (acc[view.deviceType] || 0) + 1;
      return acc;
  }, {} as Record<string, number>);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto liquid-glass-heavy rounded-[2.5rem] shadow-2xl border border-white/60 animate-in fade-in zoom-in-95 duration-300 no-scrollbar">
        
        {/* Header */}
        <div className="sticky top-0 z-20 liquid-glass border-b border-emerald-900/5 px-8 py-6 flex justify-between items-center">
            <div>
                <h2 className="font-serif text-2xl font-bold text-emerald-900">Story Insights</h2>
                <p className="text-xs font-sans text-emerald-800/60 font-bold uppercase tracking-widest">Private Analytics</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-emerald-100/50 text-emerald-900 hover:bg-emerald-200/50 flex items-center justify-center transition-colors">
                ✕
            </button>
        </div>

        <div className="p-8 space-y-8">
            
            {/* Top Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white/40 rounded-2xl p-4 border border-white/60 shadow-sm">
                    <div className="flex items-center gap-2 text-emerald-800/60 mb-1">
                        <UserIcon size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Unique Views</span>
                    </div>
                    <div className="text-3xl font-serif font-bold text-ink-900">{uniqueViews}</div>
                    <div className="mt-2 text-[10px] font-sans text-ink-500 space-y-1">
                        <div>Total views: <span className="font-bold text-ink-700">{totalViews}</span></div>
                        <div>Logged-in: <span className="font-bold text-ink-700">{uniqueLoggedIn}</span></div>
                        <div>Guests: <span className="font-bold text-ink-700">{uniqueGuests}</span></div>
                    </div>
                </div>

                <div className="bg-white/40 rounded-2xl p-4 border border-white/60 shadow-sm">
                    <div className="flex items-center gap-2 text-emerald-800/60 mb-1">
                        <Clock size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Total Time</span>
                    </div>
                    <div className="text-3xl font-serif font-bold text-ink-900">
                        {(totalReadTime / 60).toFixed(0)}<span className="text-base text-ink-500 font-sans font-normal ml-1">min</span>
                    </div>
                    <div className="mt-2 text-[10px] font-sans text-ink-500 space-y-1">
                        <div>Logged-in: <span className="font-bold text-ink-700">{(totalReadTimeLoggedIn / 60).toFixed(0)} min</span></div>
                        <div>Guests: <span className="font-bold text-ink-700">{(totalReadTimeGuests / 60).toFixed(0)} min</span></div>
                    </div>
                </div>

                <div className="bg-white/40 rounded-2xl p-4 border border-white/60 shadow-sm col-span-2 md:col-span-1">
                    <div className="flex items-center gap-2 text-emerald-800/60 mb-1">
                        <Smartphone size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Mobile</span>
                    </div>
                    <div className="text-3xl font-serif font-bold text-ink-900">
                        {Math.round(((deviceStats['mobile'] || 0) / (uniqueViews || 1)) * 100)}<span className="text-base text-ink-500 font-sans font-normal ml-1">%</span>
                    </div>
                </div>
            </div>

            {/* Visitor List (NGL Style) */}
            <div>
                <h3 className="text-sm font-sans font-bold text-ink-500 uppercase tracking-widest mb-4">Recent Visitors</h3>
                <div className="space-y-3">
                    {views.length === 0 ? (
                        <div className="text-center py-8 text-ink-400 italic">No views yet. Share your story!</div>
                    ) : (
                        views.map((view) => (
                            <div key={view.id} className="group flex items-center justify-between p-4 rounded-2xl bg-white/30 border border-white/40 hover:bg-white/60 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                                        {view.location.country === 'Unknown' ? <Globe size={18} /> : <span className="text-lg">📍</span>}
                                    </div>
                                    <div>
                                        <div className="font-serif font-bold text-ink-900 text-sm">
                                            {view.location.city !== 'Unknown' ? view.location.city : 'Anonymous Location'}
                                        </div>
                                        <div className="text-xs text-ink-500 flex items-center gap-2">
                                            <span>{view.location.region !== 'Unknown' ? view.location.region : view.location.country}</span>
                                            <span className="w-1 h-1 rounded-full bg-emerald-300"></span>
                                            <span className="flex items-center gap-1">
                                                {view.deviceType === 'mobile' ? <Smartphone size={10} /> : <Monitor size={10} />}
                                                {view.os}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-bold text-emerald-800 bg-emerald-100/50 px-2 py-1 rounded-full border border-emerald-200/50">
                                        {new Date(view.lastSeenAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </div>
                                    <div className="text-[10px] text-ink-400 mt-1">
                                        {new Date(view.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            
            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-[11px] text-blue-800/80 leading-relaxed">
                <strong>Privacy Note:</strong> Identities are anonymized using a hashed visitor ID. Locations are approximate estimations based on network. Exact GPS is never accessed.
            </div>

        </div>
      </div>
    </div>
  );
};
