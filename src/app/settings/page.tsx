"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ArrowLeft, Globe, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTheme } from "@/components/ThemeProvider";
import type { Settings } from "@/lib/types";
import type { ThemeMode } from "@/lib/constants";

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [timezone, setTimezone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          const s: Settings = data;
          setSettings(s);
          setTimezone(s?.timezone ?? "");
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleAutoDetect = useCallback(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(detected);
    saveField("timezone", detected);
  }, []);

  const saveField = useCallback(async (field: string, value: string) => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }, []);

  const handleThemeChange = useCallback(
    (value: ThemeMode[]) => {
      const selected = value[0];
      if (!selected) return;
      setTheme(selected);
      saveField("theme", selected);
    },
    [setTheme, saveField]
  );

  const handleTimezoneBlur = useCallback(() => {
    if (timezone.trim()) {
      saveField("timezone", timezone.trim());
    }
  }, [timezone, saveField]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")} aria-label="Back">
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>
      <div className="flex-1 space-y-6 p-4">
        {/* Account */}
        {session?.user && (
          <>
            <section className="space-y-1">
              <p className="text-sm font-medium">Account</p>
              <p className="text-sm text-foreground">{session.user.name}</p>
              <p className="text-xs text-muted-foreground">
                {session.user.email}
              </p>
            </section>
            <Separator />
          </>
        )}

        {/* Timezone */}
        <section className="space-y-3">
          <Label htmlFor="tz-input">Timezone</Label>
          <div className="flex gap-2">
            <Input
              id="tz-input"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              onBlur={handleTimezoneBlur}
              placeholder="e.g. America/New_York"
              className="flex-1"
            />
            <Button
              variant="outline"
              size="default"
              onClick={handleAutoDetect}
              aria-label="Auto-detect timezone"
            >
              <Globe className="size-4" />
              <span className="hidden sm:inline">Detect</span>
            </Button>
          </div>
        </section>

        <Separator />

        {/* Theme */}
        <section className="space-y-3">
          <Label>Theme</Label>
          <ToggleGroup
            defaultValue={[theme]}
            onValueChange={handleThemeChange as (groupValue: unknown[], eventDetails: unknown) => void}
            variant="outline"
          >
            <ToggleGroupItem value="light">Light</ToggleGroupItem>
            <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
            <ToggleGroupItem value="system">System</ToggleGroupItem>
          </ToggleGroup>
        </section>

        <Separator />

        {/* Archived Habits */}
        <section>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => router.push("/settings/archived")}
          >
            View Archived Habits
          </Button>
        </section>

        <Separator />

        {/* Sign Out */}
        <section>
          <Button
            variant="outline"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          >
            <LogOut className="mr-2 size-4" />
            Sign Out
          </Button>
        </section>

        <Separator />

        {/* About */}
        <section className="space-y-1">
          <p className="text-sm font-medium">About</p>
          <p className="text-sm text-muted-foreground">Cadence v1.0</p>
          <p className="text-xs text-muted-foreground">
            Personal habit tracker
          </p>
        </section>
      </div>
    </div>
  );
}
