'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, AlertCircle } from 'lucide-react';

interface AuthFormProps {
  mode: 'signin' | 'signup';
}

export const AuthForm: React.FC<AuthFormProps> = ({ mode }) => {
  const { login, register } = useAuth();
  const isLogin = mode === 'signin';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        await login();
      } else {
        await register();
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed.');
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-md liquid-glass-heavy p-10 rounded-[2.5rem] shadow-2xl border border-white/80 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-emerald-800 text-white flex items-center justify-center shadow-lg shadow-emerald-900/20 transform rotate-3 ring-4 ring-white/50">
            <BookOpen size={32} strokeWidth={1.5} />
          </div>
        </div>

        <div className="text-center mb-10">
          <h2 className="font-serif text-3xl font-bold text-ink-900 mb-2 tracking-tight">
            {isLogin ? 'Welcome Back' : 'Join Qasas'}
          </h2>
          <p className="font-sans text-ink-500">
            {isLogin ? 'Sign in with Google to continue' : 'Create your account with Google'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="w-full bg-emerald-800 text-white py-4 rounded-2xl font-sans font-bold text-lg hover:bg-emerald-900 transition-all disabled:opacity-70 shadow-xl shadow-emerald-900/20 touch-spring flex items-center justify-center gap-2"
        >
          {loading ? 'Redirecting...' : (isLogin ? 'Continue with Google' : 'Sign up with Google')}
        </button>
      </div>
    </div>
  );
};
