import { Router } from "express";
import { z } from "zod";
import auth from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import PostureLog from "../models/PostureLog.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const schema = z.object({ response: z.enum(["corrected", "snoozed", "dismissed"]) });

const r = Router();
r.use(auth);

r.post("/", validate(schema), asyncHandler(async (req, res) => {
  const log = await PostureLog.create({ user: req.userId, response: req.body.response });
  res.status(201).json(log);
}));

r.get("/", asyncHandler(async (req, res) => {
  const logs = await PostureLog.find({ user: req.userId }).sort({ remindedAt: -1 }).limit(50);
  res.json(logs);
}));

export default r;