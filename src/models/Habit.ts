import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICachedStats {
  currentStreak: number;
  bestStreak: number;
  totalCompletions: number;
  skipRate: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
  updatedAt: Date;
}

export interface IHabit extends Document {
  _id: Types.ObjectId;
  userId: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  order: number;
  sectionId: string | null;
  schedule: {
    type: "daily" | "every_n_days" | "every_other_day" | "days_of_week" | "days_of_month";
    anchorDate?: string;
    interval?: number;
    daysOfWeek?: number[];
    daysOfMonth?: number[];
  };
  gridRange: number;
  notification: {
    enabled: boolean;
    time: string;
  };
  cachedStats?: ICachedStats;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const HabitSchema = new Schema<IHabit>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    color: { type: String, required: true },
    icon: { type: String, default: "" },
    order: { type: Number, default: 0 },
    sectionId: { type: String, default: null },
    schedule: {
      type: {
        type: String,
        enum: ["daily", "every_n_days", "every_other_day", "days_of_week", "days_of_month"],
        required: true,
      },
      anchorDate: { type: String },
      interval: { type: Number },
      daysOfWeek: [{ type: Number }],
      daysOfMonth: [{ type: Number }],
    },
    gridRange: { type: Number, default: 90 },
    notification: {
      enabled: { type: Boolean, default: false },
      time: { type: String, default: "09:00" },
    },
    archivedAt: { type: Date, default: null },
    cachedStats: {
      currentStreak: { type: Number, default: 0 },
      bestStreak: { type: Number, default: 0 },
      totalCompletions: { type: Number, default: 0 },
      skipRate: { type: Number, default: 0 },
      thisWeek: { type: Number, default: 0 },
      thisMonth: { type: Number, default: 0 },
      thisYear: { type: Number, default: 0 },
      updatedAt: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

export default mongoose.models.Habit ||
  mongoose.model<IHabit>("Habit", HabitSchema);
