import { format, subDays, startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { IHabit } from "@/models/Habit";
import { IEntry } from "@/models/Entry";
import { isScheduledDay } from "./schedule";

export interface StreakResult {
  currentStreak: number;
  bestStreak: number;
}

export function calculateStreaks(
  habit: IHabit,
  entries: IEntry[],
  timezone: string
): StreakResult {
  const entryMap = new Map<string, IEntry>();
  for (const entry of entries) {
    entryMap.set(entry.date, entry);
  }

  const now = toZonedTime(new Date(), timezone);
  const todayStr = format(startOfDay(now), "yyyy-MM-dd");

  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;
  let streakBroken = false;

  // Walk backwards from today
  for (let i = 0; i < 1000; i++) {
    const d = subDays(startOfDay(now), i);
    const dateStr = format(d, "yyyy-MM-dd");

    if (!isScheduledDay(habit, dateStr, timezone)) {
      continue; // off days are transparent
    }

    const entry = entryMap.get(dateStr);

    if (
      entry &&
      (entry.status === "completed" || entry.status === "skipped")
    ) {
      tempStreak++;
    } else if (dateStr === todayStr) {
      // Today with no entry — pending, streak still intact
      continue;
    } else {
      // Past day with no entry or explicit miss — streak broken
      if (!streakBroken) {
        currentStreak = tempStreak;
        streakBroken = true;
      }
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 0;
    }
  }

  if (!streakBroken) {
    currentStreak = tempStreak;
  }
  bestStreak = Math.max(bestStreak, tempStreak);

  return { currentStreak, bestStreak };
}
