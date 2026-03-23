import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Entry from "@/models/Entry";
import Habit from "@/models/Habit";
import { requireUserId } from "@/lib/get-user";
import { recomputeStats } from "@/lib/recompute-stats";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const dateStringSchema = z.string().regex(dateRegex, "Must be YYYY-MM-DD format");

const entryCreateSchema = z.object({
  date: dateStringSchema,
  status: z.enum(["completed", "skipped", "missed"]),
  isOverride: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
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

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (from && !dateRegex.test(from)) {
    return NextResponse.json({ error: "Invalid input", details: { fieldErrors: {}, formErrors: ["'from' must be YYYY-MM-DD format"] } }, { status: 400 });
  }
  if (to && !dateRegex.test(to)) {
    return NextResponse.json({ error: "Invalid input", details: { fieldErrors: {}, formErrors: ["'to' must be YYYY-MM-DD format"] } }, { status: 400 });
  }

  const filter: Record<string, unknown> = { habitId: id, userId };

  if (from || to) {
    const dateFilter: Record<string, string> = {};
    if (from) dateFilter.$gte = from;
    if (to) dateFilter.$lte = to;
    filter.date = dateFilter;
  }

  const entries = await Entry.find(filter).sort({ date: -1 }).lean();

  return NextResponse.json(entries);
}

export async function POST(
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
  const result = entryCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid input", details: result.error.flatten() }, { status: 400 });
  }
  const validatedData = result.data;

  // Verify the habit belongs to the user
  const habit = await Habit.findOne({ _id: id, userId }).lean();
  if (!habit) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  const entry = await Entry.findOneAndUpdate(
    { habitId: id, date: validatedData.date, userId },
    {
      userId,
      habitId: id,
      date: validatedData.date,
      status: validatedData.status,
      isOverride: validatedData.isOverride ?? false,
    },
    { upsert: true, returnDocument: "after", runValidators: true }
  ).lean();

  // Fire-and-forget stats recomputation
  recomputeStats(id, userId).catch(() => {});

  return NextResponse.json(entry);
}

export async function DELETE(
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
  const { searchParams } = request.nextUrl;
  const date = searchParams.get("date");

  if (!date || !dateRegex.test(date)) {
    return NextResponse.json({ error: "Invalid input", details: { fieldErrors: {}, formErrors: ["'date' query param must be YYYY-MM-DD format"] } }, { status: 400 });
  }

  await Entry.deleteOne({ habitId: id, date, userId });

  // Fire-and-forget stats recomputation
  recomputeStats(id, userId).catch(() => {});

  return NextResponse.json({ deleted: true });
}
