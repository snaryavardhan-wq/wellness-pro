// Pure functions (no database), so they are easy to unit-test.

// flags: one boolean per day, oldest -> newest, last item = today
export function computeStreaks(flags) {
  let best = 0;
  let run = 0;
  for (const f of flags) {
    run = f ? run + 1 : 0;
    best = Math.max(best, run);
  }
  let i = flags.length - 1;
  if (i >= 0 && !flags[i]) i--; // today is still in progress, so it doesn't break the streak yet
  let current = 0;
  while (i >= 0 && flags[i]) {
    current++;
    i--;
  }
  return { current, best };
}

// 0-100 score. Water 40%, screen time 35%, posture 25%.
// Parts with no data (no screen time, no reminders) are left out and the weights re-balance.
export function dayScore(d, goals) {
  const parts = [{ w: 40, s: Math.min(1, d.waterMl / goals.dailyWaterMl) }];

  if (d.screenMinutes > 0) {
    const over = d.screenMinutes - goals.maxScreenMinutes;
    parts.push({ w: 35, s: over <= 0 ? 1 : Math.max(0, 1 - over / goals.maxScreenMinutes) });
  }

  const p = d.posture;
  const total = p.corrected + p.snoozed + p.dismissed;
  if (total > 0) parts.push({ w: 25, s: p.corrected / total });

  const weight = parts.reduce((a, x) => a + x.w, 0);
  return Math.round((parts.reduce((a, x) => a + x.w * x.s, 0) / weight) * 100);
}