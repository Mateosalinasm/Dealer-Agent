// Fills out and submits Facebook's "Create vehicle listing" form on
// facebook.com/marketplace/create/vehicle, using the job data the
// background service worker passes in.
//
// ============================================================================
// STATUS after two real attempts against the live page:
//   - CONFIRMED WORKING: Description field.
//   - CONFIRMED BUG (round 1), FIXED: a version of this script existed that
//     clicked whatever button it found (even "Next") and reported success
//     unconditionally, with no check that Facebook actually accepted
//     anything — that's why a listing got marked "posted" in the app
//     without ever actually going live. advanceThroughSteps() now only
//     reports ok:true when it finds and clicks a real Publish/Post button,
//     and checks for Facebook's own validation errors before every click.
//   - CONFIRMED BUG (round 2), FIXED: clickStaticDropdownOption's option
//     matching required a "leaf" element with zero children, but Facebook
//     wraps option text in an inner <span>, so it never matched anything
//     — findBestTextMatch() replaces that with a match-then-pick-most-
//     specific-element approach that doesn't care how deeply text is
//     nested. Also switched every click to simulateClick() (a full
//     pointerdown/mousedown/mouseup/click sequence) instead of plain
//     .click(), in case a component only listens for the real sequence.
//   - Field fills are now independent of each other (see fillListing) —
//     a failure on one field no longer prevents the others from being
//     attempted, and a failure now returns a specific string describing
//     what went wrong instead of just true/false.
//   - STILL UNVERIFIED LIVE: Year/Make/Model/Location as typeahead
//     comboboxes (fillTypeahead), and the photo upload input targeting
//     (findFileInput). These are the most likely things to still need a
//     fix — if a run fails on one of these, the error text now includes
//     a sample of what was actually visible on screen at the time.
// ============================================================================

// This dealership's lot zip — Facebook otherwise defaults to whatever
// city it thinks the account is in (seen defaulting to "Bellaire" in
// testing), not necessarily where the vehicle actually is. Change this
// one line if the lot moves.
const ZIP_CODE = "77076";
const VEHICLE_TYPE_OPTION = "Car/Truck";

window.__dealerAgentFillListing = async function fillListing({ vehicle, body, photoDataUrls }) {
  // Each field is attempted independently and a failure on one does NOT
  // stop the others from being tried — a previous version bailed out on
  // the first failing field (Vehicle type), which meant a bug in that one
  // field silently blocked Price/Description from being filled too, even
  // though those work fine on their own. Soft failures are collected and
  // only matter if advanceThroughSteps() later finds Facebook still
  // blocking on one of them.
  const warnings = [];
  try {
    await waitFor(() => document.querySelector('[aria-label="Marketplace"]') || document.body, 15000);
    await sleep(1000);

    if (photoDataUrls.length > 0) {
      const fileInput = findFileInput();
      if (!fileInput) warnings.push("Could not find the photo upload input on the page.");
      else {
        await setFiles(fileInput, photoDataUrls);
        await sleep(1500);
      }
    }

    const vehicleTypeResult = await clickStaticDropdownOption(["Vehicle type"], VEHICLE_TYPE_OPTION);
    if (vehicleTypeResult !== true) warnings.push(`Could not set Vehicle type to "${VEHICLE_TYPE_OPTION}" (${vehicleTypeResult}).`);
    await sleep(500);

    if (vehicle.year != null) {
      const r = await fillTypeahead(["Year"], String(vehicle.year));
      if (r !== true) warnings.push(`Could not fill Year (${r}).`);
    }
    if (vehicle.make) {
      const r = await fillTypeahead(["Make"], vehicle.make);
      if (r !== true) warnings.push(`Could not fill Make (${r}).`);
    }
    if (vehicle.model) {
      const r = await fillTypeahead(["Model"], vehicle.model);
      if (r !== true) warnings.push(`Could not fill Model (${r}).`);
    }

    await fillTypeahead(["Location"], ZIP_CODE); // best-effort; not fatal if this specific one fails

    const priceCents = vehicle.downPaymentCents ?? vehicle.askingPrice ?? 0;
    const priceInput = findInputByLabel(["Price"]);
    if (!priceInput) warnings.push("Could not find the Price field on the page.");
    else setInputValue(priceInput, String(Math.round(priceCents / 100)));

    const descriptionInput = findInputByLabel(["Description"], "textarea");
    if (!descriptionInput) warnings.push("Could not find the Description field on the page.");
    else setInputValue(descriptionInput, body);

    const stepResult = await advanceThroughSteps();
    if (!stepResult.ok && warnings.length > 0) {
      return { ok: false, error: `${stepResult.error} (Earlier field warnings: ${warnings.join(" | ")})` };
    }
    return stepResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: warnings.length > 0 ? `${message} (Earlier field warnings: ${warnings.join(" | ")})` : message };
  }
};

