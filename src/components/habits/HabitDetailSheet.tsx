"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  format,
  addDays,
  isToday,
  isFuture,
  differenceInCalendarDays,
  getDay,
  getDate,
  parseISO,
} from "date-fns";
import { Pencil, Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { HabitForm } from "@/components/habits/HabitForm";
import { cn } from "@/lib/utils";
import type { Habit, Entry, HabitStats, Section } from "@/lib/types";
import type { EntryStatus } from "@/lib/constants";

const COLS = 14;
const ROWS = 28;
const TOTAL_CELLS = COLS * ROWS;

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

interface HabitDetailSheetProps {
  habitId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHabitUpdated?: () => void;
  sections?: Section[];
}

export function HabitDetailSheet({
  habitId,
  open,
  onOpenChange,
  onHabitUpdated,
  sections = [],
}: HabitDetailSheetProps) {
  const [habit, setHabit] = useState<Habit | null>(null);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [stats, setStats] = useState<HabitStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [unlockMode, setUnlockMode] = useState(false);

  // Fetch data when sheet opens
  useEffect(() => {
    if (!open || !habitId) return;
    setLoading(true);
    setHabit(null);
    setEntries({});
    setStats(null);

    (async () => {
      try {
        const [habitRes, statsRes] = await Promise.all([
          fetch(`/api/habits/${habitId}`),
          fetch(`/api/habits/${habitId}/stats`),
        ]);

        let foundHabit: Habit | null = null;
        if (habitRes.ok) {
          foundHabit = await habitRes.json();
          setHabit(foundHabit);
        }
        if (statsRes.ok) {
          setStats(await statsRes.json());
        }

        if (foundHabit) {
          const from = format(parseISO(foundHabit.createdAt), "yyyy-MM-dd");
          const to = format(
            addDays(parseISO(foundHabit.createdAt), TOTAL_CELLS - 1),
            "yyyy-MM-dd"
          );
          const entriesRes = await fetch(
            `/api/habits/${habitId}/entries?from=${from}&to=${to}`
          );
          if (entriesRes.ok) {
            const data = await entriesRes.json();
            const arr: Entry[] = Array.isArray(data) ? data : [];
            const map: Record<string, Entry> = {};
            for (const e of arr) map[e.date] = e;
            setEntries(map);
          }
        }
      } catch {
        // skip
      } finally {
        setLoading(false);
      }
    })();
  }, [open, habitId]);

  const gridDates = useMemo(() => {
    if (!habit) return [];
    const start = parseISO(habit.createdAt);
    return Array.from({ length: TOTAL_CELLS }, (_, i) => addDays(start, i));
  }, [habit]);

  const handleCellTap = useCallback(
    async (dateStr: string, date: Date) => {
      if (!habit) return;
      if (isFuture(date) && !isToday(date)) return;
      const scheduled = isScheduled(habit, date);
      if (!unlockMode && !isToday(date)) return;
      if (!unlockMode && !scheduled) return;

      const current = entries[dateStr]?.status ?? null;
      const cycle: (EntryStatus | null)[] = [null, "completed", "skipped", null];
      const idx = cycle.indexOf(current);
      const next = cycle[(idx + 1) % cycle.length];
      if (current === next || (current === null && next === null)) return;

      const override = !scheduled || !isToday(date);

      setEntries((prev) => {
        const copy = { ...prev };
        if (next === null) {
          delete copy[dateStr];
        } else {
          copy[dateStr] = {
            _id: copy[dateStr]?._id ?? "temp",
            habitId: habit._id,
            date: dateStr,
            status: next,
            isOverride: override,
          };
        }
        return copy;
      });

      try {
        if (next === null) {
          await fetch(`/api/habits/${habit._id}/entries?date=${dateStr}`, {
            method: "DELETE",
          });
        } else {
          const res = await fetch(`/api/habits/${habit._id}/entries`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: dateStr,
              status: next,
              isOverride: override,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setEntries((prev) => ({ ...prev, [dateStr]: data }));
          }
        }
        const statsRes = await fetch(`/api/habits/${habit._id}/stats`);
        if (statsRes.ok) setStats(await statsRes.json());
        onHabitUpdated?.();
      } catch {
        // skip
      }
    },
    [habit, entries, onHabitUpdated, unlockMode]
  );

  const handleHabitSaved = useCallback(
    (updated: Habit) => {
      setHabit(updated);
      setEditOpen(false);
      onHabitUpdated?.();
    },
    [onHabitUpdated]
  );

  const handleDeleteOrArchive = useCallback(() => {
    setEditOpen(false);
    onOpenChange(false);
    onHabitUpdated?.();
  }, [onOpenChange, onHabitUpdated]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] overflow-y-auto"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !habit ? (
            <div className="py-12 text-center text-muted-foreground">
              Habit not found
            </div>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 pr-16">
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: habit.color }}
                  />
                  {habit.icon && <span>{habit.icon}</span>}
                  {habit.name}
                </SheetTitle>
              </SheetHeader>
              <div className="absolute top-3 right-11 flex items-center gap-1">
                <Button
                  variant={unlockMode ? "default" : "ghost"}
                  size="icon-sm"
                  onClick={() => setUnlockMode((v) => !v)}
                  aria-label={unlockMode ? "Lock days" : "Unlock days"}
                >
                  {unlockMode ? (
                    <LockOpen className="size-4" />
                  ) : (
                    <Lock className="size-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEditOpen(true)}
                  aria-label="Edit"
                >
                  <Pencil className="size-4" />
                </Button>
              </div>

              {habit.description && (
                <p className="px-4 pb-2 text-sm text-muted-foreground">
                  {habit.description}
                </p>
              )}

              <div className="px-2 pb-6">
                {/* Stats */}
                {stats && (
                  <div
                    className="mx-auto mb-4 grid grid-cols-4 gap-2"
                    style={{ maxWidth: 500 }}
                  >
                    <StatCell
                      label="Streak"
                      value={String(stats.currentStreak)}
                    />
                    <StatCell
                      label="Best"
                      value={String(stats.bestStreak)}
                    />
                    <StatCell
                      label="Total"
                      value={String(stats.totalCompletions)}
                    />
                    <StatCell
                      label="Skip"
                      value={`${Math.round(stats.skipRate * 100)}%`}
                    />
                    <StatCell
                      label="Week"
                      value={`${Math.round(stats.thisWeek * 100)}%`}
                      bar={stats.thisWeek}
                      color={habit.color}
                    />
                    <StatCell
                      label="Month"
                      value={`${Math.round(stats.thisMonth * 100)}%`}
                      bar={stats.thisMonth}
                      color={habit.color}
                    />
                    <StatCell
                      label="Year"
                      value={`${Math.round(stats.thisYear * 100)}%`}
                      bar={stats.thisYear}
                      color={habit.color}
                    />
                    <StatCell
                      label="Created"
                      value={format(parseISO(habit.createdAt), "MMM d")}
                    />
                  </div>
                )}

                {/* Grid */}
                <div
                  className="grid gap-0 mx-auto"
                  style={{
                    gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                    maxWidth: 500,
                  }}
                >
                  {gridDates.map((date, i) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    const entry = entries[dateStr];
                    const scheduled = isScheduled(habit, date);
                    const status = entry?.status ?? null;
                    const today = isToday(date);
                    const future = isFuture(date) && !today;
                    const isFirstOfMonth = date.getDate() === 1;
                    const isFirstCol = i % COLS === 0;

                    return (
                      <div key={dateStr} className="relative">
                        <button
                          onClick={() => handleCellTap(dateStr, date)}
                          disabled={future || (!today && !unlockMode)}
                          className={cn(
                            "aspect-square w-full border-[0.5px] border-border/20 relative",
                            today &&
                              "active:scale-90 ring-2 ring-primary ring-inset",
                            !today && unlockMode && !future && "active:scale-90",
                            future && "opacity-40"
                          )}
                          aria-label={`${dateStr}: ${status ?? "none"}`}
                        >
                          <CellFill
                            status={status}
                            color={habit.color}
                            scheduled={scheduled}
                            future={future}
                            unlockMode={unlockMode}
                          />
                          {(isFirstCol || isFirstOfMonth) && (
                            <span className="absolute bottom-0.5 left-0.5 text-[8px] leading-none text-foreground/50">
                              {format(
                                date,
                                isFirstOfMonth ? "MMM" : "d"
                              )}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit sheet stacks on top */}
      {habit && (
        <Sheet open={editOpen} onOpenChange={setEditOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[90dvh] overflow-y-auto"
          >
            <SheetHeader>
              <SheetTitle>Edit Habit</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <HabitForm
                habit={habit}
                onSave={handleHabitSaved}
                onArchive={handleDeleteOrArchive}
                onDelete={handleDeleteOrArchive}
                sections={sections}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

function StatCell({
  label,
  value,
  bar,
  color,
}: {
  label: string;
  value: string;
  bar?: number;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-card p-2.5 ring-1 ring-border/30">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      {bar !== undefined && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, Math.max(0, bar * 100))}%`,
              backgroundColor: color ?? "currentColor",
            }}
          />
        </div>
      )}
    </div>
  );
}

function CellFill({
  status,
  color,
  scheduled,
  future,
  unlockMode,
}: {
  status: EntryStatus | null;
  color: string;
  scheduled: boolean;
  future: boolean;
  unlockMode?: boolean;
}) {
  if (future && !scheduled) return <div className="size-full bg-muted/10" />;
  if (future)
    return (
      <div className="size-full" style={{ backgroundColor: `${color}10` }} />
    );
  if (!scheduled && unlockMode && status === null)
    return (
      <div className="size-full border border-dashed border-muted-foreground/30" />
    );
  if (!scheduled && !unlockMode)
    return <div className="size-full bg-muted/30" />;
  if (status === "completed")
    return (
      <div
        className="size-full"
        style={{ backgroundColor: color, opacity: scheduled ? 1 : 0.6 }}
      />
    );
  if (status === "skipped")
    return (
      <div
        className="size-full relative overflow-hidden"
        style={{ backgroundColor: `${color}25` }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `repeating-linear-gradient(-45deg,transparent,transparent 2px,${color}50 2px,${color}50 4px)`,
          }}
        />
      </div>
    );
  return <div className="size-full bg-muted/15" />;
}
