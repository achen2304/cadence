"use client";

import { useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const { isOnline } = useOnlineStatus();
  const [show, setShow] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setSyncing(false);
      setShow(true);
    } else if (wasOffline.current) {
      // Just came back online
      wasOffline.current = false;
      setSyncing(true);
      setShow(true);

      const timer = setTimeout(() => {
        setSyncing(false);
        setShow(false);
      }, 2000);

      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [isOnline]);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
        syncing
          ? "bg-green-500/15 text-green-700 dark:text-green-400"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
      }`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          syncing ? "bg-green-500 animate-pulse" : "bg-amber-500"
        }`}
      />
      {syncing ? "Syncing..." : "Offline — changes will sync"}
    </div>
  );
}
