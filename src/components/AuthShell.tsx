import { BookOpen } from "lucide-react";
import type { ReactNode } from "react";

export default function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="flex items-center justify-center min-h-[70vh] px-4">
    <div className="w-full max-w-md liquid-glass-heavy p-10 rounded-[2.5rem] shadow-2xl border border-white/80 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex justify-center mb-8"><div className="w-16 h-16 rounded-3xl bg-emerald-800 text-white flex items-center justify-center shadow-lg shadow-emerald-900/20 transform rotate-3 ring-4 ring-white/50"><BookOpen size={32} strokeWidth={1.5} /></div></div>
      <div className="text-center mb-10"><h1 className="font-serif text-3xl font-bold text-ink-900 mb-2 tracking-tight">{title}</h1><p className="font-sans text-ink-500">{description}</p></div>
      {children}
    </div>
  </div>;
}
