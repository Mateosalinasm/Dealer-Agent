// Infers body type / diesel / three-row-SUV from a vehicle's make+model
// (+trim) text — used to fill in categorization the operator's stock list
// never provides (the DMS export this app was built against has no
// BodyType/FuelType columns of its own) rather than leaving every import
// uncategorized. A DMS "VehicleInfo" style string already carries the real
// signal verbatim most of the time (e.g. "SPORT UTILITY", "CREW CAB",
// "SUPER DUTY", "SEDAN"), which parseVehicleInfo (lib/csv.ts) dumps
// straight into the model field for this data — so those phrases are
// checked first, ahead of a make/model keyword fallback for sources that
// only give a bare model name like "Civic" or "1500".
//
// This is a best-effort heuristic, not a fact — especially fuelType, which
// only ever suggests "diesel" for heavy-duty truck signals and is always
// safe to correct by hand afterward (see components/edit-vehicle-modal.tsx).

export interface VehicleClassification {
  bodyType: "truck" | "sedan" | "suv" | null;
  fuelType: "diesel" | null;
  isThreeRowSuv: boolean;
}

const THREE_ROW_SUV_SIGNAL =
  /TAHOE|SUBURBAN|YUKON|EXPEDITION|EXCURSION|DURANGO|TELLURIDE|PALISADE|ATLAS|TRAVERSE|HIGHLANDER|PILOT|SEQUOIA|ARMADA|ENCLAVE|PATHFINDER|EXPLORER|QX80/;

const HEAVY_DUTY_DIESEL_SIGNAL = /SUPER DUTY|DURAMAX|POWERSTROKE|CUMMINS|F-?250|F-?350|F-?450|F-?550|\d{4}\s*HD/;

const TRUCK_BODY_STYLE_SIGNAL = /PICKUP|CREW CAB|SUPER DUTY|CHASSIS\s*&\s*CAB|REGULAR CAB|EXTENDED CAB|KING CAB|QUAD CAB|MEGA CAB/;
const SUV_BODY_STYLE_SIGNAL = /SPORT UTILITY/;
const SEDAN_BODY_STYLE_SIGNAL = /\bSEDAN\b|\bCOUPE\b/;

const TRUCK_MODEL_SIGNAL =
  /F-?150|F-?250|F-?350|F-?450|SILVERADO|SIERRA|TUNDRA|TITAN|RANGER|COLORADO|CANYON|FRONTIER|TACOMA|RIDGELINE|MAVERICK|GLADIATOR/;
const SUV_MODEL_SIGNAL =
  /TAHOE|SUBURBAN|YUKON|EXPEDITION|EXCURSION|DURANGO|TELLURIDE|PALISADE|ATLAS|TRAVERSE|HIGHLANDER|PILOT|SEQUOIA|ARMADA|ENCLAVE|PATHFINDER|EXPLORER|QX80|RAV4|CR-?V|ROGUE|EQUINOX|ESCAPE|TUCSON|SPORTAGE|CX-?5|FORESTER|OUTBACK|WRANGLER|BRONCO|4RUNNER/;
const SEDAN_MODEL_SIGNAL =
  /CIVIC|ACCORD|CAMRY|COROLLA|ALTIMA|SENTRA|MALIBU|IMPALA|CHARGER|CHALLENGER|MUSTANG|OPTIMA|ELANTRA|SONATA|JETTA|PASSAT|FUSION|TAURUS/;

export function classifyVehicle(make: string | null, model: string | null, trim: string | null): VehicleClassification {
  const text = `${make ?? ""} ${model ?? ""} ${trim ?? ""}`.toUpperCase();

  let bodyType: VehicleClassification["bodyType"] = null;
  if (SUV_BODY_STYLE_SIGNAL.test(text)) bodyType = "suv";
  else if (TRUCK_BODY_STYLE_SIGNAL.test(text)) bodyType = "truck";
  else if (SEDAN_BODY_STYLE_SIGNAL.test(text)) bodyType = "sedan";
  else if (/^RAM\b/.test(text) && /1500|2500|3500/.test(text)) bodyType = "truck";
  else if (TRUCK_MODEL_SIGNAL.test(text)) bodyType = "truck";
  else if (SUV_MODEL_SIGNAL.test(text)) bodyType = "suv";
  else if (SEDAN_MODEL_SIGNAL.test(text)) bodyType = "sedan";

  const isThreeRowSuv = bodyType === "suv" && THREE_ROW_SUV_SIGNAL.test(text);

  const isHeavyDutyTruck =
    bodyType === "truck" && (HEAVY_DUTY_DIESEL_SIGNAL.test(text) || (/^RAM\b/.test(text) && /2500|3500/.test(text)));
  const fuelType: VehicleClassification["fuelType"] = isHeavyDutyTruck ? "diesel" : null;

  return { bodyType, fuelType, isThreeRowSuv };
}
