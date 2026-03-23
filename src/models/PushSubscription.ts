import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPushSubscription extends Document {
  _id: Types.ObjectId;
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string;
  createdAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>({
  userId: { type: String, required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  userAgent: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.PushSubscription ||
  mongoose.model<IPushSubscription>(
    "PushSubscription",
    PushSubscriptionSchema
  );
