'use client';

import React, { createContext, useContext } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  register: () => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data, status } = useSession();
  const isLoading = status === 'loading';
  const user = data?.user
    ? ({
        id: (data.user as { id?: string }).id || '',
        name: data.user.name || null,
        email: data.user.email || '',
      } as User)
    : null;

  const login = async () => {
    await signIn('google', { callbackUrl: '/' });
  };

  const register = async () => {
    await signIn('google', { callbackUrl: '/' });
  };

  const logout = () => {
    signOut({ callbackUrl: '/' });
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
