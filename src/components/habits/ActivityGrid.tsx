"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  format,
  subDays,
  getDay,
  differenceInCalendarDays,
  getDate,
  startOfWeek,
  addDays,
} from "date-fns";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { Entry, Habit } from "@/lib/types";
import type { EntryStatus } from "@/lib/constants";

interface ActivityGridProps {
  habitId: string;
  color: string;
  gridRange: number;
  entries: Entry[];
  schedule: Habit["schedule"];
  timezone: string;
  onOverride?: (date: string, status: EntryStatus) => void;
}

interface CellData {
  date: string;
  status: EntryStatus | null;
  isScheduled: boolean;
  isOverride: boolean;
  isFuture: boolean;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function ActivityGrid({
  habitId,
  color,
  gridRange,
  entries,
  schedule,
  timezone,
  onOverride,
}: ActivityGridProps) {
  const [overrideDate, setOverrideDate] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const entryMap = useMemo(() => {
    const map: Record<string, Entry> = {};
    for (const entry of entries) {
      map[entry.date] = entry;
    }
    return map;
  }, [entries]);

  const isScheduledDay = useCallback(
    (dateStr: string): boolean => {
      const date = new Date(dateStr + "T12:00:00Z");
      switch (schedule.type) {
        case "daily":
          return true;
        case "every_other_day": {
          if (!schedule.anchorDate) return false;
          const anchor = new Date(schedule.anchorDate + "T12:00:00Z");
          const diff = differenceInCalendarDays(date, anchor);
          return diff >= 0 && diff % 2 === 0;
        }
        case "days_of_week": {
          const dayOfWeek = getDay(date);
          return schedule.daysOfWeek?.includes(dayOfWeek) ?? false;
        }
        case "days_of_month": {
          const dayOfMonth = getDate(date);
          return schedule.daysOfMonth?.includes(dayOfMonth) ?? false;
        }
        default:
          return false;
      }
    },
    [schedule]
  );

  // Build grid data
  const { cells, numWeeks } = useMemo(() => {
    const todayDate = new Date();
    // End at end of current week (Saturday)
    const endOfCurrentWeek = addDays(
      startOfWeek(todayDate, { weekStartsOn: 0 }),
      6
    );
    const startDate = subDays(endOfCurrentWeek, gridRange - 1);

    // Align to start of week (Sunday)
    const alignedStart = startOfWeek(startDate, { weekStartsOn: 0 });
    const totalDays =
      differenceInCalendarDays(endOfCurrentWeek, alignedStart) + 1;
    const weeks = Math.ceil(totalDays / 7);

    const grid: CellData[] = [];
    for (let i = 0; i < weeks * 7; i++) {
      const cellDate = addDays(alignedStart, i);
      const dateStr = format(cellDate, "yyyy-MM-dd");
      const entry = entryMap[dateStr];
      const isFuture = dateStr > today;

      grid.push({
        date: dateStr,
        status: entry?.status ?? null,
        isScheduled: isScheduledDay(dateStr),
        isOverride: entry?.isOverride ?? false,
        isFuture,
      });
    }

    return { cells: grid, numWeeks: weeks };
  }, [gridRange, entryMap, today, isScheduledDay]);

  const getCellColor = (cell: CellData): string => {
    if (cell.isFuture) return "var(--cell-empty)";
    if (!cell.isScheduled) return "var(--cell-offday)";
    if (cell.status === "completed") return color;
    if (cell.status === "skipped") return `${color}66`;
    return "var(--cell-empty)";
  };

  const getCellClass = (cell: CellData): string => {
    if (cell.status === "skipped" && !cell.isFuture) return "activity-skipped";
    return "";
  };

  const handleLongPressStart = (dateStr: string) => {
    if (dateStr >= today) return;
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setOverrideDate(dateStr);
    }, 600);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleOverrideSelect = (status: EntryStatus) => {
    if (overrideDate) {
      onOverride?.(overrideDate, status);
      setOverrideDate(null);
    }
  };

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .activity-grid {
          --cell-empty: #e5e7eb;
          --cell-offday: #f3f4f6;
        }
        .dark .activity-grid {
          --cell-empty: #374151;
          --cell-offday: #1f2937;
        }
        .activity-skipped {
          background-image: repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 2px,
            rgba(255,255,255,0.3) 2px,
            rgba(255,255,255,0.3) 4px
          );
        }
      `,
        }}
      />

      <div className="activity-grid flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-[2px]">
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="flex h-[14px] w-[14px] items-center justify-center text-[8px] text-muted-foreground"
            >
              {i % 2 === 1 ? label : ""}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div
          className="grid gap-[2px] overflow-x-auto"
          style={{
            gridTemplateRows: "repeat(7, 14px)",
            gridTemplateColumns: `repeat(${numWeeks}, 14px)`,
            gridAutoFlow: "column",
          }}
        >
          {cells.map((cell) => (
            <Tooltip key={cell.date}>
              <TooltipTrigger
                render={
                  <div
                    className={`size-[14px] rounded-[3px] ${getCellClass(cell)}`}
                    style={{ backgroundColor: getCellColor(cell) }}
                    onMouseDown={() => handleLongPressStart(cell.date)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    onTouchStart={() => handleLongPressStart(cell.date)}
                    onTouchEnd={handleLongPressEnd}
                    onTouchCancel={handleLongPressEnd}
                  />
                }
              />
              <TooltipContent>
                <span>
                  {format(new Date(cell.date + "T12:00:00"), "MMM d, yyyy")}
                  {" \u2014 "}
                  {cell.isFuture
                    ? "Future"
                    : !cell.isScheduled
                      ? "Off day"
                      : cell.status ?? "No entry"}
                </span>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Override Sheet */}
      <Sheet
        open={overrideDate !== null}
        onOpenChange={(open) => {
          if (!open) setOverrideDate(null);
        }}
      >
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>
              Override{" "}
              {overrideDate
                ? format(
                    new Date(overrideDate + "T12:00:00"),
                    "MMM d, yyyy"
                  )
                : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2 p-4">
            <Button
              onClick={() => handleOverrideSelect("completed")}
              className="justify-start"
              variant="ghost"
            >
              <div
                className="size-4 rounded-full"
                style={{ backgroundColor: color }}
              />
              Completed
            </Button>
            <Button
              onClick={() => handleOverrideSelect("skipped")}
              className="justify-start"
              variant="ghost"
            >
              <div
                className="size-4 rounded-full"
                style={{ backgroundColor: `${color}66` }}
              />
              Skipped
            </Button>
            <Button
              onClick={() => handleOverrideSelect("missed")}
              className="justify-start"
              variant="ghost"
            >
              <div className="size-4 rounded-full bg-muted" />
              Missed
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
