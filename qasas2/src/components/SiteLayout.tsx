'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PenTool, User as UserIcon, BookOpen, Home, Globe, LogOut } from 'lucide-react';
import { getSiteStatsAction } from '@/app/actions';
import { SiteStats } from '@/types';

export const SiteLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  useEffect(() => {
    getSiteStatsAction().then(setStats);
  }, [pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col pb-24 sm:pb-0 relative z-10">
      {/* --- DESKTOP NAVIGATION (Top Bar) --- */}
      <div className="hidden sm:flex fixed top-0 left-0 right-0 z-50 justify-center pt-6 pointer-events-none">
        <nav className="pointer-events-auto liquid-glass rounded-full px-1.5 py-1.5 flex items-center gap-1 shadow-lg ring-1 ring-white/50 relative">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 px-5 py-2 rounded-full hover:bg-white/40 transition-colors group mr-2">
            <BookOpen size={18} strokeWidth={2.5} className="text-emerald-800" />
            <span className="font-serif font-bold text-lg text-emerald-900 tracking-tight">Qasas</span>
          </Link>

          {/* Desktop Links */}
          <Link
            href="/"
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
              isActive('/')
                ? 'bg-white shadow-sm text-emerald-900'
                : 'text-ink-500 hover:text-emerald-800 hover:bg-white/30'
            }`}>
            Home
          </Link>

          {isAuthenticated ? (
            <>
              <Link
                href="/write"
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  isActive('/write')
                    ? 'bg-white shadow-sm text-emerald-900'
                    : 'text-ink-500 hover:text-emerald-800 hover:bg-white/30'
                }`}>
                Write
              </Link>

              <div className="h-5 w-px bg-emerald-900/10 mx-1"></div>

              <div className="relative">
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className="pl-1 pr-1.5 py-1"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 border border-white flex items-center justify-center text-emerald-800 font-serif font-bold text-xs shadow-sm touch-spring hover:scale-105">
                    {user?.name?.[0] || 'U'}
                  </div>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-44 rounded-2xl liquid-glass border border-white/70 shadow-xl p-2 text-sm">
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-ink-600 hover:text-emerald-900 hover:bg-white/50 transition-colors"
                    >
                      <LogOut size={16} />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link
              href="/signin"
              className="ml-2 px-6 py-2 bg-emerald-800 text-white rounded-full text-sm font-medium hover:bg-emerald-900 touch-spring shadow-lg shadow-emerald-900/20">
              Sign In
            </Link>
          )}
        </nav>
      </div>

      {/* --- MOBILE NAVIGATION (Bottom Dock) --- */}
      <div className="sm:hidden fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <nav className="pointer-events-auto liquid-glass-heavy rounded-[2rem] px-6 py-3 flex items-center gap-8 shadow-2xl ring-1 ring-white/40">
          <Link href="/" className={`flex flex-col items-center gap-1 touch-spring ${isActive('/') ? 'text-emerald-800' : 'text-ink-400'}`}>
            <Home size={24} strokeWidth={isActive('/') ? 2.5 : 2} />
            {isActive('/') && <div className="w-1 h-1 rounded-full bg-emerald-800 mt-1"></div>}
          </Link>

          <Link href={isAuthenticated ? "/write" : "/signin"} className="relative -top-6 touch-spring">
            <div className="w-14 h-14 rounded-full bg-emerald-800 text-white flex items-center justify-center shadow-xl shadow-emerald-900/30 border-4 border-[#FDFCF8]">
              <PenTool size={22} />
            </div>
          </Link>

          <button
            onClick={isAuthenticated ? logout : undefined}
            className={`flex flex-col items-center gap-1 touch-spring ${isActive('/signin') || isActive('/signup') ? 'text-emerald-800' : 'text-ink-400'}`}
          >
            {user ? (
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] border ${isActive('/signin') ? 'bg-emerald-100 border-emerald-800 text-emerald-900' : 'bg-transparent border-current'}`}>
                {user.name?.[0] || 'U'}
              </div>
            ) : (
              <UserIcon size={24} strokeWidth={isActive('/signin') ? 2.5 : 2} />
            )}
            {(isActive('/signin') || isActive('/signup')) && <div className="w-1 h-1 rounded-full bg-emerald-800 mt-1"></div>}
          </button>
        </nav>
      </div>

      <main className="flex-1 w-full mx-auto mt-6 sm:mt-28">
        {children}
      </main>

      <footer className="mt-20 pb-28 sm:pb-12 px-4">
        <div className="max-w-2xl mx-auto text-center liquid-glass rounded-[2.5rem] p-10">
          <div className="flex justify-center mb-6 text-emerald-800/20">
            <BookOpen size={24} />
          </div>
          <p className="font-serif text-ink-500 mb-6 text-base leading-relaxed max-w-lg mx-auto">
            Qasas is a sanctuary designed for sharing your inner thoughts and stories.
            A quiet space where your unspoken words find a voice and silence finds connection.
          </p>

          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 flex items-center gap-2 text-[10px] font-bold text-emerald-800 uppercase tracking-widest">
              <Globe size={10} />
              <span>{stats ? stats.uniqueVisitors.toLocaleString() : '...'} Unique Voices</span>
            </div>
          </div>

          <p className="text-[10px] text-ink-400 font-sans font-bold uppercase tracking-widest opacity-60">
            &copy; {new Date().getFullYear()} Qasas
          </p>
        </div>
      </footer>
    </div>
  );
};
