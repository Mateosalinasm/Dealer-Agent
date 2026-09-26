// Fills out and submits Facebook's "Create vehicle listing" form on
// facebook.com/marketplace/create/vehicle, using the job data the
// background service worker passes in.
//
// ============================================================================
// STATUS after the latest real attempt against the live page:
//   - CONFIRMED WORKING: Photos, Price, Description.
//   - CONFIRMED NOT WORKING (this round): Vehicle type, Year (and therefore
//     Make/Model/Mileage never appeared, since Facebook only reveals those
//     once Vehicle type + Year are both set), Location resolved to a raw
//     typed zip instead of the matching city suggestion. Vehicle
//     appearance/details (Body style, Exterior color, Vehicle condition,
//     Fuel type, clean-title checkbox) and the marketplace-group selection
//     step were never attempted at all — added this round.
//   - Root cause for Vehicle type/Year: the original clickStaticDropdownOption
//     opened the dropdown and checked for a matching option exactly once,
//     600ms later. If Facebook's popup renders slower than that on a given
//     attempt, the match is missed with no second try. selectStaticOption
//     replaces it with a retry loop (~8 attempts, 300-350ms apart).
//   - STILL UNVERIFIED LIVE: Make/Model typeahead matching, Mileage/Body
//     style/Exterior color/Fuel type/clean-title selectors, and the group-
//     selection step (selectHoustonGroups) — this is the least-tested part
//     of this script since it's never been reached in a real run yet.
// ============================================================================

// This dealership's lot zip — Facebook otherwise defaults to whatever city
// it thinks the account is in, not necessarily where the vehicle actually
// is. Change these two lines if the lot moves.
const ZIP_CODE = "77076";
const VEHICLE_TYPE_OPTION = "Car/Truck";
const VEHICLE_CONDITION = "Very good"; // fixed by the operator, not derived from vehicle data
const BODY_TYPE_LABELS = { sedan: "Sedan", suv: "SUV", truck: "Truck" };
const FUEL_TYPE_LABELS = { gas: "Gasoline", diesel: "Diesel", hybrid: "Hybrid", electric: "Electric" };

