"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  format,
  subDays,
  differenceInCalendarDays,
  getDay,
  getDate,
  isToday,
  isFuture,
} from "date-fns";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  LocateFixed,
  CalendarDays,
  GripVertical,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { HabitForm } from "@/components/habits/HabitForm";
import { HabitDetailSheet } from "@/components/habits/HabitDetailSheet";
import { HeatmapSheet } from "@/components/habits/HeatmapSheet";
import { cn } from "@/lib/utils";
import type { Habit, Entry, HabitStats } from "@/lib/types";
import type { EntryStatus } from "@/lib/constants";

const NUM_DAYS = 14;
const NAME_COL = 80;

type StatMode = "streak" | "count" | "rate";

const STAT_HEADERS: Record<StatMode, [string, string, string]> = {
  streak: ["Now", "Best", "Tot"],
  count: ["Wk", "Mo", "Yr"],
  rate: ["Wk", "Mo", "Yr"],
};

const SCHEDULE_SECTION_LABELS: Record<string, string> = {
  daily: "Daily",
  every_other_day: "Daily",
  days_of_week: "Weekly",
  days_of_month: "Monthly",
};

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

function getStatValues(
  stats: HabitStats | undefined,
  mode: StatMode
): [string, string, string] {
  if (!stats) return ["—", "—", "—"];
  switch (mode) {
    case "streak":
      return [
        String(stats.currentStreak),
        String(stats.bestStreak),
        String(stats.totalCompletions),
      ];
    case "count":
      return [
        String(Math.round(stats.thisWeek * 100)),
        String(Math.round(stats.thisMonth * 100)),
        String(Math.round(stats.thisYear * 100)),
      ];
    case "rate":
      return [
        `${Math.round(stats.thisWeek * 100)}%`,
        `${Math.round(stats.thisMonth * 100)}%`,
        `${Math.round(stats.thisYear * 100)}%`,
      ];
  }
}

const CELL_CSS = `calc((100vw - ${NAME_COL}px) / 4)`;

