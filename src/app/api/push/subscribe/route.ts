import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import PushSubscription from "@/models/PushSubscription";
import { requireUserId } from "@/lib/get-user";

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  userAgent: z.string().max(500).optional(),
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
  const result = subscribeSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid input", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { endpoint, keys, userAgent } = result.data;

  const subscription = await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      userId,
      endpoint,
      keys,
      userAgent: userAgent ?? "",
    },
    { upsert: true, returnDocument: "after" }
  ).lean();

  return NextResponse.json(subscription, { status: 201 });
}
