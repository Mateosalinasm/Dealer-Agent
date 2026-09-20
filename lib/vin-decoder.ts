import "server-only";

// NHTSA's vPIC VIN decoder — free, no API key, no rate-limit key required.
// https://vpic.nhtsa.dot.gov/api/. Good enough to pre-fill year/make/model/
// trim from a VIN alone, no AutoCheck upload needed for that part.
//
// Couldn't verify this actually reaches NHTSA from inside the sandbox this
// was built in — the sandbox's outbound proxy only allow-lists a fixed set
// of domains (npm, PyPI, Anthropic's own APIs, etc.) and returns 403 for
// anything else, vpic.nhtsa.dot.gov included. That's a property of this
// dev sandbox, not of the deployed app — Vercel has normal outbound
// internet access — but it means this needs a real check once deployed
// (or from a local dev machine off this sandbox) before trusting it.

export interface DecodedVin {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  bodyType: "truck" | "sedan" | "suv" | null;
}

export interface VinDecodeResult {
  ok: boolean;
  data?: DecodedVin;
  error?: string;
}

function guessBodyType(bodyClass: string | null | undefined): DecodedVin["bodyType"] {
  if (!bodyClass) return null;
  const lower = bodyClass.toLowerCase();
  if (lower.includes("pickup") || lower.includes("truck")) return "truck";
  if (lower.includes("suv") || lower.includes("sport utility") || lower.includes("crossover")) return "suv";
  if (lower.includes("sedan") || lower.includes("hatchback") || lower.includes("coupe") || lower.includes("convertible") || lower.includes("wagon")) return "sedan";
  return null;
}

export async function decodeVin(vinRaw: string): Promise<VinDecodeResult> {
  const vin = vinRaw.trim().toUpperCase();
  if (vin.length !== 17) {
    return { ok: false, error: "A VIN is 17 characters." };
  }

  try {
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(vin)}?format=json`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { ok: false, error: `NHTSA returned ${res.status} — try again in a moment.` };
    }
    const json = await res.json();
    const result = json?.Results?.[0];
    if (!result) {
      return { ok: false, error: "No data came back for this VIN." };
    }
    if (result.ErrorCode && result.ErrorCode !== "0") {
      return { ok: false, error: result.ErrorText || "Couldn't decode this VIN — check it and try again." };
    }
    if (!result.Make && !result.ModelYear) {
      return { ok: false, error: "NHTSA doesn't have data for this VIN." };
    }

    return {
      ok: true,
      data: {
        year: result.ModelYear ? Number(result.ModelYear) : null,
        make: result.Make || null,
        model: result.Model || null,
        trim: result.Trim || null,
        bodyType: guessBodyType(result.BodyClass),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