export function Dashboard() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<
    Record<string, Record<string, Entry>>
  >({});
  const [stats, setStats] = useState<Record<string, HabitStats>>({});
  const [statMode, setStatMode] = useState<StatMode>("streak");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [detailHabitId, setDetailHabitId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: NUM_DAYS }, (_, i) =>
      subDays(today, NUM_DAYS - 1 - i)
    );
  }, []);

  const dateStrs = useMemo(
    () => dates.map((d) => format(d, "yyyy-MM-dd")),
    [dates]
  );

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/habits");
        if (res.ok) {
          setHabits(Array.isArray(await res.clone().json()) ? await res.json() : []);
        } else {
          setError("Failed to load habits");
        }
      } catch {
        setError("Network error — check your connection");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (habits.length === 0) return;
    const from = dateStrs[0];
    const to = dateStrs[dateStrs.length - 1];

    async function loadEntries() {
      try {
        const res = await fetch(`/api/habits/entries?from=${from}&to=${to}`);
        if (res.ok) {
          const grouped: Record<string, Entry[]> = await res.json();
          const allEntries: Record<string, Record<string, Entry>> = {};
          for (const [habitId, arr] of Object.entries(grouped)) {
            allEntries[habitId] = {};
            for (const e of arr) {
              allEntries[habitId][e.date] = e;
            }
          }
          setEntries(allEntries);
        }
      } catch {
        // skip — entries will show as empty
      }
    }

    loadEntries();
  }, [habits, dateStrs]);

  const refreshStats = useCallback(
    (habitIds?: string[]) => {
      // Debounce: if tapping rapidly, only fire once after 500ms idle
      if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
      statsTimerRef.current = setTimeout(async () => {
        if (habits.length === 0) return;
        try {
          if (habitIds && habitIds.length === 1) {
            const res = await fetch(`/api/habits/${habitIds[0]}/stats`);
            if (res.ok) {
              const data = await res.json();
              setStats((prev) => ({ ...prev, [habitIds[0]]: data }));
            }
          } else {
            const res = await fetch("/api/habits/stats");
            if (res.ok) {
              const data: Record<string, HabitStats> = await res.json();
              setStats((prev) => ({ ...prev, ...data }));
            }
          }
        } catch {
          // skip
        }
      }, 500);
    },
    [habits]
  );

  useEffect(() => {
    if (habits.length === 0) return;
    // Initial load — no debounce
    (async () => {
      try {
        const res = await fetch("/api/habits/stats");
        if (res.ok) {
          const data: Record<string, HabitStats> = await res.json();
          setStats(data);
        }
      } catch {
        // skip
      }
    })();
  }, [habits]);

  const scrollToToday = useCallback(() => {
    if (!scrollRef.current) return;
    const containerWidth = scrollRef.current.clientWidth;
    const cellWidth = containerWidth / 4;
    const todayRight = NUM_DAYS * cellWidth;
    scrollRef.current.scrollTo({
      left: todayRight - containerWidth,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      const containerWidth = scrollRef.current.clientWidth;
      const cellWidth = containerWidth / 4;
      const todayRight = NUM_DAYS * cellWidth;
      scrollRef.current.scrollLeft = todayRight - containerWidth;
    }
  }, [loading, habits]);

  const activeHabits = useMemo(
    () =>
      habits.filter((h) => !h.archivedAt).sort((a, b) => a.order - b.order),
    [habits]
  );

  // Group habits by schedule type
  const habitGroups = useMemo(() => {
    const daily = activeHabits.filter(
      (h) =>
        h.schedule.type === "daily" || h.schedule.type === "every_other_day"
    );
    const weekly = activeHabits.filter(
      (h) => h.schedule.type === "days_of_week"
    );
    const monthly = activeHabits.filter(
      (h) => h.schedule.type === "days_of_month"
    );

    const groups: { label: string; habits: Habit[] }[] = [];
    if (daily.length > 0) groups.push({ label: "Daily", habits: daily });
    if (weekly.length > 0) groups.push({ label: "Weekly", habits: weekly });
    if (monthly.length > 0)
      groups.push({ label: "Monthly", habits: monthly });
    return groups;
  }, [activeHabits]);

  const handleCellTap = useCallback(
    async (habit: Habit, dateStr: string, date: Date) => {
      if (isFuture(date) && !isToday(date)) return;
      if (!isScheduled(habit, date)) return;

      const current = entries[habit._id]?.[dateStr]?.status ?? null;
      const hasExistingEntry = !!entries[habit._id]?.[dateStr];
      const cycle: (EntryStatus | null)[] = [
        null,
        "completed",
        "skipped",
        null,
      ];
      const idx = cycle.indexOf(current);
      const next = cycle[(idx + 1) % cycle.length];

      if (current === next) return;
      if (current === null && next === null) return;

      const cellKey = `${habit._id}-${dateStr}`;

      // Optimistic update
      setEntries((prev) => {
        const habitEntries = { ...(prev[habit._id] ?? {}) };
        if (next === null) {
          delete habitEntries[dateStr];
        } else {
          habitEntries[dateStr] = {
            _id: habitEntries[dateStr]?._id ?? "temp",
            habitId: habit._id,
            date: dateStr,
            status: next,
            isOverride: !isToday(date),
          };
        }
        return { ...prev, [habit._id]: habitEntries };
      });

      setSavingCells((prev) => new Set(prev).add(cellKey));

      try {
        if (next === null && hasExistingEntry) {
          // Only DELETE if there was an actual entry
          const res = await fetch(
            `/api/habits/${habit._id}/entries?date=${dateStr}`,
            { method: "DELETE" }
          );
          if (!res.ok) throw new Error("Delete failed");
        } else if (next === null && !hasExistingEntry) {
          // No entry to delete — nothing to do server-side
        } else {
          const res = await fetch(`/api/habits/${habit._id}/entries`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: dateStr,
              status: next,
              isOverride: !isToday(date),
            }),
          });
          if (!res.ok) throw new Error("Save failed");
          const data = await res.json();
          setEntries((prev) => ({
            ...prev,
            [habit._id]: { ...(prev[habit._id] ?? {}), [dateStr]: data },
          }));
        }
        refreshStats([habit._id]);
      } catch {
        // Revert optimistic update
        setEntries((prev) => {
          const habitEntries = { ...(prev[habit._id] ?? {}) };
          if (current === null) {
            delete habitEntries[dateStr];
          } else {
            habitEntries[dateStr] = {
              _id: habitEntries[dateStr]?._id ?? "temp",
              habitId: habit._id,
              date: dateStr,
              status: current,
              isOverride: false,
            };
          }
          return { ...prev, [habit._id]: habitEntries };
        });
        setError("Failed to save — tap again to retry");
        setTimeout(() => setError(null), 3000);
      } finally {
        setSavingCells((prev) => {
          const next = new Set(prev);
          next.delete(cellKey);
          return next;
        });
      }
    },
    [entries, refreshStats]
  );

  const summaryRow = useMemo(() => {
    return dates.map((date, i) => {
      const dateStr = dateStrs[i];
      let completed = 0;
      let total = 0;
      for (const habit of activeHabits) {
        if (!isScheduled(habit, date)) continue;
        total++;
        const entry = entries[habit._id]?.[dateStr];
        if (entry?.status === "completed") completed++;
      }
      return { completed, total };
    });
  }, [dates, dateStrs, activeHabits, entries]);

  const handleReorder = useCallback(
    async (reordered: Habit[]) => {
      setHabits((prev) => {
        const archived = prev.filter((h) => h.archivedAt);
        return [
          ...reordered.map((h, i) => ({ ...h, order: i })),
          ...archived,
        ];
      });

      try {
        await fetch("/api/habits/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: reordered.map((h, i) => ({ id: h._id, order: i })),
          }),
        });
      } catch {
        setError("Failed to save order");
        setTimeout(() => setError(null), 3000);
      }
    },
    []
  );

  const handleHabitCreated = useCallback((habit: Habit) => {
    setHabits((prev) => [...prev, habit]);
    setSheetOpen(false);
  }, []);

  const statHeaders = STAT_HEADERS[statMode];
  const nextMode = (): StatMode => {
    const modes: StatMode[] = ["streak", "count", "rate"];
    return modes[(modes.indexOf(statMode) + 1) % modes.length];
  };

  // Clear error on dismiss
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(t);
    }
  }, [error]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col pb-24">
      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {activeHabits.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-muted-foreground">No habits yet</p>
          <p className="text-sm text-muted-foreground">
            Tap + to create your first habit
          </p>
        </div>
      ) : (
        <>
          <div className="flex">
            {/* Sticky name column */}
            <div
              className="shrink-0 z-10 bg-background flex flex-col"
              style={{ width: NAME_COL }}
            >
              {/* Reorder button */}
              <button
                onClick={() => setReorderOpen(true)}
                className="flex items-center justify-center gap-1 shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
                style={{ height: CELL_CSS }}
              >
                <ArrowUpDown className="size-3" />
                <span>Edit</span>
              </button>

              {habitGroups.map((group) => (
                <div key={group.label}>
                  <div className="flex items-center px-2 shrink-0 h-6">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </span>
                  </div>
                  {group.habits.map((habit) => (
                    <button
                      key={habit._id}
                      onClick={() => { setDetailHabitId(habit._id); setDetailOpen(true); }}
                      className="flex items-center px-2 shrink-0 overflow-hidden"
                      style={{ height: CELL_CSS }}
                    >
                      <span
                        className="text-left text-[13px] leading-tight font-medium text-foreground transition-colors hover:text-primary overflow-hidden text-ellipsis"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {habit.icon ? `${habit.icon} ` : ""}
                        {habit.name}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
              <div className="shrink-0" style={{ height: CELL_CSS }} />
            </div>

            {/* Scrollable area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-x-auto scrollbar-none touch-pan-x"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <div
                className="flex flex-col"
                style={{ width: "max-content" }}
              >
                {/* Date header row */}
                <div className="flex shrink-0" style={{ height: CELL_CSS }}>
                  {dates.map((date, i) => (
                    <div
                      key={`hdr-${dateStrs[i]}`}
                      className={cn(
                        "flex flex-col items-center justify-center shrink-0",
                        isToday(date)
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground"
                      )}
                      style={{ width: CELL_CSS }}
                    >
                      <span className="text-xs">
                        {format(date, "EEE")[0]}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 flex size-6 items-center justify-center rounded-full text-xs",
                          isToday(date) &&
                            "bg-primary text-primary-foreground"
                        )}
                      >
                        {format(date, "d")}
                      </span>
                    </div>
                  ))}
                  {statHeaders.map((label, si) => (
                    <div
                      key={`shdr-${si}`}
                      className="flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0 border-l border-border/30"
                      style={{ width: CELL_CSS }}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Grouped habit rows */}
                {habitGroups.map((group) => (
                  <div key={group.label}>
                    <div className="h-6" />
                    {group.habits.map((habit) => (
                      <div
                        key={habit._id}
                        className="flex shrink-0"
                        style={{ height: CELL_CSS }}
                      >
                        {dates.map((date, di) => {
                          const dateStr = dateStrs[di];
                          const entry = entries[habit._id]?.[dateStr];
                          const scheduled = isScheduled(habit, date);
                          const status = entry?.status ?? null;
                          const future =
                            isFuture(date) && !isToday(date);
                          const cellKey = `${habit._id}-${dateStr}`;
                          const isSaving = savingCells.has(cellKey);

                          return (
                            <button
                              key={cellKey}
                              onClick={() =>
                                handleCellTap(habit, dateStr, date)
                              }
                              disabled={future}
                              className={cn(
                                "shrink-0 border-[0.5px] border-border/20 relative",
                                !future && "active:scale-95",
                                isSaving && "animate-pulse"
                              )}
                              style={{
                                width: CELL_CSS,
                                height: CELL_CSS,
                              }}
                              aria-label={`${habit.name} ${dateStr}: ${status ?? "none"}`}
                            >
                              <CellFill
                                status={status}
                                color={habit.color}
                                scheduled={scheduled}
                              />
                            </button>
                          );
                        })}

                        {getStatValues(stats[habit._id], statMode).map(
                          (val, si) => (
                            <div
                              key={`${habit._id}-s${si}`}
                              className="flex items-center justify-center text-xs tabular-nums text-muted-foreground shrink-0 border-l border-border/10"
                              style={{
                                width: CELL_CSS,
                                height: CELL_CSS,
                              }}
                            >
                              {val}
                            </div>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                ))}

                {/* Bottom row: summary + toggle */}
                <div
                  className="flex shrink-0"
                  style={{ height: CELL_CSS }}
                >
                  {dates.map((_, di) => {
                    const s = summaryRow[di];
                    return (
                      <div
                        key={`sum-${dateStrs[di]}`}
                        className={cn(
                          "flex items-center justify-center text-xs tabular-nums shrink-0",
                          s.total > 0 && s.completed === s.total
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                        )}
                        style={{ width: CELL_CSS }}
                      >
                        {s.total > 0
                          ? `${s.completed}/${s.total}`
                          : ""}
                      </div>
                    );
                  })}

                  <button
                    onClick={() => setStatMode(nextMode())}
                    className="flex items-center justify-center text-xs font-medium capitalize text-muted-foreground shrink-0 border-l border-border/30 transition-colors hover:text-foreground"
                    style={{ width: `calc(${CELL_CSS} * 3)` }}
                  >
                    {statMode} ›
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bottom-right FABs */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
        <Button
          size="icon"
          variant="secondary"
          className="size-10 rounded-full shadow-lg"
          onClick={scrollToToday}
          aria-label="Scroll to today"
        >
          <LocateFixed className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="size-10 rounded-full shadow-lg"
          onClick={() => setHeatmapOpen(true)}
          aria-label="Heatmap"
        >
          <CalendarDays className="size-4" />
        </Button>
        <Button
          size="icon"
          className="size-14 rounded-full shadow-lg"
          onClick={() => setSheetOpen(true)}
          aria-label="Add habit"
        >
          <Plus className="size-6" />
        </Button>
      </div>

      {/* Add Habit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Habit</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <HabitForm onSave={handleHabitCreated} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Reorder Sheet — grouped by section */}
      <Sheet open={reorderOpen} onOpenChange={setReorderOpen}>
        <SheetContent side="bottom" className="max-h-[70dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Reorder Habits</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4 space-y-4">
            {habitGroups.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {group.label}
                </p>
                <ReorderList
                  habits={group.habits}
                  onReorder={(reordered) => {
                    // Merge reordered group back into full list
                    const otherHabits = activeHabits.filter(
                      (h) =>
                        SCHEDULE_SECTION_LABELS[h.schedule.type] !==
                        group.label
                    );
                    const merged = [...otherHabits, ...reordered];
                    handleReorder(merged);
                  }}
                />
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Habit Detail Sheet */}
      <HabitDetailSheet
        habitId={detailHabitId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onHabitUpdated={() => {
          // Refresh habits, entries, and stats
          fetch("/api/habits")
            .then((r) => r.json())
            .then((d) => setHabits(Array.isArray(d) ? d : []))
            .catch(() => {});
          refreshStats();
        }}
      />

      {/* Heatmap Sheet */}
      <HeatmapSheet
        open={heatmapOpen}
        onOpenChange={setHeatmapOpen}
        habits={habits}
      />
    </div>
  );
}

/* ── Reorder list (inside sheet) ── */

function ReorderList({
  habits,
  onReorder,
}: {
  habits: Habit[];
  onReorder: (habits: Habit[]) => void;
}) {
  const [items, setItems] = useState(habits);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((h) => h._id === active.id);
      const newIndex = items.findIndex((h) => h._id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(items, oldIndex, newIndex);
      setItems(reordered);
      onReorder(reordered);
    },
    [items, onReorder]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((h) => h._id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-1">
          {items.map((habit) => (
            <SortableReorderItem key={habit._id} habit={habit} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableReorderItem({ habit }: { habit: Habit }) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-xl bg-card px-3 py-3 ring-1 ring-border/50",
        isDragging && "z-50 shadow-lg opacity-80"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab p-1 text-muted-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-5" />
      </button>
      <div
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: habit.color }}
      />
      <span className="text-sm font-medium text-foreground">
        {habit.icon ? `${habit.icon} ` : ""}
        {habit.name}
      </span>
    </div>
  );
}

/* ── Cell fill ── */

function CellFill({
  status,
  color,
  scheduled,
}: {
  status: EntryStatus | null;
  color: string;
  scheduled: boolean;
}) {
  if (!scheduled) {
    return (
      <div className="size-full bg-muted/10 relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(
              -45deg,
              transparent calc(50% - 0.5px),
              currentColor calc(50% - 0.5px),
              currentColor calc(50% + 0.5px),
              transparent calc(50% + 0.5px)
            )`,
            opacity: 0.15,
          }}
        />
      </div>
    );
  }

  if (status === "completed") {
    return <div className="size-full" style={{ backgroundColor: color }} />;
  }

  if (status === "skipped") {
    return (
      <div
        className="size-full relative overflow-hidden"
        style={{ backgroundColor: `${color}25` }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 2px,
              ${color}50 2px,
              ${color}50 4px
            )`,
          }}
        />
      </div>
    );
  }

  return <div className="size-full bg-muted/15" />;
}
