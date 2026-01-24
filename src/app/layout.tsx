import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AppSessionProvider from "@/components/SessionProvider";
import SiteVisitTracker from "@/components/SiteVisitTracker";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Qasas — Stories that breathe",
  description: "Qasas is a storytelling home for reflective, intimate narratives.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${sourceSans.variable} antialiased`}>
        <AppSessionProvider session={session}>
          <SiteVisitTracker />
          {children}
        </AppSessionProvider>
      </body>
    </html>
  );
}
