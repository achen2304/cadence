import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Entry from "@/models/Entry";
import { requireUserId } from "@/lib/get-user";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const dateParamSchema = z.string().regex(dateRegex, "Must be YYYY-MM-DD format");

/**
 * Batch entries endpoint — returns entries for ALL habits in a date range.
 * GET /api/habits/entries?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns: { [habitId]: Entry[] }
 */
export async function GET(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to query params are required" },
      { status: 400 }
    );
  }

  const fromResult = dateParamSchema.safeParse(from);
  const toResult = dateParamSchema.safeParse(to);
  if (!fromResult.success || !toResult.success) {
    return NextResponse.json(
      { error: "Invalid input", details: { fieldErrors: {}, formErrors: ["'from' and 'to' must be YYYY-MM-DD format"] } },
      { status: 400 }
    );
  }

  const entries = await Entry.find({
    userId,
    date: { $gte: from, $lte: to },
  })
    .sort({ date: -1 })
    .lean();

  // Group by habitId
  const grouped: Record<string, typeof entries> = {};
  for (const entry of entries) {
    const hid = entry.habitId.toString();
    if (!grouped[hid]) grouped[hid] = [];
    grouped[hid].push(entry);
  }

  return NextResponse.json(grouped);
}
