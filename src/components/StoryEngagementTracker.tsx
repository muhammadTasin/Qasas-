"use client";

import { useEffect, useRef } from "react";

const SEND_INTERVAL_SECONDS = 15;
const MAX_SESSION_SECONDS = 20 * 60;

export default function StoryEngagementTracker({ storyId }: { storyId: string }) {
  const accumulatedRef = useRef(0);
  const totalSentRef = useRef(0);
  const lastInteractionRef = useRef(0);
  const visibleRef = useRef(true);

  const sendReadTime = (seconds: number, useBeacon = false) => {
    const body = JSON.stringify({ seconds });
    if (useBeacon && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(`/api/stories/${storyId}/readtime`, blob);
      return;
    }

    fetch(`/api/stories/${storyId}/readtime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {});
  };

  useEffect(() => {
    fetch(`/api/stories/${storyId}/view`, { method: "POST" }).catch(() => {});
  }, [storyId]);

  useEffect(() => {
    visibleRef.current = document.visibilityState === "visible";

    const markInteraction = () => {
      lastInteractionRef.current = Date.now();
    };

    const onVisibility = () => {
      visibleRef.current = document.visibilityState === "visible";
    };

    const tick = () => {
      if (!visibleRef.current) return;
      if (!lastInteractionRef.current) return;
      if (Date.now() - lastInteractionRef.current > 30_000) return;
      if (totalSentRef.current >= MAX_SESSION_SECONDS) return;

      accumulatedRef.current += 1;
      if (accumulatedRef.current >= SEND_INTERVAL_SECONDS) {
        const remaining = MAX_SESSION_SECONDS - totalSentRef.current;
        const payload = Math.min(accumulatedRef.current, remaining);
        accumulatedRef.current = 0;
        if (payload > 0) {
          totalSentRef.current += payload;
          sendReadTime(payload);
        }
      }
    };

    const interval = window.setInterval(tick, 1000);
    const events = ["scroll", "keydown", "pointerdown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, markInteraction));
    document.addEventListener("visibilitychange", onVisibility);

    const onUnload = () => {
      if (accumulatedRef.current > 0) {
        const remaining = MAX_SESSION_SECONDS - totalSentRef.current;
        const payload = Math.min(accumulatedRef.current, remaining);
        if (payload > 0) {
          sendReadTime(payload, true);
          totalSentRef.current += payload;
        }
        accumulatedRef.current = 0;
      }
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      window.clearInterval(interval);
      events.forEach((event) => window.removeEventListener(event, markInteraction));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [storyId]);

  return null;
}
