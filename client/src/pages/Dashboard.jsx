import { useCallback, useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import api, { errMsg, tz, todayStr } from "../api/client";
import { useAuth } from "../context/AuthContext";
import useScreenTime from "../hooks/useScreenTime";
import useReminders from "../hooks/useReminders";

const fmtTime = (s) => `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
const shortDay = (d) => new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" });

export default function Dashboard() {
  const { user, setUser, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState("");

  // Re-fetch the weekly analytics; called after any change
const loadStats = useCallback(
  () => Promise.all([
    api.get("/analytics/weekly", { params: { tz } }),
    api.get("/analytics/insights", { params: { tz } }),
  ])
    .then(([w, i]) => { setStats(w.data); setInsights(i.data); })
    .catch((e) => setError(errMsg(e))),
  []
);
  useEffect(() => { loadStats(); }, [loadStats]);

  const seconds = useScreenTime(loadStats);
  const { reminder, clearReminder } = useReminders(user.goals);

  const goals = user.goals;
  const today = stats?.daily[stats.daily.length - 1];
  const waterToday = today?.waterMl || 0;
  const waterPct = Math.min(100, Math.round((waterToday / goals.dailyWaterMl) * 100));
const computerSeconds = Math.max(seconds, (today?.browserMinutes || 0) * 60);
const totalSeconds = computerSeconds + (today?.manualMinutes || 0) * 60;
const overLimit = Math.floor(totalSeconds / 60) > goals.maxScreenMinutes;

  const addWater = async (amountMl) => {
    try {
      await api.post("/hydration", { amountMl });
      clearReminder();
      loadStats();
    } catch (e) { setError(errMsg(e)); }
  };

  const logPosture = async (response) => {
    try {
      await api.post("/posture", { response });
      clearReminder();
      loadStats();
    } catch (e) { setError(errMsg(e)); }
  };

  return (
    <div className="shell">
      <header className="top">
        <h1>Hi, {user.name.split(" ")[0]}</h1>
        <button className="ghost" onClick={logout}>Sign out</button>
      </header>

      {error && <p className="error">{error}</p>}

      {reminder === "posture" && (
        <div className="banner">
          <strong>Posture check.</strong> Shoulders back, screen at eye level.
          <span className="actions">
            <button onClick={() => logPosture("corrected")}>Fixed it</button>
            <button className="ghost" onClick={() => logPosture("snoozed")}>Snooze</button>
            <button className="ghost" onClick={() => logPosture("dismissed")}>Dismiss</button>
          </span>
        </div>
      )}
      {reminder === "water" && (
        <div className="banner">
          <strong>Time to drink.</strong>
          <span className="actions">
            <button onClick={() => addWater(250)}>Log 250 ml</button>
            <button className="ghost" onClick={clearReminder}>Later</button>
          </span>
        </div>
      )}
{insights && <InsightsRow insights={insights} />}
      <section className="grid">
        <article className="card">
          <h2>Water today</h2>
          <p className="big">{waterToday} <span>/ {goals.dailyWaterMl} ml</span></p>
          <div className="bar"><div style={{ width: `${waterPct}%` }} /></div>
          <div className="row">
            {[150, 250, 500].map((ml) => (
              <button key={ml} onClick={() => addWater(ml)}>+{ml} ml</button>
            ))}
          </div>
        </article>

<article className="card">
  <h2>Screen time today</h2>
  <p className={`big ${overLimit ? "warn" : ""}`}>
    {fmtTime(totalSeconds)} <span>/ {fmtTime(goals.maxScreenMinutes * 60)}</span>
  </p>

  <ul className="sources">
    <li><span>Computer (Chrome or this app)</span><strong>{fmtTime(computerSeconds)}</strong></li>
    <li><span>Phone / other devices (manual)</span><strong>{fmtTime((today?.manualMinutes || 0) * 60)}</strong></li>
  </ul>

  {today && today.browserMinutes === 0 && (
    <p className="muted">No Chrome time yet. Make sure the extension is connected (open the W icon).</p>
  )}
  <p className="muted">Total = computer time + the time you enter for other devices.</p>

  <ManualScreenTime onSaved={loadStats} />
</article>

        <article className="card">
          <h2>Posture, last 7 days</h2>
          <p className="big">{stats?.summary.postureCorrectedPct ?? 0}% <span>corrected</span></p>
          <p className="muted">
            {stats
              ? `${stats.posture.corrected} fixed · ${stats.posture.snoozed} snoozed · ${stats.posture.dismissed} dismissed`
              : ""}
          </p>
        </article>
      </section>

      {stats && (
        <section className="grid two">
          <article className="card">
            <h2>Water per day (ml)</h2>
            <p className="muted">
              Goal met on {stats.summary.daysWaterGoalMet} of 7 days. Average {stats.summary.avgWaterMl} ml.
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.daily.map((d) => ({ ...d, day: shortDay(d.date) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" />
                <YAxis width={45} />
                <Tooltip />
                <ReferenceLine y={goals.dailyWaterMl} stroke="#c2410c" strokeDasharray="4 4" />
                <Bar dataKey="waterMl" fill="#0e7490" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </article>

          <article className="card">
            <h2>Screen minutes per day</h2>
            <p className="muted">
              Average {Math.round((stats.summary.avgScreenMinutes / 60) * 10) / 10} h per day.
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.daily.map((d) => ({ ...d, day: shortDay(d.date) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" />
                <YAxis width={45} />
                <Tooltip />
                <ReferenceLine y={goals.maxScreenMinutes} stroke="#c2410c" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="screenMinutes" stroke="#4d7c0f" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </article>
        </section>
      )}

      <GoalsForm
        goals={goals}
        onSaved={(g) => setUser({ ...user, goals: g })}
        reload={loadStats}
      />
    </div>
  );
}

function GoalsForm({ goals, onSaved, reload }) {
  const [g, setG] = useState(goals);
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => setG({ ...g, [k]: Number(e.target.value) });

  const save = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.put("/users/goals", g);
      onSaved(data.goals);
      reload();
      setMsg("Goals saved");
    } catch (err) { setMsg(errMsg(err)); }
  };

  return (
    <form className="card goals" onSubmit={save}>
      <h2>Your goals</h2>
      <div className="grid four">
        <label>Water (ml/day)<input type="number" value={g.dailyWaterMl} onChange={set("dailyWaterMl")} /></label>
        <label>Max screen (min/day)<input type="number" value={g.maxScreenMinutes} onChange={set("maxScreenMinutes")} /></label>
        <label>Posture reminder (min)<input type="number" value={g.postureIntervalMin} onChange={set("postureIntervalMin")} /></label>
        <label>Water reminder (min)<input type="number" value={g.hydrationIntervalMin} onChange={set("hydrationIntervalMin")} /></label>
      </div>
      <button>Save goals</button> <span className="muted">{msg}</span>
    </form>
  );
}

function ManualScreenTime({ onSaved }) {
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [msg, setMsg] = useState("");

  const save = async (e) => {
    e.preventDefault();
    const minutes = (Number(h) || 0) * 60 + (Number(m) || 0);
    try {
      await api.put(`/screentime/${todayStr()}/source`, { source: "manual", minutes });
      setMsg("Saved");
      onSaved();
    } catch (err) {
      setMsg(errMsg(err));
    }
  };

  return (
    <form onSubmit={save} className="row manual">
      <input type="number" min="0" max="24" placeholder="hours" value={h} onChange={(e) => setH(e.target.value)} />
      <input type="number" min="0" max="59" placeholder="min" value={m} onChange={(e) => setM(e.target.value)} />
      <button className="ghost">Set today's total</button>
      <span className="muted">{msg}</span>
    </form>
  );
}

function InsightsRow({ insights }) {
  const { score, trend, streaks } = insights;
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Getting there" : "Needs attention";
  return (
    <section className="grid two">
      <article className="card">
        <h2>Wellness score today</h2>
        <p className="big">{score} <span>/ 100 · {label}</span></p>
        <ResponsiveContainer width="100%" height={90}>
          <BarChart data={trend.map((t) => ({ ...t, day: shortDay(t.date) }))}>
            <XAxis dataKey="day" />
            <YAxis hide domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="score" fill="#0e7490" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="muted">Water 40% · Screen time 35% · Posture 25%. Parts with no data are left out.</p>
      </article>

      <article className="card">
        <h2>Streaks</h2>
        <ul className="sources">
          <li><span>Water goal streak</span><strong>{streaks.water.current} days</strong></li>
          <li><span>Best water streak</span><strong>{streaks.water.best} days</strong></li>
          <li><span>Under screen limit</span><strong>{streaks.screen.current} days</strong></li>
          <li><span>Best screen streak</span><strong>{streaks.screen.best} days</strong></li>
        </ul>
        <p className="muted">Today doesn't break a streak until the day ends.</p>
      </article>
    </section>
  );
}