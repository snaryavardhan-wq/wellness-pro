import mongoose from "mongoose";

const postureSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  remindedAt: { type: Date, default: Date.now },
  response: { type: String, enum: ["corrected", "snoozed", "dismissed"], required: true },
});

postureSchema.index({ user: 1, remindedAt: -1 });

export default mongoose.model("PostureLog", postureSchema);