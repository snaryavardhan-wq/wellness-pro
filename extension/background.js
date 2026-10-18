const API = "https://wellness-pro-api.onrender.com/api"; // change to your deployed API (and add it to host_permissions)
const todayStr = () => new Intl.DateTimeFormat("en-CA").format(new Date());

// A service worker gets suspended, so setInterval is unreliable. chrome.alarms wakes it up.
const ensureAlarm = () => chrome.alarms.create("tick", { periodInMinutes: 1 });
chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);

async function loadToday() {
  const { today } = await chrome.storage.local.get("today");
  const d = todayStr();
  return today && today.date === d ? today : { date: d, minutes: 0, sites: {} };
}

async function sync(minutes) {
  const { token } = await chrome.storage.local.get("token");
  if (!token) return;
  try {
    const res = await fetch(`${API}/screentime/${todayStr()}/source`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ source: "browser", minutes }),
    });
    if (res.status === 401) await chrome.storage.local.remove("token"); // token expired
  } catch {
    // offline: the next tick sends a larger total, and $max on the server makes that safe
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "tick") return;

  // Count only when the user is actually active in a focused Chrome window
  const state = await chrome.idle.queryState(60);
  const win = await chrome.windows.getLastFocused();
  if (state !== "active" || !win.focused) return;

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  let host = null;
  try {
    const url = new URL(tab?.url || "");
    if (url.protocol === "http:" || url.protocol === "https:") host = url.hostname;
  } catch {}

  const data = await loadToday();
  data.minutes += 1;
  if (host) data.sites[host] = (data.sites[host] || 0) + 1;
  await chrome.storage.local.set({ today: data });
  await sync(data.minutes);
});
// Receives the login token from the Wellness page (content.js)
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== "token") return;
const ALLOWED = ["http://localhost:5173", "https://wellness-pro-xi.vercel.app"];
if (!ALLOWED.some((o) => sender.url?.startsWith(o))) return; // only trust our own sites
  if (msg.token) chrome.storage.local.set({ token: msg.token });
  else chrome.storage.local.remove("token"); // logged out on the website
});

// ---------- Reminders (desktop notifications) ----------
const DASHBOARD_URL = "https://wellness-pro-xi.vercel.app";

// fetch helper that adds the login token (and forgets it if the server rejects it)
async function authed(path, options = {}) {
  const { token } = await chrome.storage.local.get("token");
  if (!token) return null;
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) await chrome.storage.local.remove("token");
  return res;
}

// Read the user's reminder intervals and (re)create the alarms if they changed
async function syncGoals() {
  let g = null;
  try {
    const res = await authed("/auth/me");
    if (res && res.ok) g = (await res.json()).user.goals;
  } catch {}
  if (!g) {
    chrome.alarms.clear("posture");
    chrome.alarms.clear("water");
    return;
  }
  const setAlarm = async (name, minutes) => {
    const existing = await chrome.alarms.get(name);
    if (!existing || existing.periodInMinutes !== minutes) {
      chrome.alarms.create(name, { delayInMinutes: minutes, periodInMinutes: minutes });
    }
  };
  await setAlarm("posture", g.postureIntervalMin);
  await setAlarm("water", g.hydrationIntervalMin);
}

const startReminders = () => {
  chrome.alarms.create("goals", { periodInMinutes: 15 }); // picks up goal changes
  syncGoals();
};
chrome.runtime.onInstalled.addListener(startReminders);
chrome.runtime.onStartup.addListener(startReminders);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.token?.newValue) syncGoals(); // just logged in
});

function notify(id, title, message, buttons) {
  chrome.notifications.create(
    id,
    {
      type: "basic",
      iconUrl: "icon.png",
      title,
      message,
      buttons: buttons.map((t) => ({ title: t })),
      requireInteraction: true,
      priority: 2,
    },
    () => {
      if (chrome.runtime.lastError) console.error("Notification failed:", chrome.runtime.lastError.message);
      else console.log("Notification shown:", id);
    }
  );
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "goals") return syncGoals();
  if (alarm.name !== "posture" && alarm.name !== "water") return;

  // Don't nag when you're away from the computer
  const idleState = await chrome.idle.queryState(120);
if (idleState !== "active") {
  console.log("Reminder skipped, state:", idleState);
  return;
}

  if (alarm.name === "posture") {
    notify("posture", "Posture check", "Shoulders back, screen at eye level.", ["Fixed it", "Snooze"]);
  } else {
    notify("water", "Time to drink water", "Take a few sips.", ["Drank 250 ml", "Later"]);
  }
});

const handled = new Set(); // stops a button click from also being logged as "dismissed"

chrome.notifications.onButtonClicked.addListener(async (id, index) => {
  handled.add(id);
  try {
    if (id === "posture") {
      await authed("/posture", {
        method: "POST",
        body: JSON.stringify({ response: index === 0 ? "corrected" : "snoozed" }),
      });
    } else if (id === "water" && index === 0) {
      await authed("/hydration", { method: "POST", body: JSON.stringify({ amountMl: 250 }) });
    }
  } catch {}
  chrome.notifications.clear(id);
});

chrome.notifications.onClosed.addListener(async (id, byUser) => {
  if (handled.delete(id)) return;
  if (id === "posture" && byUser) {
    try {
      await authed("/posture", { method: "POST", body: JSON.stringify({ response: "dismissed" }) });
    } catch {}
  }
});

chrome.notifications.onClicked.addListener((id) => {
  chrome.tabs.create({ url: DASHBOARD_URL });
  chrome.notifications.clear(id);
});