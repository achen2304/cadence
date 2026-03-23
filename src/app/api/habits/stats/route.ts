import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Habit from "@/models/Habit";
import { recomputeStats, type ComputedStats } from "@/lib/recompute-stats";
import { requireUserId } from "@/lib/get-user";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  // Fetch all active (non-archived) habits for this user
  const habits = await Habit.find({
    userId,
    archivedAt: null,
  }).lean();

  const result: Record<string, ComputedStats> = {};

  await Promise.all(
    habits.map(async (habit) => {
      const id = habit._id.toString();

      // Check if cachedStats is fresh
      const cached = habit.cachedStats;
      if (cached?.updatedAt) {
        const age = Date.now() - new Date(cached.updatedAt).getTime();
        if (age < CACHE_TTL_MS) {
          result[id] = {
            thisWeek: cached.thisWeek,
            thisMonth: cached.thisMonth,
            thisYear: cached.thisYear,
            currentStreak: cached.currentStreak,
            bestStreak: cached.bestStreak,
            totalCompletions: cached.totalCompletions,
            skipRate: cached.skipRate,
          };
          return;
        }
      }

      // Stale or missing — recompute
      try {
        result[id] = await recomputeStats(id, userId);
      } catch {
        // skip habits that fail to compute
      }
    })
  );

  return NextResponse.json(result);
}
