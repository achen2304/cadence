"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushQueue } from "@/lib/offline-queue";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const flushing = useRef(false);

  const handleOnline = useCallback(() => {
    setIsOnline(true);

    if (!flushing.current) {
      flushing.current = true;
      flushQueue().finally(() => {
        flushing.current = false;
      });
    }
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  useEffect(() => {
    // Set initial value from navigator (SSR-safe default is true)
    setIsOnline(navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return { isOnline };
}
