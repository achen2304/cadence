import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Settings from "@/models/Settings";
import { requireUserId } from "@/lib/get-user";

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

  const settings = await Settings.findOneAndUpdate(
    { userId },
    { $set: body },
    { upsert: true, returnDocument: "after", runValidators: true }
  ).lean();

  return NextResponse.json(settings);
}
