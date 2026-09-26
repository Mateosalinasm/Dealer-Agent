// Orchestrator: polls the Dealer Agent app on a timer, and when a listing
// is due, opens a Facebook Marketplace tab, injects the fill-and-submit
// logic from content-script.js into it, and reports the result back.
//
// Runs entirely in your own browser, using your own already-logged-in
// Facebook session — this extension never sees or stores your Facebook
// password. It only talks to two things: your Dealer Agent app (to ask
// "anything to post?" and to report back), and facebook.com (to actually
// fill out the listing form).

const POLL_MINUTES = 15;
const ALARM_NAME = "dealer-agent-poll";

async function getConfig() {
  const { apiBaseUrl, apiToken } = await chrome.storage.local.get(["apiBaseUrl", "apiToken"]);
  return { apiBaseUrl: apiBaseUrl || null, apiToken: apiToken || null };
}

async function setStatus(patch) {
  const { status } = await chrome.storage.local.get(["status"]);
  await chrome.storage.local.set({ status: { ...(status || {}), ...patch, updatedAt: new Date().toISOString() } });
}

async function fetchNextJob(apiBaseUrl, apiToken) {
  const res = await fetch(`${apiBaseUrl}/api/extension/next-job`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: "no-store", // this must always reflect what's due right now, never a cached answer
  });
  if (!res.ok) throw new Error(`next-job returned ${res.status}`);
  return res.json();
}

async function reportResult(apiBaseUrl, apiToken, body) {
  await fetch(`${apiBaseUrl}/api/extension/report`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Photos are fetched here (the background service worker), not inside the
// injected page script — a fetch from facebook.com's own page context to
// our API would be blocked by CORS unless our server opts into it, but a
// fetch from the extension's own privileged context isn't. Converted to
// data URLs so they survive being passed as plain-JSON args into
// chrome.scripting.executeScript (which can't pass Blobs across that
// boundary reliably).
async function photoUrlToDataUrl(url) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    // A CORS/host-mismatch failure throws a generic "Failed to fetch"
    // with no indication of which URL it was — that detail only ever
    // showed up in the DevTools console, not anywhere the operator could
    // see it. Naming the exact URL here means a future occurrence is
    // diagnosable from the popup/report alone.
    throw new Error(`Could not fetch photo from ${url}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) throw new Error(`Photo fetch for ${url} returned ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Opens exactly one tab, injects content-script.js into that same tab,
// then invokes the function it defines on that same tab — the earlier
// version of this function opened a second, different tab for the actual
// call, which would have silently failed since only the first tab ever
// had the content script injected into it.
async function runJob(job) {
  const photoDataUrlsPromise = Promise.all(job.photoUrls.map(photoUrlToDataUrl));

  const tab = await chrome.tabs.create({ url: "https://www.facebook.com/marketplace/create/vehicle", active: true });
  await waitForTabComplete(tab.id);
  // Give the SPA a moment to finish its own client-side render after the
  // browser's "complete" — Facebook's page is fully JS-rendered, so
  // "complete" only means the initial HTML shell loaded.
  await new Promise((r) => setTimeout(r, 3000));

  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content-script.js"] });

  const photoDataUrls = await photoDataUrlsPromise;
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (payload) => window.__dealerAgentFillListing(payload),
    args: [{ vehicle: job.vehicle, body: job.body, photoDataUrls }],
  });

  // Deliberately left open, success or failure — closing it would hide
  // exactly the evidence needed to diagnose a failed attempt (or to just
  // see the listing that went out).
  return result; // { ok, error?, listingUrl? }
}

async function checkForJob() {
  const { apiBaseUrl, apiToken } = await getConfig();
  if (!apiBaseUrl || !apiToken) {
    await setStatus({ lastCheck: "Not paired yet — set the app URL and token in Options." });
    return;
  }

  try {
    const result = await fetchNextJob(apiBaseUrl, apiToken);
    if (!result.due) {
      await setStatus({ lastCheck: `Checked — nothing due (${result.reason}).` });
      return;
    }

    const label = `${result.job.vehicle.year ?? ""} ${result.job.vehicle.make ?? ""} ${result.job.vehicle.model ?? ""}`.trim();
    await setStatus({ lastCheck: `Posting ${label}…` });

    const outcome = await runJob(result.job);
    await reportResult(apiBaseUrl, apiToken, { postId: result.job.postId, ...outcome });
    await setStatus({ lastCheck: outcome.ok ? `Posted ${label}.` : `Failed: ${outcome.error}` });
  } catch (err) {
    await setStatus({ lastCheck: `Error: ${err instanceof Error ? err.message : String(err)}` });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) checkForJob();
});

// Manual "Check now" from the popup.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "check-now") {
    checkForJob().then(() => sendResponse({ ok: true }));
    return true; // keep the message channel open for the async response
  }
});
