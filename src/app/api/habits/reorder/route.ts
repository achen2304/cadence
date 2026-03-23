import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Habit from "@/models/Habit";
import { requireUserId } from "@/lib/get-user";

const reorderItemSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
});

const reorderSchema = z.object({
  items: z.array(reorderItemSchema).max(500),
});

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const body = await request.json();
  const result = reorderSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid input", details: result.error.flatten() }, { status: 400 });
  }
  const validatedData = result.data.items;

  const ops = validatedData.map(({ id, order }) => ({
    updateOne: {
      filter: { _id: id, userId },
      update: { $set: { order } },
    },
  }));

  await Habit.bulkWrite(ops);

  return NextResponse.json({ success: true });
}
