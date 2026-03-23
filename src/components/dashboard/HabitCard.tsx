"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { GripVertical, Check, Minus } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { Habit, Entry } from "@/lib/types";
import type { EntryStatus } from "@/lib/constants";

interface HabitCardProps {
  habit: Habit;
  entry: Entry | undefined;
  isScheduled: boolean;
  selectedDate: Date;
  onEntryChange: (habitId: string, entry: Entry | null) => void;
}

const STATUS_CYCLE: (EntryStatus | null)[] = [
  null,
  "completed",
  "skipped",
  null,
];

function getNextStatus(current: EntryStatus | null): EntryStatus | null {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

export function HabitCard({
  habit,
  entry,
  isScheduled,
  selectedDate,
  onEntryChange,
}: HabitCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: habit._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const currentStatus: EntryStatus | null = entry?.status ?? null;

  const handleStatusToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (loading) return;

      const nextStatus = getNextStatus(currentStatus);
      setLoading(true);

      try {
        const dateStr = format(selectedDate, "yyyy-MM-dd");

        if (nextStatus === null) {
          onEntryChange(habit._id, null);
          await fetch(`/api/habits/${habit._id}/entries?date=${dateStr}`, {
            method: "DELETE",
          });
        } else {
          const optimistic: Entry = {
            _id: entry?._id ?? "temp",
            habitId: habit._id,
            date: dateStr,
            status: nextStatus,
            isOverride: false,
          };
          onEntryChange(habit._id, optimistic);

          const res = await fetch(`/api/habits/${habit._id}/entries`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: dateStr, status: nextStatus }),
          });
          if (res.ok) {
            const data = await res.json();
            onEntryChange(habit._id, data);
          }
        }
      } catch {
        // revert on error
      } finally {
        setLoading(false);
      }
    },
    [currentStatus, entry, habit._id, loading, onEntryChange, selectedDate]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-all",
        isDragging && "z-50 shadow-lg opacity-90",
        !isScheduled && "opacity-40"
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>

      {/* Color accent bar */}
      <div
        className="w-1 self-stretch rounded-full"
        style={{ backgroundColor: habit.color }}
      />

      {/* Content */}
      <button
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
        onClick={() => router.push(`/habit/${habit._id}`)}
      >
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {habit.icon && <span>{habit.icon}</span>}
          <span className="truncate">{habit.name}</span>
        </span>
        <span className="text-xs text-muted-foreground">
          {getScheduleLabelClient(habit)}
        </span>
      </button>

      {/* Status button */}
      <button
        onClick={handleStatusToggle}
        disabled={loading}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full border-2 transition-all",
          currentStatus === "completed" && "border-transparent",
          currentStatus === "skipped" && "border-transparent",
          currentStatus === null && "border-muted-foreground/30"
        )}
        style={
          currentStatus === "completed"
            ? { backgroundColor: habit.color }
            : currentStatus === "skipped"
              ? { backgroundColor: `${habit.color}40` }
              : undefined
        }
        aria-label={`Status: ${currentStatus ?? "none"}`}
      >
        {currentStatus === "completed" && (
          <Check className="size-5 text-white" />
        )}
        {currentStatus === "skipped" && (
          <Minus className="size-5 text-white" />
        )}
      </button>
    </div>
  );
}

function getScheduleLabelClient(habit: Habit): string {
  const schedule = habit.schedule;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  switch (schedule.type) {
    case "daily":
      return "Daily";
    case "every_other_day":
      return "Every other day";
    case "days_of_week":
      return (
        schedule.daysOfWeek?.map((d) => dayNames[d]).join(" \u00B7 ") ??
        "No days"
      );
    case "days_of_month":
      return schedule.daysOfMonth?.join(", ") ?? "No days";
    default:
      return "";
  }
}
