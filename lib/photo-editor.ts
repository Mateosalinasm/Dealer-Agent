import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { VehiclePhotoEditSettings, vehiclePhotoBackgroundValues } from "@/schema-sketch/schema";

const MODEL = "gemini-2.5-flash-image";

const SUPPORTED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// Realistic settings a Houston-area dealership could plausibly shoot a car
// in front of — picked for variety (open field, urban, water, dramatic
// light, neutral studio) while staying unobtrusive: nothing here is meant
// to upstage the vehicle. Each description feeds straight into the prompt
// alongside the shared grounding/lighting-match/plate-removal instructions
// in buildEditPrompt, so it only needs to describe the *setting* itself.
const BACKGROUND_PROMPTS: Record<(typeof vehiclePhotoBackgroundValues)[number], string> = {
  grass_lot:
    "a realistic, professional empty grass lot: clean well-maintained grass, open space, natural horizon",
  paved_lot_wall:
    "a clean, empty paved asphalt lot with a plain neutral wall (light gray, tan, or brick) behind the vehicle — no " +
    "signage, graffiti, murals, or other markings on the wall",
  sunset_sky:
    "an open outdoor setting at golden hour with a vivid sunset sky filling the background — rich, varied " +
    "orange/pink/purple/blue tones with real color separation between them, not a flat overall sepia or brown " +
    "wash, open flat ground beneath the vehicle, no buildings crowding the frame",
  houston_skyline:
    "an open paved or grass lot with the Houston downtown skyline softly visible in the distance, gently out of " +
    "focus so it reads as atmosphere rather than a distraction",
  lakeside:
    "a calm lakeside or bayou setting typical of the Houston area — still water and trees in the background, open " +
    "ground at the water's edge where the vehicle sits",
  studio_gradient:
    "a clean professional two-tone studio backdrop — not one single flat color. A smooth, evenly lit light " +
    "gray-to-white wall behind the vehicle, meeting the ground at a soft seamless curve where the floor turns " +
    "distinctly darker than the wall — a deep charcoal-to-black floor, giving clear visual separation between " +
    "wall and floor like a real photography studio cove. No visible horizon or outdoor elements",
};

export interface PhotoEditResult {
  ok: boolean;
  imageBuffer?: Buffer;
  mimeType?: string;
  error?: string;
}

