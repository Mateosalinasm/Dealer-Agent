import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { formatCents } from "@/lib/utils";
import { copilotConfigured } from "@/lib/deal-copilot";
import type { bodyType, fuelType, marketingLanguage, marketingPlatform } from "@/schema-sketch/schema";

const MODEL = "claude-sonnet-5";

export const PLATFORM_LABELS: Record<(typeof marketingPlatform)[number], string> = {
  facebook_marketplace: "Facebook Marketplace",
  facebook_post: "Facebook post",
  instagram_caption: "Instagram caption",
  tiktok_caption: "TikTok caption",
};

export const LANGUAGE_LABELS: Record<(typeof marketingLanguage)[number], string> = {
  es: "Spanish",
  en: "English",
};

export interface VehicleForMarketing {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  color: string | null;
  askingPrice: number | null; // cents
  bodyType: (typeof bodyType)[number] | null;
  fuelType: (typeof fuelType)[number];
  isThreeRowSuv: boolean;
}

/**
 * "Starting from" down payment, in cents — a business rule from the
 * finance manager, applied the exact same way every time. Never
 * generated, guessed, or adjusted by the AI copy generator; never
 * inferred from model/trim text either (too unreliable for a figure that
 * lands in a customer-facing ad — fuelType/isThreeRowSuv are set
 * explicitly on the vehicle instead). Returns null if bodyType isn't set,
 * since there's no rule to fall back to.
 */
export function downPaymentCentsFor(v: VehicleForMarketing): number | null {
  if (!v.bodyType) return null;
  const year = v.year ?? 0;
  if (v.bodyType === "sedan") return year >= 2023 ? 250_000 : 200_000;
  if (v.bodyType === "suv") return v.isThreeRowSuv ? 300_000 : 250_000;
  // truck
  return v.fuelType === "diesel" && year > 2020 ? 500_000 : 350_000;
}

/**
 * Reads back the down payment figure actually printed in a generated (or
 * since hand-edited) listing body — not a second, independent guess at the
 * number the way downPaymentCentsFor's own doc comment warns against.
 * Rule #3 in the system prompt below guarantees the down payment is the
 * ONLY dollar figure a listing body ever states, so the first one found is
 * it. This exists because the body can drift from what
 * downPaymentCentsFor(vehicle) computes today — written before a tier-rule
 * change, or edited by hand — and the auto-poster's Price field has to
 * match what the ad itself actually says, never a different number from
 * the same listing. Returns null if the body has no dollar figure at all.
 */
export function extractDownPaymentCentsFromBody(body: string): number | null {
  const match = body.match(/\$\s?([\d,]+(?:\.\d{2})?)/);
  if (!match) return null;
  const dollars = parseFloat(match[1].replace(/,/g, ""));
  if (!Number.isFinite(dollars)) return null;
  return Math.round(dollars * 100);
}

const SYSTEM_PROMPT = `You write vehicle-for-sale marketing copy for a single "buy here, pay here"
-style dealership's own social media and marketplace posts, focused on the Hispanic community.
You are given real facts about one vehicle and a down payment figure that the dealership has
already computed with its own pricing rules — never recompute, adjust, round, or second-guess
that figure.

Hard rules — never break these:
1. Only use the vehicle facts you are given (year, make, model, trim, color) plus the down payment
   figure. Never invent a feature, package, trim level, or condition detail that wasn't provided.
2. NEVER mention the vehicle's title status or condition history, and never say or imply anything
   about salvage, rebuilt, flood, insurance-loss, lemon, or branded titles — leave title out of the
   post entirely, in every language.
3. NEVER mention mileage, odometer reading, or how many miles the vehicle has.
4. Always state the down payment as exactly the figure you were given, always phrased as
   "starting from" / "desde" (e.g. "Desde $2,500 de down") — never as a flat, fixed, negotiable, or
   different amount. The down payment is the ONLY dollar figure that ever appears anywhere in the
   post — never state, imply, or hint at a total price, asking price, sticker price, sale price, or
   "out the door" figure, in any language.
5. The only requirements to list are exactly these four, never more or fewer:
   (a) ID — accepted forms include a passport, so phrase this so passport-only applicants aren't
       told they don't qualify (e.g. "ID (incluye pasaporte)" / "ID (passport accepted)"), never
       say a US ID or driver's license specifically is required
   (b) proof of income
   (c) the down payment
   (d) an open bank account (e.g. "cuenta de banco abierta" / "an open bank account")
   Do not mention SSN, credit score/history, or a driver's license one way or the other — don't
   claim they're required and don't claim they aren't.
6. Match the length and format convention of the requested platform:
   - Facebook Marketplace: a structured classified-style listing, can run longer.
   - Facebook post: a casual social caption, medium length.
   - Instagram caption: shorter, emoji-forward, a few relevant hashtags at the end.
   - TikTok caption: very short, punchy hook, a few trending-style hashtags.
7. Write in the requested language, in a warm, direct, slightly urgent buy-here-pay-here tone —
   emojis where they fit (🔥💰✔️📩 and similar), a clear call to action (message to ask questions
   or schedule a test drive; mention they can drive out the same day if that fits the platform's
   length).
8. Output only the finished post text, ready to paste as-is — no preamble, no explanation, no
   markdown formatting markers, no surrounding quotation marks.`;

export interface GenerateListingResult {
  ok: boolean;
  text?: string;
  error?: string;
}

export async function generateListingCopy(params: {
  vehicle: VehicleForMarketing;
  platform: (typeof marketingPlatform)[number];
  language: (typeof marketingLanguage)[number];
}): Promise<GenerateListingResult> {
  if (!copilotConfigured()) {
    return { ok: false, error: "AI listing generation isn't connected yet — add ANTHROPIC_API_KEY to .env.local." };
  }

  const { vehicle, platform, language } = params;
  const downPaymentCents = downPaymentCentsFor(vehicle);
  if (downPaymentCents == null) {
    return { ok: false, error: "Set this vehicle's body type before generating a listing — the down payment depends on it." };
  }

  // Asking price is deliberately never sent as a fact here — the down
  // payment (below) is the only dollar figure this listing is allowed to
  // state, and a model given the asking price has nothing forbidding it
  // from also mentioning that.
  const facts = [
    vehicle.year != null && `Year: ${vehicle.year}`,
    vehicle.make && `Make: ${vehicle.make}`,
    vehicle.model && `Model: ${vehicle.model}`,
    vehicle.trim && `Trim: ${vehicle.trim}`,
    vehicle.color && `Color: ${vehicle.color}`,
  ]
    .filter(Boolean)
    .join("\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Platform: ${PLATFORM_LABELS[platform]}\nLanguage: ${LANGUAGE_LABELS[language]}\nDown payment — state exactly this figure, "starting from": ${formatCents(downPaymentCents)}\n\nVehicle facts:\n${facts}`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "The model didn't return text — try again." };
    }
    return { ok: true, text: textBlock.text.trim() };
  } catch (err) {
    return { ok: false, error: `Listing generation failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
