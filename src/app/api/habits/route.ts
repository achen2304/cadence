import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Habit from "@/models/Habit";
import { requireUserId } from "@/lib/get-user";

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const habits = await Habit.find({ userId, archivedAt: null })
    .sort({ order: 1 })
    .lean();

  return NextResponse.json(habits);
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const body = await request.json();

  // Set order to be after the last habit
  const lastHabit = await Habit.findOne({ userId, archivedAt: null })
    .sort({ order: -1 })
    .lean();
  const nextOrder = lastHabit ? (lastHabit as { order: number }).order + 1 : 0;

  const habit = await Habit.create({
    ...body,
    userId,
    order: body.order ?? nextOrder,
  });

  return NextResponse.json(habit, { status: 201 });
}
