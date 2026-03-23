import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Habit, { IHabit } from "@/models/Habit";
import Entry from "@/models/Entry";
import Settings from "@/models/Settings";
import PushSubscription from "@/models/PushSubscription";
import { isScheduledDay } from "@/lib/schedule";
import { format, startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@cadence.app";

export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get("authorization");
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  // Find habits with notifications enabled and not archived (across all users)
  const habits = await Habit.find({
    "notification.enabled": true,
    archivedAt: null,
  }).lean() as IHabit[];

  // Group habits by userId to look up settings per user
  const habitsByUser = new Map<string, IHabit[]>();
  for (const habit of habits) {
    const userHabits = habitsByUser.get(habit.userId) ?? [];
    userHabits.push(habit);
    habitsByUser.set(habit.userId, userHabits);
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  let sentCount = 0;

  for (const [userId, userHabits] of habitsByUser) {
    const settings = await Settings.findOne({ userId }).lean();
    const timezone = settings?.timezone ?? "America/Chicago";

    const now = toZonedTime(new Date(), timezone);
    const todayStr = format(startOfDay(now), "yyyy-MM-dd");
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const subscriptions = await PushSubscription.find({ userId }).lean();
    if (subscriptions.length === 0) continue;

    for (const habit of userHabits) {
      // Check if notification time is within the current 5-minute window
      const [notifHour, notifMinute] = habit.notification.time
        .split(":")
        .map(Number);

      const diffMinutes =
        (currentHour - notifHour) * 60 + (currentMinute - notifMinute);

      // Window: 0 to 4 minutes past the scheduled time
      if (diffMinutes < 0 || diffMinutes >= 5) continue;

      // Check if today is a scheduled day
      if (!isScheduledDay(habit, todayStr, timezone)) continue;

      // Check if there's already an entry for today
      const existingEntry = await Entry.findOne({
        habitId: habit._id,
        userId,
        date: todayStr,
      }).lean();

      if (existingEntry) continue;

      // Send push notification
      const payload = JSON.stringify({
        title: "Cadence Reminder",
        body: `Don't forget: ${habit.name}`,
        data: { habitId: habit._id.toString() },
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

      // Clean up expired subscriptions
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

      sentCount += results.filter((r) => r.status === "fulfilled").length;
    }
  }

  // Calculate badge count per user: habits scheduled today with no entry
  const allActiveHabits = await Habit.find({ archivedAt: null }).lean() as IHabit[];
  const allHabitsByUser = new Map<string, IHabit[]>();
  for (const habit of allActiveHabits) {
    const userHabits = allHabitsByUser.get(habit.userId) ?? [];
    userHabits.push(habit);
    allHabitsByUser.set(habit.userId, userHabits);
  }

  let badgeCount = 0;
  for (const [userId, userHabits] of allHabitsByUser) {
    const settings = await Settings.findOne({ userId }).lean();
    const timezone = settings?.timezone ?? "America/Chicago";
    const now = toZonedTime(new Date(), timezone);
    const todayStr = format(startOfDay(now), "yyyy-MM-dd");

    for (const habit of userHabits) {
      if (!isScheduledDay(habit, todayStr, timezone)) continue;
      const entry = await Entry.findOne({
        habitId: habit._id,
        userId,
        date: todayStr,
      }).lean();
      if (!entry) badgeCount++;
    }
  }

  return NextResponse.json({ sent: sentCount, badgeCount });
}
