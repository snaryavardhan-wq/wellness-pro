import { Router } from "express";
import { z } from "zod";
import auth from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import User from "../models/User.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const goalsSchema = z.object({
  dailyWaterMl: z.number().int().min(500).max(10000),
  maxScreenMinutes: z.number().int().min(30).max(1440),
  postureIntervalMin: z.number().int().min(5).max(180),
  hydrationIntervalMin: z.number().int().min(10).max(240),
});

const r = Router();
r.put("/goals", auth, validate(goalsSchema), asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.userId, { goals: req.body }, { returnDocument: "after" });
  res.json({ goals: user.goals });
}));

export default r;