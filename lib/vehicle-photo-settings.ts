import type { VehiclePhotoEditSettings, vehiclePhotoBackgroundValues } from "@/schema-sketch/schema";

// A hard cap, not just a soft nudge — enforced both client-side (instant
// feedback, no wasted upload bandwidth) and server-side in
// uploadVehiclePhotos (the real guard, since a client check alone is only
// a courtesy). Nine keeps a listing's gallery tight without cutting off a
// legitimate multi-angle shoot.
export const MAX_VEHICLE_PHOTOS = 9;

export const BACKGROUND_LABELS: Record<(typeof vehiclePhotoBackgroundValues)[number], string> = {
  grass_lot: "Grass lot",
  paved_lot_wall: "Paved lot + wall",
  sunset_sky: "Sunset sky",
  houston_skyline: "Houston skyline",
  lakeside: "Lakeside",
  studio_gradient: "Studio backdrop",
};

// Lives outside app/inventory/photo-actions.ts on purpose: a "use server"
// file may only export async server actions, and this constant needs to
// be importable from client components (the edit panel seeds its form
// state from it) as well as from the server action itself.
export const DEFAULT_EDIT_SETTINGS: VehiclePhotoEditSettings = {
  preserveOriginalBackground: false,
  background: "grass_lot",
  enhanceQuality: true,
  removeLicensePlate: true,
  professionalCameraLook: true,
  cinematicGrade: true,
  cinematicIntensity: 15,
  backgroundRealism: 80,
  imageQuality: 80,
  turnOnVehicleLights: false,
};
