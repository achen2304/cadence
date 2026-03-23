"use client";

import { useEffect, useState } from "react";
import type { HabitStats } from "@/lib/types";

interface StatsPanelProps {
  habitId: string;
}

function StatCard({
  label,
  value,
  isPercentage = false,
}: {
  label: string;
  value: number;
  isPercentage?: boolean;
}) {
  const display = isPercentage ? `${Math.round(value)}%` : String(value);

  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold text-foreground">{display}</span>
      {isPercentage && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function StatsPanel({ habitId }: StatsPanelProps) {
  const [stats, setStats] = useState<HabitStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/habits/${habitId}/stats`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [habitId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!stats) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Could not load stats
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard label="This Week" value={stats.thisWeek} isPercentage />
      <StatCard label="This Month" value={stats.thisMonth} isPercentage />
      <StatCard label="This Year" value={stats.thisYear} isPercentage />
      <StatCard label="Skip Rate" value={stats.skipRate} isPercentage />
      <StatCard label="Current Streak" value={stats.currentStreak} />
      <StatCard label="Best Streak" value={stats.bestStreak} />
      <StatCard
        label="Total Completions"
        value={stats.totalCompletions}
      />
    </div>
  );
}
