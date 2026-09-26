// Fills out and submits Facebook's "Create vehicle listing" form on
// facebook.com/marketplace/create/vehicle, using the job data the
// background service worker passes in.
//
// ============================================================================
// STATUS after the latest real attempt against the live page:
//   - CONFIRMED WORKING: Vehicle type, Photos, Location, Model, Mileage,
//     Price, clean-title checkbox. (Transmission "working" is suspect —
//     see below.)
//   - CONFIRMED WRONG: the native-<select> theory. Diagnostics (added
//     specifically to test it) came back "selects on page: [none]" — there
//     are no native selects here at all, so that fix did nothing for
//     Year/Make/Body style/colors/condition/fuel type, which still fail
//     identically.
//   - What the diagnostics DID reveal: the error format itself
//     ("no option matched X", not "could not find the field to click")
//     means the trigger for EVERY one of these fields IS being found and
//     clicked — the failure is specifically that no popup/option content
//     with the right text ever gets found afterward. Two real bugs fixed
//     based on that:
//       1. The typing fallback only fired when document.activeElement was
//          literally an <input> — but fillLocation (which works) also
//          falls back to findInputByLabel() when it isn't, and this
//          selectStaticOption was missing that same fallback entirely.
//          Should fix Year/Make, which are search-backed like Location.
//       2. The "visible text" in every diagnostic dump was IDENTICAL page-
//          wide nav chrome ("Number of unread notifications", "Save
//          draft", etc.) — not because nothing changed, but because a
//          flat page-wide sample is dominated by Facebook's own chrome,
//          which sorts first in DOM order and crowded out whatever
//          actually sits near the field being diagnosed. Samples now drop
//          anything above the clicked field's own position, and the
//          failure message now says whether a popup ever appeared to open
//          at all versus one opening without the right text in it — the
//          next report should actually be diagnostic instead of the same
//          uninformative dump every time.
//   - Body style/Exterior/Interior color/Vehicle condition/Fuel type
//     remain unexplained — they're presumably NOT search-backed (no
//     reason a fixed enum list like "SUV/Sedan/Truck" would need a search
//     box), so fix #1 above likely doesn't touch them. The next real error
//     text (with the new "never opened anything" vs "opened without a
//     match" distinction) should finally say which.
//   - Also: Make does not reset Model — Make already runs before Model in
//     this file's own order. If Make fails and the operator sets it by
//     hand afterward, THAT later manual change is what resets Model, not
//     anything this script does — the real fix is making Make succeed on
//     its own so nobody needs to touch it by hand.
// ============================================================================

