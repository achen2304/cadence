import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Habit from "@/models/Habit";
import { requireUserId } from "@/lib/get-user";

const habitCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  color: z.string().min(1).max(50),
  icon: z.string().max(100).optional(),
  schedule: z.object({
    type: z.enum(["daily", "every_n_days", "every_other_day", "days_of_week", "days_of_month"]),
    anchorDate: z.string().optional(),
    interval: z.number().int().min(2).max(365).optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    daysOfMonth: z.array(z.number().int().min(1).max(31)).optional(),
  }),
  order: z.number().int().min(0).optional(),
  sectionId: z.string().nullable().optional(),
  notification: z.object({
    enabled: z.boolean(),
    time: z.string(),
  }).optional(),
  gridRange: z.number().int().positive().optional(),
});

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
  const result = habitCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid input", details: result.error.flatten() }, { status: 400 });
  }
  const validatedData = result.data;

  // Set order to be after the last habit
  const lastHabit = await Habit.findOne({ userId, archivedAt: null })
    .sort({ order: -1 })
    .lean();
  const nextOrder = lastHabit ? (lastHabit as { order: number }).order + 1 : 0;

  const habit = await Habit.create({
    ...validatedData,
    userId,
    order: validatedData.order ?? nextOrder,
  });

  return NextResponse.json(habit, { status: 201 });
}
