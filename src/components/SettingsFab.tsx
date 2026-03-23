"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

export function SettingsFab() {
  return (
    <Link
      href="/settings"
      className="fixed bottom-6 left-6 z-40 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-lg transition-colors hover:bg-accent hover:text-foreground"
      aria-label="Settings"
    >
      <Settings className="size-5" />
    </Link>
  );
}
