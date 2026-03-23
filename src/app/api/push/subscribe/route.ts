import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import PushSubscription from "@/models/PushSubscription";
import { requireUserId } from "@/lib/get-user";

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const body = await request.json();

  const subscription = await PushSubscription.findOneAndUpdate(
    { endpoint: body.endpoint },
    {
      userId,
      endpoint: body.endpoint,
      keys: body.keys,
      userAgent: body.userAgent ?? "",
    },
    { upsert: true, returnDocument: "after" }
  ).lean();

  return NextResponse.json(subscription, { status: 201 });
}
