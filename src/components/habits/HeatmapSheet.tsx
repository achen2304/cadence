"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Habit, Entry } from "@/lib/types";

const COLS = 14;
const ROWS = 28;
const TOTAL = COLS * ROWS;

const HEATMAP_COLOR = { h: 142, s: 71, l: 45 };

function isScheduled(habit: Habit, date: Date): boolean {
  const schedule = habit.schedule;
  switch (schedule.type) {
    case "daily":
      return true;
    case "every_other_day":
    case "every_n_days": {
      if (!schedule.anchorDate) return false;
      const interval = schedule.interval ?? 2;
      const anchor = new Date(schedule.anchorDate + "T12:00:00Z");
      const diff = differenceInCalendarDays(date, anchor);
      return diff >= 0 && diff % interval === 0;
    }
    case "days_of_week":
      return schedule.daysOfWeek?.includes(getDay(date)) ?? false;
    case "days_of_month":
      return schedule.daysOfMonth?.includes(getDate(date)) ?? false;
    default:
      return false;
  }
}

interface HeatmapSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habits: Habit[];
}

export function HeatmapSheet({
  open,
  onOpenChange,
  habits,
}: HeatmapSheetProps) {
  const [entries, setEntries] = useState<Record<string, Entry[]>>({});
  const [loading, setLoading] = useState(false);

  const activeHabits = useMemo(
    () => habits.filter((h) => !h.archivedAt),
    [habits]
  );

  const startDate = useMemo(() => {
    if (activeHabits.length === 0) return new Date();
    const earliest = activeHabits.reduce((min, h) => {
      const d = parseISO(h.createdAt);
      return d < min ? d : min;
    }, parseISO(activeHabits[0].createdAt));

    const today = new Date();
    const daysSinceEarliest = differenceInCalendarDays(today, earliest);
    if (daysSinceEarliest >= TOTAL) {
      return subDays(today, TOTAL - 1);
    }
    return earliest;
  }, [activeHabits]);

  const gridDates = useMemo(
    () => Array.from({ length: TOTAL }, (_, i) => addDays(startDate, i)),
    [startDate]
  );

  const dateStrs = useMemo(
    () => gridDates.map((d) => format(d, "yyyy-MM-dd")),
    [gridDates]
  );

  // Fetch entries when sheet opens
  useEffect(() => {
    if (!open || activeHabits.length === 0) return;
    setLoading(true);

    const from = dateStrs[0];
    const to = dateStrs[dateStrs.length - 1];

    (async () => {
      try {
        const res = await fetch(`/api/habits/entries?from=${from}&to=${to}`);
        if (res.ok) {
          setEntries(await res.json());
        }
      } catch {
        // skip
      } finally {
        setLoading(false);
      }
    })();
  }, [open, activeHabits, dateStrs]);

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

  const dayData = useMemo(() => {
    return gridDates.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      let scheduled = 0;
      let done = 0;

      for (const habit of activeHabits) {
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
        ratio: scheduled > 0 ? done / scheduled : -1,
      };
    });
  }, [gridDates, activeHabits, entryMap]);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Heatmap</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="px-2 pb-6">
            {/* Summary */}
            <div
              className="mx-auto mb-4 grid grid-cols-3 gap-2"
              style={{ maxWidth: 500 }}
            >
              <div className="flex flex-col gap-1 rounded-lg bg-card p-2.5 ring-1 ring-border/30">
                <span className="text-[10px] text-muted-foreground">
                  Overall
                </span>
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
                <span className="text-[10px] text-muted-foreground">
                  Perfect days
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {summaryStats.perfectDays}
                </span>
              </div>
              <div className="flex flex-col gap-1 rounded-lg bg-card p-2.5 ring-1 ring-border/30">
                <span className="text-[10px] text-muted-foreground">
                  Tracked days
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {summaryStats.totalDays}
                </span>
              </div>
            </div>

            {/* Legend */}
            <div
              className="mx-auto mb-4 flex items-center justify-center gap-1.5"
              style={{ maxWidth: 500 }}
            >
              <span className="text-[10px] text-muted-foreground mr-1">
                Less
              </span>
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
              <span className="text-[10px] text-muted-foreground ml-1">
                More
              </span>
            </div>

            {/* Grid */}
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
                      <HeatCell ratio={d.ratio} future={future} />
                      {(isFirstCol || isFirstOfMonth) && (
                        <span className="absolute bottom-0.5 left-0.5 text-[8px] leading-none text-foreground/50 pointer-events-none">
                          {format(
                            d.date,
                            isFirstOfMonth ? "MMM" : "d"
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function HeatCell({
  ratio,
  future,
}: {
  ratio: number;
  future: boolean;
}) {
  if (ratio < 0) return <div className="size-full bg-muted/20" />;
  if (future) return <div className="size-full bg-muted/10" />;
  if (ratio === 0)
    return (
      <div
        className="size-full"
        style={{ backgroundColor: "hsl(0, 0%, 15%)" }}
      />
    );

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
