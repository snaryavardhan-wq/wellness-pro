import { Router } from "express";
import mongoose from "mongoose";
import auth from "../middleware/auth.js";
import Hydration from "../models/Hydration.js";
import ScreenTime, { effectiveMinutes } from "../models/ScreenTime.js";
import PostureLog from "../models/PostureLog.js";
import User from "../models/User.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { computeStreaks, dayScore } from "../utils/insights.js";

const r = Router();
r.use(auth);

const validTz = (tz) => {
  try { new Intl.DateTimeFormat("en-CA", { timeZone: tz }); return true; } catch { return false; }
};

// last n local dates, e.g. ["2026-09-27", ..., "2026-10-03"]
const lastDays = (tz, n = 7) =>
  Array.from({ length: n }, (_, i) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(Date.now() - (n - 1 - i) * 864e5))
  );

r.get("/weekly", asyncHandler(async (req, res) => {
  const tz = validTz(req.query.tz) ? req.query.tz : "UTC";
  const userId = new mongoose.Types.ObjectId(req.userId);
  const days = lastDays(tz);
  const since = new Date(Date.now() - 8 * 864e5);

  const [water, screen, posture, user] = await Promise.all([
    Hydration.aggregate([
      { $match: { user: userId, loggedAt: { $gte: since } } },
      { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$loggedAt", timezone: tz } },
          totalMl: { $sum: "$amountMl" },
          drinks: { $sum: 1 } } },
    ]),
    ScreenTime.find({ user: userId, date: { $in: days } }),
    PostureLog.aggregate([
      { $match: { user: userId, remindedAt: { $gte: since } } },
      { $group: { _id: "$response", count: { $sum: 1 } } },
    ]),
    User.findById(userId),
  ]);

const waterMap = Object.fromEntries(water.map((d) => [d._id, d]));
const screenMap = Object.fromEntries(screen.map((d) => [d.date, d]));
const daily = days.map((date) => {
  const s = screenMap[date];
  return {
    date,
    waterMl: waterMap[date]?.totalMl || 0,
    drinks: waterMap[date]?.drinks || 0,
    screenMinutes: s ? effectiveMinutes(s) : 0, // best estimate, used by the chart
    appMinutes: s?.totalMinutes || 0,           // Wellness tab
    browserMinutes: s?.browserMinutes || 0,     // Chrome extension
    manualMinutes: s?.manualMinutes || 0,       // typed in by the user
  };
});

  const goals = user.goals;
  const postureCounts = { corrected: 0, snoozed: 0, dismissed: 0 };
  posture.forEach((p) => (postureCounts[p._id] = p.count));
  const totalReminders = Object.values(postureCounts).reduce((a, b) => a + b, 0);

  res.json({
    daily,
    goals,
    summary: {
      avgWaterMl: Math.round(daily.reduce((s, d) => s + d.waterMl, 0) / 7),
      avgScreenMinutes: Math.round(daily.reduce((s, d) => s + d.screenMinutes, 0) / 7),
      daysWaterGoalMet: daily.filter((d) => d.waterMl >= goals.dailyWaterMl).length,
      daysUnderScreenLimit: daily.filter((d) => d.screenMinutes > 0 && d.screenMinutes <= goals.maxScreenMinutes).length,
      postureCorrectedPct: totalReminders ? Math.round((postureCounts.corrected / totalReminders) * 100) : 0,
    },
    posture: postureCounts,
  });
}));


// GET /api/analytics/insights?tz=Asia/Kolkata  -> today's score, 7-day trend, streaks
r.get("/insights", asyncHandler(async (req, res) => {
  const tz = validTz(req.query.tz) ? req.query.tz : "UTC";
  const userId = new mongoose.Types.ObjectId(req.userId);
  const days = lastDays(tz, 60);
  const since = new Date(Date.now() - 61 * 864e5);
  const dayOf = (field) => ({ $dateToString: { format: "%Y-%m-%d", date: field, timezone: tz } });

  const [water, screen, posture, user] = await Promise.all([
    Hydration.aggregate([
      { $match: { user: userId, loggedAt: { $gte: since } } },
      { $group: { _id: dayOf("$loggedAt"), totalMl: { $sum: "$amountMl" } } },
    ]),
    ScreenTime.find({ user: userId, date: { $in: days } }),
    PostureLog.aggregate([
      { $match: { user: userId, remindedAt: { $gte: since } } },
      { $group: { _id: { day: dayOf("$remindedAt"), response: "$response" }, count: { $sum: 1 } } },
    ]),
    User.findById(userId),
  ]);

  const waterMap = Object.fromEntries(water.map((d) => [d._id, d.totalMl]));
  const screenMap = Object.fromEntries(screen.map((d) => [d.date, effectiveMinutes(d)]));
  const postureMap = {};
  for (const p of posture) {
    postureMap[p._id.day] ??= { corrected: 0, snoozed: 0, dismissed: 0 };
    postureMap[p._id.day][p._id.response] = p.count;
  }

  const goals = user.goals;
  const daily = days.map((date) => ({
    date,
    waterMl: waterMap[date] || 0,
    screenMinutes: screenMap[date] || 0,
    posture: postureMap[date] || { corrected: 0, snoozed: 0, dismissed: 0 },
  }));
  const scores = daily.map((d) => ({ date: d.date, score: dayScore(d, goals) }));

  res.json({
    score: scores[scores.length - 1].score,
    trend: scores.slice(-7),
    streaks: {
      water: computeStreaks(daily.map((d) => d.waterMl >= goals.dailyWaterMl)),
      screen: computeStreaks(daily.map((d) => d.screenMinutes > 0 && d.screenMinutes <= goals.maxScreenMinutes)),
    },
  });
}));
export default r;