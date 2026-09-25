import type { VehiclePhotoEditSettings } from "@/schema-sketch/schema";

// Lives outside app/inventory/photo-actions.ts on purpose: a "use server"
// file may only export async server actions, and this constant needs to
// be importable from client components (the edit panel seeds its form
// state from it) as well as from the server action itself.
export const DEFAULT_EDIT_SETTINGS: VehiclePhotoEditSettings = {
  preserveOriginalBackground: false,
  enhanceQuality: true,
  removeLicensePlate: true,
  professionalCameraLook: true,
  cinematicGrade: true,
  cinematicIntensity: 15,
  backgroundRealism: 80,
  imageQuality: 80,
};
