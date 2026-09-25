const urlInput = document.getElementById("apiBaseUrl");
const tokenInput = document.getElementById("apiToken");
const saveButton = document.getElementById("save");
const statusEl = document.getElementById("status");

chrome.storage.local.get(["apiBaseUrl", "apiToken"]).then(({ apiBaseUrl, apiToken }) => {
  if (apiBaseUrl) urlInput.value = apiBaseUrl;
  if (apiToken) tokenInput.value = apiToken;
});

function setStatus(text, ok) {
  statusEl.textContent = text;
  statusEl.className = ok === undefined ? "" : ok ? "ok" : "err";
}

saveButton.addEventListener("click", async () => {
  const apiBaseUrl = urlInput.value.trim().replace(/\/$/, "");
  const apiToken = tokenInput.value.trim();
  if (!apiBaseUrl || !apiToken) {
    setStatus("Fill in both fields.", false);
    return;
  }

  let origin;
  try {
    origin = new URL(apiBaseUrl).origin + "/*";
  } catch {
    setStatus("That doesn't look like a valid URL.", false);
    return;
  }

  saveButton.disabled = true;
  setStatus("Requesting permission to reach that URL…");

  // MV3 requires explicit, user-gesture-triggered permission before the
  // background worker can fetch an arbitrary (user-supplied) origin —
  // this is that request, asked for right here rather than baked into the
  // manifest, so the extension only ever gets access to the one app URL
  // you actually paired it with.
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) {
    setStatus("Permission denied — the extension can't reach that URL without it.", false);
    saveButton.disabled = false;
    return;
  }

  await chrome.storage.local.set({ apiBaseUrl, apiToken });

  setStatus("Saved — testing connection…");
  try {
    const res = await fetch(`${apiBaseUrl}/api/extension/next-job`, { headers: { Authorization: `Bearer ${apiToken}` } });
    if (res.status === 401) {
      setStatus("Saved, but the token was rejected — check it was copied in full.", false);
    } else if (!res.ok) {
      setStatus(`Saved, but the app responded with an error (${res.status}).`, false);
    } else {
      setStatus("Connected — paired successfully.", true);
    }
  } catch {
    setStatus("Saved, but couldn't reach that URL — double check it's correct and the app is running.", false);
  }
  saveButton.disabled = false;
});
