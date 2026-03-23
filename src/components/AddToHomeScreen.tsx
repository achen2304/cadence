"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "cadence-a2hs-dismissed";

function isIOSStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "standalone" in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function isIOSSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iP(hone|ad|od)/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}

export function AddToHomeScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed as standalone — never show
    if (isIOSStandalone()) return;

    // Only show on mobile Safari
    if (!isIOSSafari()) return;

    // Respect dismissal for this visit (uses sessionStorage so it reappears next visit)
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    if (dismissed) return;

    setVisible(true);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-zinc-900 shadow-2xl dark:bg-zinc-900 dark:text-zinc-100">
        <h2 className="mb-4 text-center text-lg font-semibold">
          Install Cadence
        </h2>
        <p className="mb-5 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Add Cadence to your Home Screen for the best experience.
        </p>

        <ol className="mb-6 space-y-4 text-sm">
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold dark:bg-zinc-800">
              1
            </span>
            <span>
              Tap the{" "}
              <strong className="inline-flex items-center gap-1">
                Share
                <svg
                  className="inline h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 3v12M7 8l5-5 5 5"
                  />
                </svg>
              </strong>{" "}
              button in the toolbar
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold dark:bg-zinc-800">
              2
            </span>
            <span>
              Scroll down and tap{" "}
              <strong>&quot;Add to Home Screen&quot;</strong>
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold dark:bg-zinc-800">
              3
            </span>
            <span>
              Tap <strong>&quot;Add&quot;</strong> to confirm
            </span>
          </li>
        </ol>

        <button
          onClick={dismiss}
          className="w-full rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
