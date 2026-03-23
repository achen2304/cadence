import mongoose, { Schema, Document, Types } from "mongoose";

export interface ISettings extends Document {
  _id: Types.ObjectId;
  userId: string;
  timezone: string;
  theme: "light" | "dark" | "system";
  endOfDayReminder: {
    enabled: boolean;
    time: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    userId: { type: String, required: true, unique: true },
    timezone: { type: String, default: "America/Chicago" },
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "system",
    },
    endOfDayReminder: {
      enabled: { type: Boolean, default: false },
      time: { type: String, default: "21:00" },
    },
  },
  { timestamps: true }
);

export default mongoose.models.Settings ||
  mongoose.model<ISettings>("Settings", SettingsSchema);
