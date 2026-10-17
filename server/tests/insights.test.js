import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreaks, dayScore } from "../src/utils/insights.js";

const goals = { dailyWaterMl: 2000, maxScreenMinutes: 480 };
const noPosture = { corrected: 0, snoozed: 0, dismissed: 0 };

test("streak counts back from today", () => {
  assert.deepEqual(computeStreaks([false, true, true, true]), { current: 3, best: 3 });
});

test("unfinished today does not break the streak", () => {
  assert.deepEqual(computeStreaks([true, true, true, false]), { current: 3, best: 3 });
});

test("a missed day before today resets the streak, best is remembered", () => {
  assert.deepEqual(computeStreaks([true, true, true, true, false, true]), { current: 1, best: 4 });
});

test("empty and all-false input", () => {
  assert.deepEqual(computeStreaks([]), { current: 0, best: 0 });
  assert.deepEqual(computeStreaks([false, false]), { current: 0, best: 0 });
});

test("perfect day scores 100", () => {
  const d = { waterMl: 2500, screenMinutes: 300, posture: { corrected: 4, snoozed: 0, dismissed: 0 } };
  assert.equal(dayScore(d, goals), 100);
});

test("only water is scored when there is no other data", () => {
  assert.equal(dayScore({ waterMl: 1000, screenMinutes: 0, posture: noPosture }, goals), 50);
});

test("going over the screen limit lowers the score", () => {
  const ok = dayScore({ waterMl: 2000, screenMinutes: 480, posture: noPosture }, goals);
  const over = dayScore({ waterMl: 2000, screenMinutes: 720, posture: noPosture }, goals);
  assert.equal(ok, 100);
  assert.ok(over < ok);
});

test("snoozed and dismissed reminders count against posture", () => {
  const d = { waterMl: 2000, screenMinutes: 0, posture: { corrected: 1, snoozed: 1, dismissed: 2 } };
  assert.equal(dayScore(d, goals), Math.round(((40 * 1 + 25 * 0.25) / 65) * 100));
});