// This dealership's lot location — Facebook otherwise defaults to whatever
// city it thinks the account is in, not necessarily where the vehicle
// actually is. Typing the bare zip (77076) stopped resolving reliably —
// Facebook would leave it as raw unselected text and reject it ("Please
// enter a valid location") instead of ever showing a matching suggestion;
// the city name is a far more reliable autocomplete match. Change this if
// the lot moves.
const LOCATION_QUERY = "Houston";
const VEHICLE_TYPE_OPTION = "Car/Truck";
const VEHICLE_CONDITION = "Very good"; // fixed by the operator, not derived from vehicle data
const INTERIOR_COLOR = "Black"; // fixed by the operator, not derived from vehicle data
const TRANSMISSION = "Automatic transmission"; // fixed by the operator, not derived from vehicle data
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
        // setFiles() only proves the event was dispatched, not that
        // Facebook's own widget actually picked it up and rendered
        // thumbnails — worth confirming, since a run where every field
        // after this one comes back empty is much more explicable (and a
        // different fix) if photos silently never attached in the first
        // place than if the form itself broke later on.
        const attached = await waitForPhotosAttached(photoDataUrls.length);
        if (!attached) warnings.push(`Set ${photoDataUrls.length} photo file(s) on the input but never saw a confirmation they attached.`);
      }
    }

    // Vehicle type gates everything below it — Year/Make/Model/Mileage
    // don't even render until it's set, and going back to set it by hand
    // later can reset those fields. So this one field is a hard stop, not
    // a soft warning: if it's not confirmed selected, nothing else is
    // attempted at all.
    const vehicleTypeResult = await selectStaticOption(["Vehicle type"], VEHICLE_TYPE_OPTION);
    if (vehicleTypeResult !== true) {
      return { ok: false, error: `Could not set Vehicle type to "${VEHICLE_TYPE_OPTION}" (${vehicleTypeResult}) — stopped here so nothing downstream gets filled against a form that isn't ready for it.` };
    }

    if (vehicle.year != null) {
      const r = await selectStaticOption(["Year"], String(vehicle.year));
      if (r !== true) warnings.push(`Could not set Year (${r}).`);
    }

    // Make, Model, and Mileage only render in the DOM once Vehicle type
    // and Year are both set — give the page a moment to reveal them.
    await sleep(800);

    // Make is a dropdown (must be selected from Facebook's own catalog);
    // Model, once Make is set, is confirmed to be a plain text field —
    // typed directly rather than searched for a matching option.
    if (vehicle.make) {
      const r = await selectStaticOption(["Make"], vehicle.make);
      if (r !== true) warnings.push(`Could not set Make (${r}).`);
    }
    if (vehicle.model) {
      const modelInput = await findInputByLabel(["Model"]);
      if (!modelInput) warnings.push("Could not find the Model field on the page.");
      else setInputValue(modelInput, vehicle.model);
    }
    if (vehicle.miles != null) {
      const mileageInput = await findInputByLabel(["Mileage"]);
      if (!mileageInput) warnings.push("Could not find the Mileage field on the page.");
      else setInputValue(mileageInput, String(vehicle.miles));
    }

    const locationResult = await fillLocation();
    if (locationResult !== true) warnings.push(`Could not set Location (${locationResult}).`);

    const priceCents = vehicle.downPaymentCents ?? vehicle.askingPrice ?? 0;
    const priceInput = await findInputByLabel(["Price"]);
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
    const interiorResult = await selectStaticOption(["Interior color"], INTERIOR_COLOR);
    if (interiorResult !== true) warnings.push(`Could not set Interior color (${interiorResult}).`);

    const cleanTitleResult = checkCleanTitleBox();
    if (cleanTitleResult !== true) warnings.push(`Could not check the clean title box (${cleanTitleResult}).`);

    const conditionResult = await selectStaticOption(["Vehicle condition"], VEHICLE_CONDITION);
    if (conditionResult !== true) warnings.push(`Could not set Vehicle condition (${conditionResult}).`);

    const fuelLabel = FUEL_TYPE_LABELS[vehicle.fuelType] || "Gasoline";
    const fuelResult = await selectStaticOption(["Fuel type"], fuelLabel);
    if (fuelResult !== true) warnings.push(`Could not set Fuel type (${fuelResult}).`);

    const transmissionResult = await selectStaticOption(["Transmission"], TRANSMISSION);
    if (transmissionResult !== true) warnings.push(`Could not set Transmission (${transmissionResult}).`);

    const descriptionInput = await findInputByLabel(["Description"], "textarea");
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
    "mileage", "body style", "exterior color", "interior color", "condition",
    "fuel", "transmission", "clean title", "location",
  ];
  let groupsHandled = false;

  for (let step = 0; step < 6; step++) {
    await sleep(800);

    const unknownError = findUnhandledRequiredFieldError(KNOWN_FIELDS);
    if (unknownError) return { ok: false, error: `Reached a step this script doesn't handle yet: "${unknownError}".` };

    // Groups MUST be checked before Publish is ever clicked — the group-
    // selection UI can share its screen with the same Publish button
    // rather than living behind its own separate "Next" step, so checking
    // for Publish first (the previous order) could click straight through
    // to publishing without this ever running at all. That's exactly what
    // was happening: the listing kept publishing immediately with no
    // groups selected, because Publish was found and clicked before this
    // line ever got a turn.
    // step 0 is still the main form (before any Next has been clicked
    // this run) — its own Preview panel now legitimately shows "Houston"
    // as the resolved Location, which selectHoustonGroups could match as
    // if it were a real group. previewPanelContainer() already excludes
    // that specific text, but skipping step 0 entirely here too is a
    // second, cheap layer of the same protection: there is no real group
    // list to find before the first Next is clicked anyway.
    if (!groupsHandled && step > 0) {
      const matched = await selectHoustonGroups();
      if (matched > 0) groupsHandled = true;
    }

    const publishButton = findButtonByText(["Publish", "Post"]);
    if (publishButton) {
      simulateClick(publishButton);
      await sleep(3000);
      return {
        ok: true,
        listingUrl: extractListingUrl() ?? undefined,
        warning: groupsHandled ? undefined : "Never found any matching Houston/Katy groups to join — the listing published, but wasn't posted to any group.",
      };
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

// Houston-area keywords for matching which of the operator's Facebook
// groups to join — deliberately not limited to car-related names, since
// general community groups for this area (e.g. "Cubanos en Houston") are
// worth joining too, per the operator's own request. Add more city/suburb
// names here as needed (Katy is a Houston suburb, included the same way).
const GROUP_AREA_KEYWORDS = ["houston", "katy"];
// The operator's own cap, intentionally under Facebook's 20-group limit.
const MAX_GROUPS_TO_JOIN = 18;

// The listing's own Preview panel now legitimately shows "Houston" (the
// resolved Location value, e.g. "Houston, TX 77076" and "Listed ... in
// Houston") — a false-positive match for a "group name" that isn't a
// group at all. Finds the "Preview" heading and climbs its ancestors,
// stopping BEFORE an ancestor wide enough to be the whole page layout
// rather than just that one column — over-climbing would exclude
// everything on the page, including the real group list.
function previewPanelContainer() {
  const heading = Array.from(document.querySelectorAll("span, div, h1, h2")).find(
    (el) => el.children.length === 0 && (el.textContent || "").trim() === "Preview"
  );
  if (!heading) return null;
  let node = heading;
  for (let i = 0; i < 12 && node.parentElement; i++) {
    const next = node.parentElement;
    if (next.getBoundingClientRect().width > window.innerWidth * 0.7) break;
    node = next;
  }
  return node;
}

// Runs once, on whichever step actually shows the group list — matches
// group NAME text first (not the checkbox itself, which — per everything
// learned building the rest of this form — likely carries no reliable
// role/tag to search for on its own), then finds that row's checkbox by
// walking outward from the matched name. A step with no matching group
// names at all is not an error, just nothing to do yet, so the caller
// retries this on later steps until it finds one (or never does).
async function selectHoustonGroups() {
  const preview = previewPanelContainer();
  const nameCandidates = Array.from(document.querySelectorAll("span, div"))
    .filter((el) => el.children.length === 0 && isVisible(el))
    .filter((el) => !preview || !preview.contains(el))
    .filter((el) => {
      const text = (el.textContent || "").toLowerCase();
      return GROUP_AREA_KEYWORDS.some((k) => text.includes(k));
    });

  let matched = 0;
  const triedTargets = new Set();
  for (const nameEl of nameCandidates) {
    if (matched >= MAX_GROUPS_TO_JOIN) break;
    const target = findGroupCheckbox(nameEl);
    if (!target || triedTargets.has(target)) continue;
    triedTargets.add(target);

    // No checked/aria-checked to read (see findGroupCheckbox) — this runs
    // once per job on a fresh, all-unchecked group list, so there's no
    // "already checked, skip it" case to detect here; just click and move
    // on to the next match.
    simulateClick(target);
    await sleep(250);
    matched++;
  }
  return matched;
}

// A group row's checkbox isn't necessarily an ancestor of its own name
// text (could be a preceding sibling within the same row) — walks up from
// the name looking both at each ancestor itself and inside that
// ancestor's whole subtree, same "expand outward until something matches"
// approach as findFileInput.
function findGroupCheckbox(nameEl) {
  // A real capture showed this "checkbox" is a plain <i> icon drawn from a
  // CSS sprite (background-image + background-position) — no role, no
  // checked attribute, nothing semantic at all, the same pattern as every
  // other non-native control in this form. role="checkbox"/
  // input[type=checkbox] never existed to find here. The icon and the
  // group's name sit in separate sibling containers (two nearly identical
  // divs sharing the same class set), so this walks up from the name,
  // widening the search at each level, until it finds a sprite icon that
  // isn't part of the name's own text — stopping at the FIRST (smallest,
  // safest) level that has one, so it doesn't grab an icon belonging to a
  // different group's row further up the list.
  let row = nameEl;
  for (let i = 0; i < 8 && row; i++) {
    const icon = Array.from(row.querySelectorAll('i[data-visualcompletion="css-img"]')).find((el) => !nameEl.contains(el));
    if (icon) return icon.parentElement || icon;
    row = row.parentElement;
  }
  return null;
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
// text like "Price (required)"). Retries with a scroll between attempts —
// fields further down this long form aren't necessarily rendered until
// scrolled near, so a field that isn't found on the first try isn't
// necessarily missing, just not there yet.
async function findInputByLabel(candidates, tag = "input") {
  for (let attempt = 0; attempt < 6; attempt++) {
    const els = Array.from(document.querySelectorAll(tag));
    const found = els.find((el) => {
      const haystack = [el.getAttribute("aria-label"), el.getAttribute("placeholder"), labelTextFor(el)].filter(Boolean).join(" ").toLowerCase();
      // Plain substring matching let "make" match Facebook's own top-nav
      // search box (placeholder "Search Marketplace" — "make" is a literal
      // substring of "Marketplace") — seen in testing swallowing both the
      // Make and Model values into that one box instead of their own
      // fields. Word-boundary matching only matches "make" as its own word.
      return candidates.some((c) => wordBoundaryIncludes(haystack, c.toLowerCase()));
    });
    if (found) return found;
    window.scrollBy(0, 500);
    await sleep(300);
  }
  return undefined;
}

function wordBoundaryIncludes(haystack, word) {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(haystack);
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
// and as the open-step of the typeahead fields. Retries with a scroll
// between attempts, same reasoning as findInputByLabel: a field further
// down this long form may just not be rendered yet.
async function findFieldTrigger(candidates) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const all = Array.from(document.querySelectorAll("div, input"));
    const matches = all.filter((el) => {
      if (!isVisible(el)) return false;
      const text = (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.textContent || "").trim().toLowerCase();
      return candidates.some((c) => text === c.toLowerCase() || text.startsWith(c.toLowerCase()));
    });
    if (matches.length > 0) {
      // .textContent falls back to a div's whole subtree, so a big
      // ancestor wrapping the real trigger (and everything after it) can
      // ALSO start with the same label text and would otherwise be
      // matched first, since document order puts ancestors before their
      // descendants — clicking that ancestor instead of the actual small
      // trigger looks like nothing happened. Picking the most specific
      // (fewest descendants) match, same approach as findBestTextMatch,
      // lands on the real control instead.
      const mostSpecific = matches.reduce((best, el) => (el.querySelectorAll("*").length < best.querySelectorAll("*").length ? el : best));
      // But the MOST specific element can overshoot too: Year/Make/Body
      // style/colors/condition/fuel type all confirmed "clicking this
      // field never appeared to open anything" — consistent with the most
      // specific match being a bare, non-interactive label span sitting
      // INSIDE the real clickable control (a common floating-label input
      // pattern), one or two levels below it. Vehicle type apparently has
      // no such wrapper — its label IS the clickable element — so walking
      // up from it just returns itself immediately. Only ever walks
      // upward, never sideways, so this can't drift onto some unrelated
      // bigger ancestor the way the plain "most specific" pick alone did.
      return nearestInteractiveAncestor(mostSpecific);
    }
    window.scrollBy(0, 500);
    await sleep(300);
  }
  return null;
}

function isLikelyInteractive(el) {
  if (["BUTTON", "INPUT", "SELECT", "A"].includes(el.tagName)) return true;
  const role = el.getAttribute("role");
  if (role === "button" || role === "combobox" || role === "listbox" || role === "option") return true;
  return el.hasAttribute("tabindex");
}

function nearestInteractiveAncestor(el) {
  let node = el;
  for (let i = 0; i < 5 && node; i++) {
    if (isLikelyInteractive(node)) return node;
    node = node.parentElement;
  }
  return el; // nothing looked interactive nearby — click the original match, unchanged
}

// A plain .click() only fires a synthetic MouseEvent — some React
// components listen for the full real sequence (pointerdown/mousedown/
// mouseup) rather than just "click", so this dispatches all of them.
function simulateClick(el) {
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
}

// For the ARIA combobox pattern (role="combobox" aria-haspopup="listbox")
// seen in a real capture — Enter/Space/ArrowDown are the standard keys
// that open one for keyboard users, alongside (not instead of) a click.
function dispatchKey(el, key) {
  const opts = { key, bubbles: true, cancelable: true };
  el.dispatchEvent(new KeyboardEvent("keydown", opts));
  el.dispatchEvent(new KeyboardEvent("keyup", opts));
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
  // Interior color kept matching and clicking "Black", yet stayed blank —
  // traced to Exterior color (a field of the exact same shape, run right
  // before it) already showing "Black" as ITS OWN selected value, which is
  // just as exact and just as minimal a match as the real option sitting
  // inside Interior color's freshly opened list. Preferring whatever's
  // actually inside a currently open [role="listbox"] — which only exists
  // while a popup is genuinely showing — resolves that ambiguity, since a
  // field's own already-selected value is never inside one.
  const insideOpenListbox = all.filter((el) => el.closest('[role="listbox"]'));
  const candidates = insideOpenListbox.length > 0 ? insideOpenListbox : all;
  return candidates.reduce((best, el) => (el.querySelectorAll("*").length < best.querySelectorAll("*").length ? el : best));
}

// A short list of what's currently visible on screen, for when a match
// fails — included in the error so the next failure report can name the
// actual option text Facebook is showing without needing another
// screenshot round-trip.
// minTop, when given, drops anything above that vertical position —
// without it, a page-wide sample is dominated by Facebook's own nav/
// notifications chrome (which sorts first in DOM order and is a fixed
// set of ~10 strings repeated on every page), crowding out whatever
// actually sits near the field this is diagnosing.
function visibleTextSample(max = 15, minTop = -Infinity) {
  const texts = Array.from(document.querySelectorAll("span, div"))
    .filter((el) => el.children.length === 0 && isVisible(el) && el.getBoundingClientRect().top >= minTop)
    .map((el) => (el.textContent || "").trim())
    .filter((t) => t.length > 0 && t.length < 40);
  return [...new Set(texts)].slice(0, max).join(", ");
}

// Facebook shows a "N photos attached" (or similar) count once its upload
// widget actually processes the files — polls for that instead of trusting
// that dispatching the input's change/drop events was enough on its own.
async function waitForPhotosAttached(expectedCount) {
  const pattern = new RegExp(`${expectedCount}\\s*(photo|video)`, "i");
  for (let attempt = 0; attempt < 8; attempt++) {
    if (pattern.test(visibleTextSample(60))) return true;
    await sleep(400);
  }
  return false;
}

function findOpenListbox() {
  const listboxes = Array.from(document.querySelectorAll('[role="listbox"]')).filter(isVisible);
  return listboxes.find((el) => el.scrollHeight > el.clientHeight + 10) || null;
}

// A real <select> rarely carries an aria-label/associated <label> in a
// form like this — but its own placeholder option (the first, disabled
// one, shown before anything is chosen — e.g. an unselected Year field
// literally displays the word "Year") almost always matches the field's
// visible name, so that's checked too, not just the usual label sources.
async function findNativeSelect(candidates) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const selects = Array.from(document.querySelectorAll("select")).filter(isVisible);
    const found = selects.find((el) => {
      const placeholderOptionText = el.options.length > 0 ? (el.options[0].textContent || "").trim() : "";
      const haystack = [el.getAttribute("aria-label"), labelTextFor(el), placeholderOptionText].filter(Boolean).join(" ").toLowerCase();
      return candidates.some((c) => wordBoundaryIncludes(haystack, c.toLowerCase()));
    });
    if (found) return found;
    window.scrollBy(0, 500);
    await sleep(300);
  }
  return null;
}

