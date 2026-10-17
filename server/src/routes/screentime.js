import { Router } from "express";
import { z } from "zod";
import auth from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import ScreenTime, { effectiveMinutes } from "../models/ScreenTime.js";
import { asyncHandler } from "../middleware/errorHandler.js";


const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const bodySchema = z.object({ totalMinutes: z.number().int().min(0).max(1440) });

const r = Router();
r.use(auth);

const checkDate = (req, res, next) =>
  dateRe.test(req.params.date) ? next() : res.status(400).json({ message: "Date must be YYYY-MM-DD" });

r.get("/:date", checkDate, asyncHandler(async (req, res) => {
  const doc = await ScreenTime.findOne({ user: req.userId, date: req.params.date });
  res.json({ date: req.params.date, totalMinutes: doc ? doc.totalMinutes : 0 });
}));

// Upsert with $max: the stored value can only go up
r.put("/:date", checkDate, validate(bodySchema), asyncHandler(async (req, res) => {
  const doc = await ScreenTime.findOneAndUpdate(
    { user: req.userId, date: req.params.date },
    { $max: { totalMinutes: req.body.totalMinutes } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  res.json({ date: doc.date, totalMinutes: doc.totalMinutes });
}));


const sourceSchema = z.object({
  source: z.enum(["browser", "manual"]),
  minutes: z.number().int().min(0).max(1440),
});

// Browser extension: monotonic ($max). Manual entry: the user may correct it ($set).
r.put("/:date/source", checkDate, validate(sourceSchema), asyncHandler(async (req, res) => {
  const { source, minutes } = req.body;
  const field = source === "browser" ? "browserMinutes" : "manualMinutes";
  const update = source === "browser" ? { $max: { [field]: minutes } } : { $set: { [field]: minutes } };
  const doc = await ScreenTime.findOneAndUpdate(
    { user: req.userId, date: req.params.date },
    update,
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  res.json({ date: doc.date, effectiveMinutes: effectiveMinutes(doc) });
}));
export default r;