// One prompt, assembled from the finance manager's own spec for what a
// dealership listing photo should look like, gated by the same toggles the
// editing panel exposes (components/vehicle-photo-editor.tsx) — a toggle
// that's off just isn't mentioned to the model rather than being told
// "don't do X", since a positive instruction set edits more reliably than
// a mix of dos and don'ts on an image model.
function buildEditPrompt(settings: VehiclePhotoEditSettings): string {
  const sections: string[] = [];

  sections.push(
    `You are editing a single vehicle photo for a car dealership's inventory listing. The vehicle is the ` +
      `primary subject and MUST remain visually accurate: do not change its make, model, year, trim, body ` +
      `style, wheels, headlights, taillights, grille, badges, emblems, mirrors, windows, tires, proportions, ` +
      `paint color, or condition (keep genuine scratches, dents, and wear unless told otherwise). Do not add ` +
      `or remove vehicle features or make it look artificially new. Keep its exact shape and proportions. You ` +
      `are editing the environment and photographic presentation of this exact vehicle, not redesigning it.`,
  );

  sections.push(
    `If this is an interior photo (dashboard, seats, console), do NOT replace it with an exterior background ` +
      `— preserve the actual interior, correct its exposure and white balance, increase clarity and detail, ` +
      `reduce noise, and improve dynamic range so it looks professionally photographed. Otherwise, treat it as ` +
      `an exterior photo and apply the rest of these instructions.`,
  );

  if (!settings.preserveOriginalBackground) {
    const isStudio = settings.background === "studio_gradient";
    const isSunset = settings.background === "sunset_sky";
    sections.push(
      `Detect and isolate the vehicle from its original background. Replace the background with ` +
        `${BACKGROUND_PROMPTS[settings.background]}. No other vehicles, no people, no dealership signs, no ` +
        `distracting clutter. Match the original photo's perspective and camera angle. ` +
        (isStudio
          ? `Light it with soft, even studio lighting rather than trying to replicate outdoor sun.`
          : isSunset
            ? `Use warm late-day sunset light on the sky and ground, but keep the vehicle itself brightly and ` +
              `clearly lit — expose the vehicle noticeably brighter and more clearly than the ambient background, ` +
              `as if it has its own supplemental fill light, not lit only by the dim ambient sunset glow. Do not ` +
              `let the vehicle go dark, murky, or silhouetted, and do not let an overall sepia/brown color cast ` +
              `wash over it — its paint color must stay true and clearly readable even under the warm light.`
            : `Match the lighting direction, softness, and approximate time of day from the original photo — if it ` +
              `was shot in sunlight, match the sun direction and shadow direction; if overcast, use soft light with ` +
              `no hard shadows.`) +
        ` The vehicle must look physically present in the new environment, not pasted on: generate realistic ` +
        `contact shadows under the vehicle, tire shadows, subtle ambient occlusion, and ground reflections ` +
        `where appropriate. Tires must never appear to float. Realism target for this background swap is ` +
        `about ${settings.backgroundRealism}/100 — higher means it should be indistinguishable from a real ` +
        `photograph taken on location, not an obviously AI-generated backdrop.` +
        (settings.removeLicensePlate
          ? ` Automatically detect any license plate visible on the vehicle and completely remove the ` +
            `identifying plate information, replacing it with a realistic neutral plate area that matches the ` +
            `bumper's mounting area, lighting, shadows, reflections, and perspective — no readable numbers, ` +
            `letters, state names, or logos. If there's no plate visible, don't modify that area unnecessarily.`
          : ""),
    );
  } else {
    sections.push(
      `Keep the original background exactly as photographed — do not replace or alter the environment, only ` +
        `improve the photograph itself per the instructions below.` +
        (settings.removeLicensePlate
          ? ` Still automatically detect and remove any visible license plate the same way: replace it with a ` +
            `realistic neutral plate area matching the mounting area, lighting, and perspective, with no ` +
            `readable identifying information.`
          : ""),
    );
  }

  sections.push(
    `Improve composition while preserving the vehicle exactly as photographed: professionally positioned, the ` +
      `entire vehicle visible whenever possible, minimal unnecessary empty space, a straight horizon, balanced ` +
      `framing, natural camera height. Never crop off part of the vehicle. Favor a clean 3/4 front or 3/4 rear ` +
      `presentation when the source composition allows it without material re-cropping.`,
  );

  if (settings.turnOnVehicleLights) {
    sections.push(
      `If the vehicle's headlights, taillights, or daytime running lights appear off in the original photo, turn ` +
        `them on in the final image: headlights lit with a realistic white/blue-white glow, taillights and brake ` +
        `lights lit with a realistic red glow, with soft, physically accurate light spill onto the ground and ` +
        `surrounding surfaces — the way dealerships often light a car for a listing photo to make it look more ` +
        `appealing. Only change whether the lights are illuminated — every lens, housing, and light fixture must ` +
        `stay exactly as it is on the real vehicle.`,
    );
  }

  if (settings.enhanceQuality) {
    sections.push(
      `Improve overall image quality: resolution and sharpness enhancement, sensible noise reduction, detail ` +
        `recovery, lens-quality correction, highlight and shadow recovery, dynamic-range enhancement, natural ` +
        `contrast, accurate white balance, exposure correction, and color correction. Target quality level ` +
        `about ${settings.imageQuality}/100. Avoid excessive HDR, oversharpening, artificial clarity, plastic-` +
        `looking paint, fake reflections, haloing, excessive saturation, or cartoon-like processing.`,
    );
  }

  if (settings.professionalCameraLook) {
    sections.push(
      `Make the final image look like it was shot by a professional automotive photographer on a high-end ` +
        `full-frame camera: excellent dynamic range, sharp vehicle detail across the whole car (not a shallow ` +
        `depth-of-field effect — the entire vehicle should stay in focus), controlled highlights, clean ` +
        `shadows, realistic paint reflections, natural contrast, and accurate color, roughly consistent with ` +
        `an f/4-f/5.6 aperture, ISO 100-200, and a 35-70mm full-frame-equivalent focal length.`,
    );
  }

  if (settings.cinematicGrade) {
    sections.push(
      `Apply a VERY subtle cinematic color grade at about ${settings.cinematicIntensity}% intensity (this is ` +
        `usually meant to be small, roughly 10-20%): slightly richer contrast, controlled highlights, slightly ` +
        `deeper and richer blacks, subtle film-like tonal response, and slightly refined color separation, ` +
        `without changing the vehicle's actual paint color. If the effect would read as an obvious "filter", ` +
        `pull it back — this should still look like a real, unfiltered dealership listing photo, just a ` +
        `little more visually appealing.`,
    );
  }

  sections.push(
    `Before finishing, verify: the vehicle is still unmistakably the same vehicle, its color is unchanged, its ` +
      `proportions are correct, it sits naturally on the ground with no floating tires, the lighting matches ` +
      `between vehicle and background, shadows look real, no license plate is still readable if removal was ` +
      `requested, wheels/tires aren't distorted, and windows/mirrors/badges/body panels are all intact. The ` +
      `result should look like a real photograph, not an AI generation, and the vehicle is always the source ` +
      `of truth — when in doubt, change the environment and photo quality, never the vehicle.`,
  );

  return sections.join("\n\n");
}

export async function editVehiclePhoto(
  imageBuffer: Buffer,
  mimeType: string | null,
  settings: VehiclePhotoEditSettings,
): Promise<PhotoEditResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY is not set — add it to .env.local to enable AI photo editing." };
  }
  if (!mimeType || !SUPPORTED_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: `Unsupported image type "${mimeType ?? "unknown"}" — upload a PNG, JPEG, or WebP.` };
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildEditPrompt(settings);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, { inlineData: { data: imageBuffer.toString("base64"), mimeType } }],
        },
      ],
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      const textPart = parts.find((p) => p.text)?.text;
      return { ok: false, error: textPart || "The model didn't return an edited image — try again." };
    }

    return {
      ok: true,
      imageBuffer: Buffer.from(imagePart.inlineData.data, "base64"),
      mimeType: imagePart.inlineData.mimeType || "image/png",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Photo editing failed: ${message}` };
  }
}
