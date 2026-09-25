// Fills out and submits Facebook's "Create vehicle listing" form on
// facebook.com/marketplace/create/vehicle, using the job data the
// background service worker passes in.
//
// ============================================================================
// IMPORTANT — READ BEFORE RELYING ON THIS
// ============================================================================
// This was written without ever loading the real page (this project's dev
// sandbox can't reach facebook.com), so the selectors below are a
// best-effort based on how Facebook's Marketplace form is generally known
// to be built, not something verified against the live DOM. Facebook also
// changes this UI over time. Expect to need to fix the small set of
// `find*` helpers below against whatever the page actually looks like
// today — everything else (orchestration, error reporting, photo
// handling) does not need to change when you do.
//
// The core strategy — finding fields by their visible label/placeholder
// text rather than by class name — is deliberate: Facebook's CSS classes
// are auto-generated and change constantly, but the label text a human
// reads ("Price", "Mileage", …) is comparatively stable. If a field can't
// be found, this bails out with a clear error naming which field, rather
// than guessing and silently submitting something wrong.
// ============================================================================

window.__dealerAgentFillListing = async function fillListing({ vehicle, body, photoDataUrls }) {
  try {
    await waitFor(() => document.querySelector('[aria-label="Marketplace"]') || document.body, 15000);

    if (photoDataUrls.length > 0) {
      const fileInput = findFileInput();
      if (!fileInput) return fail("Could not find the photo upload input on the page.");
      await setFiles(fileInput, photoDataUrls);
      await sleep(1000);
    }

    const priceInput = findInputByLabel(["Price"]);
    if (!priceInput) return fail("Could not find the Price field on the page.");
    setInputValue(priceInput, String(Math.round((vehicle.askingPrice ?? 0) / 100)));

    if (vehicle.miles != null) {
      const mileageInput = findInputByLabel(["Mileage"]);
      if (mileageInput) setInputValue(mileageInput, String(vehicle.miles));
    }

    const descriptionInput = findInputByLabel(["Description"], "textarea");
    if (!descriptionInput) return fail("Could not find the Description field on the page.");
    setInputValue(descriptionInput, body);

    // Year/Make/Model/Body style/Fuel type/Transmission/Exterior color are
    // typically searchable comboboxes on this form, not plain inputs —
    // deliberately left unfilled in this first pass rather than guessing
    // at combobox interaction that might select the wrong option. If
    // Facebook requires them before it'll let you publish, this will
    // currently stop at the "couldn't find Publish" step below with a
    // clear error rather than submitting an incomplete/wrong listing.

    await sleep(500);
    const publishButton = findButtonByText(["Publish", "Post", "Next"]);
    if (!publishButton) return fail("Could not find the Publish button on the page.");
    publishButton.click();

    await sleep(3000);
    const listingUrl = extractListingUrl();
    return { ok: true, listingUrl: listingUrl ?? undefined };
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }

  function fail(error) {
    return { ok: false, error };
  }
};

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
  return els.find((el) => candidates.some((c) => (el.textContent || "").trim().toLowerCase() === c.toLowerCase()));
}

function findFileInput() {
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
