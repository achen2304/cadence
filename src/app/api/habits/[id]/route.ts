import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Habit from "@/models/Habit";
import Entry from "@/models/Entry";
import { requireUserId } from "@/lib/get-user";

const habitUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  color: z.string().min(1).max(50).optional(),
  icon: z.string().max(100).optional(),
  schedule: z.object({
    type: z.enum(["daily", "every_other_day", "days_of_week", "days_of_month"]),
    anchorDate: z.string().optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    daysOfMonth: z.array(z.number().int().min(1).max(31)).optional(),
  }).optional(),
  order: z.number().int().min(0).optional(),
  notification: z.object({
    enabled: z.boolean(),
    time: z.string(),
  }).optional(),
  gridRange: z.number().int().positive().optional(),
  sections: z.array(z.unknown()).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

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

  return NextResponse.json(habit);
}

export async function PATCH(
  request: NextRequest,
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
  const body = await request.json();
  const result = habitUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid input", details: result.error.flatten() }, { status: 400 });
  }
  const validatedData = result.data;

  const habit = await Habit.findOneAndUpdate({ _id: id, userId }, { $set: validatedData }, {
    returnDocument: "after",
    runValidators: true,
  }).lean();

  if (!habit) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  return NextResponse.json(habit);
}

export async function DELETE(
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

  const habit = await Habit.findOneAndDelete({ _id: id, userId });
  if (!habit) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  await Entry.deleteMany({ habitId: id, userId });

  return NextResponse.json({ deleted: true });
}
