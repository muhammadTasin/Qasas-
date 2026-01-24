'use client';

import React, { useEffect, useRef } from 'react';
import { incrementReadTimeAction } from '@/app/actions';

interface ReadTrackerProps {
  storyId: string;
}

export const ReadTracker: React.FC<ReadTrackerProps> = ({ storyId }) => {
  const accumulatedTime = useRef(0);
  const intervalRef = useRef<number | null>(null);

  // Sync to DB every 15 seconds
  const SYNC_INTERVAL = 15000; 

  const flushTime = () => {
    if (accumulatedTime.current > 0) {
      incrementReadTimeAction(storyId, accumulatedTime.current);
      accumulatedTime.current = 0;
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Paused
        if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
      } else {
        // Resumed
        startTracking();
      }
    };

    const startTracking = () => {
      if (intervalRef.current) return;
      
      intervalRef.current = window.setInterval(() => {
        // Only count if document is focused to prevent background tab abuse
        if (document.hasFocus()) {
            accumulatedTime.current += 1;
        }
      }, 1000);
    };

    const syncInterval = setInterval(flushTime, SYNC_INTERVAL);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startTracking();

    return () => {
      flushTime(); // Final flush on unmount
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [storyId]);

  return null; // Invisible component
};
