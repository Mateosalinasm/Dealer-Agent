// Minimal defensive CSV parser: handles quoted fields (with escaped "" and
// embedded commas/newlines), tolerates ragged rows, and never throws on bad
// input — it returns what it could read plus a list of problems so the
// caller can show them instead of silently dropping rows.

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  errors: string[];
}

export function parseCsv(text: string): ParsedCsv {
  const errors: string[] = [];
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  function endField() {
    row.push(field);
    field = "";
  }
  function endRow() {
    endField();
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
  }

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      endField();
      i += 1;
      continue;
    }
    if (char === "\r") {
      i += 1;
      continue;
    }
    if (char === "\n") {
      endRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) endRow();

  if (inQuotes) errors.push("File ended inside a quoted field — last row may be truncated.");
  if (rows.length === 0) {
    errors.push("No rows found in the file.");
    return { headers: [], rows: [], errors };
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => h.trim());

  dataRows.forEach((r, idx) => {
    if (r.length !== headers.length) {
      errors.push(
        `Row ${idx + 2} has ${r.length} column${r.length === 1 ? "" : "s"}, expected ${headers.length} — check it manually.`,
      );
    }
  });

  return { headers, rows: dataRows, errors };
}

const HEADER_ALIASES: Record<string, string[]> = {
  stockNumber: ["stock", "stock #", "stock number", "stocknumber", "stock no"],
  vin: ["vin", "vin#", "vin #"],
  year: ["year", "yr"],
  make: ["make"],
  model: ["model"],
  trim: ["trim"],
  color: ["color", "colour", "exterior color", "ext color", "ext. color"],
  bodyType: ["body", "body type", "bodytype", "body style"],
  miles: ["miles", "mileage", "odometer"],
  askingPriceDollars: ["price", "asking price", "list price", "asking", "askingprice"],
  // "TotalCostForUI" is the all-in landed cost a dealer-management-system
  // export shows the user in its UI — "VehicleCost" in the same export is a
  // different, narrower figure and must never match here (see importVehicles).
  costDollars: ["cost", "hammer", "hammer price", "purchase price", "buy price", "cost paid", "acquisition cost", "paid", "totalcostforui", "total cost"],
  acquiredOn: ["in stock since", "in stock date", "date in stock", "acquired", "acquired on", "in-service date"],
  // Not part of VehicleImportRow — read separately by the importer to
  // derive year/make/model (vehicleInfo, e.g. "2014 RAM 1500 CREW CAB...")
  // and acquiredOn (daysInStock, converted to a date) when a file has no
  // dedicated columns for those.
  vehicleInfo: ["vehicle info", "vehicleinfo", "description", "vehicle description", "vehicle"],
  daysInStock: ["days in stock", "daysinstock", "days on lot", "age", "days"],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, " ");
}

export function mapHeaders(headers: string[]): Record<string, number> {
  const normalized = headers.map(normalizeHeader);
  const map: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx !== -1) map[field] = idx;
  }
  return map;
}

// A single free-text "vehicle info" column (e.g. "2014 RAM 1500 CREW CAB
// LONE STAR PICKUP 4D 5 1/2 FT") in place of separate year/make/model
// columns — leading 4-digit year, next token the make, everything after
// is the model (trim isn't reliably separable from this shape, so it's
// left for the operator to fill in if they care).
export function parseVehicleInfo(text: string): { year?: number; make?: string; model?: string } {
  const trimmed = text.trim();
  const match = trimmed.match(/^(\d{4})\s+(\S+)\s+(.+)$/);
  if (!match) return {};
  const year = Number(match[1]);
  if (year < 1900 || year > 2100) return {};
  return { year, make: match[2], model: match[3].trim() || undefined };
}
