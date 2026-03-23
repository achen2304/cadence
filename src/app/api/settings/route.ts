import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Settings from "@/models/Settings";
import { requireUserId } from "@/lib/get-user";

const settingsPatchSchema = z.object({
  timezone: z.string().min(1).max(100).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  endOfDayReminder: z
    .object({
      enabled: z.boolean(),
      time: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .optional(),
});

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  let settings = await Settings.findOne({ userId }).lean();
  if (!settings) {
    settings = await Settings.create({ userId });
    settings = settings.toObject();
  }

  return NextResponse.json(settings);
}

export async function PATCH(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const body = await request.json();
  const result = settingsPatchSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid input", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const settings = await Settings.findOneAndUpdate(
    { userId },
    { $set: result.data },
    { upsert: true, returnDocument: "after", runValidators: true }
  ).lean();

  return NextResponse.json(settings);
}
