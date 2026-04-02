import mongoose, { Schema, Document, Types } from "mongoose";

export interface ISection {
  id: string;
  name: string;
  order: number;
}

export interface ISettings extends Document {
  _id: Types.ObjectId;
  userId: string;
  timezone: string;
  theme: "light" | "dark" | "system";
  sections: ISection[];
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
    sections: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, required: true },
          order: { type: Number, required: true },
        },
      ],
      default: [],
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
