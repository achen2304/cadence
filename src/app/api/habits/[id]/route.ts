import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Habit from "@/models/Habit";
import Entry from "@/models/Entry";
import { requireUserId } from "@/lib/get-user";

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

  const habit = await Habit.findOneAndUpdate({ _id: id, userId }, body, {
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