// Same React-controlled-value problem as setInputValue, but a <select>
// has no single text value to set — the matching <option>'s own value
// has to be looked up by its visible text first.
function setNativeSelectByText(select, optionText) {
  const wanted = optionText.trim().toLowerCase();
  const options = Array.from(select.options);
  const match = options.find((o) => (o.textContent || "").trim().toLowerCase() === wanted);
  if (!match) return `no <option> matched "${optionText}" — this dropdown's options were: ${options.map((o) => (o.textContent || "").trim()).join(", ")}`;

  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
  setter.call(select, match.value);
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

// For dropdown fields (Vehicle type, Year, Make, Body style, Exterior/
// Interior color, Vehicle condition, Fuel type, Transmission) — click the
// trigger, then click the option whose text matches exactly. Some of
// these (Year, Make) turn out to open a live search input rather than a
// pre-rendered list, same as Location — if one appears after opening,
// type the value into it first so a search-backed field's option
// actually gets rendered to click. Retries for a few seconds rather than
// checking once, since a single fixed delay was missing Facebook's popup
// on a real device depending on how long it took to render that time.
// Returns true, or a string describing what went wrong.
async function selectStaticOption(triggerCandidates, optionText) {
  // Interior color kept matching and clicking a "Black" option, yet the
  // field stayed blank — a real capture showed why: Exterior color (run
  // immediately before it, same kind of color-list popup) never got
  // explicitly closed, so the still-open Exterior popup's own "Black"
  // option was what actually got found and clicked, not anything belonging
  // to Interior color's own (never-opened) list. Escape closes out
  // whatever the previous field left open before this one starts looking
  // for its own trigger — a no-op if nothing was open.
  document.activeElement?.dispatchEvent?.(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await sleep(300);

  // Year/Make/Body style/Exterior/Interior color/Vehicle condition/Fuel
  // type failed identically every single time, no matter how long this
  // retried — the click-and-search-the-page-for-a-popup approach below
  // can never work on a real native <select>, because its option list is
  // rendered by the browser/OS itself, entirely outside the page's DOM,
  // so there's nothing here to ever find. Vehicle type and Transmission
  // (which DID work) are presumably Facebook's own custom popup widget,
  // not a native select — so this checks for a real <select> first and
  // only falls through to the popup-search approach if there isn't one.
  const nativeSelect = await findNativeSelect(triggerCandidates);
  if (nativeSelect) return setNativeSelectByText(nativeSelect, optionText);

  const trigger = await findFieldTrigger(triggerCandidates);
  // Two guesses at this field's failure (typeahead-style search input,
  // then native <select>) have both come back wrong, so rather than try
  // a third guess blind, this dumps what's actually on the page right
  // now — every <select> and its placeholder text — directly into the
  // error, so the next report says what's really there instead of this
  // needing another screenshot round-trip to find out.
  if (!trigger) return `could not find the field to click — ${selectDiagnostics()}`;
  // Captured BEFORE the click so the input-typing fallback below only ever
  // fires for a field that actually changed focus as a RESULT of this
  // click — otherwise some unrelated input that already happened to have
  // focus (left over from a previous field, or Facebook's own chrome)
  // could get this option's text typed into it instead, for a field that
  // was never meant to be typed into at all (Vehicle type, Body style,
  // colors, condition, fuel type are all fixed lists, not search boxes).
  const previouslyFocused = document.activeElement;

  // A real capture of this exact markup (an unselected Year field) showed
  // a plain <div><span>2010</span></div> with NO role, NO tabindex, NOT
  // even a real onclick attribute — Facebook's own atomic-CSS components
  // can attach a click handler in React with nothing at all visible in
  // the rendered DOM to say so. There's no semantic marker left to guess
  // from, so instead of picking one element to click, this clicks the
  // matched label, then walks up its ancestors one at a time, checking
  // after each click whether anything actually happened — stopping at the
  // first level that visibly opens a popup/listbox or moves focus onto an
  // input. Only walks upward, capped at 5 levels, same bound as
  // findFieldTrigger's own interactive-ancestor check.
  let opened = false;
  for (let level = 0, node = trigger; level < 5 && node; level++, node = node.parentElement) {
    simulateClick(node);
    // A real capture showed a wrapper marked data-interactable="|keydown|"
    // around this exact combobox — Facebook's own hint that this widget
    // expects a keyboard interaction, not just a click. Focusing it and
    // pressing Enter is the standard way an ARIA combobox
    // (aria-haspopup="listbox") opens for keyboard users, so this tries
    // that too at every level, in case a given ancestor only wired up one
    // of the two.
    node.focus?.();
    dispatchKey(node, "Enter");
    await sleep(500);
    if (
      // A real capture showed Facebook marking these fields explicitly:
      // <label role="combobox" aria-haspopup="listbox" aria-expanded="false">
      // — checking whether the clicked node itself flips to "true" is a
      // cleaner, more direct signal than inferring it from side effects,
      // whenever this particular ancestor happens to be that element.
      node.getAttribute?.("aria-expanded") === "true" ||
      findOpenListbox() ||
      visibleOptionElements().length > 0 ||
      (document.activeElement && document.activeElement !== previouslyFocused && document.activeElement.tagName === "INPUT")
    ) {
      opened = true;
      break;
    }
  }

  // fillLocation (which works) falls back to findInputByLabel when focus
  // didn't land on a plain <input> — this same fallback was missing here,
  // so a field whose combobox doesn't move real DOM focus onto an <input>
  // (rather than, say, a contenteditable or a nested element) never got
  // anything typed into it at all.
  const activeInput =
    document.activeElement && document.activeElement !== previouslyFocused && document.activeElement.tagName === "INPUT"
      ? document.activeElement
      : await findInputByLabel(triggerCandidates);
  if (activeInput) setInputValue(activeInput, optionText);

  // Tracks whether ANYTHING resembling an open popup was ever observed
  // during the retries below, regardless of whether it contained a
  // matching option — distinguishes "the trigger click never opens
  // anything" from "it opens, just never with the text expected", which
  // otherwise look identical from the outside (both end in the same "no
  // option matched" outcome) but need very different fixes.
  let sawAnyPopupActivity = opened || !!activeInput;

  // Auction wifi is unreliable (see CLAUDE.md) — a slow connection can
  // leave a popup's options rendering well past what a single quick check
  // would tolerate, so this retries for several seconds rather than
  // giving up fast.
  for (let attempt = 0; attempt < 12; attempt++) {
    const match = findBestTextMatch(optionText);
    if (match) {
      simulateClick(match);
      await sleep(400);
      // A click on the right-looking option isn't proof it landed —
      // confirm the trigger itself now displays the chosen value before
      // calling this a success, since a mis-clicked or ignored click
      // leaves the field looking untouched.
      if (await confirmSelected(trigger, triggerCandidates, optionText)) return true;
      await sleep(400);
      if (await confirmSelected(trigger, triggerCandidates, optionText)) return true;
      return `clicked "${optionText}" but the field still doesn't show it selected`;
    }
    if (visibleOptionElements().length > 0) sawAnyPopupActivity = true;
    const popup = findOpenListbox();
    if (popup) {
      sawAnyPopupActivity = true;
      popup.scrollTop += popup.clientHeight;
    }
    await sleep(450);
  }
  if (!sawAnyPopupActivity) {
    return `clicking this field never appeared to open anything (no popup, no listbox, no input gained focus) — ${selectDiagnostics(trigger)}`;
  }
  return `something opened but no option matched "${optionText}" — ${selectDiagnostics(trigger)}`;
}

// Every <select> currently on the page plus its placeholder (first)
// option's text — e.g. an unselected Year field's <select> shows "Year"
// as that placeholder — so a failure report says exactly what candidate
// label text would have actually matched, instead of guessing again.
// `near`, when given, biases the visible-text sample toward whatever's at
// or below that element's position on screen — a flat page-wide sample is
// dominated by Facebook's own nav/notifications chrome (which sorts first
// in DOM order), which is what happened in testing: every failure's
// "visible text" looked identical and useless, always the same nav junk,
// never the actual field content sitting right below the trigger that was
// just clicked.
function selectDiagnostics(near) {
  const selects = Array.from(document.querySelectorAll("select"))
    .filter(isVisible)
    .map((el) => `"${el.options.length > 0 ? (el.options[0].textContent || "").trim() : "(no options)"}"`);
  const sample = near ? visibleTextSample(60, near.getBoundingClientRect().top) : visibleTextSample();
  return `selects on page: [${selects.join(", ") || "none"}] — visible text: ${sample}`;
}

function triggerShowsValue(trigger, optionText) {
  const shown = (trigger.getAttribute("aria-label") || trigger.textContent || "").trim().toLowerCase();
  return shown.includes(optionText.trim().toLowerCase());
}

// Interior color reported "clicked Black but the field still doesn't show
// it selected" — a real click on a real match, just never confirmed.
// Likely cause: selecting a value can make Facebook re-render this
// combobox as a brand new DOM node rather than mutating the one already
// captured as `trigger` (React does this often for controlled selects
// whose display changes shape) — checking the OLD node's textContent
// forever, after the live page replaced it, would explain a real
// selection reading as permanently unconfirmed. If the captured node is
// no longer attached to the page, this re-finds the field fresh and
// checks that instead, before giving up.
async function confirmSelected(trigger, triggerCandidates, optionText) {
  if (triggerShowsValue(trigger, optionText)) return true;
  if (document.body.contains(trigger)) return false;
  const fresh = await findFieldTrigger(triggerCandidates);
  return !!fresh && triggerShowsValue(fresh, optionText);
}

function visibleOptionElements() {
  return Array.from(document.querySelectorAll('[role="option"], [role="listbox"] *')).filter((el) => isVisible(el) && (el.textContent || "").trim().length > 0);
}

// Typing the zip alone leaves raw digits in the box instead of a real,
// structured location — Facebook resolves it to a city suggestion (e.g.
// "Houston, TX 77076") a moment later, and that suggestion has to actually
// be clicked, not just left as typed text.
async function fillLocation() {
  const trigger = await findFieldTrigger(["Location"]);
  if (!trigger) return "could not find the field to click";
  simulateClick(trigger);
  await sleep(400);

  const activeInput = document.activeElement && document.activeElement.tagName === "INPUT" ? document.activeElement : await findInputByLabel(["Location"]);
  if (!activeInput) return "could not find a text input after opening the field";
  setInputValue(activeInput, LOCATION_QUERY);

  // Auction wifi is unreliable (see CLAUDE.md) — reported failing
  // intermittently, with the typed text left unresolved (and, with the
  // zip, Facebook outright rejecting it as "not a valid location") rather
  // than ever showing a matching suggestion, which is exactly what a slow
  // suggestion fetch on a given attempt would look like. Longer retry
  // budget (was 8×350ms, now 14×500ms — ~7s total) rather than assuming
  // it's just a one-off glitch nothing can be done about.
  let sawAnySuggestion = false;
  for (let attempt = 0; attempt < 14; attempt++) {
    const options = visibleOptionElements();
    if (options.length > 0) sawAnySuggestion = true;
    const cityMatch = options.find((el) => /houston/i.test(el.textContent || ""));
    if (cityMatch) {
      simulateClick(cityMatch);
      await sleep(300);
      if (locationLooksResolved(activeInput)) return true;
    }
    await sleep(500);
  }

  // Only try the keyboard fallback (ArrowDown to highlight, Enter to
  // pick) if a suggestion list was actually seen at some point — pressing
  // Enter with nothing ever rendered just commits the raw typed text as
  // free text instead of a real selected place, which is exactly what
  // produced Facebook's "Please enter a valid location" rejection in
  // testing. No suggestions ever showing up at all is a real failure to
  // report, not something a blind Enter should paper over.
  if (sawAnySuggestion) {
    dispatchKey(activeInput, "ArrowDown");
    await sleep(300);
    dispatchKey(activeInput, "Enter");
    await sleep(500);
    if (locationLooksResolved(activeInput)) return true;
  }

  return `no "Houston" suggestion could be confirmed selected for "${LOCATION_QUERY}" — visible text was: ${visibleTextSample()}`;
}

// A resolved location replaces the raw typed zip with the real place
// name Facebook picked (e.g. "Houston, TX 77076") — checking for that
// instead of just "a click happened" catches a click that landed but
// didn't actually register, the same false-success risk confirmSelected
// exists to catch elsewhere.
function locationLooksResolved(input) {
  return /houston/i.test(input.value || "");
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
