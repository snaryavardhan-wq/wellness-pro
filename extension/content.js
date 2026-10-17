// Runs only on the Wellness site. Shares the page's login token with the extension.
const share = () =>
  chrome.runtime.sendMessage({ type: "token", token: localStorage.getItem("token") });

share();
setInterval(share, 5000); // picks up logins and logouts