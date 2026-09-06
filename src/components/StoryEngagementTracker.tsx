"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { getAvailableClientHints, getClientHints, recentlyTracked, sendAnalytics } from "@/lib/analytics-client";
import type { DeviceHints } from "@/lib/device-info";

const SEND_INTERVAL_SECONDS = 15;
const MAX_SESSION_SECONDS = 20 * 60;

export default function StoryEngagementTracker({ storyId }: { storyId: string }) {
  const { status } = useSession();
  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    void getClientHints().then(hints => {
      if (cancelled || recentlyTracked(`story:${storyId}:${status}`)) return;
      sendAnalytics(`/api/stories/${storyId}/view`, { hints });
    });
    return () => { cancelled = true; };
  }, [storyId, status]);

  useEffect(() => {
    let accumulated = 0;
    let totalSent = 0;
    let lastInteraction = Date.now();
    let lastTick = performance.now();
    let hints: DeviceHints = {};
    void getClientHints().then(value => { hints = value; });
    const markInteraction = () => { lastInteraction = Date.now(); };
    const flush = (beacon = false) => {
      const seconds = Math.min(Math.floor(accumulated), MAX_SESSION_SECONDS - totalSent, 30);
      if (seconds < 1) return;
      accumulated -= seconds;
      totalSent += seconds;
      sendAnalytics(`/api/stories/${storyId}/readtime`, { seconds, hints: { ...hints, ...getAvailableClientHints() } }, beacon);
    };
    const visibilityChanged = () => {
      if (document.visibilityState === "hidden") flush(true);
      else { lastTick = performance.now(); markInteraction(); }
    };
    const pageHide = () => flush(true);
    const interval = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min((now - lastTick) / 1000, 2);
      lastTick = now;
      if (document.visibilityState !== "visible" || Date.now() - lastInteraction > 30000 || totalSent >= MAX_SESSION_SECONDS) return;
      accumulated += elapsed;
      if (accumulated >= SEND_INTERVAL_SECONDS) flush();
    }, 1000);
    const events = ["scroll", "keydown", "pointerdown", "touchstart"];
    events.forEach(event => window.addEventListener(event, markInteraction, { passive: true }));
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("pagehide", pageHide);
    return () => {
      window.clearInterval(interval);
      events.forEach(event => window.removeEventListener(event, markInteraction));
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("pagehide", pageHide);
      flush(true);
    };
  }, [storyId]);
  return null;
}
