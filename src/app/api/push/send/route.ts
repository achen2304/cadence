import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import PushSubscription from "@/models/PushSubscription";
import webpush from "web-push";
import { requireUserId } from "@/lib/get-user";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@cadence.app";

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const { title, body, habitId } = await request.json() as {
    title: string;
    body: string;
    habitId?: string;
  };

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const subscriptions = await PushSubscription.find({ userId }).lean();

  const payload = JSON.stringify({
    title,
    body,
    data: { habitId: habitId ?? null },
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        payload
      )
    )
  );

  // Clean up expired subscriptions (410 Gone)
  const expiredEndpoints: string[] = [];
  results.forEach((result, i) => {
    if (
      result.status === "rejected" &&
      (result.reason as { statusCode?: number })?.statusCode === 410
    ) {
      expiredEndpoints.push(subscriptions[i].endpoint);
    }
  });

  if (expiredEndpoints.length > 0) {
    await PushSubscription.deleteMany({
      endpoint: { $in: expiredEndpoints },
    });
  }

  const sent = results.filter((r) => r.status === "fulfilled").length;

  return NextResponse.json({ sent, failed: results.length - sent });
}
