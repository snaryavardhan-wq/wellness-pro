import mongoose from "mongoose";

const screenTimeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true },
  totalMinutes: { type: Number, default: 0, min: 0, max: 1440 },   // web app (existing)
  browserMinutes: { type: Number, default: 0, min: 0, max: 1440 }, // Chrome extension
  manualMinutes: { type: Number, default: 0, min: 0, max: 1440 },  // typed in by the user
});

screenTimeSchema.index({ user: 1, date: -1 }, { unique: true });

// Sources overlap, so we take the best estimate instead of adding them up
export const effectiveMinutes = (d) =>
  Math.min(1440, Math.max(d.totalMinutes || 0, d.browserMinutes || 0) + (d.manualMinutes || 0));

export default mongoose.model("ScreenTime", screenTimeSchema);