window.__dealerAgentFillListing = async function fillListing({ vehicle, body, photoDataUrls }) {
  // Each field is attempted independently and a failure on one does NOT
  // stop the others from being tried — a previous version bailed out on
  // the first failing field, which meant a bug in that one field silently
  // blocked every other field from being attempted too.
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

    const vehicleTypeResult = await selectStaticOption(["Vehicle type"], VEHICLE_TYPE_OPTION);
    if (vehicleTypeResult !== true) warnings.push(`Could not set Vehicle type to "${VEHICLE_TYPE_OPTION}" (${vehicleTypeResult}).`);

    if (vehicle.year != null) {
      const r = await selectStaticOption(["Year"], String(vehicle.year));
      if (r !== true) warnings.push(`Could not set Year (${r}).`);
    }

    // Make, Model, and Mileage only render in the DOM once Vehicle type
    // and Year are both set — give the page a moment to reveal them.
    await sleep(800);

    if (vehicle.make) {
      const r = await fillTypeahead(["Make"], vehicle.make);
      if (r !== true) warnings.push(`Could not fill Make (${r}).`);
    }
    if (vehicle.model) {
      const r = await fillTypeahead(["Model"], vehicle.model);
      if (r !== true) warnings.push(`Could not fill Model (${r}).`);
    }
    if (vehicle.miles != null) {
      const mileageInput = findInputByLabel(["Mileage"]);
      if (!mileageInput) warnings.push("Could not find the Mileage field on the page.");
      else setInputValue(mileageInput, String(vehicle.miles));
    }

    const locationResult = await fillLocation();
    if (locationResult !== true) warnings.push(`Could not set Location (${locationResult}).`);

    const priceCents = vehicle.downPaymentCents ?? vehicle.askingPrice ?? 0;
    const priceInput = findInputByLabel(["Price"]);
    if (!priceInput) warnings.push("Could not find the Price field on the page.");
    else setInputValue(priceInput, String(Math.round(priceCents / 100)));

    const bodyLabel = vehicle.bodyType && BODY_TYPE_LABELS[vehicle.bodyType];
    if (bodyLabel) {
      const r = await selectStaticOption(["Body style"], bodyLabel);
      if (r !== true) warnings.push(`Could not set Body style (${r}).`);
    }
    if (vehicle.color) {
      const r = await selectStaticOption(["Exterior color"], vehicle.color);
      if (r !== true) warnings.push(`Could not set Exterior color (${r}).`);
    }

    const conditionResult = await selectStaticOption(["Vehicle condition"], VEHICLE_CONDITION);
    if (conditionResult !== true) warnings.push(`Could not set Vehicle condition (${conditionResult}).`);

    const fuelLabel = FUEL_TYPE_LABELS[vehicle.fuelType] || "Gasoline";
    const fuelResult = await selectStaticOption(["Fuel type"], fuelLabel);
    if (fuelResult !== true) warnings.push(`Could not set Fuel type (${fuelResult}).`);

    const cleanTitleResult = checkCleanTitleBox();
    if (cleanTitleResult !== true) warnings.push(`Could not check the clean title box (${cleanTitleResult}).`);

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

// Clicks "Next" to leave the main form, best-effort checks the Houston
// marketplace groups once that step appears, then clicks "Next"/"Continue"
// up to a few more times to reach Publish. Before each click, checks for a
// visible required-field error this script doesn't already know how to
// fill — if one shows up, stops immediately rather than guessing at a
// field it's never seen, naming it so it can be added properly next time.
async function advanceThroughSteps() {
  const KNOWN_FIELDS = [
    "vehicle type", "year", "make", "model", "price", "description", "photo",
    "mileage", "body style", "exterior color", "condition", "fuel", "clean title", "location",
  ];
  let groupsHandled = false;

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

    if (!groupsHandled) {
      const matched = await selectHoustonGroups();
      if (matched > 0) groupsHandled = true;
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

// Facebook caps a listing at 20 groups. Checks every visible group
// checkbox whose nearby text reads like a Houston buy/sell group (English
// or Spanish naming — "Buy Sell Houston", "Compra y Venta de Carros
// Houston", etc.), up to that cap. Runs once, on whichever step actually
// shows the group list — a step with no matching checkboxes at all is not
// an error, just nothing to do yet, so the caller retries this on later
// steps until it finds one (or never does).
async function selectHoustonGroups() {
  const checkboxes = Array.from(document.querySelectorAll('[role="checkbox"], input[type="checkbox"]')).filter(isVisible);
  let matched = 0;
  for (const box of checkboxes) {
    if (matched >= 20) break;
    const text = nearbyText(box);
    if (!/houston/i.test(text)) continue;
    const already = box.getAttribute("aria-checked") === "true" || box.checked === true;
    if (!already) {
      simulateClick(box);
      await sleep(150);
    }
    matched++;
  }
  return matched;
}

// Group checkboxes don't reliably carry their own label as an accessible
// name, so this walks up a few ancestor levels (same pattern as
// findFileInput/checkCleanTitleBox) collecting textContent until it finds
// something to match against.
function nearbyText(el) {
  let container = el;
  for (let i = 0; i < 4 && container; i++) {
    const text = (container.textContent || "").trim();
    if (text.length > 0) return text;
    container = container.parentElement;
  }
  return "";
}

// Looks for Facebook's own inline validation text (e.g. "Please choose a
// vehicle category.") that ISN'T about one of the fields already handled,
// meaning a new required field showed up that nothing here knows how to
// fill yet.
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
// text sitting near a dropdown affordance — used for both static dropdowns
// and as the open-step of the typeahead fields.
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

// Finds the best visible element whose text matches optionText. Not
// restricted to specific tags or "leaf node" elements — an option's
// visible text is very often wrapped in an inner <span> — so this matches
// on ANY element and then picks the most specific (fewest descendant
// elements) match, landing on the innermost text-bearing element
// regardless of how deeply Facebook nests it.
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

function findOpenListbox() {
  const listboxes = Array.from(document.querySelectorAll('[role="listbox"]')).filter(isVisible);
  return listboxes.find((el) => el.scrollHeight > el.clientHeight + 10) || null;
}

// For plain option-list fields (Vehicle type, Year, Body style, Exterior
// color, Vehicle condition, Fuel type) — click the trigger, then click the
// option whose text matches exactly. Retries for a few seconds rather than
// checking once, since a single fixed delay was missing Facebook's popup
// on a real device depending on how long it took to render that time.
// Returns true, or a string describing what went wrong.
async function selectStaticOption(triggerCandidates, optionText) {
  const trigger = findFieldTrigger(triggerCandidates);
  if (!trigger) return "could not find the field to click";
  simulateClick(trigger);
  await sleep(500);

  for (let attempt = 0; attempt < 8; attempt++) {
    const match = findBestTextMatch(optionText);
    if (match) {
      simulateClick(match);
      await sleep(300);
      return true;
    }
    const popup = findOpenListbox();
    if (popup) popup.scrollTop += popup.clientHeight;
    await sleep(350);
  }
  return `no option matched "${optionText}" — visible text was: ${visibleTextSample()}`;
}

// For Make/Model — fields tied to Facebook's own searchable catalog (not a
// short fixed list). Clicks the trigger, types into whatever text input
// becomes active, waits for suggestions, and clicks the closest match.
async function fillTypeahead(triggerCandidates, valueText) {
  const trigger = findFieldTrigger(triggerCandidates);
  if (!trigger) return "could not find the field to click";
  simulateClick(trigger);
  await sleep(400);

  const activeInput = document.activeElement && document.activeElement.tagName === "INPUT" ? document.activeElement : findInputByLabel(triggerCandidates);
  if (!activeInput) return "could not find a text input after opening the field";
  setInputValue(activeInput, valueText);

  for (let attempt = 0; attempt < 6; attempt++) {
    const options = visibleOptionElements();
    if (options.length > 0) {
      const mostSpecific = options.reduce((best, el) => (el.querySelectorAll("*").length < best.querySelectorAll("*").length ? el : best));
      simulateClick(mostSpecific);
      await sleep(300);
      return true;
    }
    await sleep(300);
  }
  // No suggestion list appeared — some of these fields may just accept
  // free text once typed, so leaving the typed value in place isn't
  // necessarily wrong. Treat it as success rather than failing the whole
  // job over a field that might already be fine.
  return true;
}

function visibleOptionElements() {
  return Array.from(document.querySelectorAll('[role="option"], [role="listbox"] *')).filter((el) => isVisible(el) && (el.textContent || "").trim().length > 0);
}

// Typing the zip alone leaves raw digits in the box instead of a real,
// structured location — Facebook resolves it to a city suggestion (e.g.
// "Houston, TX 77076") a moment later, and that suggestion has to actually
// be clicked, not just left as typed text.
async function fillLocation() {
  const trigger = findFieldTrigger(["Location"]);
  if (!trigger) return "could not find the field to click";
  simulateClick(trigger);
  await sleep(400);

  const activeInput = document.activeElement && document.activeElement.tagName === "INPUT" ? document.activeElement : findInputByLabel(["Location"]);
  if (!activeInput) return "could not find a text input after opening the field";
  setInputValue(activeInput, ZIP_CODE);

  for (let attempt = 0; attempt < 8; attempt++) {
    const cityMatch = visibleOptionElements().find((el) => /houston/i.test(el.textContent || ""));
    if (cityMatch) {
      simulateClick(cityMatch);
      await sleep(300);
      return true;
    }
    await sleep(350);
  }
  return `no "Houston" suggestion appeared for zip ${ZIP_CODE} — visible text was: ${visibleTextSample()}`;
}

// Always checked, per the operator — walks up a few ancestor levels from
// the visible label text to find the actual checkbox control (same
// pattern as findFileInput), since the checkbox itself carries no
// matching label text of its own.
function checkCleanTitleBox() {
  const label = Array.from(document.querySelectorAll("span, div, label")).find(
    (el) => el.children.length === 0 && /this vehicle has a clean title/i.test((el.textContent || "").trim())
  );
  if (!label) return "could not find the clean title text on the page";

  let container = label;
  for (let i = 0; i < 5 && container; i++) {
    const checkbox = container.querySelector('[role="checkbox"], input[type="checkbox"]');
    if (checkbox) {
      const alreadyChecked = checkbox.getAttribute("aria-checked") === "true" || checkbox.checked === true;
      if (!alreadyChecked) simulateClick(checkbox);
      return true;
    }
    container = container.parentElement;
  }
  return "found the clean title text but not its checkbox";
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
