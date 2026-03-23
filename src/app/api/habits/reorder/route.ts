import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Habit from "@/models/Habit";
import { requireUserId } from "@/lib/get-user";

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const body: { id: string; order: number }[] = await request.json();

  const ops = body.map(({ id, order }) => ({
    updateOne: {
      filter: { _id: id, userId },
      update: { $set: { order } },
    },
  }));

  await Habit.bulkWrite(ops);

  return NextResponse.json({ success: true });
}
