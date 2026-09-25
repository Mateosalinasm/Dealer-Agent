const lastCheckEl = document.getElementById("lastCheck");
const checkNowButton = document.getElementById("checkNow");

async function render() {
  const { status, apiBaseUrl } = await chrome.storage.local.get(["status", "apiBaseUrl"]);
  if (!apiBaseUrl) {
    lastCheckEl.textContent = "Not paired yet — open Pairing settings below.";
    return;
  }
  if (!status?.lastCheck) {
    lastCheckEl.textContent = "Not checked yet. Runs automatically every 15 minutes, or click below.";
    return;
  }
  const when = status.updatedAt ? new Date(status.updatedAt).toLocaleTimeString() : "";
  lastCheckEl.textContent = `${status.lastCheck} (${when})`;
}

checkNowButton.addEventListener("click", async () => {
  checkNowButton.disabled = true;
  checkNowButton.textContent = "Checking…";
  await chrome.runtime.sendMessage({ type: "check-now" });
  await render();
  checkNowButton.disabled = false;
  checkNowButton.textContent = "Check now";
});

document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

render();
