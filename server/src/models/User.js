import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    goals: {
      dailyWaterMl: { type: Number, default: 2500 },
      maxScreenMinutes: { type: Number, default: 480 },
      postureIntervalMin: { type: Number, default: 30 },
      hydrationIntervalMin: { type: Number, default: 60 },
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);