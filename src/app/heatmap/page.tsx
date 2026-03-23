"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  format,
  addDays,
  subDays,
  parseISO,
  isToday,
  isFuture,
  differenceInCalendarDays,
  getDay,
  getDate,
} from "date-fns";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Habit, Entry } from "@/lib/types";

const COLS = 14;
const ROWS = 28;
const TOTAL = COLS * ROWS; // 392

const HEATMAP_COLOR = { h: 142, s: 71, l: 45 }; // green, similar to GitHub

function isScheduled(habit: Habit, date: Date): boolean {
  const schedule = habit.schedule;
  switch (schedule.type) {
    case "daily":
      return true;
    case "every_other_day": {
      if (!schedule.anchorDate) return false;
      const anchor = new Date(schedule.anchorDate + "T12:00:00Z");
      const diff = differenceInCalendarDays(date, anchor);
      return diff >= 0 && diff % 2 === 0;
    }
    case "days_of_week":
      return schedule.daysOfWeek?.includes(getDay(date)) ?? false;
    case "days_of_month":
      return schedule.daysOfMonth?.includes(getDate(date)) ?? false;
    default:
      return false;
  }
}

export default function HeatmapPage() {
  const router = useRouter();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry[]>>({});
  const [loading, setLoading] = useState(true);

  // Compute start date: earliest habit createdAt, but if that's more than
  // TOTAL days ago, use (today - TOTAL + 1) instead
  const startDate = useMemo(() => {
    if (habits.length === 0) return new Date();
    const earliest = habits.reduce((min, h) => {
      const d = parseISO(h.createdAt);
      return d < min ? d : min;
    }, parseISO(habits[0].createdAt));

    const today = new Date();
    const daysSinceEarliest = differenceInCalendarDays(today, earliest);

    if (daysSinceEarliest >= TOTAL) {
      return subDays(today, TOTAL - 1);
    }
    return earliest;
  }, [habits]);

  const gridDates = useMemo(() => {
    return Array.from({ length: TOTAL }, (_, i) => addDays(startDate, i));
  }, [startDate]);

  const dateStrs = useMemo(
    () => gridDates.map((d) => format(d, "yyyy-MM-dd")),
    [gridDates]
  );

  // Fetch habits
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/habits");
        if (res.ok) {
          const data = await res.json();
          setHabits(Array.isArray(data) ? data : []);
        }
      } catch {
        // skip
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Fetch all entries for the date range
  useEffect(() => {
    if (habits.length === 0 || dateStrs.length === 0) return;
    const from = dateStrs[0];
    const to = dateStrs[dateStrs.length - 1];

    async function loadEntries() {
      try {
        const res = await fetch(`/api/habits/entries?from=${from}&to=${to}`);
        if (res.ok) {
          const data: Record<string, Entry[]> = await res.json();
          setEntries(data);
        }
      } catch {
        // skip
      }
    }
    loadEntries();
  }, [habits, dateStrs]);

  // Build a lookup: entryMap[habitId][dateStr] = Entry
  const entryMap = useMemo(() => {
    const map: Record<string, Record<string, Entry>> = {};
    for (const [habitId, arr] of Object.entries(entries)) {
      map[habitId] = {};
      for (const e of arr) {
        map[habitId][e.date] = e;
      }
    }
    return map;
  }, [entries]);

  const activeHabits = useMemo(
    () => habits.filter((h) => !h.archivedAt),
    [habits]
  );

  // Compute completion ratio per day
  const dayData = useMemo(() => {
    return gridDates.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      let scheduled = 0;
      let done = 0;

      for (const habit of activeHabits) {
        // Skip days before this habit was created
        const created = parseISO(habit.createdAt);
        if (date < created) continue;
        if (!isScheduled(habit, date)) continue;
        scheduled++;

        const entry = entryMap[habit._id]?.[dateStr];
        if (
          entry?.status === "completed" ||
          entry?.status === "skipped"
        ) {
          done++;
        }
      }

      return {
        date,
        dateStr,
        scheduled,
        done,
        ratio: scheduled > 0 ? done / scheduled : -1, // -1 = no habits scheduled
      };
    });
  }, [gridDates, activeHabits, entryMap]);

  // Summary stats
  const summaryStats = useMemo(() => {
    let totalScheduled = 0;
    let totalDone = 0;
    let perfectDays = 0;
    let daysWithData = 0;

    for (const d of dayData) {
      if (d.scheduled <= 0) continue;
      if (isFuture(d.date) && !isToday(d.date)) continue;
      daysWithData++;
      totalScheduled += d.scheduled;
      totalDone += d.done;
      if (d.done === d.scheduled) perfectDays++;
    }

    return {
      overallRate: totalScheduled > 0 ? totalDone / totalScheduled : 0,
      perfectDays,
      totalDays: daysWithData,
    };
  }, [dayData]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")} aria-label="Back">
          <ArrowLeft className="size-5" />
        </Button>
        <h2 className="text-lg font-semibold">Heatmap</h2>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-2 pb-6">
        <div
          className="grid gap-0 mx-auto"
          style={{
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            maxWidth: 500,
          }}
        >
          {dayData.map((d, i) => {
            const today = isToday(d.date);
            const future = isFuture(d.date) && !today;
            const isFirstOfMonth = d.date.getDate() === 1;
            const isFirstCol = i % COLS === 0;

            return (
              <div key={d.dateStr} className="relative">
                <div
                  className={cn(
                    "aspect-square w-full border-[0.5px] border-border/20",
                    today && "ring-2 ring-primary ring-inset",
                    future && "opacity-40"
                  )}
                >
                  <HeatCell
                    ratio={d.ratio}
                    future={future}
                  />
                  {(isFirstCol || isFirstOfMonth) && (
                    <span className="absolute bottom-0.5 left-0.5 text-[8px] leading-none text-foreground/50 pointer-events-none">
                      {format(d.date, isFirstOfMonth ? "MMM" : "d")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary stats */}
        <div className="mx-auto mt-6 grid grid-cols-3 gap-2" style={{ maxWidth: 500 }}>
          <div className="flex flex-col gap-1 rounded-lg bg-card p-2.5 ring-1 ring-border/30">
            <span className="text-[10px] text-muted-foreground">Overall</span>
            <span className="text-sm font-semibold tabular-nums">
              {Math.round(summaryStats.overallRate * 100)}%
            </span>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.round(summaryStats.overallRate * 100)}%`,
                  backgroundColor: `hsl(${HEATMAP_COLOR.h}, ${HEATMAP_COLOR.s}%, ${HEATMAP_COLOR.l}%)`,
                }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-card p-2.5 ring-1 ring-border/30">
            <span className="text-[10px] text-muted-foreground">Perfect days</span>
            <span className="text-sm font-semibold tabular-nums">
              {summaryStats.perfectDays}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-card p-2.5 ring-1 ring-border/30">
            <span className="text-[10px] text-muted-foreground">Tracked days</span>
            <span className="text-sm font-semibold tabular-nums">
              {summaryStats.totalDays}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="mx-auto mt-4 flex items-center justify-center gap-1.5" style={{ maxWidth: 500 }}>
          <span className="text-[10px] text-muted-foreground mr-1">Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((level) => (
            <div
              key={level}
              className="size-4 rounded-sm"
              style={{
                backgroundColor:
                  level === 0
                    ? "hsl(0, 0%, 20%)"
                    : `hsla(${HEATMAP_COLOR.h}, ${HEATMAP_COLOR.s}%, ${HEATMAP_COLOR.l}%, ${0.2 + level * 0.8})`,
              }}
            />
          ))}
          <span className="text-[10px] text-muted-foreground ml-1">More</span>
        </div>
      </div>
    </div>
  );
}

function HeatCell({
  ratio,
  future,
}: {
  ratio: number; // -1 = no habits scheduled, 0-1 = completion ratio
  future: boolean;
}) {
  if (ratio < 0) {
    // No habits scheduled — gray
    return <div className="size-full bg-muted/20" />;
  }

  if (future) {
    return <div className="size-full bg-muted/10" />;
  }

  if (ratio === 0) {
    // 0% — darkest/empty
    return (
      <div
        className="size-full"
        style={{ backgroundColor: "hsl(0, 0%, 15%)" }}
      />
    );
  }

  // Scale opacity: 20% at low completion, 100% at full
  const alpha = 0.2 + ratio * 0.8;

  return (
    <div
      className="size-full"
      style={{
        backgroundColor: `hsla(${HEATMAP_COLOR.h}, ${HEATMAP_COLOR.s}%, ${HEATMAP_COLOR.l}%, ${alpha})`,
      }}
    />
  );
}
