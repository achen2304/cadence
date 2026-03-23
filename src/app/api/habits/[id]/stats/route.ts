import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Habit from "@/models/Habit";
import { recomputeStats } from "@/lib/recompute-stats";
import { requireUserId } from "@/lib/get-user";

type RouteContext = { params: Promise<{ id: string }> };

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { id } = await params;

  const habit = await Habit.findOne({ _id: id, userId }).lean();
  if (!habit) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  // Check if cachedStats is fresh
  const cached = habit.cachedStats;
  if (cached?.updatedAt) {
    const age = Date.now() - new Date(cached.updatedAt).getTime();
    if (age < CACHE_TTL_MS) {
      return NextResponse.json({
        thisWeek: cached.thisWeek,
        thisMonth: cached.thisMonth,
        thisYear: cached.thisYear,
        currentStreak: cached.currentStreak,
        bestStreak: cached.bestStreak,
        totalCompletions: cached.totalCompletions,
        skipRate: cached.skipRate,
      });
    }
  }

  // Stale or missing — recompute
  const stats = await recomputeStats(id, userId);
  return NextResponse.json(stats);
}
