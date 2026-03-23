import { differenceInCalendarDays, getDay, getDate } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { IHabit } from "@/models/Habit";

export function isScheduledDay(
  habit: IHabit,
  dateStr: string,
  timezone: string
): boolean {
  const date = toZonedTime(new Date(dateStr + "T12:00:00Z"), timezone);
  const schedule = habit.schedule;

  switch (schedule.type) {
    case "daily":
      return true;

    case "every_other_day": {
      if (!schedule.anchorDate) return false;
      const anchor = new Date(schedule.anchorDate + "T12:00:00Z");
      const diff = differenceInCalendarDays(date, anchor);
      return diff >= 0 && diff % 2 === 0;
    }

    case "days_of_week": {
      const dayOfWeek = getDay(date);
      return schedule.daysOfWeek?.includes(dayOfWeek) ?? false;
    }

    case "days_of_month": {
      const dayOfMonth = getDate(date);
      return schedule.daysOfMonth?.includes(dayOfMonth) ?? false;
    }

    default:
      return false;
  }
}

export function getScheduleLabel(habit: IHabit): string {
  const schedule = habit.schedule;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  switch (schedule.type) {
    case "daily":
      return "Daily";
    case "every_other_day":
      return "Every other day";
    case "days_of_week":
      return (
        schedule.daysOfWeek?.map((d) => dayNames[d]).join(" · ") ?? "No days"
      );
    case "days_of_month":
      return (
        schedule.daysOfMonth?.map((d) => ordinal(d)).join(", ") ?? "No days"
      );
    default:
      return "";
  }
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
