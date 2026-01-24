"use client";

import { useEffect } from "react";

export default function SiteVisitTracker() {
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/site/visit", { method: "POST", signal: controller.signal }).catch(
      () => {}
    );
    return () => controller.abort();
  }, []);

  return null;
}
