"use client";

import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  function toggle() {
    const theme = document.documentElement.dataset.theme === "journal" ? "qasas" : "journal";
    document.documentElement.dataset.theme = theme;
    document.cookie = `qasas-theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    try { localStorage.setItem("qasas-theme", theme); } catch { /* Cookie still persists the choice. */ }
  }
  return <button type="button" onClick={toggle} aria-label="Switch between Original Qasas and Journal theme" title="Original / Journal"
    className="theme-toggle w-8 h-8 rounded-full liquid-glass flex items-center justify-center text-emerald-800 hover:bg-white/60 touch-spring">
    <Moon size={14} className="theme-moon" /><Sun size={14} className="theme-sun" />
  </button>;
}