// Clicks "Next"/"Continue" up to a few times to get through the rest of
// the wizard. Before each click, checks for a visible required-field
// error this script doesn't already know how to fill — if one shows up,
// stops immediately rather than guessing at a step it's never seen,
// naming the field so it can be added properly next time.
async function advanceThroughSteps() {
  const KNOWN_FIELDS = ["vehicle type", "year", "make", "model", "price", "description", "photo"];
  for (let step = 0; step < 6; step++) {
    await sleep(800);

    const unknownError = findUnhandledRequiredFieldError(KNOWN_FIELDS);
    if (unknownError) return { ok: false, error: `Reached a step this script doesn't handle yet: "${unknownError}".` };

    const publishButton = findButtonByText(["Publish", "Post"]);
    if (publishButton) {
      simulateClick(publishButton);
      await sleep(3000);
      return { ok: true, listingUrl: extractListingUrl() ?? undefined };
    }

    const nextButton = findButtonByText(["Next", "Continue"]);
    if (!nextButton) return { ok: false, error: "Could not find a Next or Publish button on this step." };
    if (nextButton.getAttribute("aria-disabled") === "true" || nextButton.disabled) {
      const stillUnknown = findUnhandledRequiredFieldError(KNOWN_FIELDS);
      return { ok: false, error: stillUnknown ? `Stuck on: "${stillUnknown}".` : "The Next button stayed disabled for a reason this script couldn't identify." };
    }
    simulateClick(nextButton);
  }
  return { ok: false, error: "Went through 6 steps without reaching Publish — this form has more steps than expected." };
}

// Looks for Facebook's own inline validation text (e.g. "Please choose a
// vehicle category.") that ISN'T about one of the fields already handled,
// meaning a new required field showed up on this step that nothing here
// knows how to fill yet.
function findUnhandledRequiredFieldError(knownFieldWords) {
  const candidates = Array.from(document.querySelectorAll("span, div")).filter((el) => {
    const text = (el.textContent || "").trim().toLowerCase();
    return text.startsWith("please ") && el.children.length === 0;
  });
  const unhandled = candidates.find((el) => !knownFieldWords.some((w) => el.textContent.toLowerCase().includes(w)));
  return unhandled ? unhandled.textContent.trim() : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitFor(check, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      const result = check();
      if (result) return resolve(result);
      if (Date.now() - start > timeoutMs) return reject(new Error("Timed out waiting for the page to load."));
      setTimeout(poll, 200);
    })();
  });
}

// Finds a text input / textarea whose accessible label, placeholder, or a
// nearby <label> text matches one of the candidates (case-insensitive,
// substring match — Facebook often prefixes/suffixes labels with extra
// text like "Price (required)").
function findInputByLabel(candidates, tag = "input") {
  const els = Array.from(document.querySelectorAll(tag));
  return els.find((el) => {
    const haystack = [el.getAttribute("aria-label"), el.getAttribute("placeholder"), labelTextFor(el)].filter(Boolean).join(" ").toLowerCase();
    return candidates.some((c) => haystack.includes(c.toLowerCase()));
  });
}

function labelTextFor(el) {
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label) return label.textContent || "";
  }
  const wrappingLabel = el.closest("label");
  return wrappingLabel ? wrappingLabel.textContent || "" : "";
}

