import mongoose, { Schema, Document, Types } from "mongoose";

export interface IEntry extends Document {
  _id: Types.ObjectId;
  userId: string;
  habitId: Types.ObjectId;
  date: string;
  status: "completed" | "skipped" | "missed";
  isOverride: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EntrySchema = new Schema<IEntry>(
  {
    userId: { type: String, required: true, index: true },
    habitId: { type: Schema.Types.ObjectId, ref: "Habit", required: true },
    date: { type: String, required: true },
    status: {
      type: String,
      enum: ["completed", "skipped", "missed"],
      required: true,
    },
    isOverride: { type: Boolean, default: false },
  },
  { timestamps: true }
);

EntrySchema.index({ userId: 1, habitId: 1, date: 1 }, { unique: true });

export default mongoose.models.Entry ||
  mongoose.model<IEntry>("Entry", EntrySchema);
