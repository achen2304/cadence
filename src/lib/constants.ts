export const HABIT_COLORS = [
  { hex: "#EF4444", name: "Red" },
  { hex: "#F97316", name: "Orange" },
  { hex: "#EAB308", name: "Yellow" },
  { hex: "#22C55E", name: "Green" },
  { hex: "#14B8A6", name: "Teal" },
  { hex: "#3B82F6", name: "Blue" },
  { hex: "#8B5CF6", name: "Purple" },
  { hex: "#EC4899", name: "Pink" },
  { hex: "#6B7280", name: "Gray" },
  { hex: "#F59E0B", name: "Amber" },
] as const;

export const GRID_RANGE_OPTIONS = [30, 90, 180, 365] as const;

export type ScheduleType =
  | "daily"
  | "every_other_day"
  | "days_of_week"
  | "days_of_month";

export type EntryStatus = "completed" | "skipped" | "missed";

export type ThemeMode = "light" | "dark" | "system";
