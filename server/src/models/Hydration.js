import mongoose from "mongoose";

const hydrationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amountMl: { type: Number, required: true, min: 1, max: 5000 },
  loggedAt: { type: Date, default: Date.now },
});

hydrationSchema.index({ user: 1, loggedAt: -1 });

export default mongoose.model("Hydration", hydrationSchema);