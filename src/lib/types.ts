import type { ScheduleType, EntryStatus } from "./constants";

export interface Habit {
  _id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  order: number;
  schedule: {
    type: ScheduleType;
    anchorDate?: string;
    daysOfWeek?: number[];
    daysOfMonth?: number[];
  };
  gridRange: number;
  notification: {
    enabled: boolean;
    time: string;
  };
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Entry {
  _id: string;
  habitId: string;
  date: string;
  status: EntryStatus;
  isOverride: boolean;
}

export interface Settings {
  _id?: string;
  timezone: string;
  theme: "light" | "dark" | "system";
  endOfDayReminder: {
    enabled: boolean;
    time: string;
  };
}

export interface HabitStats {
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
  currentStreak: number;
  bestStreak: number;
  totalCompletions: number;
  skipRate: number;
}
