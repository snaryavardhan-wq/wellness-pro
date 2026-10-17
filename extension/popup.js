const API = "http://localhost:5000/api";
const $ = (id) => document.getElementById(id);
const todayStr = () => new Intl.DateTimeFormat("en-CA").format(new Date());
const fmt = (m) => `${Math.floor(m / 60)}h ${m % 60}m`;

async function render() {
  const { token, today } = await chrome.storage.local.get(["token", "today"]);
  $("login").hidden = !!token;
  $("stats").hidden = !token;
  if (!token) return;

  const t = today && today.date === todayStr() ? today : { minutes: 0, sites: {} };
  $("mins").textContent = fmt(t.minutes);

  $("sites").innerHTML = "";
  const top = Object.entries(t.sites).sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [host, m] of top) {
    const li = document.createElement("li");
    li.textContent = `${host}: ${m} min`; // textContent, never innerHTML, for untrusted hostnames
    $("sites").appendChild(li);
  }
}

$("loginBtn").onclick = async () => {
  $("err").textContent = "";
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: $("email").value, password: $("password").value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");
    await chrome.storage.local.set({ token: data.token });
    render();
  } catch (e) {
    $("err").textContent = e.message;
  }
};

$("logout").onclick = async () => {
  await chrome.storage.local.remove("token");
  render();
};

render();