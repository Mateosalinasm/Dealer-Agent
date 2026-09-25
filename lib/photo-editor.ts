import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { VehiclePhotoEditSettings } from "@/schema-sketch/schema";

const MODEL = "gemini-2.5-flash-image";

const SUPPORTED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

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
    sections.push(
      `Detect and isolate the vehicle from its original background. Replace the background with a realistic, ` +
        `professional empty grass lot suitable for a dealership: clean well-maintained grass, open space, no ` +
        `other vehicles, no people, no buildings (unless extremely subtle and distant), no dealership signs, ` +
        `no distracting objects, a natural horizon, and realistic perspective. Match the original photo's ` +
        `perspective, lighting direction, camera angle, and approximate time of day — if it was shot in ` +
        `sunlight, use a sunny lot and match the sun direction and shadow direction; if overcast, use soft ` +
        `overcast lighting with no hard artificial shadows; if near sunset, use warm but realistic light. The ` +
        `vehicle must look physically present in the new environment, not pasted on: generate realistic ` +
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
