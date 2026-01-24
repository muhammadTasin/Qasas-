import React from 'react';
import './globals.css';
import type { Metadata } from 'next';
import { Inter, Merriweather } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { SiteLayout } from '@/components/SiteLayout';
import Providers from '@/components/Providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const merriweather = Merriweather({
  weight: ['300', '400', '700', '900'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-serif'
});

export const metadata: Metadata = {
  title: 'Qasas',
  description: 'A storytelling platform to share your thoughts.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${merriweather.variable}`}>
      <body className="text-ink-800 font-sans min-h-screen">
        <div className="liquid-bg-wrapper">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
          <div className="blob blob-3"></div>
        </div>
        <Providers>
          <AuthProvider>
            <SiteLayout>
              {children}
            </SiteLayout>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