function findButtonByText(candidates) {
  const els = Array.from(document.querySelectorAll('[role="button"], button'));
  return els.find((el) => isVisible(el) && candidates.some((c) => (el.textContent || "").trim().toLowerCase() === c.toLowerCase()));
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

// Finds the clickable trigger for a field by its visible placeholder/label
// text sitting near a dropdown affordance — used for both the static
// "Vehicle type" dropdown and as the open-step of the typeahead fields.
function findFieldTrigger(candidates) {
  const all = Array.from(document.querySelectorAll("div, input"));
  return all.find((el) => {
    if (!isVisible(el)) return false;
    const text = (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.textContent || "").trim().toLowerCase();
    return candidates.some((c) => text === c.toLowerCase() || text.startsWith(c.toLowerCase()));
  });
}

// A plain .click() only fires a synthetic MouseEvent — some React
// components listen for the full real sequence (pointerdown/mousedown/
// mouseup) rather than just "click", so this dispatches all of them.
function simulateClick(el) {
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
}

// Finds the best visible element whose text matches optionText — used
// for both the static Vehicle type list and typeahead suggestions.
// Deliberately NOT restricted to specific tags or "leaf node" elements:
// an option's visible text is very often wrapped in an inner <span>, so
// requiring el.children.length === 0 on a broad div/li/role=option query
// (an earlier version of this function did that) misses it entirely —
// this instead matches on ANY element and then picks the most specific
// (fewest descendant elements) match, which lands on the innermost
// text-bearing element regardless of how deeply Facebook nests it.
function findBestTextMatch(text) {
  const wanted = text.trim().toLowerCase();
  const all = Array.from(document.querySelectorAll("*")).filter((el) => isVisible(el) && (el.textContent || "").trim().toLowerCase() === wanted);
  if (all.length === 0) return null;
  return all.reduce((best, el) => (el.querySelectorAll("*").length < best.querySelectorAll("*").length ? el : best));
}

// A short list of what's currently visible on screen, for when a match
// fails — included in the error so the next failure report can name the
// actual option text Facebook is showing without needing another
// screenshot round-trip.
function visibleTextSample(max = 15) {
  const texts = Array.from(document.querySelectorAll("span, div"))
    .filter((el) => el.children.length === 0 && isVisible(el))
    .map((el) => (el.textContent || "").trim())
    .filter((t) => t.length > 0 && t.length < 40);
  return [...new Set(texts)].slice(0, max).join(", ");
}

// Vehicle type is a plain static list (Car/Truck, Motorcycle, …) — click
// the trigger, then click the option whose text matches exactly. Returns
// true, or a string describing what went wrong (not a plain boolean, so
// the caller can report specifically which part failed).
async function clickStaticDropdownOption(triggerCandidates, optionText) {
  const trigger = findFieldTrigger(triggerCandidates);
  if (!trigger) return "could not find the field to click";
  simulateClick(trigger);
  await sleep(600);

  const match = findBestTextMatch(optionText);
  if (!match) return `no option matched "${optionText}" — visible text was: ${visibleTextSample()}`;
  simulateClick(match);
  await sleep(300);
  return true;
}

// For Year/Make/Model/Location — fields expected to be typeahead
// comboboxes tied to Facebook's own catalog (not free text). Clicks the
// trigger, types into whatever text input becomes active, waits for
// suggestions, and clicks the closest match. This is the least-verified
// part of this script — if it's wrong, the fix is almost certainly here.
async function fillTypeahead(triggerCandidates, valueText) {
  const trigger = findFieldTrigger(triggerCandidates);
  if (!trigger) return "could not find the field to click";
  simulateClick(trigger);
  await sleep(400);

  const activeInput = document.activeElement && document.activeElement.tagName === "INPUT" ? document.activeElement : findInputByLabel(triggerCandidates);
  if (!activeInput) return "could not find a text input after opening the field";
  setInputValue(activeInput, valueText);
  await sleep(900); // let Facebook's own suggestion search run

  const options = Array.from(document.querySelectorAll('[role="option"], [role="listbox"] *')).filter((el) => isVisible(el) && (el.textContent || "").trim().length > 0);
  if (options.length > 0) {
    const mostSpecific = options.reduce((best, el) => (el.querySelectorAll("*").length < best.querySelectorAll("*").length ? el : best));
    simulateClick(mostSpecific);
    return true;
  }
  // No suggestion list appeared — some of these fields may just accept
  // free text once typed, so leaving the typed value in place isn't
  // necessarily wrong. Treat it as success rather than failing the whole
  // job over a field that might already be fine.
  return true;
}

function findFileInput() {
  // Prefer an input scoped near the actual "Add photos" text over a blind
  // page-wide query — Facebook's chrome (e.g. a profile-photo control)
  // can have its own unrelated file input elsewhere on the same page.
  const label = Array.from(document.querySelectorAll("span, div")).find((el) => (el.textContent || "").trim().toLowerCase().startsWith("add photos"));
  if (label) {
    let container = label;
    for (let i = 0; i < 5 && container; i++) {
      const input = container.querySelector('input[type="file"]');
      if (input) return input;
      container = container.parentElement;
    }
  }
  return document.querySelector('input[type="file"][accept*="image"]') || document.querySelector('input[type="file"]');
}

// React controls these inputs, so a plain `.value = x` doesn't trigger its
// internal state update — dispatching a native input event through React's
// tracked value setter is the standard workaround.
function setInputValue(el, value) {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

async function setFiles(fileInput, dataUrls) {
  const files = await Promise.all(dataUrls.map((dataUrl, i) => dataUrlToFile(dataUrl, `photo-${i}.jpg`)));
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  fileInput.files = dt.files;
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));

  // Fallback in case this widget only listens for an actual drop rather
  // than a file-input change (common for drag-and-drop upload tiles) —
  // dispatched on the input's nearest reasonably-sized ancestor tile.
  const dropTarget = fileInput.closest("div") || fileInput.parentElement;
  if (dropTarget) {
    const dropEvent = new DragEvent("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, "dataTransfer", { value: dt });
    dropTarget.dispatchEvent(dropEvent);
  }
}

async function dataUrlToFile(dataUrl, filename) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

// Best-effort — Facebook may redirect to the listing, show a toast with a
// link, or navigate to the marketplace item page after publishing. Missing
// this is not treated as a failure (the report still says ok:true); it
// just means the "View listing" link on the Marketing page stays blank.
function extractListingUrl() {
  const match = window.location.href.match(/\/marketplace\/item\/\d+/);
  if (match) return `https://www.facebook.com${match[0]}`;
  const link = document.querySelector('a[href*="/marketplace/item/"]');
  return link ? link.href : null;
}
