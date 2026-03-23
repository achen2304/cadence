import { connectDB } from "@/lib/mongodb";
import Habit, { IHabit } from "@/models/Habit";
import Entry, { IEntry } from "@/models/Entry";
import Settings from "@/models/Settings";
import { isScheduledDay } from "@/lib/schedule";
import { calculateStreaks } from "@/lib/streaks";
import {
  format,
  startOfWeek,
  startOfMonth,
  startOfYear,
  eachDayOfInterval,
  startOfDay,
  isBefore,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";

export interface ComputedStats {
  currentStreak: number;
  bestStreak: number;
  totalCompletions: number;
  skipRate: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
}

export async function recomputeStats(
  habitId: string,
  userId: string
): Promise<ComputedStats> {
  await connectDB();

  const habit = (await Habit.findOne({ _id: habitId, userId })) as IHabit | null;
  if (!habit) {
    throw new Error("Habit not found");
  }

  const settings = await Settings.findOne({ userId }).lean();
  const timezone = settings?.timezone ?? "America/Chicago";

  const now = toZonedTime(new Date(), timezone);
  const today = startOfDay(now);
  const todayStr = format(today, "yyyy-MM-dd");

  // Habit creation date in user's timezone
  const createdAt = toZonedTime(new Date(habit.createdAt), timezone);
  const habitStart = startOfDay(createdAt);

  // Period starts, clamped to habit creation date
  const clamp = (d: Date) => (isBefore(d, habitStart) ? habitStart : d);
  const weekStart = clamp(startOfWeek(now, { weekStartsOn: 0 }));
  const monthStart = clamp(startOfMonth(now));
  const yearStart = clamp(startOfYear(now));

  const earliestStr = format(habitStart, "yyyy-MM-dd");

  // Fetch all entries from habit creation to today
  const allEntries = (await Entry.find({
    habitId,
    userId,
    date: { $gte: earliestStr, $lte: todayStr },
  }).lean()) as IEntry[];

  const entryMap = new Map<string, IEntry>();
  for (const entry of allEntries) {
    entryMap.set(entry.date, entry);
  }

  // Calculate completion rate for a period (only counting scheduled days)
  function completionRate(periodStart: Date): number {
    if (isBefore(today, periodStart)) return 0;
    const days = eachDayOfInterval({ start: periodStart, end: today });
    let scheduled = 0;
    let done = 0;

    for (const day of days) {
      const dateStr = format(day, "yyyy-MM-dd");
      if (isBefore(day, habitStart)) continue;
      if (!isScheduledDay(habit!, dateStr, timezone)) continue;
      scheduled++;
      const entry = entryMap.get(dateStr);
      if (entry?.status === "completed" || entry?.status === "skipped") done++;
    }

    return scheduled > 0 ? done / scheduled : 0;
  }

  const thisWeek = completionRate(weekStart);
  const thisMonth = completionRate(monthStart);
  const thisYear = completionRate(yearStart);

  const totalCompletions = allEntries.filter(
    (e) => e.status === "completed"
  ).length;
  const totalSkipped = allEntries.filter(
    (e) => e.status === "skipped"
  ).length;
  const totalDone = totalCompletions + totalSkipped;
  const skipRate = totalDone > 0 ? totalSkipped / totalDone : 0;

  const streaks = calculateStreaks(habit, allEntries, timezone);

  const computed: ComputedStats = {
    thisWeek,
    thisMonth,
    thisYear,
    currentStreak: streaks.currentStreak,
    bestStreak: streaks.bestStreak,
    totalCompletions,
    skipRate,
  };

  // Save to habit's cachedStats
  await Habit.findByIdAndUpdate(habitId, {
    cachedStats: {
      ...computed,
      updatedAt: new Date(),
    },
  });

  return computed;
}
