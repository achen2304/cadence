"use client";

import { useMemo } from "react";
import {
  startOfWeek,
  addDays,
  format,
  isSameDay,
  isToday as isTodayFn,
} from "date-fns";
import { cn } from "@/lib/utils";

interface WeekStripProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
}

const DAY_ABBREVS = ["M", "T", "W", "T", "F", "S", "S"];

export function WeekStrip({ selectedDate, onSelect }: WeekStripProps) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, []);

  return (
    <div className="flex w-full items-center justify-between gap-1 overflow-x-auto px-2 py-3">
      {weekDays.map((day, i) => {
        const isToday = isTodayFn(day);
        const isSelected = isSameDay(day, selectedDate);

        return (
          <button
            key={i}
            onClick={() => onSelect(day)}
            className={cn(
              "flex min-w-[44px] flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-colors",
              isToday && !isSelected && "bg-primary/10",
              isSelected && "bg-primary text-primary-foreground",
              !isToday && !isSelected && "hover:bg-muted"
            )}
          >
            <span
              className={cn(
                "text-xs font-medium",
                isSelected
                  ? "text-primary-foreground"
                  : isToday
                    ? "text-primary"
                    : "text-muted-foreground"
              )}
            >
              {DAY_ABBREVS[i]}
            </span>
            <span
              className={cn(
                "text-sm font-semibold",
                isSelected
                  ? "text-primary-foreground"
                  : isToday
                    ? "text-primary"
                    : "text-foreground"
              )}
            >
              {format(day, "d")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
