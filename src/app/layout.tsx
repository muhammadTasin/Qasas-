import React from 'react';
import { cookies } from 'next/headers';
import './journal.css';
import './globals.css';
import type { Metadata } from 'next';
import { Inter, Merriweather } from 'next/font/google';
import { getSession } from '@/lib/session';
import AppSessionProvider from '@/components/SessionProvider';
import SiteVisitTracker from '@/components/SiteVisitTracker';
import { SiteLayout } from '@/components/SiteLayout';


const inter = Inter({ subsets: ['latin'], variable: '--font-qasas-sans' });
const merriweather = Merriweather({
  weight: ['300', '400', '700', '900'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-qasas-serif'
});

export const metadata: Metadata = {
  title: 'Qasas',
  description: 'A storytelling platform to share your thoughts.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([getSession(), cookies()]);
  const theme = cookieStore.get("qasas-theme")?.value === "journal" ? "journal" : "qasas";
  return (
    <html lang="en" data-theme={theme} className={`${inter.variable} ${merriweather.variable}`}>
      <body className="text-ink-800 font-sans min-h-screen">
        <div className="liquid-bg-wrapper">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
          <div className="blob blob-3"></div>
        </div>
        <AppSessionProvider session={session}>
          <SiteVisitTracker />
            <SiteLayout>
              {children}
            </SiteLayout>
          </AppSessionProvider>
      </body>
    </html>
  );
}
