// Defensive parser for a pasted auction run list. Real sale sheets are
// hostile: copied out of a browser table (tab-delimited), exported as CSV
// (comma-delimited), ragged rows, inconsistent headers. Never drop a row
// silently — anything that doesn't parse cleanly is surfaced as an error
// string so the operator can see it and fix it by hand.

import { parseCsv } from "./csv";

export interface RunListRow {
  runNumber: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  vin: string;
  miles: string;
  announcements: string;
}

export interface ParsedRunList {
  rows: RunListRow[];
  errors: string[];
}

const HEADER_ALIASES: Record<keyof RunListRow, string[]> = {
  runNumber: ["run", "run #", "run number", "lot", "lot #", "lot number"],
  year: ["year", "yr"],
  make: ["make"],
  model: ["model"],
  trim: ["trim", "series"],
  vin: ["vin", "vin#", "vin #"],
  miles: ["miles", "mileage", "odometer"],
  announcements: ["announcements", "condition", "notes", "arb", "damage", "grade"],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, " ");
}

function splitTabDelimited(text: string): { headers: string[]; rows: string[][]; errors: string[] } {
  const errors: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l)
    .filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [], errors: ["No rows found in the pasted text."] };

  const headers = lines[0].split("\t").map((h) => h.trim());
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split("\t");
    if (cells.length !== headers.length) {
      errors.push(`Row ${i + 1} has ${cells.length} column(s), expected ${headers.length} — check it manually.`);
    }
    rows.push(cells);
  }
  return { headers, rows, errors };
}

export function parseRunList(text: string): ParsedRunList {
  if (!text.trim()) return { rows: [], errors: ["Nothing pasted yet."] };

  const looksTabDelimited = text.split(/\r?\n/, 2)[0]?.includes("\t");
  const { headers, rows, errors } = looksTabDelimited ? splitTabDelimited(text) : parseCsv(text);

  const normalized = headers.map(normalizeHeader);
  const fieldIndex: Partial<Record<keyof RunListRow, number>> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [keyof RunListRow, string[]][]) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx !== -1) fieldIndex[field] = idx;
  }

  const missingCore = (["make", "model"] as const).filter((f) => fieldIndex[f] === undefined);
  if (missingCore.length > 0) {
    errors.push(
      `Couldn't find a column for: ${missingCore.join(", ")}. Every row will need those filled in by hand below.`,
    );
  }

  const parsedRows: RunListRow[] = rows.map((cells) => {
    const get = (field: keyof RunListRow) => {
      const idx = fieldIndex[field];
      return idx != null && idx < cells.length ? (cells[idx] ?? "").trim() : "";
    };
    return {
      runNumber: get("runNumber"),
      year: get("year"),
      make: get("make"),
      model: get("model"),
      trim: get("trim"),
      vin: get("vin"),
      miles: get("miles").replace(/[^0-9]/g, ""),
      announcements: get("announcements"),
    };
  });

  return { rows: parsedRows, errors };
}
