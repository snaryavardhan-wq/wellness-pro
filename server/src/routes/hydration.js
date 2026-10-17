import { Router } from "express";
import { z } from "zod";
import auth from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import Hydration from "../models/Hydration.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const logSchema = z.object({ amountMl: z.number().int().min(1).max(5000) });

const r = Router();
r.use(auth); // every route below requires a valid JWT

r.post("/", validate(logSchema), asyncHandler(async (req, res) => {
  const entry = await Hydration.create({ user: req.userId, amountMl: req.body.amountMl });
  res.status(201).json(entry);
}));

r.get("/", asyncHandler(async (req, res) => {
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 864e5);
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const filter = { user: req.userId, loggedAt: { $gte: from, $lte: to } };
  const [items, total] = await Promise.all([
    Hydration.find(filter).sort({ loggedAt: -1 }).skip((page - 1) * limit).limit(limit),
    Hydration.countDocuments(filter),
  ]);
  const totalMl = items.reduce((s, i) => s + i.amountMl, 0);
  res.json({ items, total, page, limit, totalMl });
}));

r.delete("/:id", asyncHandler(async (req, res) => {
  const deleted = await Hydration.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!deleted) return res.status(404).json({ message: "Entry not found" });
  res.json({ message: "Deleted" });
}));

export default r;